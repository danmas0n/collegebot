import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { WizardStage, WizardData, WizardContextType, Student } from '../types/wizard';
import { api } from '../utils/api';

const stages: WizardStage[] = [
  'student-selection',
  'student-profile',
  'college-interests',
  'budget',
  'data-collection',
  'recommendations',
  'map'
];

const initialData: WizardData = {
  studentProfile: {},
  collegeInterests: {},
  budgetInfo: {}
};

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStage, setCurrentStage] = useState<WizardStage>('student-selection');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [data, setData] = useState<WizardData>(initialData);

  // Load students on mount
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const response = await api.get('/api/students');
        const loadedStudents = await response.json();
        setStudents(loadedStudents);
      } catch (error) {
        console.error('Error loading students:', error);
      }
    };

    loadStudents();
  }, []);

  const goToStage = useCallback((stage: WizardStage) => {
    setCurrentStage(stage);
  }, []);

  const updateData = useCallback(async (updates: Partial<WizardData>) => {
    setData(prev => {
      const newData = {
        ...prev,
        ...updates
      };
      
      if (currentStudent) {
        const updatedStudent = {
          ...currentStudent,
          data: newData,
          lastUpdated: new Date().toISOString()
        };

        // Update local state
        setStudents(prev => prev.map(student => 
          student.id === currentStudent.id ? updatedStudent : student
        ));

        // Persist to server
        api.post('/api/students', {
          student: updatedStudent
        }).catch(error => {
          console.error('Error saving student data:', error);
        });
      }
      
      return newData;
    });
  }, [currentStudent]);

  const findFirstIncompleteStage = useCallback((studentData: WizardData): WizardStage => {
    // Check each stage's requirements
    if (!studentData.studentProfile.graduationYear || !studentData.studentProfile.highSchool) {
      return 'student-profile';
    }
    if (!studentData.collegeInterests.colleges?.length && !studentData.collegeInterests.majors?.length) {
      return 'college-interests';
    }
    if (!studentData.budgetInfo.yearlyBudget) {
      return 'budget';
    }
    if (!studentData.dataCollection?.status || studentData.dataCollection.status !== 'complete') {
      return 'data-collection';
    }
    // If all stages are complete, go to recommendations
    return 'recommendations';
  }, []);

  const selectStudent = useCallback(async (student: Student) => {
    try {
      setCurrentStudent(student);
      setData(student.data);
      const firstIncompleteStage = findFirstIncompleteStage(student.data);
      setCurrentStage(firstIncompleteStage);

      // Load student's chats
      const response = await api.post('/api/chat/claude/chats', { studentId: student.id });
      
      if (!response.ok) {
        console.error('Failed to load chats:', await response.text());
      }
    } catch (error) {
      console.error('Error selecting student:', error);
      // Still set the student even if chat loading fails
      setCurrentStudent(student);
      setData(student.data);
      setCurrentStage(findFirstIncompleteStage(student.data));
    }
  }, [findFirstIncompleteStage]);

  const createStudent = useCallback(async (name: string) => {
    const newStudent: Student = {
      id: crypto.randomUUID(),
      name,
      lastUpdated: new Date().toISOString(),
      data: initialData
    };

    try {
      await api.post('/api/students', { student: newStudent });

      // Only update state if the save was successful
      setStudents(prev => [...prev, newStudent]);
      selectStudent(newStudent);
    } catch (error) {
      console.error('Error creating student:', error);
      throw error; // Re-throw to be handled by the UI
    }
  }, [selectStudent]);

  const deleteStudent = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/students/${id}`);

      setStudents(prev => prev.filter(student => student.id !== id));
      if (currentStudent?.id === id) {
        setCurrentStudent(null);
        setData(initialData);
        setCurrentStage('student-selection');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  }, [currentStudent]);

  const canProceed = useCallback(() => {
    switch (currentStage) {
      case 'student-selection':
        return !!currentStudent;
      case 'student-profile':
        return !!(data.studentProfile.graduationYear && data.studentProfile.highSchool);
      case 'college-interests':
        return !!(data.collegeInterests.colleges?.length || data.collegeInterests.majors?.length);
      case 'budget':
        return !!data.budgetInfo.yearlyBudget;
      case 'data-collection':
        return data.dataCollection?.status === 'complete';
      case 'recommendations':
        return true;
      case 'map':
        return true;
      default:
        return false;
    }
  }, [currentStage, currentStudent, data]);

  const nextStage = useCallback(() => {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1 && canProceed()) {
      setCurrentStage(stages[currentIndex + 1]);
    }
  }, [currentStage, canProceed]);

  const previousStage = useCallback(() => {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex > 0) {
      setCurrentStage(stages[currentIndex - 1]);
    }
  }, [currentStage]);

  return (
    <WizardContext.Provider
      value={{
        currentStage,
        currentStudent,
        students,
        data,
        goToStage,
        updateData,
        selectStudent,
        createStudent,
        deleteStudent,
        canProceed: canProceed(),
        nextStage,
        previousStage
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

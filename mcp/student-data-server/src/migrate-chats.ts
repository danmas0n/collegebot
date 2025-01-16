#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'thinking';
  content: string;
  toolData?: string;
  timestamp: string;
}

interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  studentId: string;
}

interface Student {
  id: string;
  name: string;
  lastUpdated: string;
  data: {
    recommendations?: {
      colleges: Array<{
        name: string;
        reason: string;
        fitScore: number;
      }>;
      scholarships?: Array<{
        name: string;
        amount: number;
        deadline: string;
        eligibility: string;
      }>;
      chats?: Chat[];
    };
    // ... other fields omitted for brevity
  };
}

async function migrateChats() {
  const basePath = path.join(process.env.HOME || '', '.collegebot');
  const studentsPath = path.join(basePath, 'students.json');
  const chatsPath = path.join(basePath, 'chats.json');
  const backupPath = path.join(basePath, 'students.backup.json');

  try {
    // Create backup of students file
    console.log('Creating backup of students data...');
    await fs.copyFile(studentsPath, backupPath);
    console.log('Backup created at:', backupPath);

    // Read existing data
    console.log('Reading student data...');
    const studentsData = JSON.parse(await fs.readFile(studentsPath, 'utf-8'));
    let chatsData = { chats: [] as Chat[] };
    try {
      chatsData = JSON.parse(await fs.readFile(chatsPath, 'utf-8'));
      console.log('Found existing chats file');
    } catch {
      console.log('No existing chats file found, will create new one');
    }

    // Extract chats from students
    const students = studentsData.students as Student[];
    let migratedChatsCount = 0;
    let studentsWithChatsCount = 0;

    console.log(`Processing ${students.length} students...`);
    for (const student of students) {
      const chats = student.data.recommendations?.chats || [];
      if (chats.length > 0) {
        studentsWithChatsCount++;
        for (const chat of chats) {
          // Add studentId to chat if not present
          const chatWithStudent: Chat = {
            ...chat,
            studentId: student.id
          };
          chatsData.chats.push(chatWithStudent);
          migratedChatsCount++;
        }

        // Remove chats from student data
        if (student.data.recommendations?.chats) {
          delete student.data.recommendations.chats;
        }
      }
    }

    // Write updated data
    console.log('Writing updated data...');
    await fs.writeFile(studentsPath, JSON.stringify(studentsData, null, 2));
    await fs.writeFile(chatsPath, JSON.stringify(chatsData, null, 2));

    console.log(`
Migration complete:
- Migrated ${migratedChatsCount} chats from ${studentsWithChatsCount} students
- Updated ${students.length} total students
- Chats moved to: ${chatsPath}
- Backup saved to: ${backupPath}
    `);

  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Attempting to restore from backup...');
    try {
      await fs.copyFile(backupPath, studentsPath);
      console.log('Successfully restored from backup');
    } catch (restoreError) {
      console.error('Failed to restore from backup:', restoreError);
    }
    process.exit(1);
  }
}

migrateChats().catch(console.error);

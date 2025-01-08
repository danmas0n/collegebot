import { generateToolInstructions, generateBasePrompt } from './base.js';

export const generatePrompt = (studentName, studentData) => {
  return generateBasePrompt(studentName, studentData);
};

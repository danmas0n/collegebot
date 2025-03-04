import { db } from '../config/firebase';
import { ResearchTask, ResearchFinding, Chat } from '../types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { executeMcpTool } from './mcp.js';
import { toolServerMap } from '../config/mcp-tools.js';

interface AIResearchTask {
  type: 'college' | 'scholarship';
  name: string;
  findings: Array<{
    detail: string;
    category: 'deadline' | 'requirement' | 'contact' | 'financial' | 'other';
    confidence: 'high' | 'medium' | 'low';
    source?: string;
  }>;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export class ResearchService {
  private static instance: ResearchService;
  private activeTasks: Map<string, boolean> = new Map();

  private constructor() {}

  static getInstance(): ResearchService {
    if (!ResearchService.instance) {
      ResearchService.instance = new ResearchService();
    }
    return ResearchService.instance;
  }

  async startTask(task: Omit<ResearchTask, 'id' | 'createdAt' | 'updatedAt' | 'findings' | 'status' | 'progress' | 'currentOperation'>) {
    const docRef = await db.collection('research_tasks').add({
      ...task,
      findings: [],
      status: 'queued' as const,
      progress: 0,
      currentOperation: 'Initializing',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const taskId = docRef.id;
    this.processTask(taskId);
    return taskId;
  }

  private async processTask(taskId: string) {
    if (this.activeTasks.get(taskId)) {
      return; // Task is already being processed
    }

    this.activeTasks.set(taskId, true);

    try {
      const taskRef = db.collection('research_tasks').doc(taskId);
      const task = await taskRef.get();
      const taskData = task.data() as ResearchTask;

      if (!taskData || taskData.status === 'complete') {
        this.activeTasks.delete(taskId);
        return;
      }

      // Update status to in-progress
      await taskRef.update({
        'status': 'in-progress',
        'progress': 10,
        'currentOperation': 'Gathering information',
        'updatedAt': Timestamp.now()
      });

      // Use web search to find relevant information
      const searchResults = await this.searchForEntity(taskData);
      await taskRef.update({
        'progress': 30,
        'currentOperation': 'Analyzing search results',
        'updatedAt': Timestamp.now()
      });

      // Process search results
      const findings = await this.processSearchResults(searchResults, taskData);
      await taskRef.update({
        'findings': [...(taskData.findings || []), ...findings],
        'progress': 90,
        'currentOperation': 'Finalizing research',
        'updatedAt': Timestamp.now()
      });

      // Mark task as complete
      await taskRef.update({
        'status': 'complete',
        'progress': 100,
        'currentOperation': 'Research complete',
        'updatedAt': Timestamp.now()
      });
    } catch (error) {
      console.error(`Error processing research task ${taskId}:`, error);
      const taskRef = db.collection('research_tasks').doc(taskId);
      await taskRef.update({
        'status': 'complete',
        'progress': 100,
        'currentOperation': `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'updatedAt': Timestamp.now()
      });
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private async searchForEntity(task: ResearchTask): Promise<SearchResult[]> {
    const searchServer = toolServerMap['search_college_data'];
    if (!searchServer) {
      throw new Error('Web search tool not available');
    }

    let query = `${task.entityName} `;
    if (task.entityType === 'college') {
      query += 'admissions requirements deadlines scholarships';
    } else {
      query += 'scholarship requirements deadlines application process';
    }

    const searchResult = await executeMcpTool(searchServer, 'search_college_data', { query: query });

    if (!searchResult?.content?.[0]?.text) {
      return [];
    }

    const text = searchResult?.content?.[0]?.text;
    if (!text || typeof text !== 'string') {
      return [];
    }
    const parsed = JSON.parse(text);
    return parsed.results.map((r: any) => ({
      title: r.title,
      link: r.url,
      snippet: r.description
    }));
  }

  private async processSearchResults(results: SearchResult[], task: ResearchTask): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    const processedUrls = new Set<string>();

    for (const result of results) {
      if (processedUrls.has(result.link)) continue;
      processedUrls.add(result.link);

      try {
        const fetchServer = toolServerMap['fetch'];
        if (!fetchServer) {
          throw new Error('Fetch tool not available');
        }

        const fetchResult = await executeMcpTool(fetchServer, 'fetch', {
          url: result.link,
          max_length: 10000,
          raw: false,
          start_index: 0
        });

        if (!fetchResult?.content?.[0]?.text) continue;

        const content = fetchResult.content[0].text as string;
        
        // Extract deadlines
        const deadlineMatches = content.match(/\b(?:deadline|due date|due by)\b[^.!?]*?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/gi) || [];
        if (deadlineMatches) {
          for (const match of deadlineMatches) {
            findings.push({
              detail: match.trim(),
              category: 'deadline',
              confidence: 'medium',
              source: result.link,
              timestamp: Timestamp.now()
            });
          }
        }

        // Extract requirements
        const requirementMatches = content.match(/(?:required|requirement|must|minimum)[^.!?]*?(?:\d+|\$[0-9,]+|GPA|test|score|essay|recommendation)[^.!?]*/gi) || [];
        if (requirementMatches) {
          for (const match of requirementMatches) {
            findings.push({
              detail: match.trim(),
              category: 'requirement',
              confidence: 'medium',
              source: result.link,
              timestamp: Timestamp.now()
            });
          }
        }

        // Extract contact information
        const contactMatches = content.match(/(?:contact|email|phone|fax)[^.!?]*?(?:@|\d{3}[-.)]\d{3}[-.)]\d{4}|\(\d{3}\)\s*\d{3}[-.)]\d{4})[^.!?]*/gi) || [];
        if (contactMatches) {
          for (const match of contactMatches) {
            findings.push({
              detail: match.trim(),
              category: 'contact',
              confidence: 'high',
              source: result.link,
              timestamp: Timestamp.now()
            });
          }
        }

        // Extract financial information
        const financialMatches = content.match(/(?:tuition|cost|fee|award|scholarship|grant|financial aid)[^.!?]*?(?:\$[0-9,]+|percent|%|\d+,\d+)[^.!?]*/gi) || [];
        if (financialMatches) {
          for (const match of financialMatches) {
            findings.push({
              detail: match.trim(),
              category: 'financial',
              confidence: 'medium',
              source: result.link,
              timestamp: Timestamp.now()
            });
          }
        }
      } catch (error) {
        console.error(`Error processing search result ${result.link}:`, error);
        continue;
      }
    }

    return findings;
  }

  async getTasks(studentId: string): Promise<ResearchTask[]> {
    const snapshot = await db.collection('research_tasks')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ResearchTask[];
  }

  async getTask(taskId: string): Promise<ResearchTask | null> {
    const doc = await db.collection('research_tasks').doc(taskId).get();
    if (!doc.exists) return null;
    return {
      id: doc.id,
      ...doc.data()
    } as ResearchTask;
  }

  async addFinding(taskId: string, finding: Omit<ResearchFinding, 'timestamp'>) {
    const taskRef = db.collection('research_tasks').doc(taskId);
    const task = await taskRef.get();

    if (!task.exists) {
      throw new Error('Task not found');
    }

    const taskData = task.data() as ResearchTask;
    const newFinding: ResearchFinding = {
      ...finding,
      timestamp: Timestamp.now()
    };

    await taskRef.update({
      'findings': [...(taskData.findings || []), newFinding],
      'updatedAt': Timestamp.now()
    });

    return newFinding;
  }

  async updateTask(taskId: string, updates: Partial<ResearchTask>) {
    const taskRef = db.collection('research_tasks').doc(taskId);
    await taskRef.update({
      ...updates,
      'updatedAt': Timestamp.now()
    });
  }

  async deleteTask(taskId: string) {
    await db.collection('research_tasks').doc(taskId).delete();
  }
}

export const researchService = ResearchService.getInstance();

export async function processChat(chat: Chat, studentId: string, userId: string): Promise<string[]> {
  // Extract research task IDs from chat messages
  const taskIds: string[] = [];
  
  for (const message of chat.messages) {
    if (message.role === 'answer') {
      const taskRegex = /\[RESEARCH_TASK\]\s*({[\s\S]*?})\s*\[\/RESEARCH_TASK\]/g;
      let match;
      
      while ((match = taskRegex.exec(message.content)) !== null) {
        try {
          const taskJson = match[1];
          const task = JSON.parse(taskJson) as AIResearchTask;
          
          // Create research task
          const taskId = await researchService.startTask({
            studentId,
            userId,
            entityType: task.type,
            entityId: `${task.type}-${Date.now()}`,
            entityName: task.name
          });

          // Add findings after task creation
          for (const finding of task.findings) {
            await researchService.addFinding(taskId, {
              detail: finding.detail,
              category: finding.category,
              confidence: finding.confidence,
              source: finding.source
            });
          }
          
          taskIds.push(taskId);
        } catch (error) {
          console.error('Error processing research task:', error);
        }
      }
    }
  }
  
  return taskIds;
}

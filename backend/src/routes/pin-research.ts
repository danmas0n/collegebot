import express, { Request, Response } from 'express';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import { AIServiceFactory, AIService } from '../services/ai-service-factory';

const router = express.Router();

// Get all research requests for a student
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    const requestsRef = db.collection('pin-research-requests')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc');
    
    const snapshot = await requestsRef.get();
    
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({ requests });
  } catch (error) {
    console.error('Error getting research requests:', error);
    return res.status(500).json({ error: 'Failed to get research requests' });
  }
});

// Get a specific research request
router.get('/request/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }
    
    const requestRef = db.collection('pin-research-requests').doc(requestId);
    const doc = await requestRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Research request not found' });
    }
    
    const request = {
      id: doc.id,
      ...doc.data()
    };
    
    return res.status(200).json(request);
  } catch (error) {
    console.error('Error getting research request:', error);
    return res.status(500).json({ error: 'Failed to get research request' });
  }
});

// Create a new research request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { studentId, pinIds } = req.body;
    
    if (!studentId || !pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      return res.status(400).json({ error: 'Student ID and pin IDs are required' });
    }
    
    // Get the student data
    const studentRef = db.collection('students').doc(studentId);
    const studentDoc = await studentRef.get();
    
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get the map locations for the pins
    const locationsRef = db.collection('map-locations')
      .where('studentId', '==', studentId)
      .where('id', 'in', pinIds);
    
    const locationsSnapshot = await locationsRef.get();
    
    if (locationsSnapshot.empty) {
      return res.status(404).json({ error: 'No locations found for the provided pin IDs' });
    }
    
    const locations = locationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Create the research request
    const newRequest = {
      id: uuidv4(),
      studentId,
      pinIds,
      status: 'pending',
      progress: 0,
      findings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('pin-research-requests').doc(newRequest.id).set(newRequest);
    
    // Start the research process asynchronously
    startResearch(newRequest.id, studentId, locations);
    
    return res.status(201).json(newRequest);
  } catch (error) {
    console.error('Error creating research request:', error);
    return res.status(500).json({ error: 'Failed to create research request' });
  }
});

// Helper function to start the research process
async function startResearch(requestId: string, studentId: string, locations: any[]) {
  try {
    // Update the request status to in-progress
    await db.collection('pin-research-requests').doc(requestId).update({
      status: 'in-progress',
      updatedAt: new Date().toISOString()
    });
    
    const aiService = await AIServiceFactory.createService(studentId);
    const findings = [];
    
    // Process each location
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      
      // Update progress
      const progress = Math.round(((i + 1) / locations.length) * 100);
      await db.collection('pin-research-requests').doc(requestId).update({
        progress,
        updatedAt: new Date().toISOString()
      });
      
      // Skip if not a college
      if (location.type !== 'college') {
        findings.push({
          pinId: location.id,
          deadlines: [],
          requirements: []
        });
        continue;
      }
      
      // Research the college
      const prompt = `
        I need you to research the following college and extract key deadlines and requirements:
        
        College Name: ${location.name}
        
        Please provide:
        1. Application deadlines (regular, early action, early decision, etc.)
        2. Financial aid deadlines
        3. Scholarship deadlines
        4. Housing application deadlines
        5. Athletic recruitment opportunities and deadlines
        6. Any other important deadlines
        7. Application requirements (essays, recommendations, tests, etc.)
        8. Athletic program information (if applicable)
        
        Format your response as JSON with the following structure:
        {
          "deadlines": [
            {
              "date": "YYYY-MM-DD",
              "description": "Description of the deadline",
              "source": "Source of information (optional)"
            }
          ],
          "requirements": [
            {
              "description": "Description of the requirement",
              "source": "Source of information (optional)"
            }
          ]
        }
      `;
      
      try {
        // Create a message array with just the prompt
        const messages = [
          {
            role: 'user' as const,
            content: prompt
          }
        ];
        
        // Use a simple system prompt
        const systemPrompt = "You are a helpful assistant that researches college information. Respond with JSON only.";
        
        // Use a dummy SSE function since we don't need streaming
        const sendSSE = () => {};
        
        // Process the message
        const result = await aiService.processSingleStream(messages, systemPrompt, sendSSE);
        
        // Extract the response from the messages
        const responseMessage = result.messages.find(msg => msg.role === 'answer' || msg.role === 'assistant');
        const response = responseMessage ? responseMessage.content : '';
        
        // Parse the response as JSON
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/```\n([\s\S]*?)\n```/) || 
                          response.match(/({[\s\S]*})/);
        
        let researchData;
        if (jsonMatch && jsonMatch[1]) {
          researchData = JSON.parse(jsonMatch[1]);
        } else {
          // Try to parse the entire response as JSON
          try {
            researchData = JSON.parse(response);
          } catch (e) {
            console.error('Failed to parse AI response as JSON:', e);
            researchData = {
              deadlines: [],
              requirements: []
            };
          }
        }
        
        // Add the finding
        findings.push({
          pinId: location.id,
          deadlines: researchData.deadlines || [],
          requirements: researchData.requirements || []
        });
      } catch (err) {
        console.error(`Error researching ${location.name}:`, err);
        
        // Add an empty finding
        findings.push({
          pinId: location.id,
          deadlines: [],
          requirements: []
        });
      }
    }
    
    // Update the request with the findings and mark as complete
    await db.collection('pin-research-requests').doc(requestId).update({
      status: 'complete',
      progress: 100,
      findings,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in research process:', error);
    
    // Mark the request as error
    await db.collection('pin-research-requests').doc(requestId).update({
      status: 'error',
      updatedAt: new Date().toISOString()
    });
  }
}

export default router;

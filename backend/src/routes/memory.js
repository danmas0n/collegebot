import express from 'express';
import { executeMcpTool } from '../utils/mcp.js';

const router = express.Router();

// Create entities
router.post('/create-entities', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'create_entities', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating entities:', error);
    res.status(500).json({ error: 'Failed to create entities' });
  }
});

// Create relations
router.post('/create-relations', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'create_relations', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating relations:', error);
    res.status(500).json({ error: 'Failed to create relations' });
  }
});

// Read graph
router.post('/read-graph', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'read_graph', {});
    res.json(JSON.parse(result.content[0].text));
  } catch (error) {
    console.error('Error reading graph:', error);
    res.status(500).json({ error: 'Failed to read graph' });
  }
});

// Delete entities
router.post('/delete-entities', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'delete_entities', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error deleting entities:', error);
    res.status(500).json({ error: 'Failed to delete entities' });
  }
});

export default router;

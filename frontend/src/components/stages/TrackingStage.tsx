import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import { useChat } from '../../contexts/ChatContext';
import { useWizard } from '../../contexts/WizardContext';
import { useClaudeContext } from '../../contexts/ClaudeContext';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  NodeProps,
  Connection,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { WizardData } from '../../types/wizard';

type NodeStatus = 'todo' | 'doing' | 'done' | null;

type NodeType = 'student' | 'college' | 'major' | 'interest';

interface CustomNodeData {
  label: string;
  nodeType: NodeType;
  metadata?: Record<string, any>;
  status?: NodeStatus;
  [key: string]: unknown;
}

const nodeColors: Record<NodeType, string> = {
  student: '#e91e63',
  college: '#2196f3',
  major: '#4caf50',
  interest: '#ff9800',
};

interface CustomNodeProps extends NodeProps {
  data: CustomNodeData;
}

const CustomNode = React.memo(({ data }: CustomNodeProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChange = (status: NodeStatus) => {
    // We'll handle this through a global context
    handleClose();
  };

  const handleDelete = () => {
    // We'll handle this through a global context
    handleClose();
  };

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        style={{
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: nodeColors[data.nodeType],
          color: 'white',
          cursor: 'pointer',
        }}
        onClick={() => setShowMetadata(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">{data.label}</Typography>
          <IconButton
            size="small"
            style={{ color: 'white' }}
            onClick={handleClick}
          >
            <MoreVertIcon />
          </IconButton>
        </div>
        {data.status && (
          <Typography variant="caption" style={{ opacity: 0.8 }}>
            Status: {data.status}
          </Typography>
        )}

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={() => handleStatusChange('todo')}>Set To Do</MenuItem>
          <MenuItem onClick={() => handleStatusChange('doing')}>Set Doing</MenuItem>
          <MenuItem onClick={() => handleStatusChange('done')}>Set Done</MenuItem>
          <MenuItem onClick={handleDelete} style={{ color: 'red' }}>
            <DeleteIcon fontSize="small" style={{ marginRight: 8 }} />
            Delete
          </MenuItem>
        </Menu>

        <Dialog open={showMetadata} onClose={() => setShowMetadata(false)}>
          <DialogTitle>{data.label}</DialogTitle>
          <DialogContent>
            {data.metadata && Object.entries(data.metadata).map(([key, value]) => (
              <div key={key}>
                <Typography variant="subtitle2">{key}:</Typography>
                <Typography variant="body2">
                  {typeof value === 'string' && value.startsWith('http') ? (
                    <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
                  ) : (
                    String(value)
                  )}
                </Typography>
              </div>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowMetadata(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
});

const nodeTypes = {
  custom: CustomNode,
} as const;

export const TrackingStage = (): JSX.Element => {
  const { currentStudent, data, updateData } = useWizard();
  const { apiKey } = useClaudeContext();
  const { chats, loadChats } = useChat();
  const [processingChats, setProcessingChats] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CustomNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const handleNodeStatusChange = useCallback((nodeId: string, status: NodeStatus) => {
    setNodes((nds: Node<CustomNodeData>[]) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, status } }
          : node
      )
    );
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds: Node<CustomNodeData>[]) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds: Edge<any>[]) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, []);

  const transformGraphData = useCallback((graphData: any) => {
    if (!graphData?.entities || !graphData?.relations) {
      console.error('Invalid graph data structure:', graphData);
      throw new Error('Invalid graph data structure');
    }

    const nodes: Node<CustomNodeData>[] = graphData.entities.map((entity: any) => ({
      id: entity.name,
      type: 'custom',
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: {
        label: entity.name,
        nodeType: entity.entityType as NodeType,
        metadata: {
          ...entity.observations.reduce((acc: any, obs: string) => {
            const [key, value] = obs.split(': ');
            return { ...acc, [key]: value };
          }, {}),
        },
      },
    }));

    const edges: Edge<any>[] = graphData.relations.map((relation: any, index: number) => ({
      id: `e${index}`,
      source: relation.from,
      target: relation.to,
      label: relation.relationType,
    }));

    return { nodes, edges };
  }, []);

  const initializeKnowledgeGraph = useCallback(async (student: NonNullable<typeof currentStudent>, wizardData: typeof data) => {
    try {
      console.log('TrackingStage: Starting knowledge graph initialization');
      if (!student) return;
      
      console.log('TrackingStage: Current student data:', student);
      console.log('TrackingStage: Wizard data:', wizardData);
      
      setIsLoading(true);
      setError(null);

      // Create student entity
      console.log('TrackingStage: Creating student entity:', {
        name: student.name,
        observations: wizardData.studentProfile
      });
      const createStudentResponse = await fetch('/api/mcp/memory/create-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entities: [{
            name: student.name,
            entityType: 'student',
            observations: [
              `GPA: ${student.data.studentProfile?.gpa || 'Not provided'}`,
              `SAT Score: ${student.data.studentProfile?.satScore || 'Not provided'}`,
              `ACT Score: ${student.data.studentProfile?.actScore || 'Not provided'}`,
              `Graduation Year: ${student.data.studentProfile?.graduationYear || 'Not provided'}`,
              `High School: ${student.data.studentProfile?.highSchool || 'Not provided'}`,
              `Budget: ${student.data.budgetInfo?.yearlyBudget || 'Not provided'}`,
              ...(student.data.studentProfile?.extracurriculars?.map(ec => `Extracurricular: ${ec}`) || []),
              ...(student.data.studentProfile?.sports?.map(sport => `Sport: ${sport}`) || [])
            ]
          }]
        })
      });
      console.log('TrackingStage: Student entity creation response:', await createStudentResponse.clone().json());

      // Create college entities and relations
      const colleges = student.data.recommendations?.colleges || [];
      console.log('TrackingStage: College recommendations:', colleges);
      if (colleges.length > 0) {
        const collegeEntities = colleges.map(college => ({
          name: college.name,
          entityType: 'college',
          observations: [
            `Fit Score: ${college.fitScore || 'Not provided'}`,
            `Reason: ${college.reason || 'Not provided'}`
          ]
        }));

        console.log('TrackingStage: Creating college entities:', collegeEntities);
        const createCollegesResponse = await fetch('/api/mcp/memory/create-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entities: collegeEntities })
        });
        console.log('TrackingStage: College entities creation response:', await createCollegesResponse.clone().json());

        // Create relations between student and colleges
        const collegeRelations = colleges.map(college => ({
          from: student.name,
          to: college.name,
          relationType: 'is interested in'
        }));
        console.log('TrackingStage: Creating college relations:', collegeRelations);
        const createCollegeRelationsResponse = await fetch('/api/mcp/memory/create-relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relations: collegeRelations })
        });
        console.log('TrackingStage: College relations creation response:', await createCollegeRelationsResponse.clone().json());
      }

      // Create major/field entities and relations
      const majors = student.data.collegeInterests?.majors || [];
      console.log('TrackingStage: College majors:', majors);
      if (majors.length > 0) {
        const majorEntities = majors.map(major => ({
          name: major,
          entityType: 'major',
          observations: []
        }));

        console.log('TrackingStage: Creating major entities:', majorEntities);
        const createMajorsResponse = await fetch('/api/mcp/memory/create-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entities: majorEntities })
        });
        console.log('TrackingStage: Major entities creation response:', await createMajorsResponse.clone().json());

        const majorRelations = majors.map(major => ({
          from: student.name,
          to: major,
          relationType: 'wants to study'
        }));

        console.log('TrackingStage: Creating major relations:', majorRelations);
        const createMajorRelationsResponse = await fetch('/api/mcp/memory/create-relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relations: majorRelations })
        });
        console.log('TrackingStage: Major relations creation response:', await createMajorRelationsResponse.clone().json());
      }

      // Read the graph to visualize
      console.log('TrackingStage: Fetching graph data');
      const response = await fetch('/api/mcp/memory/read-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      console.log('TrackingStage: Graph response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TrackingStage: Graph response error:', errorText);
        throw new Error(`Failed to fetch graph: ${response.status} ${errorText}`);
      }
      const graph = await response.json();
      console.log('TrackingStage: Received graph data:', graph);

      // Transform graph data for visualization
      const { nodes: newNodes, edges: newEdges } = transformGraphData(graph);
      setNodes(newNodes);
      setEdges(newEdges);
      setIsLoading(false);
    } catch (err: any) {
      console.error('TrackingStage: Error initializing knowledge graph:', err);
      if (err instanceof Response) {
        console.error('TrackingStage: Response error:', await err.text());
      }
      console.error('TrackingStage: Error details:', {
        name: err?.name || 'Unknown error',
        message: err?.message || 'No error message available',
        stack: err?.stack || 'No stack trace available'
      });
      setError('Failed to initialize knowledge graph');
      setIsLoading(false);
    }
  }, [setNodes, setEdges, setError, setIsLoading]);

  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [streamContent, setStreamContent] = useState<string>('');

  const processChats = useCallback(async (unprocessedChats: any[]) => {
    setProcessingChats(true);
    setTotalToProcess(unprocessedChats.length);
    setProcessedCount(0);
    setProcessingError(null);
    setStreamContent(''); // Clear stream content when starting new processing

    for (const chat of unprocessedChats) {
      try {
        // Send chat to Claude for processing with SSE
        if (!apiKey) {
          throw new Error('Claude API key not configured');
        }

        const response = await fetch('/api/chat/claude/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            studentId: currentStudent?.id,
            chatId: chat.id,
            mode: 'graph_enrichment'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to process chat');
        }

        // Handle SSE response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Parse SSE data
          const text = new TextDecoder().decode(value);
          const lines = text.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(5));
                // Add all content to stream display
                const timestamp = new Date().toLocaleTimeString();
                setStreamContent(prev => prev + `\n[${timestamp}] ` + JSON.stringify(data, null, 2));
                
                if (data.type === 'thinking') {
                  setProcessingStatus(data.content);
                } else if (data.type === 'error') {
                  throw new Error(data.content);
                } else if (data.type === 'complete') {
                  // Mark chat as processed
                  await fetch('/api/mcp/student-data/mark-chat-processed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      studentId: currentStudent?.id,
                      chatId: chat.id,
                      lastMessageTimestamp: chat.updatedAt
                    })
                  });

                  setProcessedCount(prev => prev + 1);
                  // Refresh graph after each chat is processed
                  if (currentStudent) {
                    await initializeKnowledgeGraph(currentStudent, data);
                  }
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error processing chat:', error);
        setProcessingError(`Failed to process chat: ${error?.message || 'Unknown error'}`);
      }
    }

    setProcessingChats(false);
    setProcessingStatus('');
  }, [currentStudent, data, initializeKnowledgeGraph]);

  useEffect(() => {
    if (currentStudent) {
      // Load chats and initialize graph
      loadChats(currentStudent.id).then(() => {
        initializeKnowledgeGraph(currentStudent, data);
      });
    }
  }, [currentStudent, data, initializeKnowledgeGraph, loadChats]);

  useEffect(() => {
    if (currentStudent && chats.length > 0) {
      // Find unprocessed chats
      const unprocessedChats = chats.filter(chat => !chat.processed);
      if (unprocessedChats.length > 0) {
        processChats(unprocessedChats);
      }
    }
  }, [currentStudent, chats, processChats]);

  const handleClearMemory = useCallback(async () => {
    if (!currentStudent) return;
    
    setIsLoading(true);
    try {
      // First get all entities related to this student
      const graphResponse = await fetch('/api/mcp/memory/read-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!graphResponse.ok) {
        throw new Error('Failed to read graph');
      }

      const graph = await graphResponse.json();
      
      // Find all entities connected to the student
      const studentRelations = graph.relations.filter(
        (rel: any) => rel.from === currentStudent.name || rel.to === currentStudent.name
      );
      const connectedEntities = new Set(
        studentRelations.flatMap((rel: any) => [rel.from, rel.to])
      );

      // Delete all connected entities
      const deleteResponse = await fetch('/api/mcp/memory/delete-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityNames: Array.from(connectedEntities)
        })
      });
      
      if (!deleteResponse.ok) {
        throw new Error('Failed to clear memory');
      }

      // Reinitialize the graph from student data
      await initializeKnowledgeGraph(currentStudent, data);
    } catch (err) {
      console.error('Failed to clear memory:', err);
      setError('Failed to clear memory');
    }
    setIsLoading(false);
  }, [currentStudent, data, initializeKnowledgeGraph, setError, setIsLoading]);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          College Recommendations Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined"
            onClick={async () => {
              if (!currentStudent?.id) return;
              
              try {
                setIsLoading(true);
                // Mark all chats as unprocessed
                const response = await fetch('/api/chat/claude/mark-all-unprocessed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ studentId: currentStudent.id })
                });

                if (!response.ok) {
                  throw new Error('Failed to mark chats as unprocessed');
                }

                // Reload chats and process them
                const loadedChats = await loadChats(currentStudent.id);
                // Process all chats since we just marked them all as unprocessed
                if (loadedChats.length > 0) {
                  await processChats(loadedChats);
                }
              } catch (err) {
                console.error('Failed to reprocess chats:', err);
                setError('Failed to reprocess chats');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={!currentStudent || isLoading}
          >
            Reprocess Chats
          </Button>
          <Button 
            variant="outlined" 
            color="secondary"
            onClick={handleClearMemory}
            disabled={!currentStudent || isLoading}
          >
            Clear Memory
          </Button>
        </Box>
      </Box>

      {processingChats && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Processing chats ({processedCount}/{totalToProcess})
          </Typography>
          {processingStatus && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {processingStatus}
            </Typography>
          )}
          <LinearProgress 
            variant="determinate" 
            value={(processedCount / totalToProcess) * 100} 
          />
        </Box>
      )}

      {processingError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProcessingError(null)}>
          {processingError}
        </Alert>
      )}

      {/* Always show the stream box, even when empty */}
      <Paper elevation={1} sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5' }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Stream Output:</Typography>
        <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
          <Typography variant="caption" component="pre" sx={{ 
            whiteSpace: 'pre-wrap', 
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            margin: 0
          }}>
            {streamContent || 'Waiting for stream...'}
          </Typography>
        </Box>
      </Paper>

      {!currentStudent ? (
        <Typography>Please select a student first.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ height: '600px', border: '1px solid #eee' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable
                nodesConnectable={false}
              >
                <Controls />
                <MiniMap />
                <Background />
              </ReactFlow>
            </Box>
          </CardContent>
        </Card>
      )}
    </Paper>
  );
};

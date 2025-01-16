import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { useWizard } from '../../contexts/WizardContext';
import ForceGraph2D from 'react-force-graph-2d';

interface GraphData {
  nodes: Array<{
    id: string;
    name: string;
    type: 'student' | 'college' | 'major' | 'interest';
    val: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export const TrackingStage: React.FC = () => {
  const { currentStudent, data } = useWizard();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStudent) return;

    const initializeKnowledgeGraph = async () => {
      try {
        console.log('TrackingStage: Starting knowledge graph initialization');
        console.log('TrackingStage: Current student data:', currentStudent);
        console.log('TrackingStage: Wizard data:', data);
        
        setIsLoading(true);
        setError(null);

        // Create student entity
        console.log('TrackingStage: Creating student entity:', {
          name: currentStudent.name,
          observations: data.studentProfile
        });
        const createStudentResponse = await fetch('/api/mcp/memory/create-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entities: [{
              name: currentStudent.name,
              entityType: 'student',
              observations: [
                `GPA: ${data.studentProfile.gpa}`,
                `SAT Score: ${data.studentProfile.satScore}`,
                `ACT Score: ${data.studentProfile.actScore}`,
                `Graduation Year: ${data.studentProfile.graduationYear}`,
                `High School: ${data.studentProfile.highSchool}`,
                `Budget: ${data.budgetInfo.yearlyBudget}`,
                ...data.studentProfile.extracurriculars?.map(ec => `Extracurricular: ${ec}`) || [],
                ...data.studentProfile.sports?.map(sport => `Sport: ${sport}`) || []
              ]
            }]
          })
        });
        console.log('TrackingStage: Student entity creation response:', await createStudentResponse.clone().json());

        // Create college entities and relations
        console.log('TrackingStage: College recommendations:', data?.recommendations?.colleges);
        if (data?.recommendations?.colleges?.length > 0) {
          const collegeEntities = data.recommendations.colleges.map(college => ({
            name: college.name,
            entityType: 'college',
            observations: [
              `Fit Score: ${college.fitScore}`,
              `Reason: ${college.reason}`
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
          const collegeRelations = data.recommendations.colleges.map(college => ({
            from: currentStudent.name,
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
        console.log('TrackingStage: College majors:', data?.collegeInterests?.majors);
        if (data?.collegeInterests?.majors?.length > 0) {
          const majorEntities = data.collegeInterests.majors.map(major => ({
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

          const majorRelations = data.collegeInterests.majors.map(major => ({
            from: currentStudent.name,
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
        console.log('TrackingStage: Transforming graph data:', graph);
        if (!graph?.entities || !graph?.relations) {
          console.error('TrackingStage: Invalid graph data structure:', graph);
          throw new Error('Invalid graph data structure');
        }

        const nodes = (graph.entities || []).map((node: any) => ({
          id: node.name,
          name: node.name,
          type: node.entityType,
          val: node.entityType === 'student' ? 3 : 
               node.entityType === 'college' ? 2 : 1
        }));

        const links = (graph.relations || []).map((rel: any) => ({
          source: rel.from,
          target: rel.to,
          type: rel.relationType
        }));

        setGraphData({ nodes, links });
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
    };

    initializeKnowledgeGraph();
  }, [currentStudent, data]);

  if (!currentStudent) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Typography>Please select a student first.</Typography>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        College Recommendations Tracker
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Knowledge Graph
              </Typography>
              <Box sx={{ height: '600px', border: '1px solid #eee' }}>
                <ForceGraph2D
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor={(node: any) => 
                    node.type === 'student' ? '#e91e63' :
                    node.type === 'college' ? '#2196f3' :
                    node.type === 'major' ? '#4caf50' : '#ff9800'
                  }
                  linkLabel={(link: any) => link.type}
                  linkColor={() => '#999'}
                  nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const label = node.name;
                    const fontSize = 12/globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(
                      node.x - bckgDimensions[0] / 2,
                      node.y - bckgDimensions[1] / 2,
                      bckgDimensions[0],
                      bckgDimensions[1]
                    );

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = node.type === 'student' ? '#e91e63' :
                                  node.type === 'college' ? '#2196f3' :
                                  node.type === 'major' ? '#4caf50' : '#ff9800';
                    ctx.fillText(label, node.x, node.y);
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Legend
              </Typography>
              <Grid container spacing={2}>
                <Grid item>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#e91e63', borderRadius: '50%' }} />
                    <Typography>Student</Typography>
                  </Box>
                </Grid>
                <Grid item>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#2196f3', borderRadius: '50%' }} />
                    <Typography>College</Typography>
                  </Box>
                </Grid>
                <Grid item>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, bgcolor: '#4caf50', borderRadius: '50%' }} />
                    <Typography>Major</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

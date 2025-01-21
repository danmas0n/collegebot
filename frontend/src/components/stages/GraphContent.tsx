import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  NodeTypes,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
} from '@xyflow/react';
import { Box, Typography, Button } from '@mui/material';
import { Controls, MiniMap, Background } from '@xyflow/react';
import { getLayoutedElements } from './graph-utils';
import { CustomNodeData } from './types';

interface GraphContentProps {
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  nodeTypes: NodeTypes;
  filteredNodes: Node<CustomNodeData>[];
  visibleTypes: Set<string>;
  toggleNodeType: (type: string) => void;
  nodeColors: Record<string, string>;
  setNodes: (nodes: Node<CustomNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
}

// Inner component that uses React Flow hooks
const GraphContentInner = ({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect, 
  nodeTypes, 
  filteredNodes,
  visibleTypes,
  toggleNodeType,
  nodeColors,
  setNodes,
  setEdges
}: GraphContentProps) => {
  const { fitView } = useReactFlow();

  // Layout helper function
  const handleLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(filteredNodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    window.requestAnimationFrame(() => fitView());
  }, [filteredNodes, edges, setNodes, setEdges, fitView]);

  // Apply layout after nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      handleLayout();
    }
  }, [nodes.length, handleLayout]);

  return (
    <ReactFlow
      nodes={filteredNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={true}
      nodesConnectable={false}
      selectionOnDrag={false}
      connectionLineType={ConnectionLineType.SmoothStep}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 2 }
      }}
    >
      <Panel position="top-left" style={{ background: 'white', padding: '10px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Node Types</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Object.entries(nodeColors).map(([type, color]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                variant={visibleTypes.has(type) ? "contained" : "outlined"}
                onClick={() => toggleNodeType(type)}
                sx={{ 
                  backgroundColor: visibleTypes.has(type) ? color : 'transparent',
                  color: visibleTypes.has(type) ? 'white' : color,
                  borderColor: color,
                  textTransform: 'capitalize',
                  minWidth: '120px',
                  justifyContent: 'flex-start',
                  '&:hover': {
                    backgroundColor: visibleTypes.has(type) ? color : 'rgba(0,0,0,0.04)',
                    borderColor: color,
                  }
                }}
              >
                {type}
              </Button>
            </Box>
          ))}
        </Box>
      </Panel>
      <Controls />
      <MiniMap />
      <Background />
    </ReactFlow>
  );
};

// Outer component that provides React Flow context
export const GraphContent = (props: GraphContentProps) => (
  <ReactFlowProvider>
    <GraphContentInner {...props} />
  </ReactFlowProvider>
);

import { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';
import { CustomNodeData } from './types';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Node dimensions - match the actual rendered size
const nodeWidth = 250;  // Increased to match maxWidth in CustomNode
const nodeHeight = 100; // Increased to account for padding and content

export const getLayoutedElements = (nodes: Node<CustomNodeData>[], edges: Edge[], direction = 'TB') => {
  // Create a new graph for each layout to avoid stale data
  const layoutGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  layoutGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,  // Minimum horizontal separation between nodes
    ranksep: 100,  // Minimum vertical separation between ranks
    edgesep: 50,   // Minimum separation between edges
    marginx: 50,   // Margin around the graph horizontally
    marginy: 50    // Margin around the graph vertically
  });

  // Add nodes to dagre graph
  nodes.forEach(node => {
    layoutGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to dagre graph
  edges.forEach(edge => {
    layoutGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(layoutGraph);

  // Get positioned nodes
  const layoutedNodes = nodes.map(node => {
    const nodeWithPosition = layoutGraph.node(node.id);
    return {
      ...node,
      // Set source/target positions based on layout direction
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    } as Node<CustomNodeData>;
  });

  return { nodes: layoutedNodes, edges };
};

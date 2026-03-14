'use client';

import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeTypes,
  type EdgeTypes,
  type FitViewOptions,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore, useFilteredNodes, useFilteredEdges } from '@/lib/store/workflowStore';
import { EntryNode } from './nodes/EntryNode';
import { ComponentNode } from './nodes/ComponentNode';
import { ApiNode } from './nodes/ApiNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { ServiceNode } from './nodes/ServiceNode';
import { ConfigNode } from './nodes/ConfigNode';
import { DataFlowEdge } from './edges/DataFlowEdge';
import { DependencyEdge } from './edges/DependencyEdge';
import { MiniMapPanel } from './overlays/MiniMapPanel';
import { DetailDrawer } from './overlays/DetailDrawer';
import { WorkflowStepsBar } from './WorkflowStepsBar';
import { useWorkflowLayout } from '@/hooks/useWorkflowLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertTriangle } from 'lucide-react';

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  component: ComponentNode,
  api: ApiNode,
  database: DatabaseNode,
  service: ServiceNode,
  config: ConfigNode,
  hook: ComponentNode,
  style: ConfigNode,
  test: ConfigNode,
  external: ServiceNode,
};

const edgeTypes: EdgeTypes = {
  dataflow: DataFlowEdge,
  dependency: DependencyEdge,
};

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
  duration: 800,
};

export function WorkflowCanvas() {
  const nodes = useFilteredNodes();
  const edges = useFilteredEdges();
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const hoverNode = useWorkflowStore((s) => s.hoverNode);
  const hoveredNodeId = useWorkflowStore((s) => s.hoveredNodeId);
  const aiStatus = useWorkflowStore((s) => s.aiStatus);
  const aiModel = useWorkflowStore((s) => s.aiModel);

  useWorkflowLayout();

  const statusBanner = useMemo(() => {
    if (aiStatus === 'ready') return null;
    if (aiStatus === 'starting') {
      return {
        tone: 'info',
        message: 'Starting the AI engine. This should only take a moment.',
      };
    }
    if (aiStatus === 'pulling') {
      return {
        tone: 'info',
        message: `Downloading ${aiModel ?? 'the selected model'} and warming it up.`,
      };
    }
    if (aiStatus === 'limited') {
      return {
        tone: 'warn',
        message: 'Ollama is running, but the model is still getting ready. We will keep retrying.',
      };
    }
    return {
      tone: 'warn',
      message: 'AI engine is unavailable right now. We will keep trying automatically.',
    };
  }, [aiStatus, aiModel]);

  // Dim unconnected nodes on hover
  const styledNodes = useMemo(() => {
    if (!hoveredNodeId) return nodes;
    const connected = new Set<string>();
    connected.add(hoveredNodeId);
    for (const edge of edges) {
      if (edge.source === hoveredNodeId) connected.add(edge.target);
      if (edge.target === hoveredNodeId) connected.add(edge.source);
    }
    return nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: connected.has(n.id) ? 1 : 0.25,
        transition: 'opacity 150ms ease',
      },
    }));
  }, [nodes, edges, hoveredNodeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = useWorkflowStore.getState().nodes;
      const updatedNodes = applyNodeChanges(changes, currentNodes);
      useWorkflowStore.setState({ nodes: updatedNodes });
    },
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = useWorkflowStore.getState().edges;
      const updatedEdges = applyEdgeChanges(changes, currentEdges);
      useWorkflowStore.setState({ edges: updatedEdges });
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectNode(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectNode]);

  return (
    <div className="flex-1 relative">
      {/* AI Warning Banner */}
      {statusBanner && (
        <div
          className={`absolute top-4 left-4 z-20 rounded-lg px-4 py-2 flex items-center gap-2 max-w-md ${
            statusBanner.tone === 'info'
              ? 'bg-sky-500/10 border border-sky-500/20'
              : 'bg-yellow-500/10 border border-yellow-500/20'
          }`}
        >
          {statusBanner.tone === 'info' ? (
            <LoadingSpinner size="sm" className="justify-start gap-2" label="AI starting" />
          ) : (
            <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
          )}
          <p
            className={`text-xs ${
              statusBanner.tone === 'info' ? 'text-sky-200' : 'text-yellow-300'
            }`}
          >
            {statusBanner.message}
          </p>
        </div>
      )}

      <WorkflowStepsBar />

      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onNodeMouseEnter={(_, node) => hoverNode(node.id)}
        onNodeMouseLeave={() => hoverNode(null)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={nodes.length <= 100}
        aria-label="Workflow visualization canvas"
        className="bg-[#12141A]"
      >
        <Background color="#ffffff" gap={20} size={1.5} style={{ opacity: 0.05 }} />
        <Controls
          showInteractive={false}
          aria-label="Zoom controls"
        />
        <MiniMapPanel />
      </ReactFlow>

      {/* SVG Arrow marker */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-default)" />
          </marker>
        </defs>
      </svg>

      <DetailDrawer />
    </div>
  );
}

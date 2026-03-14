import { create } from 'zustand';
import type { XYPosition } from 'reactflow';
import type { NodeType, WorkflowNode, WorkflowEdge } from '@/lib/types/graph';
import type {
  ParsedProject,
  AIEnrichmentResult,
  AnalyzeResponse,
  UploadState,
  ProcessingStep,
  AiStatus,
  WorkflowStep,
  ProjectMeta,
  FileOverviewState,
} from '@/lib/types/project';

interface WorkflowState {
  projectMeta: ProjectMeta | null;
  parsedProject: ParsedProject | null;
  aiEnrichment: AIEnrichmentResult | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  isDrawerOpen: boolean;
  layoutDirection: 'TB' | 'LR';
  activeFilters: NodeType[];
  searchQuery: string;
  isClusterMode: boolean;
  aiModel: string | null;
  aiDetail: string | null;
  fileOverviews: Record<string, FileOverviewState>;
  uploadState: UploadState;
  uploadError: string | null;
  processingSteps: ProcessingStep[];
  aiStatus: AiStatus;
  activeWorkflowStepIndex: number | null;
  isReportOpen: boolean;

  setProject: (data: AnalyzeResponse['data']) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setLayoutDirection: (dir: 'TB' | 'LR') => void;
  toggleFilter: (type: NodeType) => void;
  setSearchQuery: (q: string) => void;
  toggleClusterMode: () => void;
  setUploadState: (state: UploadState) => void;
  setUploadError: (error: string | null) => void;
  setAiStatus: (status: AiStatus) => void;
  setAiModel: (model: string | null) => void;
  setAiDetail: (detail: string | null) => void;
  resetStore: () => void;
  updateNodePositions: (positions: Record<string, XYPosition>) => void;
  setProcessingSteps: (steps: ProcessingStep[]) => void;
  updateProcessingStep: (index: number, status: ProcessingStep['status']) => void;
  setActiveWorkflowStep: (index: number | null) => void;
  setReportOpen: (open: boolean) => void;
  setFileOverview: (filePath: string, state: FileOverviewState) => void;
}

const ALL_NODE_TYPES: NodeType[] = [
  'entry', 'component', 'hook', 'api', 'service',
  'database', 'config', 'style', 'test', 'external',
];

const INITIAL_PROCESSING_STEPS: ProcessingStep[] = [
  { label: 'Extracting files...', status: 'pending' },
  { label: 'Parsing source code...', status: 'pending' },
  { label: 'Mapping relationships...', status: 'pending' },
  { label: 'Sending to AI models for analysis...', status: 'pending' },
  { label: 'Building intelligent graph...', status: 'pending' },
  { label: 'Rendering visualization...', status: 'pending' },
];

const initialState = {
  projectMeta: null,
  parsedProject: null,
  aiEnrichment: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  hoveredNodeId: null,
  isDrawerOpen: false,
  layoutDirection: 'LR' as const,
  activeFilters: [...ALL_NODE_TYPES],
  searchQuery: '',
  isClusterMode: false,
  aiModel: null,
  aiDetail: null,
  fileOverviews: {},
  uploadState: 'idle' as UploadState,
  uploadError: null,
  processingSteps: INITIAL_PROCESSING_STEPS.map(s => ({ ...s })),
  aiStatus: 'offline' as AiStatus,
  activeWorkflowStepIndex: null,
  isReportOpen: false,
};

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ...initialState,

  setProject: (data) =>
    set({
      parsedProject: data.project,
      aiEnrichment: data.aiEnrichment,
      nodes: data.graph.nodes,
      edges: data.graph.edges,
      projectMeta: data.meta,
      aiModel: data.meta.aiModel ?? null,
      aiDetail: null,
      fileOverviews: {},
      uploadState: 'success',
      uploadError: null,
    }),

  selectNode: (id) =>
    set({
      selectedNodeId: id,
      isDrawerOpen: id !== null,
    }),

  hoverNode: (id) =>
    set({ hoveredNodeId: id }),

  setLayoutDirection: (dir) =>
    set({ layoutDirection: dir }),

  toggleFilter: (type) =>
    set((state) => {
      const isActive = state.activeFilters.includes(type);
      const activeFilters = isActive
        ? state.activeFilters.filter((t) => t !== type)
        : [...state.activeFilters, type];
      return { activeFilters };
    }),

  setSearchQuery: (q) =>
    set({ searchQuery: q }),

  toggleClusterMode: () =>
    set((state) => ({ isClusterMode: !state.isClusterMode })),

  setUploadState: (uploadState) =>
    set({ uploadState }),

  setUploadError: (uploadError) =>
    set({ uploadError, uploadState: uploadError ? 'error' : 'idle' }),

  setAiStatus: (aiStatus) =>
    set({ aiStatus }),

  setAiModel: (aiModel) =>
    set({ aiModel }),

  setAiDetail: (aiDetail) =>
    set({ aiDetail }),

  resetStore: () =>
    set({
      ...initialState,
      processingSteps: INITIAL_PROCESSING_STEPS.map(s => ({ ...s })),
    }),

  updateNodePositions: (positions) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const pos = positions[node.id];
        if (pos) {
          return { ...node, position: pos };
        }
        return node;
      }),
    })),

  setProcessingSteps: (steps) =>
    set({ processingSteps: steps }),

  updateProcessingStep: (index, status) =>
    set((state) => ({
      processingSteps: state.processingSteps.map((step, i) =>
        i === index ? { ...step, status } : step
      ),
    })),

  setActiveWorkflowStep: (index) =>
    set({ activeWorkflowStepIndex: index }),

  setReportOpen: (isReportOpen) =>
    set({ isReportOpen }),

  setFileOverview: (filePath, state) =>
    set((current) => ({
      fileOverviews: {
        ...current.fileOverviews,
        [filePath]: state,
      },
    })),
}));

/* ── Computed Selectors ── */

export function useFilteredNodes(): WorkflowNode[] {
  return useWorkflowStore((state) => {
    const { nodes, activeFilters, searchQuery } = state;
    let filtered = nodes.filter((n) => activeFilters.includes(n.data.nodeType));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.data.label.toLowerCase().includes(q) ||
          n.data.filePath.toLowerCase().includes(q) ||
          n.data.description.toLowerCase().includes(q)
      );
    }
    return filtered;
  });
}

export function useFilteredEdges(): WorkflowEdge[] {
  return useWorkflowStore((state) => {
    const { nodes, edges, activeFilters, searchQuery } = state;
    let visibleNodeIds: Set<string>;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      visibleNodeIds = new Set(
        nodes
          .filter(
            (n) =>
              activeFilters.includes(n.data.nodeType) &&
              (n.data.label.toLowerCase().includes(q) ||
                n.data.filePath.toLowerCase().includes(q) ||
                n.data.description.toLowerCase().includes(q))
          )
          .map((n) => n.id)
      );
    } else {
      visibleNodeIds = new Set(
        nodes.filter((n) => activeFilters.includes(n.data.nodeType)).map((n) => n.id)
      );
    }
    return edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
  });
}

export function useSelectedNode(): WorkflowNode | null {
  return useWorkflowStore((state) => {
    if (!state.selectedNodeId) return null;
    return state.nodes.find((n) => n.id === state.selectedNodeId) ?? null;
  });
}

export function useConnectedNodeIds(): Set<string> {
  return useWorkflowStore((state) => {
    if (!state.selectedNodeId) return new Set<string>();
    const connected = new Set<string>();
    connected.add(state.selectedNodeId);
    for (const edge of state.edges) {
      if (edge.source === state.selectedNodeId) connected.add(edge.target);
      if (edge.target === state.selectedNodeId) connected.add(edge.source);
    }
    return connected;
  });
}

export function useWorkflowSteps(): WorkflowStep[] {
  return useWorkflowStore((state) => state.aiEnrichment?.workflowSteps ?? []);
}

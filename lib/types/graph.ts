import type { Node, Edge, XYPosition } from 'reactflow';

export type NodeType =
  | 'entry'
  | 'component'
  | 'hook'
  | 'api'
  | 'service'
  | 'database'
  | 'config'
  | 'style'
  | 'test'
  | 'external';

export type EdgeType =
  | 'import'
  | 'dataflow'
  | 'api_call'
  | 'db_query'
  | 'renders'
  | 'uses_hook'
  | 'inferred';

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isDynamic: boolean;
}

export interface NodeMetrics {
  dependencies: number;
  dependents: number;
}

export interface WorkflowNodeData {
  id: string;
  label: string;
  filePath: string;
  nodeType: NodeType;
  language: string;
  lineCount: number;
  exports: string[];
  imports: ImportInfo[];
  description: string;
  responsibility: string;
  dataIn: string;
  dataOut: string;
  subsystem: string;
  metrics: NodeMetrics;
  highlights: string[];
  httpMethod?: string;
  fieldCount?: number;
  modelName?: string;
  methodCount?: number;
  packageVersion?: string;
  hasError?: boolean;
  errorMessage?: string;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge<WorkflowEdgeData>;

export interface WorkflowEdgeData {
  edgeType: EdgeType;
  label?: string;
  description?: string;
  dataFlowing?: string;
  isAnimated?: boolean;
  httpMethod?: string;
}

export interface GraphData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface SubsystemGroup {
  name: string;
  color: string;
  files: string[];
  description: string;
}

export interface LayoutConfig {
  direction: 'TB' | 'LR';
  rankSep: number;
  nodeSep: number;
  clusterMode: boolean;
}

export interface PositionUpdate {
  positions: Record<string, XYPosition>;
}

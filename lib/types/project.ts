import type { ParsedFile, DependencyMap, EnvVariable } from './parser';
import type { GraphData, SubsystemGroup } from './graph';

export interface ApiRoute {
  method: string;
  path: string;
  filePath: string;
  handler: string;
}

export interface DatabaseModel {
  name: string;
  orm: string;
  fields: string[];
  filePath: string;
}

export interface ParsedProject {
  projectName: string;
  detectedFramework: string;
  detectedLanguages: string[];
  totalFiles: number;
  totalLinesOfCode: number;
  files: ParsedFile[];
  dependencies: DependencyMap;
  entryPoints: string[];
  apiRoutes: ApiRoute[];
  databaseModels: DatabaseModel[];
  envVariables: EnvVariable[];
}

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  files: string[];
  type: 'entry' | 'process' | 'data' | 'response';
}

export interface FileDescription {
  purpose: string;
  responsibility: string;
  dataIn: string;
  dataOut: string;
  subsystem: string;
}

export interface InferredEdge {
  source: string;
  target: string;
  relationship: string;
  dataFlowing: string;
  edgeType: 'dataflow' | 'api_call' | 'db_query' | 'renders' | 'triggers';
}

export interface AIEnrichmentResult {
  projectSummary: string;
  detailedReport: string;
  workflowSteps: WorkflowStep[];
  fileDescriptions: Record<string, FileDescription>;
  inferredEdges: InferredEdge[];
  subsystems: SubsystemGroup[];
  warnings: string[];
}

export interface FileOverviewState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  content: string;
  error?: string;
}

export interface ProjectMeta {
  processingTimeMs: number;
  aiTimeMs: number;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  aiAvailable: boolean;
  aiModel?: string;
  warnings: string[];
}

export interface AnalyzeResponse {
  success: boolean;
  data: {
    project: ParsedProject;
    aiEnrichment: AIEnrichmentResult | null;
    graph: GraphData;
    meta: ProjectMeta;
  };
  error?: string;
}

export type UploadState =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'enriching'
  | 'building'
  | 'rendering'
  | 'success'
  | 'error';

export interface ProcessingStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

export type AiStatus = 'ready' | 'limited' | 'offline' | 'starting' | 'pulling';

export interface LanguageBreakdown {
  language: string;
  percentage: number;
  count: number;
  color: string;
}

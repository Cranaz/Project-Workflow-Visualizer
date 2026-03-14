import type { ParsedProject, AIEnrichmentResult } from '@/lib/types/project';
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData, WorkflowEdgeData, NodeType, ImportInfo } from '@/lib/types/graph';
import { normalizePath, detectEntryPoint, isTestFile, isStyleFile, isConfigFile, getFileExtension, getLanguageFromExtension } from '@/lib/utils/fileUtils';
import { inferRelationships } from './inferRelationships';

function determineNodeType(filePath: string, file: ParsedProject['files'][0]): NodeType {
  if (detectEntryPoint(filePath)) return 'entry';
  if (file.apiRoutes.length > 0) return 'api';
  if (file.databaseModels.length > 0) return 'database';
  if (file.components.length > 0) return 'component';
  if (file.hooks.length > 0) return 'hook';
  if (isTestFile(filePath)) return 'test';
  if (isStyleFile(filePath)) return 'style';
  if (isConfigFile(filePath)) return 'config';
  if (file.classes.length > 0 || file.externalCalls.length > 0) return 'service';
  return 'service';
}

function createNodeId(filePath: string): string {
  return `node_${normalizePath(filePath).replace(/[^a-zA-Z0-9]/g, '_')}`;
}


export function buildGraph(
  project: ParsedProject,
  aiEnrichment: AIEnrichmentResult | null
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const filePathToNodeId = new Map<string, string>();
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Build nodes
  for (const file of project.files) {
    const nodeId = createNodeId(file.filePath);
    filePathToNodeId.set(normalizePath(file.filePath), nodeId);

    const nodeType = determineNodeType(file.filePath, file);
    const aiData = aiEnrichment?.fileDescriptions?.[file.filePath];

    const imports: ImportInfo[] = file.imports.map((imp) => ({
      source: imp.source,
      specifiers: imp.specifiers,
      isDefault: imp.isDefault,
      isDynamic: imp.isDynamic,
    }));

    const highlights: string[] = [];
    if (file.components.length > 0) highlights.push(`${file.components.length} component(s)`);
    if (file.hooks.length > 0) highlights.push(`${file.hooks.length} hook(s)`);
    if (file.apiRoutes.length > 0) highlights.push(`${file.apiRoutes.length} API route(s)`);
    if (file.databaseModels.length > 0) highlights.push(`${file.databaseModels.length} model(s)`);
    if (file.externalCalls.length > 0) highlights.push('External calls');
    if (file.hasParseError) highlights.push('Parse error');

    const data: WorkflowNodeData = {
      id: nodeId,
      label: file.fileName,
      filePath: file.filePath,
      nodeType,
      language: file.language,
      lineCount: file.lineCount,
      exports: file.exports.map((e) => e.name),
      imports,
      description: aiData?.purpose ?? '',
      responsibility: aiData?.responsibility ?? '',
      dataIn: aiData?.dataIn ?? '',
      dataOut: aiData?.dataOut ?? '',
      subsystem: aiData?.subsystem ?? '',
      metrics: {
        dependencies: file.imports.length,
        dependents: 0, // Computed below
      },
      highlights,
      hasError: file.hasParseError,
      errorMessage: file.parseErrorMessage,
    };

    // Add API-specific data
    if (file.apiRoutes.length > 0) {
      data.httpMethod = file.apiRoutes[0].method;
    }
    if (file.databaseModels.length > 0) {
      data.modelName = file.databaseModels[0].name;
      data.fieldCount = file.databaseModels[0].fields.length;
    }
    if (file.classes.length > 0) {
      data.methodCount = file.classes.reduce((sum, c) => sum + c.methods.length, 0);
    }

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x: 0, y: 0 },
      data,
    });
  }

  // Build import edges
  const edgeSet = new Set<string>();
  for (const file of project.files) {
    const sourceId = filePathToNodeId.get(normalizePath(file.filePath));
    if (!sourceId) continue;

    for (const imp of file.imports) {
      const resolvedPath = resolveImportPath(file.filePath, imp.source, filePathToNodeId);
      if (resolvedPath) {
        const targetId = filePathToNodeId.get(resolvedPath);
        if (targetId && targetId !== sourceId) {
          const edgeKey = `${sourceId}->${targetId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              id: `edge_${edgeKey}`,
              source: sourceId,
              target: targetId,
              type: 'dependency',
              data: {
                edgeType: 'import',
                label: imp.specifiers.join(', ') || undefined,
              },
            });
          }
        }
      }
    }
  }

  // Add inferred relationships
  const inferred = inferRelationships(project, filePathToNodeId);
  for (const edge of inferred) {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      edges.push(edge);
    }
  }

  // Add AI-inferred edges
  if (aiEnrichment?.inferredEdges) {
    for (const aiEdge of aiEnrichment.inferredEdges) {
      const sourceId = filePathToNodeId.get(normalizePath(aiEdge.source));
      const targetId = filePathToNodeId.get(normalizePath(aiEdge.target));
      if (sourceId && targetId && sourceId !== targetId) {
        const edgeKey = `${sourceId}->${targetId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            id: `edge_ai_${edgeKey}`,
            source: sourceId,
            target: targetId,
            type: 'dataflow',
            data: {
              edgeType: 'inferred',
              label: aiEdge.relationship,
              description: aiEdge.dataFlowing,
              dataFlowing: aiEdge.dataFlowing,
            },
          });
        }
      }
    }
  }

  // Compute dependents count
  for (const edge of edges) {
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (targetNode) {
      targetNode.data.metrics.dependents++;
    }
  }

  return { nodes, edges };
}

function resolveImportPath(
  fromFilePath: string,
  importSource: string,
  fileMap: Map<string, string>
): string | null {
  // Skip node_modules / external dependencies
  if (!importSource.startsWith('.') && !importSource.startsWith('@/') && !importSource.startsWith('~/')) {
    return null;
  }

  // Handle alias resolution
  let resolved = importSource;
  if (resolved.startsWith('@/')) {
    resolved = resolved.slice(2);
  } else if (resolved.startsWith('~/')) {
    resolved = resolved.slice(2);
  } else if (resolved.startsWith('.')) {
    // Relative path resolution
    const fromDir = normalizePath(fromFilePath).split('/').slice(0, -1).join('/');
    const parts = resolved.split('/');
    const dirParts = fromDir.split('/');

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        dirParts.pop();
      } else {
        dirParts.push(part);
      }
    }
    resolved = dirParts.join('/');
  }

  resolved = normalizePath(resolved);

  // Try exact match first
  if (fileMap.has(resolved)) return resolved;

  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of extensions) {
    if (fileMap.has(resolved + ext)) return resolved + ext;
  }

  // Try with /index
  for (const ext of extensions) {
    if (fileMap.has(resolved + '/index' + ext)) return resolved + '/index' + ext;
  }

  return null;
}

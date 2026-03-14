import type { ParsedProject } from '@/lib/types/project';
import type { WorkflowEdge, WorkflowEdgeData } from '@/lib/types/graph';
import { normalizePath } from '@/lib/utils/fileUtils';

export function inferRelationships(
  project: ParsedProject,
  filePathToNodeId: Map<string, string>
): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  const edgeSet = new Set<string>();

  const addEdge = (
    sourceId: string,
    targetId: string,
    data: WorkflowEdgeData
  ) => {
    const key = `${sourceId}->${targetId}`;
    if (!edgeSet.has(key) && sourceId !== targetId) {
      edgeSet.add(key);
      edges.push({
        id: `edge_infer_${key}`,
        source: sourceId,
        target: targetId,
        type: 'dataflow',
        data,
      });
    }
  };

  // 1. Components that fetch from API routes
  for (const file of project.files) {
    const fileId = filePathToNodeId.get(normalizePath(file.filePath));
    if (!fileId) continue;

    // Look for fetch('/api/...' patterns
    const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]*\/api\/[^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;
    while ((match = fetchRegex.exec(file.rawContent)) !== null) {
      const apiPath = match[1];
      // Match against known API routes
      for (const route of project.apiRoutes) {
        const routeId = filePathToNodeId.get(normalizePath(route.filePath));
        if (routeId && apiPath.includes(route.path.replace(/^\//, ''))) {
          addEdge(fileId, routeId, {
            edgeType: 'api_call',
            label: `${route.method} ${route.path}`,
            httpMethod: route.method,
            isAnimated: true,
          });
        }
      }
    }
  }

  // 2. Files accessing the same database model
  const modelToFiles = new Map<string, string[]>();
  for (const model of project.databaseModels) {
    const modelId = filePathToNodeId.get(normalizePath(model.filePath));
    if (modelId) {
      const files = modelToFiles.get(model.name) ?? [];
      files.push(modelId);
      modelToFiles.set(model.name, files);
    }
  }

  // Find files that reference model names
  for (const file of project.files) {
    const fileId = filePathToNodeId.get(normalizePath(file.filePath));
    if (!fileId) continue;

    for (const [modelName, modelNodeIds] of modelToFiles) {
      if (
        file.rawContent.includes(modelName) &&
        !modelNodeIds.includes(fileId)
      ) {
        for (const modelId of modelNodeIds) {
          addEdge(fileId, modelId, {
            edgeType: 'db_query',
            label: `Uses ${modelName}`,
            isAnimated: true,
          });
        }
      }
    }
  }

  // 3. Shared state stores and consumers
  for (const file of project.files) {
    const fileId = filePathToNodeId.get(normalizePath(file.filePath));
    if (!fileId) continue;

    // Detect zustand/redux store usage
    const storePatterns = [
      /useStore|useAppStore|useWorkflowStore/g,
      /useSelector|useDispatch/g,
      /useContext\s*\(\s*(\w+Context)\s*\)/g,
    ];

    for (const pattern of storePatterns) {
      const matches = file.rawContent.match(pattern);
      if (matches) {
        // Find the store definition file
        for (const otherFile of project.files) {
          if (otherFile.filePath === file.filePath) continue;
          const otherId = filePathToNodeId.get(normalizePath(otherFile.filePath));
          if (!otherId) continue;

          if (
            otherFile.exports.some(
              (e) =>
                e.name.includes('Store') ||
                e.name.includes('store') ||
                e.name.includes('Context')
            )
          ) {
            addEdge(fileId, otherId, {
              edgeType: 'dataflow',
              label: 'Uses state',
              description: 'Shared state consumption',
            });
          }
        }
      }
    }
  }

  // 4. Detect circular dependencies
  const circularEdges = detectCircularDeps(edges);
  for (const edge of circularEdges) {
    edge.data = { ...(edge.data ?? { edgeType: 'dataflow' }), label: '⚠️ Circular' };
  }

  return edges;
}

function detectCircularDeps(edges: WorkflowEdge[]): WorkflowEdge[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) ?? [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }

  const circular: WorkflowEdge[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (stack.has(node)) {
      // Found cycle — mark the edge that closes it
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        const cycleEdge = edges.find(
          (e) =>
            e.source === path[path.length - 1] && e.target === node
        );
        if (cycleEdge) circular.push(cycleEdge);
      }
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      dfs(neighbor, [...path, node]);
    }

    stack.delete(node);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return circular;
}

import type { WorkflowNode, WorkflowEdge } from '@/lib/types/graph';
import dagre from 'dagre';

interface LayoutOptions {
  direction: 'TB' | 'LR';
  rankSep: number;
  nodeSep: number;
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 120;

function getLayerRank(nodeType: string): number {
  const layers: Record<string, number> = {
    entry: 0,
    api: 1,
    component: 2,
    hook: 2,
    service: 2,
    config: 3,
    style: 3,
    test: 3,
    database: 4,
    external: 4,
  };
  return layers[nodeType] ?? 2;
}

export function computeLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: LayoutOptions = { direction: 'TB', rankSep: 120, nodeSep: 80 }
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: options.direction,
    ranksep: options.rankSep,
    nodesep: options.nodeSep,
    marginx: 50,
    marginy: 50,
  });

  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      rank: getLayerRank(node.data.nodeType),
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const nodeId of g.nodes()) {
    const nodeData = g.node(nodeId);
    if (nodeData) {
      positions[nodeId] = {
        x: nodeData.x - DEFAULT_NODE_WIDTH / 2,
        y: nodeData.y - DEFAULT_NODE_HEIGHT / 2,
      };
    }
  }

  return positions;
}

export function computeClusterLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: LayoutOptions = { direction: 'TB', rankSep: 120, nodeSep: 80 }
): Record<string, { x: number; y: number }> {
  // Group nodes by directory
  const groups = new Map<string, WorkflowNode[]>();
  for (const node of nodes) {
    const dir = node.data.filePath.split('/').slice(0, -1).join('/') || 'root';
    const group = groups.get(dir) ?? [];
    group.push(node);
    groups.set(dir, group);
  }

  // Layout each group, then lay out groups
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options.direction,
    ranksep: options.rankSep * 1.5,
    nodesep: options.nodeSep * 1.5,
    marginx: 80,
    marginy: 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const groupDimensions = new Map<string, { width: number; height: number }>();
  const intraPositions = new Map<string, Record<string, { x: number; y: number }>>();

  for (const [dir, groupNodes] of groups) {
    const groupEdges = edges.filter(
      (e) =>
        groupNodes.some((n) => n.id === e.source) &&
        groupNodes.some((n) => n.id === e.target)
    );

    const subPositions = computeLayout(groupNodes, groupEdges, {
      ...options,
      rankSep: 60,
      nodeSep: 40,
    });
    intraPositions.set(dir, subPositions);

    let maxX = 0;
    let maxY = 0;
    for (const pos of Object.values(subPositions)) {
      maxX = Math.max(maxX, pos.x + DEFAULT_NODE_WIDTH);
      maxY = Math.max(maxY, pos.y + DEFAULT_NODE_HEIGHT);
    }

    const dims = { width: maxX + 40, height: maxY + 40 };
    groupDimensions.set(dir, dims);
    g.setNode(dir, dims);
  }

  // Add inter-group edges
  for (const edge of edges) {
    const sourceDir = findNodeGroup(edge.source, groups);
    const targetDir = findNodeGroup(edge.target, groups);
    if (sourceDir && targetDir && sourceDir !== targetDir) {
      if (g.hasNode(sourceDir) && g.hasNode(targetDir)) {
        g.setEdge(sourceDir, targetDir);
      }
    }
  }

  dagre.layout(g);

  // Compute final positions
  const positions: Record<string, { x: number; y: number }> = {};
  for (const dir of g.nodes()) {
    const groupNode = g.node(dir);
    if (!groupNode) continue;
    const subPos = intraPositions.get(dir);
    if (!subPos) continue;
    const dims = groupDimensions.get(dir) ?? { width: 0, height: 0 };

    const offsetX = groupNode.x - dims.width / 2;
    const offsetY = groupNode.y - dims.height / 2;

    for (const [nodeId, pos] of Object.entries(subPos)) {
      positions[nodeId] = {
        x: pos.x + offsetX + 20,
        y: pos.y + offsetY + 20,
      };
    }
  }

  return positions;
}

function findNodeGroup(nodeId: string, groups: Map<string, WorkflowNode[]>): string | null {
  for (const [dir, nodes] of groups) {
    if (nodes.some((n) => n.id === nodeId)) return dir;
  }
  return null;
}

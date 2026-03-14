'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, FileCode, Folder, FolderOpen } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import { buildFileTree, type FileTreeNode, getFileExtension, getLanguageFromExtension } from '@/lib/utils/fileUtils';
import { getLanguageColor } from '@/lib/utils/colorUtils';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  onFileClick: (path: string) => void;
}

function FileTreeItem({ node, depth, onFileClick }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.isDirectory) {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-elevated transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${node.name} folder`}
        >
          {expanded ? (
            <ChevronDown size={12} className="text-text-muted shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-text-muted shrink-0" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="text-text-secondary shrink-0" />
          ) : (
            <Folder size={14} className="text-text-secondary shrink-0" />
          )}
          <span className="text-xs text-text-primary truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const ext = getFileExtension(node.name);
  const lang = getLanguageFromExtension(ext);
  const color = getLanguageColor(lang);

  return (
    <button
      className="w-full flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-elevated transition-colors text-left"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => onFileClick(node.path)}
      aria-label={`${node.name} file`}
    >
      <FileCode size={14} style={{ color }} className="shrink-0" />
      <span className="text-xs text-text-secondary truncate">{node.name}</span>
    </button>
  );
}

export function FileTree() {
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectNode = useWorkflowStore((s) => s.selectNode);

  const handleFileClick = useCallback(
    (filePath: string) => {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const node = nodes.find(
        (n) => n.data.filePath.replace(/\\/g, '/').endsWith(normalizedPath)
      );
      if (node) {
        selectNode(node.id);
      }
    },
    [nodes, selectNode]
  );

  if (!parsedProject) return null;

  const filePaths = parsedProject.files.map((f) => f.filePath);
  const tree = buildFileTree(filePaths);

  return (
    <div className="overflow-y-auto">
      {tree.children.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={0}
          onFileClick={handleFileClick}
        />
      ))}
    </div>
  );
}

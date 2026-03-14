'use client';

import { Badge } from '@/components/ui/Badge';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';
import { nodeTypeLabel } from '@/lib/utils/formatUtils';
import type { NodeType } from '@/lib/types/graph';

const NODE_TYPES: NodeType[] = [
  'entry', 'component', 'hook', 'api', 'service',
  'database', 'config', 'style', 'test', 'external',
];

export function LegendPanel() {
  return (
    <div
      className="absolute top-4 right-4 bg-surface border border-border-muted rounded-lg p-3 shadow-lg z-10"
      aria-label="Graph legend"
    >
      <p className="text-[11px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">
        Legend
      </p>
      <div className="space-y-1">
        {NODE_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: getNodeTypeColor(type) }}
              aria-hidden="true"
            />
            <span className="text-[11px] text-text-secondary">
              {nodeTypeLabel(type)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-border-subtle space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-border-default" aria-hidden="true" />
          <span className="text-[10px] text-text-muted">Import</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t border-dashed border-accent-primary" aria-hidden="true" />
          <span className="text-[10px] text-text-muted">Data Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t border-dashed" style={{ borderColor: '#A855F7' }} aria-hidden="true" />
          <Badge color="#A855F7" size="sm">AI</Badge>
          <span className="text-[10px] text-text-muted">Inferred</span>
        </div>
      </div>
    </div>
  );
}

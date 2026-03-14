'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowNodeData } from '@/lib/types/graph';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';

function DatabaseNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const color = getNodeTypeColor('database');

  return (
    <div
      className="relative rounded-xl bg-[#232731] border border-[#3A4150] flex items-center p-3 pr-6 min-w-[220px] transition-all duration-200"
      style={{
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 8px 32px rgba(0,0,0,0.6)`
          : '0 4px 20px rgba(0,0,0,0.3)',
      }}
      aria-label={`Database model: ${data.label}`}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !border-2 !bg-[#232731] !border-[#666] hover:!border-white transition-colors"
        style={{ left: '-6px' }}
      />
      
      <div className="flex items-center justify-center w-12 h-12 rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Database size={24} style={{ color }} />
      </div>

      <div className="ml-4 flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-200 truncate">{data.modelName || data.label}</p>
        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider truncate">
          Database Model
        </p>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !border-2 !bg-[#232731] !border-[#666] hover:!border-white transition-colors"
        style={{ right: '-6px' }}
      />
    </div>
  );
}

export const DatabaseNode = memo(DatabaseNodeComponent);

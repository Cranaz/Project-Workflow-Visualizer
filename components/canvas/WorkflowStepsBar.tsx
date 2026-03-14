'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore, useWorkflowSteps } from '@/lib/store/workflowStore';
import { ArrowRight, Cog, Database, ArrowLeft, LucideIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STEP_ICONS: Record<string, LucideIcon> = {
  entry: ArrowRight,
  process: Cog,
  data: Database,
  response: ArrowLeft,
};

export function WorkflowStepsBar() {
  const workflowSteps = useWorkflowSteps();
  const activeStepIndex = useWorkflowStore((s) => s.activeWorkflowStepIndex);
  const setActiveWorkflowStep = useWorkflowStore((s) => s.setActiveWorkflowStep);
  const setReportOpen = useWorkflowStore((s) => s.setReportOpen);

  if (workflowSteps.length === 0) return null;

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-full overflow-x-auto">
        <div className="flex items-center flex-nowrap bg-[#1E222A]/80 backdrop-blur-md border border-white/5 rounded-full px-3 py-2 shadow-2xl">
        {/* Overview Tab */}
        <div className="flex items-center">
          <div className="relative group">
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/10 z-10 bg-[#2D333E]" />
            <button
              onClick={() => setReportOpen(true)}
              className="relative px-4 py-2 flex items-center gap-2 rounded-lg bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            >
              <FileText size={14} />
              <span className="text-[11px] font-bold whitespace-nowrap">
                Project Overview
              </span>
            </button>
            <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/10 z-10 bg-[#2D333E]" />
          </div>
          <div className="w-8 h-[1px] bg-gradient-to-r from-accent-primary/30 to-white/10 relative" />
        </div>

        {workflowSteps.map((step, i) => {
          const Icon = STEP_ICONS[step.type] || ArrowRight;
          const isActive = activeStepIndex === i;
          const isPast = activeStepIndex !== null && i < activeStepIndex;

          return (
            <div key={i} className="flex items-center flex-nowrap">
              {/* Connector line from previous step */}
              {i > 0 && (
                <div className="w-8 h-[1px] bg-gradient-to-r from-white/10 to-white/10 relative">
                  {(isPast || (isActive && i > 0)) && (
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="absolute inset-0 bg-accent-primary origin-left"
                    />
                  )}
                </div>
              )}

              {/* Step Node */}
              <div className="relative group">
                {/* Left Dot */}
                <div 
                  className={cn(
                    "absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/10 z-10 transition-colors",
                    isActive ? "bg-accent-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-[#2D333E]"
                  )}
                />

                {/* Tab */}
                <button
                  onClick={() => setActiveWorkflowStep(i)}
                  className={cn(
                    "relative px-4 py-2 flex items-center gap-2 rounded-lg transition-all duration-300",
                    isActive 
                      ? "bg-accent-primary/20 border border-accent-primary/50 text-white" 
                      : "bg-[#252A34] border border-white/5 text-text-muted hover:bg-[#2D333E] hover:text-text-primary"
                  )}
                >
                  <Icon size={14} className={isActive ? "text-accent-primary" : "text-text-muted"} />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {step.title}
                  </span>
                </button>

                {/* Right Dot */}
                <div 
                  className={cn(
                    "absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/10 z-10 transition-colors",
                    isActive ? "bg-accent-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-[#2D333E]"
                  )}
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

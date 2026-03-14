import { NextRequest, NextResponse } from 'next/server';
import { enrichProject } from '@/lib/ai/enrichProject';
import {
  getAnalysisEntry,
  getProjectSnapshot,
  setProjectEnrichment,
} from '@/lib/ai/analysisCache';
import { queueAnalysisJobs } from '@/lib/ai/analysisQueue';
import type { ParsedProject } from '@/lib/types/project';

interface EnrichRequest {
  project?: ParsedProject;
  analysisId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EnrichRequest;

    if (body?.analysisId) {
      const cached = getAnalysisEntry(body.analysisId);
      if (cached?.projectEnrichment) {
        return NextResponse.json({
          success: true,
          enrichment: cached.projectEnrichment,
          model: cached.aiModel,
          aiTimeMs: cached.aiTimeMs,
          cached: true,
        });
      }
      const snapshot = getProjectSnapshot(body.analysisId);
      if (snapshot) {
        queueAnalysisJobs(body.analysisId, snapshot);
      }
      return NextResponse.json(
        {
          success: false,
          pending: true,
          error: cached?.projectError ?? 'AI enrichment is still running',
          status: cached?.projectStatus ?? 'working',
        },
        { status: 202 }
      );
    }

    if (!body?.project) {
      return NextResponse.json(
        { success: false, error: 'project payload is required' },
        { status: 400 }
      );
    }

    const start = Date.now();
    const result = await enrichProject(body.project);
    const aiTimeMs = Date.now() - start;

    if (body.analysisId) {
      setProjectEnrichment(body.analysisId, result.enrichment, {
        aiModel: result.model,
        aiTimeMs,
      });
    }

    return NextResponse.json({
      success: true,
      enrichment: result.enrichment,
      model: result.model,
      aiTimeMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enrich project';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export const maxDuration = 600;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { enrichProject } from '@/lib/ai/enrichProject';
import type { ParsedProject } from '@/lib/types/project';

interface EnrichRequest {
  project: ParsedProject;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as EnrichRequest;

    if (!body?.project) {
      return NextResponse.json(
        { success: false, error: 'project payload is required' },
        { status: 400 }
      );
    }

    const start = Date.now();
    const result = await enrichProject(body.project);
    const aiTimeMs = Date.now() - start;

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'AI enrichment failed' },
        { status: 500 }
      );
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

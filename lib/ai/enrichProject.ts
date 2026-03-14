import type { ParsedProject, AIEnrichmentResult } from '@/lib/types/project';
import { callOllama } from './ollamaClient';
import { buildPrompt } from './buildPrompt';

export async function enrichProject(
  parsed: ParsedProject
): Promise<{ enrichment: AIEnrichmentResult; model: string } | null> {
  try {
    const prompt = buildPrompt(parsed);
    const { response: rawText, model } = await callOllama(prompt);

    // Strip any accidental markdown fences
    const clean = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Find the first { and last } to extract pure JSON
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON found in AI response');
    }

    const jsonStr = clean.slice(start, end + 1);
    const result = JSON.parse(jsonStr) as AIEnrichmentResult;

    // Validate required fields
    if (!result.projectSummary) result.projectSummary = '';
    if (!result.detailedReport) result.detailedReport = '';
    if (!Array.isArray(result.workflowSteps)) result.workflowSteps = [];
    if (!result.fileDescriptions) result.fileDescriptions = {};
    if (!Array.isArray(result.inferredEdges)) result.inferredEdges = [];
    if (!Array.isArray(result.subsystems)) result.subsystems = [];
    if (!Array.isArray(result.warnings)) result.warnings = [];

    return { enrichment: result, model };
  } catch (err) {
    console.error('AI enrichment failed:', err);
    return null;
  }
}

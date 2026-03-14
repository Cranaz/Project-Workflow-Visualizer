import type { ParsedProject, AIEnrichmentResult } from '@/lib/types/project';
import { callOllama } from './ollamaClient';
import { buildPrompt } from './buildPrompt';
import { buildDetailedReportPrompt } from './buildDetailedReportPrompt';

function extractJsonObject(rawText: string): string {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object start found in AI response');
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  throw new Error('No complete JSON object found in AI response (possibly truncated)');
}

function parseAiJson(rawText: string): AIEnrichmentResult {
  const jsonStr = extractJsonObject(rawText);
  const result = JSON.parse(jsonStr) as AIEnrichmentResult;

  if (!result.projectSummary) result.projectSummary = '';
  if (!result.detailedReport) result.detailedReport = '';
  if (!Array.isArray(result.workflowSteps)) result.workflowSteps = [];
  if (!result.fileDescriptions) result.fileDescriptions = {};
  if (!Array.isArray(result.inferredEdges)) result.inferredEdges = [];
  if (!Array.isArray(result.subsystems)) result.subsystems = [];
  if (!Array.isArray(result.warnings)) result.warnings = [];

  return result;
}

export async function enrichProject(
  parsed: ParsedProject
): Promise<{ enrichment: AIEnrichmentResult; model: string }> {
  const prompt = buildPrompt(parsed);
  const { response: rawText, model } = await callOllama(prompt, { numPredict: 6000 });
  const result = parseAiJson(rawText);

  try {
    const reportPrompt = buildDetailedReportPrompt(parsed);
    const { response: detailedReport } = await callOllama(reportPrompt);
    const cleanedReport = detailedReport.replace(/```/g, '').trim();
    if (cleanedReport) {
      result.detailedReport = cleanedReport;
    }
  } catch (err) {
    console.warn('Detailed report generation failed:', err);
  }

  return { enrichment: result, model };
}

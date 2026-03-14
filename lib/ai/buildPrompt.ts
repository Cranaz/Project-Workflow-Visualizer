import type { ParsedProject } from '@/lib/types/project';
import { detectEntryPoint } from '@/lib/utils/fileUtils';
import { truncateContent } from '@/lib/utils/fileUtils';

const MAX_PROMPT_CHARS = 30_000;
const MAX_FILES_IN_PROMPT = 80;

interface FilePriority {
  filePath: string;
  content: string;
  priority: number;
  maxLines: number;
}

function getPromptPriority(filePath: string, project: ParsedProject): { priority: number; maxLines: number } {
  if (detectEntryPoint(filePath)) return { priority: 0, maxLines: 60 };

  const isApiRoute = project.apiRoutes.some((r) => r.filePath === filePath);
  if (isApiRoute) return { priority: 1, maxLines: 60 };

  const isDbModel = project.databaseModels.some((m) => m.filePath === filePath);
  if (isDbModel) return { priority: 2, maxLines: 60 };

  const file = project.files.find((f) => f.filePath === filePath);
  if (!file) return { priority: 9, maxLines: 10 };

  if (file.components.length > 0 || file.classes.length > 0) return { priority: 3, maxLines: 30 };
  if (file.hooks.length > 0) return { priority: 4, maxLines: 20 };

  const ext = file.extension;
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) return { priority: 5, maxLines: 15 };
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return { priority: 6, maxLines: 0 };
  if (file.filePath.includes('.test.') || file.filePath.includes('.spec.')) return { priority: 7, maxLines: 0 };

  return { priority: 5, maxLines: 20 };
}

function buildFileSection(files: FilePriority[]): string {
  let result = '';
  for (const fp of files) {
    if (fp.maxLines === 0) {
      result += `\n--- FILE: ${fp.filePath} (skipped - style/test) ---\n`;
      continue;
    }
    const truncated = truncateContent(fp.content, fp.maxLines);
    result += `\n--- FILE: ${fp.filePath} ---\n${truncated}\n`;
  }
  return result;
}

export function buildPrompt(project: ParsedProject): string {
  const filePriorities: FilePriority[] = project.files
    .map((f) => {
      const { priority, maxLines } = getPromptPriority(f.filePath, project);
      return {
        filePath: f.filePath,
        content: f.rawContent,
        priority,
        maxLines,
      };
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_FILES_IN_PROMPT);

  const preamble = `You are a senior software architect. Analyze the following project source code and return ONLY a valid JSON object. Do not write anything before or after the JSON. Do not use markdown code fences. Do not explain yourself. Return raw JSON.

PROJECT INFO:
- Name: ${project.projectName}
- Framework: ${project.detectedFramework}
- Languages: ${project.detectedLanguages.join(', ')}
- Total files: ${project.totalFiles}
- Total LOC: ${project.totalLinesOfCode}
- Entry points: ${project.entryPoints.join(', ') || 'none detected'}
- API routes: ${project.apiRoutes.map((r) => `${r.method} ${r.path}`).join(', ') || 'none'}
- Database models: ${project.databaseModels.map((m) => m.name).join(', ') || 'none'}
- Dependencies: ${project.dependencies.dependencies.map((d) => d.name).slice(0, 20).join(', ')}

SOURCE FILES:`;

  let fileSection = buildFileSection(filePriorities);

  // Trim if exceeding max chars
  const schemaInstruction = getSchemaInstruction();
  while (preamble.length + fileSection.length + schemaInstruction.length > MAX_PROMPT_CHARS && filePriorities.length > 5) {
    // Reduce lines for lowest priority files
    const lastFile = filePriorities[filePriorities.length - 1];
    if (lastFile.maxLines > 0) {
      lastFile.maxLines = Math.max(0, lastFile.maxLines - 10);
    } else {
      filePriorities.pop();
    }
    fileSection = buildFileSection(filePriorities);
  }

  return preamble + fileSection + '\n\n' + schemaInstruction;
}

function getSchemaInstruction(): string {
  return `Return this exact JSON structure:
{
  "projectSummary": "string - 2-3 sentence extremely concise summary of what this project does",
  "detailedReport": "string - A detailed but concise markdown overview (6-10 paragraphs). The full long-form report is generated separately.",
  "workflowSteps": [
    {
      "step": 1,
      "title": "string",
      "description": "string",
      "files": ["filePath1", "filePath2"],
      "type": "entry | process | data | response"
    }
  ],
  "fileDescriptions": {
    "filePath": {
      "purpose": "string - one sentence (max 20 words)",
      "responsibility": "string - one sentence (max 20 words)",
      "dataIn": "string - one sentence (max 20 words)",
      "dataOut": "string - one sentence (max 20 words)",
      "subsystem": "string - 1-3 words"
    }
  },
  "inferredEdges": [
    {
      "source": "filePath",
      "target": "filePath",
      "relationship": "string",
      "dataFlowing": "string",
      "edgeType": "dataflow | api_call | db_query | renders | triggers"
    }
  ],
  "subsystems": [
    {
      "name": "string",
      "color": "#hexcolor",
      "files": ["filePath1"],
      "description": "string"
    }
  ],
  "warnings": ["string - any architectural concerns or issues detected"]
}`;
}

import type { ParsedFile, EnvVariable } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

function categorizeEnvVar(name: string): EnvVariable['category'] {
  const upper = name.toUpperCase();
  if (upper.includes('DATABASE') || upper.includes('DB_') || upper === 'DATABASE_URL' || upper.includes('MONGO') || upper.includes('POSTGRES') || upper.includes('MYSQL') || upper.includes('REDIS')) {
    return 'database';
  }
  if (upper.includes('AUTH') || upper.includes('JWT') || upper.includes('SESSION') || upper.includes('OAUTH') || upper.includes('TOKEN')) {
    return 'auth';
  }
  if (upper.startsWith('API_') || upper.includes('API_KEY') || upper.includes('ENDPOINT')) {
    return 'api';
  }
  if (upper.startsWith('NEXT_PUBLIC_') || upper.startsWith('PUBLIC_') || upper.startsWith('VITE_')) {
    return 'public';
  }
  if (upper.includes('SECRET') || upper.includes('PRIVATE') || upper.includes('KEY') && !upper.includes('PUBLIC')) {
    return 'secret';
  }
  if (upper === 'PORT' || upper.includes('_PORT')) {
    return 'port';
  }
  return 'other';
}

export function parseEnvFile(filePath: string, content: string): ParsedFile {
  const lines = content.split('\n');
  const envVars: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const name = trimmed.slice(0, eqIndex).trim();
      if (/^[A-Z_][A-Z0-9_]*$/i.test(name)) {
        envVars.push(name);
      }
    }
  }

  return {
    filePath,
    fileName: getFileName(filePath),
    language: 'ENV',
    extension: 'env',
    lineCount: countLines(content),
    rawContent: '', // Never store env values
    imports: [],
    exports: envVars.map(name => ({
      name,
      isDefault: false,
      type: 'variable' as const,
    })),
    components: [],
    hooks: [],
    apiRoutes: [],
    classes: [],
    typeDefinitions: [],
    envVariables: envVars,
    databaseModels: [],
    externalCalls: [],
    hasParseError: false,
  };
}

export function extractEnvVariables(content: string): EnvVariable[] {
  const lines = content.split('\n');
  const variables: EnvVariable[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const name = trimmed.slice(0, eqIndex).trim();
      if (/^[A-Z_][A-Z0-9_]*$/i.test(name)) {
        variables.push({ name, category: categorizeEnvVar(name) });
      }
    }
  }

  return variables;
}

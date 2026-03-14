import type { DependencyInfo, PackageJsonData, TsConfigData } from '@/lib/types/parser';
import type { ParsedFile } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

const FRAMEWORK_DEPS = new Set([
  'next', 'react', 'react-dom', 'vue', 'nuxt', '@angular/core', 'svelte',
  '@sveltejs/kit', 'express', 'fastify', 'koa', 'hono', 'nest', '@nestjs/core',
  'remix', 'gatsby', 'astro', 'solid-js', 'preact', 'ember', 'django', 'flask',
]);

const UI_DEPS = new Set([
  'tailwindcss', '@mui/material', 'antd', '@chakra-ui/react', 'framer-motion',
  'styled-components', '@emotion/styled', '@radix-ui/react-dialog', 'lucide-react',
  'react-icons', 'reactflow', 'd3', 'three', '@react-three/fiber', 'recharts',
]);

const DB_DEPS = new Set([
  'prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'mongoose', 'knex',
  'sequelize', 'pg', 'mysql2', 'better-sqlite3', 'redis', 'ioredis',
  '@supabase/supabase-js', 'firebase', '@firebase/firestore',
]);

const TEST_DEPS = new Set([
  'vitest', 'jest', '@jest/core', 'mocha', 'cypress', 'playwright',
  '@testing-library/react', '@testing-library/jest-dom', 'chai',
]);

function categorizeDep(name: string): DependencyInfo['category'] {
  if (FRAMEWORK_DEPS.has(name)) return 'framework';
  if (UI_DEPS.has(name)) return 'ui';
  if (DB_DEPS.has(name)) return 'database';
  if (TEST_DEPS.has(name)) return 'testing';
  if (name.startsWith('@types/') || name.includes('eslint') || name.includes('prettier')) return 'devtool';
  return 'other';
}

function detectFramework(deps: Record<string, string>): string {
  if (deps['next']) return 'Next.js';
  if (deps['nuxt']) return 'Nuxt';
  if (deps['@angular/core']) return 'Angular';
  if (deps['@sveltejs/kit']) return 'SvelteKit';
  if (deps['svelte']) return 'Svelte';
  if (deps['vue']) return 'Vue';
  if (deps['gatsby']) return 'Gatsby';
  if (deps['remix'] || deps['@remix-run/react']) return 'Remix';
  if (deps['astro']) return 'Astro';
  if (deps['solid-js']) return 'Solid';
  if (deps['express']) return 'Express';
  if (deps['fastify']) return 'Fastify';
  if (deps['@nestjs/core']) return 'NestJS';
  if (deps['koa']) return 'Koa';
  if (deps['hono']) return 'Hono';
  if (deps['react']) return 'React';
  return 'Unknown';
}

export function parsePackageJson(content: string): PackageJsonData {
  const json = JSON.parse(content) as Record<string, unknown>;
  const deps = (json.dependencies ?? {}) as Record<string, string>;
  const devDeps = (json.devDependencies ?? {}) as Record<string, string>;
  const scripts = (json.scripts ?? {}) as Record<string, string>;

  const dependencies: DependencyInfo[] = Object.entries(deps).map(([name, version]) => ({
    name,
    version,
    category: categorizeDep(name),
    isDev: false,
  }));

  const devDependencies: DependencyInfo[] = Object.entries(devDeps).map(([name, version]) => ({
    name,
    version,
    category: categorizeDep(name),
    isDev: true,
  }));

  return {
    name: (json.name as string) ?? 'untitled',
    version: (json.version as string) ?? '0.0.0',
    description: (json.description as string) ?? '',
    scripts: Object.entries(scripts).map(([name, command]) => ({ name, command })),
    dependencies,
    devDependencies,
    detectedFramework: detectFramework(deps),
  };
}

export function parseTsConfig(content: string): TsConfigData {
  const json = JSON.parse(content) as Record<string, unknown>;
  const compilerOptions = (json.compilerOptions ?? {}) as Record<string, unknown>;
  const paths = (compilerOptions.paths ?? {}) as Record<string, string[]>;
  return { pathAliases: paths };
}

export function parseJsonFile(filePath: string, content: string): ParsedFile {
  const fileName = getFileName(filePath);
  const exports: ParsedFile['exports'] = [];

  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    const topKeys = Object.keys(json);
    for (const key of topKeys.slice(0, 20)) {
      exports.push({ name: key, isDefault: false, type: 'const' });
    }
  } catch {
    // Invalid JSON
  }

  return {
    filePath,
    fileName,
    language: 'JSON',
    extension: 'json',
    lineCount: countLines(content),
    rawContent: content,
    imports: [],
    exports,
    components: [],
    hooks: [],
    apiRoutes: [],
    classes: [],
    typeDefinitions: [],
    envVariables: [],
    databaseModels: [],
    externalCalls: [],
    hasParseError: false,
  };
}

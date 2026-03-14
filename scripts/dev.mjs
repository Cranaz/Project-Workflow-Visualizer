#!/usr/bin/env node

/**
 * Dev startup script for Project Workflow Visualizer.
 * Checks Ollama status, ensures primary model availability, then starts Next.js.
 * Compatible with Windows (PowerShell) — uses only Node.js built-in modules.
 */

import { spawn } from 'child_process';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const DEFAULT_MODELS = [
    'qwen3.5:397b-cloud',
    'deepseek-v3.2:cloud',
    'glm-5:cloud',
    'kimi-k2.5:cloud',
];
const RAW_MODELS = process.env.OLLAMA_MODELS;
const PRIMARY_OVERRIDE = process.env.OLLAMA_MODEL;
const BASE_MODELS = RAW_MODELS
    ? RAW_MODELS.split(',').map((entry) => entry.trim()).filter(Boolean)
    : PRIMARY_OVERRIDE
        ? [PRIMARY_OVERRIDE, ...DEFAULT_MODELS]
        : [...DEFAULT_MODELS];
const MODEL_LIST = [...new Set(BASE_MODELS)];
const PRIMARY_MODEL = MODEL_LIST[0] ?? DEFAULT_MODELS[0];

function log(icon, message) {
    console.log(`${icon} ${message}`);
}

function banner() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Project Workflow Visualizer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
}

async function checkOllama() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return { running: false, models: [] };
        const data = await res.json();
        const models = (data.models ?? []).map((m) => m.name);
        return { running: true, models };
    } catch {
        return { running: false, models: [] };
    }
}

function matchesModel(name, expected) {
    if (!expected) return false;
    if (name === expected) return true;
    if (!expected.includes(':')) {
        return name.startsWith(`${expected}:`) || name.includes(expected);
    }
    return false;
}

async function pullModel() {
    return new Promise((resolve, reject) => {
        log('⬇️ ', `Model ${PRIMARY_MODEL} not found — pulling now...`);
        log('  ', '(This may take a while on first run)');

        const child = spawn('ollama', ['pull', PRIMARY_MODEL], {
            stdio: 'inherit',
            shell: true,
        });

        child.on('close', (code) => {
            if (code === 0) {
                log('✅', 'Model pulled successfully');
                resolve(undefined);
            } else {
                reject(new Error(`ollama pull exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

function startNextDev() {
    log('🌐', 'Starting Next.js dev server...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const child = spawn('npx', ['next', 'dev'], {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd(),
    });

    child.on('close', (code) => {
        process.exit(code ?? 0);
    });

    child.on('error', (err) => {
        console.error('Failed to start Next.js:', err.message);
        process.exit(1);
    });

    process.on('SIGINT', () => {
        child.kill('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        child.kill('SIGTERM');
        process.exit(0);
    });
}

async function main() {
    banner();

    const ollamaStatus = await checkOllama();

    if (ollamaStatus.running) {
        log('✅', `Ollama is running at ${OLLAMA_HOST}`);

        const hasModel = ollamaStatus.models.some((m) => matchesModel(m, PRIMARY_MODEL));

        if (hasModel) {
            log('✅', `Model ${PRIMARY_MODEL} is available`);
        } else {
            try {
                await pullModel();
            } catch (err) {
                log('⚠️ ', `Failed to pull model: ${err.message}`);
                log('  ', 'AI enrichment will be unavailable — structural analysis only');
            }
        }
    } else {
        log('⚠️ ', `Ollama is not reachable at ${OLLAMA_HOST}`);
        log('  ', 'Please start Ollama manually to enable AI enrichment.');
        log('  ', 'The app will still work with structural analysis only.');
    }

    console.log('');
    startNextDev();
}

main().catch((err) => {
    console.error('Startup error:', err);
    process.exit(1);
});

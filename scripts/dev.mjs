#!/usr/bin/env node

/**
 * Dev startup script for Project Workflow Visualizer.
 * Checks Ollama status, ensures model availability, then starts Next.js.
 * Compatible with Windows (PowerShell) - uses only Node.js built-in modules.
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
const AUTO_START = (process.env.OLLAMA_AUTO_START ?? 'true') === 'true';
const AUTO_PULL = (process.env.OLLAMA_AUTO_PULL ?? 'true') === 'true';
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
    console.log('------------------------------------');
    console.log('  Project Workflow Visualizer');
    console.log('------------------------------------');
    console.log('');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalHost(host) {
    try {
        const normalized = host.includes('://') ? host : `http://${host}`;
        const url = new URL(normalized);
        return (
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '0.0.0.0' ||
            url.hostname === '::1'
        );
    } catch {
        return false;
    }
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

async function waitForOllamaReady(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const status = await checkOllama();
        if (status.running) return status;
        await delay(500);
    }
    return checkOllama();
}

function matchesModel(name, expected) {
    if (!expected) return false;
    if (name === expected) return true;
    if (!expected.includes(':')) {
        return name.startsWith(`${expected}:`) || name.includes(expected);
    }
    return false;
}

async function pullModel(model) {
    return new Promise((resolve, reject) => {
        log('[pull]', `Model ${model} not found - pulling now...`);
        log('     ', '(This may take a while on first run)');

        const child = spawn('ollama', ['pull', model], {
            stdio: 'inherit',
            shell: true,
        });

        child.on('close', (code) => {
            if (code === 0) {
                log('[ok] ', 'Model pulled successfully');
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

async function startOllamaServe() {
    return new Promise((resolve, reject) => {
        const child = spawn('ollama', ['serve'], {
            stdio: 'ignore',
            shell: true,
            detached: true,
            windowsHide: true,
        });

        child.on('error', (err) => reject(err));
        child.unref();
        resolve(undefined);
    });
}

function startNextDev() {
    log('[dev]', 'Starting Next.js dev server...');
    console.log('------------------------------------');
    console.log('');

    const child = spawn('npx', ['next', 'dev', '--webpack'], {
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

    const isLocal = isLocalHost(OLLAMA_HOST);
    let ollamaStatus = await checkOllama();

    if (!ollamaStatus.running && AUTO_START && isLocal) {
        log('[ai] ', `Ollama not running at ${OLLAMA_HOST} - starting...`);
        try {
            await startOllamaServe();
            ollamaStatus = await waitForOllamaReady();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log('[warn]', `Failed to start Ollama: ${message}`);
        }
    }

    if (ollamaStatus.running) {
        log('[ok] ', `Ollama is running at ${OLLAMA_HOST}`);

        const available = MODEL_LIST.find((model) =>
            ollamaStatus.models.some((name) => matchesModel(name, model))
        );

        if (available) {
            log('[ok] ', `Model ${available} is available`);
            process.env.OLLAMA_MODEL = available;
        } else if (AUTO_PULL && isLocal) {
            let selected = null;
            for (const model of MODEL_LIST) {
                try {
                    await pullModel(model);
                    const refreshed = await checkOllama();
                    if (refreshed.running) {
                        const match = refreshed.models.some((name) => matchesModel(name, model));
                        if (match) {
                            selected = model;
                            ollamaStatus = refreshed;
                            break;
                        }
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    log('[warn]', `Failed to pull ${model}: ${message}`);
                }
            }

            if (selected) {
                log('[ok] ', `Model ${selected} is available`);
                process.env.OLLAMA_MODEL = selected;
            } else {
                log('[warn]', 'No configured models are available yet.');
            }
        } else {
            log('[warn]', 'No configured models are available yet.');
        }
    } else {
        log('[warn]', `Ollama is not reachable at ${OLLAMA_HOST}`);
        log('     ', 'AI enrichment will be unavailable - structural analysis only.');
    }

    console.log('');
    startNextDev();
}

main().catch((err) => {
    console.error('Startup error:', err);
    process.exit(1);
});

import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './app/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',
        './hooks/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                base: 'var(--bg-base)',
                surface: 'var(--bg-surface)',
                elevated: 'var(--bg-elevated)',
                overlay: 'var(--bg-overlay)',
                'border-subtle': 'var(--border-subtle)',
                'border-muted': 'var(--border-muted)',
                'border-default': 'var(--border-default)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',
                'text-disabled': 'var(--text-disabled)',
                accent: {
                    primary: 'var(--accent-primary)',
                    hover: 'var(--accent-hover)',
                    glow: 'var(--accent-glow)',
                },
                node: {
                    entry: 'var(--node-entry)',
                    component: 'var(--node-component)',
                    hook: 'var(--node-hook)',
                    api: 'var(--node-api)',
                    service: 'var(--node-service)',
                    database: 'var(--node-database)',
                    config: 'var(--node-config)',
                    style: 'var(--node-style)',
                    test: 'var(--node-test)',
                    external: 'var(--node-external)',
                    inferred: 'var(--node-inferred)',
                },
            },
            fontFamily: {
                sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-jetbrains)', 'monospace'],
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 8px var(--accent-glow)' },
                    '50%': { boxShadow: '0 0 24px var(--accent-glow)' },
                },
                'flow-dash': {
                    '0%': { strokeDashoffset: '24' },
                    '100%': { strokeDashoffset: '0' },
                },
                'node-enter': {
                    '0%': { opacity: '0', transform: 'scale(0.8)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'spin-slow': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                },
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'flow-dash': 'flow-dash 1s linear infinite',
                'node-enter': 'node-enter 0.4s ease-out forwards',
                'spin-slow': 'spin-slow 3s linear infinite',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};

export default config;

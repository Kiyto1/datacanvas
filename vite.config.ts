/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Single source of truth for security headers: public/_headers (Cloudflare Pages).
// `vite preview` serves the same headers so e2e tests exercise the real production CSP.
function headersFromFile(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync('public/_headers', 'utf8').split(/\r?\n/)) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match?.[1] && match[2]) out[match[1]] = match[2];
  }
  return out;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // assetsInlineLimit 0: never inline assets as data: URIs, so font-src/img-src can stay 'self'.
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
  preview: { port: 4173, strictPort: true, headers: headersFromFile() },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

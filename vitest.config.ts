import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
// Component tests only. The pure-logic suites under tests/*.test.ts stay on `node:test` and run
// through `npm test`, which is the fast path; this runner pays for jsdom and is kept separate.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/components/**/*.test.tsx'],
    restoreMocks: true,
    // jsdom has no layout engine, so animations and CSS are irrelevant here.
    css: false,
  },
});

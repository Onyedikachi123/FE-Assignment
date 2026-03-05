import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        exclude: [
            '**/node_modules/**',
            '**/tests/e2e/**', // Playwright E2E tests — run via `npm run test:e2e`
        ],
    },
});

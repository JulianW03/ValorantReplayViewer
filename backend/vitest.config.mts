import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: ".",
    resolve: {
        tsconfigPaths: true,
    },
    ssr: {
        resolve: {
            conditions: ['source', ...defaultServerConditions],
        },
    },
    test: {
        environment: 'node',
        include: ['./test/**/*.spec.ts'],
    },
});

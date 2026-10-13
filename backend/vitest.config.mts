import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: ".",
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: 'node',
        include: ['./test/**/*.spec.ts'],
    },
});
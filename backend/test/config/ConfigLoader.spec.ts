import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigLoader } from '@/config/configLoader';

describe('ConfigLoader', () => {
    const originalLocalAppData = process.env.LOCALAPPDATA;
    let tempDir: string;
    let loader: ConfigLoader;

    beforeEach(async () => {
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'vrv-config-'));
        process.env.LOCALAPPDATA = tempDir;
        loader = new ConfigLoader();
        await mkdir(loader.getPersistentPath(), { recursive: true });
    });

    afterEach(async () => {
        process.env.LOCALAPPDATA = originalLocalAppData;
        await rm(tempDir, { recursive: true, force: true });
    });

    it('replaces default arrays with overridden arrays instead of merging them by index', async () => {
        await writeFile(
            loader.getConfigOverridesPath(),
            JSON.stringify({
                configurations: { app: { logging: { levels: ['error'] } } },
                filepaths: { 'valorant-saved': { path: ['Elsewhere'] } },
            }),
        );

        const config = await loader.getEffectiveConfig();

        expect(config.configurations.app.logging.levels).toEqual(['error']);
        expect(config.filepaths['valorant-saved'].path).toEqual(['Elsewhere']);
    });

    it('keeps defaults for values that are not overridden', async () => {
        await writeFile(
            loader.getConfigOverridesPath(),
            JSON.stringify({ configurations: { app: { port: 4000 } } }),
        );

        const config = await loader.getEffectiveConfig();
        const defaults = await loader.getStaticConfig();

        expect(config.configurations.app.port).toBe(4000);
        expect(config.configurations.app.logging).toEqual(defaults.configurations.app.logging);
        expect(config.filepaths).toEqual(defaults.filepaths);
    });
});

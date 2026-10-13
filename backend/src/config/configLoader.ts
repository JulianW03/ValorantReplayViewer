import { readFile } from 'node:fs/promises';
import mergeWith from 'lodash/mergeWith';
import path from 'path';
import os from 'node:os';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getPackageAwarePath } from '@/utils/PackagedPath';
import {
    EnvConfigV1DTO,
    EnvConfigV1DTOSchema,
    OverridableConfigV1,
    OverridableConfigV1Schema,
} from '@/config/ConfigV1.schema';

export const SYMBOL_CONFIG = Symbol('CONFIG');

/**
 * The resolved, effective config as injected under {@link SYMBOL_CONFIG}.
 * This is a snapshot taken at bootstrap — see {@link ConfigLoader.invalidate}.
 */
export type AppConfig = EnvConfigV1DTO;

export const InjectConfig = () => Inject(SYMBOL_CONFIG);

// lodash merges arrays index by index, so overriding ['log', 'error', 'warn'] with ['error'] would yield ['error', 'error', 'warn'].
const replaceArrays = (_base: unknown, override: unknown) => (Array.isArray(override) ? override : undefined);

const isNotFound = (e: unknown): boolean =>
    (e as NodeJS.ErrnoException)?.code === 'ENOENT';

@Injectable()
export class ConfigLoader {
    private readonly logger = new Logger(this.constructor.name);

    private staticConfig?: Promise<EnvConfigV1DTO>;
    private effectiveConfig?: Promise<EnvConfigV1DTO>;

    public getPersistentPath(): string {
        const localAppData =
            process.env.LOCALAPPDATA ??
            path.join(os.homedir(), 'AppData', 'Local');
        return path.join(localAppData, 'ValorantReplayViewer');
    }

    public getConfigOverridesPath(): string {
        return path.join(this.getPersistentPath(), 'config-overrides.json');
    }

    public getStaticConfig(): Promise<EnvConfigV1DTO> {
        this.staticConfig ??= this.readBaseConfig();
        return this.staticConfig;
    }

    public async getConfigOverrides(): Promise<OverridableConfigV1> {
        const configPath = this.getConfigOverridesPath();
        this.logger.log(`Attempting to load config overrides from ${configPath}`);

        let file: string;
        try {
            file = await readFile(configPath, 'utf8');
        } catch (e) {
            if (isNotFound(e)) {
                this.logger.log(`No config overrides found at ${configPath}`);
                return {};
            }
            throw e;
        }

        return OverridableConfigV1Schema.parseAsync(JSON.parse(file));
    }

    public getEffectiveConfig(): Promise<EnvConfigV1DTO> {
        this.effectiveConfig ??= this.computeEffectiveConfig();
        return this.effectiveConfig;
    }

    public invalidate(): void {
        this.staticConfig = undefined;
        this.effectiveConfig = undefined;
    }

    private async computeEffectiveConfig(): Promise<EnvConfigV1DTO> {
        const base = await this.getStaticConfig();

        try {
            const overrides = await this.getConfigOverrides();
            return await EnvConfigV1DTOSchema.parseAsync(mergeWith({}, base, overrides, replaceArrays));
        } catch (e) {
            this.logger.warn('Failed to load config overrides, using default config.', e);
            return base;
        }
    }

    private async readBaseConfig(): Promise<EnvConfigV1DTO> {
        const file = await readFile(getPackageAwarePath('config.json'), 'utf8');
        return EnvConfigV1DTOSchema.parseAsync(JSON.parse(file));
    }
}

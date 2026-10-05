import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import fs from 'node:fs';
import * as readline from 'node:readline';
import { ProductSessionManager } from '@/modules/ProductSessionModule/ProductSessionManager';
import { MinimalVersionInfoDTO } from '@/modules/Valorant/ValorantVersionInfo/MinimalVersionInfoDTO';
import { IObjectDataManager } from '@/core/data/interfaces/IObjectDataManager';
import { SimpleObjectDataManager } from '@/core/data/SimpleObjectDataManager';
import { EmittingObjectDataBehavior } from '@/core/data/behaviors/emission/EmittingObjectDataBehavior';
import path from 'path';
import { EventType } from '@/core/events/EventTypes';
import { getResolvedPath } from '@/config/ConfigV1.schema';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

@Injectable()
export class ValorantVersionInfoManager implements IObjectDataManager<MinimalVersionInfoDTO, MinimalVersionInfoDTO>, OnModuleInit, OnModuleDestroy {
    protected readonly manager: IObjectDataManager<MinimalVersionInfoDTO, MinimalVersionInfoDTO>;
    protected readonly logger = new Logger(this.constructor.name);

    constructor(
        @InjectConfig()
        protected readonly config: AppConfig,
        protected readonly eventBus: SimpleEventBus,
    ) {
        const base = new SimpleObjectDataManager<MinimalVersionInfoDTO>();
        this.manager = new EmittingObjectDataBehavior(base, eventBus, this.constructor.name);
        this.regex = new RegExp(this.config.configurations['valorant-version-read'].regex);
    }

    private unsubscribe: (() => void) | null = null;
    private timeoutHandle: NodeJS.Timeout | null = null;
    private maxRetryCount = 5;
    private lastSeesSessionId: string | null = null;
    private readonly regex: RegExp;

    private async readValue(signal?: AbortSignal): Promise<MinimalVersionInfoDTO> {
        const filePath = path.join(getResolvedPath(this.config.filepaths['valorant-saved']), 'Logs', 'ShooterGame.log');
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });
        const onAbort = () => {
            rl.close();
            stream.destroy(new Error('Operation aborted'));
        };
        if (signal) {
            if (signal.aborted) {
                onAbort();
            } else {
                signal.addEventListener('abort', onAbort, { once: true });
            }
        }
        try {
            for await (const line of rl) {
                const match = this.regex.exec(line);
                if (match && match[1]) {
                    return {
                        version: match[1],
                    };
                }
                if (signal?.aborted) throw new Error('Operation aborted');
            }
        } finally {
            signal?.removeEventListener('abort', onAbort);
            rl.close();
            stream.destroy();
        }
        throw new Error('No version info found in log file');
    }

    private async loadAndSetState(retryIterations: number): Promise<void> {
        const optOverride = this.config.overrides['valorant-version-read'].version;
        if (optOverride) {
            this.manager.updateValue({
                version: optOverride,
            });
            return;
        }

        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5_000);
            const version = await this.readValue(controller.signal);
            this.logger.debug('Extracted version:', version);
            this.manager.updateValue(version);
        } catch (error) {
            this.logger.warn('Failed to fetch version info', error);
        }
        if (retryIterations <= 0) {
            this.logger.log(`Max retry count reached. Assuming that the current available version ${this.manager.getView()?.version} is the correct one.`);
            return;
        }
        const newRetryCount = retryIterations - 1;
        this.logger.debug(`Retrying to fetch version info after timeout, iterations remaining: ${newRetryCount}`);
        this.timeoutHandle = setTimeout(() => {
            this.loadAndSetState(newRetryCount);
        }, this.config.configurations['valorant-version-read']['retry-timeout-ms']);
    }

    onModuleInit() {
        this.unsubscribe = ProductSessionManager.onNewSessionLaunch(
            {
                eventBus: this.eventBus,
                productId: 'valorant',
                callback: (sessionId, session) => {
                    if (sessionId === this.lastSeesSessionId) {
                        return;
                    }
                    this.lastSeesSessionId = sessionId;
                    this.loadAndSetState(this.maxRetryCount);
                },
            },
        );
    }

    onModuleDestroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
        }
        this.lastSeesSessionId = null;
    }

    deleteState(): void {
        this.manager.deleteState();
    }

    getView(): MinimalVersionInfoDTO | null {
        return this.manager.getView();
    }

    updateValue(value: MinimalVersionInfoDTO): void {
        this.manager.updateValue(value);
    }

    static onValorantVersionReady(eventBus: SimpleEventBus, callback: (info: MinimalVersionInfoDTO) => void): () => void {
        return eventBus.subscribeOnSource(ValorantVersionInfoManager.name, (event) => {
            if (event.type === EventType.StateUpdated) {
                callback(event.payload.value as MinimalVersionInfoDTO);
            }
        });
    }
}
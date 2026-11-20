import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import {
    type AutoArchiveProgress,
    AutoArchiveProgressStateSchema,
    type AutoArchiveSettings,
    AutoArchiveSettingsSchema,
    DEFAULT_AUTO_ARCHIVE_SETTINGS,
    GUID,
    QueueSelectionTypeSchema,
    selectionIncludesQueue,
} from '@vrv/shared';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { onSource } from '@/core/events/adapters/rxjsAdapters';
import { EventType } from '@/core/events/EventTypes';
import { KeyValueUpdatedEvent } from '@/core/events/BasicEvent';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { KeyDataViewable } from '@/core/data/interfaces/capabilities/KeyDataViewable';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { EmittingMapDataBehavior } from '@/core/data/behaviors/emission/EmittingMapDataBehavior';
import { isPracticeMatch } from '@/modules/Valorant/MatchHistory/isPracticeMatch';
import { MatchStatus, MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { ReplayFetchManager } from '@/modules/Valorant/ValorantReplays/remote/ReplayFetchManager';
import { ReplayDBService } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBService';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { type AppConfig, InjectConfig } from '@/config/configLoader';

const SETTINGS_KEY = 'auto-archive-settings';
const { SAVING, SAVED, FAILED } = AutoArchiveProgressStateSchema.enum;

@Injectable()
export class ReplayAutoArchiveManager
    implements OnModuleInit, OnModuleDestroy, KeyDataViewable<GUID, AutoArchiveProgress> {
    private readonly logger = new Logger(ReplayAutoArchiveManager.name);
    private readonly progress: IMapDataManager<GUID, AutoArchiveProgress, AutoArchiveProgress>;
    private readonly initialDelayMs: number;
    private readonly retryDelaysMs: number[];
    private readonly pendingAttempts = new Set<NodeJS.Timeout>();
    private sessionSubscription: Subscription | null = null;
    private isStopped = false;

    constructor(
        @InjectConfig()
        config: AppConfig,
        private readonly eventBus: SimpleEventBus,
        private readonly replayManager: ReplayManager,
        private readonly fetchManager: ReplayFetchManager,
        private readonly db: ReplayDBService,
    ) {
        const autoArchiveConfig = config.configurations['auto-archive'];
        this.initialDelayMs = autoArchiveConfig['initial-delay-ms'];
        this.retryDelaysMs = autoArchiveConfig['retry-delays-ms'];

        const base = new SimpleMapDataManager<GUID, AutoArchiveProgress>();
        this.progress = new EmittingMapDataBehavior(base, eventBus, ReplayAutoArchiveManager.name);
    }

    onModuleInit(): void {
        this.sessionSubscription = onSource(this.eventBus, ValorantGameSessionManager.name)
            .subscribe((event) => {
                if (event.type !== EventType.KeyValueUpdated) return;

                const { key, value } = (event as KeyValueUpdatedEvent<GUID, MatchStatus>).payload;
                if (value === MatchStatusSchema.enum.ENDED) {
                    this.scheduleAttempt(key, this.getSettings(), 0, this.initialDelayMs);
                }
            });
    }

    onModuleDestroy(): void {
        this.isStopped = true;
        this.sessionSubscription?.unsubscribe();
        this.pendingAttempts.forEach((attempt) => clearTimeout(attempt));
        this.pendingAttempts.clear();
    }

    getKeyView(matchId: GUID): AutoArchiveProgress | null {
        return this.progress.getKeyView(matchId);
    }

    getView(): Record<GUID, AutoArchiveProgress> | null {
        return this.progress.getView();
    }

    getSettings(): AutoArchiveSettings {
        const stored = this.db.getAppMeta(SETTINGS_KEY);
        if (stored === null) {
            return DEFAULT_AUTO_ARCHIVE_SETTINGS;
        }

        try {
            return AutoArchiveSettingsSchema.parse(JSON.parse(stored));
        } catch (e) {
            this.logger.warn('Stored auto-archive settings are invalid, auto-archive stays off.', e);
            return DEFAULT_AUTO_ARCHIVE_SETTINGS;
        }
    }

    updateSettings(settings: AutoArchiveSettings): AutoArchiveSettings {
        this.db.setAppMeta(SETTINGS_KEY, JSON.stringify(settings));
        return settings;
    }

    private scheduleAttempt(matchId: GUID, settings: AutoArchiveSettings, attempt: number, delayMs: number): void {
        const timer = setTimeout(() => {
            this.pendingAttempts.delete(timer);
            void this.archiveWithRetries(matchId, settings, attempt);
        }, delayMs);
        this.pendingAttempts.add(timer);
    }

    private async archiveWithRetries(matchId: GUID, settings: AutoArchiveSettings, attempt: number): Promise<void> {
        try {
            await this.archive(matchId, settings);
            await this.announceSaved(matchId);
        } catch (e) {
            if (this.isStopped) {
                return;
            }

            const delay = this.retryDelaysMs[attempt];
            if (delay === undefined) {
                this.logger.warn(`Auto-archive of match ${matchId} gave up after ${attempt + 1} attempts.`, e);
                await this.announceFailed(matchId);
                return;
            }

            this.logger.debug(`Auto-archive of match ${matchId} failed, retrying in ${delay}ms.`, e);
            this.scheduleAttempt(matchId, settings, attempt + 1, delay);
        }
    }

    private async archive(matchId: GUID, settings: AutoArchiveSettings): Promise<void> {
        const { NONE } = QueueSelectionTypeSchema.enum;
        if (settings.stats.type === NONE && settings.replays.type === NONE) {
            return;
        }
        if (!(await this.replayManager.getStatus()).isSetup) {
            return;
        }

        const metadata = await this.fetchManager.fetchMatchMetadata(matchId);
        const { matchInfo } = metadata.riotMatchMetadata.matchMetadata;
        if (isPracticeMatch(matchInfo)) {
            return;
        }

        const missing = await this.replayManager.findMissingParts(metadata, {
            stats: selectionIncludesQueue(settings.stats, matchInfo.queueID),
            replay: selectionIncludesQueue(settings.replays, matchInfo.queueID),
        });
        if (!missing.stats && !missing.replay) {
            return;
        }

        this.progress.updateKeyValue(matchId, { state: SAVING });
        await this.replayManager.archiveMatch(metadata, missing);
    }

    private async announceSaved(matchId: GUID): Promise<void> {
        if (this.progress.getKeyView(matchId)?.state !== SAVING) {
            return;
        }

        const stored = await this.replayManager.getStoredParts(matchId);
        if (stored) {
            this.progress.updateKeyValue(matchId, { state: SAVED, stored });
        }
    }

    private async announceFailed(matchId: GUID): Promise<void> {
        const stored = await this.replayManager.getStoredParts(matchId).catch(() => null);
        this.progress.updateKeyValue(matchId, {
            state: FAILED,
            stored: stored ?? { stats: false, replay: false },
        });
    }
}

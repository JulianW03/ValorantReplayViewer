import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/db/schema';
import { SimpleEventBusImpl } from '@/core/events/impl/SimpleEventBusImpl';
import { EventType } from '@/core/events/EventTypes';
import { KeyValueUpdatedEvent } from '@/core/events/BasicEvent';
import { onSource } from '@/core/events/adapters/rxjsAdapters';
import { MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { ValorantMatchStatsManager } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsManager';
import { ReplayAutoArchiveManager } from '@/modules/Valorant/ValorantReplays/autoArchive/ReplayAutoArchiveManager';
import type { AppConfig } from '@/config/configLoader';
import type { FetchedMatchMetadata } from '@/modules/Valorant/ValorantReplays/remote/ReplayFetchManager';
import { ReplayDBConnection } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBConnection';
import { ReplayDBService } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBService';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import {
    AsyncResult,
    type AutoArchiveSettings,
    CUSTOM_GAME_QUEUE_ID,
    CURRENT_REPLAY_FORMAT_VERSION,
    isAnyDownloading,
    PartDownloadState,
    type QueueSelection,
    RiotMatchApiResponseDTOSchema,
} from '@vrv/shared';
import exampleMatch from '../../../schemas/RiotMatchAPI/example_1.json';

const MIGRATIONS = path.resolve(__dirname, '../../../../db/migrations');
const MATCH_ID = 'b84da47a-eef3-4497-ab6d-0c7a92151519';
const IGNORED_MATCH_ID = '11111111-2222-4333-8444-555555555555';
const RETRY_DELAYS_MS = [1_000, 5_000];

const autoArchiveConfig = (initialDelayMs = 0) => ({
    configurations: {
        'auto-archive': { 'initial-delay-ms': initialDelayMs, 'retry-delays-ms': RETRY_DELAYS_MS },
    },
}) as AppConfig;

const ALL: QueueSelection = { type: 'ALL' };
const NONE: QueueSelection = { type: 'NONE' };
const ONLY_COMPETITIVE: QueueSelection = { type: 'SELECTED_ONLY', includedQueueIds: ['competitive'] };
const EXCEPT_COMPETITIVE: QueueSelection = { type: 'NON_SELECTED', excludedQueueIds: ['competitive'] };

interface MatchOptions {
    queueID?: string;
    isReplayRecorded?: boolean;
    provisioningFlowID?: string;
}

function matchMetadata(matchId: string, options: MatchOptions = {}): FetchedMatchMetadata {
    const details = RiotMatchApiResponseDTOSchema.parse(exampleMatch);
    return {
        formatVersion: CURRENT_REPLAY_FORMAT_VERSION,
        uuid: matchId,
        riotMatchMetadata: {
            matchMetadata: {
                ...details,
                matchInfo: {
                    ...details.matchInfo,
                    matchId,
                    queueID: 'competitive',
                    isReplayRecorded: true,
                    provisioningFlowID: 'Matchmaking',
                    ...options,
                },
            },
            puuidResolver: {},
        },
        userMetadata: { name: `Replay ${matchId}`, tags: [], notes: null },
    };
}

describe('ReplayAutoArchiveManager', () => {
    const replayBytes = Buffer.from('replay-file-content');

    let tmpRoot: string;
    let replaysDir: string;
    let sqlite: Database.Database;
    let eventBus: SimpleEventBusImpl;
    let sessions: ValorantGameSessionManager;
    let replays: ReplayManager;
    let autoArchive: ReplayAutoArchiveManager;
    let matches: Record<string, MatchOptions>;
    let fetchReplayFile: ReturnType<typeof vi.fn>;
    let fetchMatchMetadata: ReturnType<typeof vi.fn>;
    let progress: { matchId: string; value: unknown }[];
    let startAutoArchive: (config: AppConfig) => void;

    const endMatch = (matchId: string, options: MatchOptions = {}) => {
        matches[matchId] = options;
        sessions.updateKeyValue(matchId, MatchStatusSchema.enum.ENDED);
    };

    const configure = (settings: AutoArchiveSettings) => autoArchive.updateSettings(settings);

    const partsOf = (matchId: string) => replays.getKeyView(matchId)?.parts;

    const expectSaved = async (matchId: string, parts: { stats: boolean; replay: boolean }) => {
        await vi.waitFor(() => {
            const states = partsOf(matchId);
            expect(isAnyDownloading(states)).toBe(false);
            expect({
                stats: states?.stats === PartDownloadState.STORED,
                replay: states?.replay === PartDownloadState.STORED,
            }).toEqual(parts);
        });
        const saved = await replays.getReplay(matchId);
        if (!saved.isSuccess()) throw new Error(`Match ${matchId} was not saved`);
        expect(saved.data.riotMatchMetadata != null).toBe(parts.stats);
        expect(saved.data.replayFileMetadata != null).toBe(parts.replay);
    };

    const expectIgnoredWhileControlIsSaved = async () => {
        endMatch(MATCH_ID);
        await expectSaved(MATCH_ID, { stats: true, replay: true });
        expect(replays.matchRegistered(IGNORED_MATCH_ID)).toBe(false);
    };

    beforeEach(async () => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrv-auto-archive-'));
        replaysDir = path.join(tmpRoot, 'replays');

        sqlite = new Database(':memory:');
        sqlite.pragma('foreign_keys = ON');
        migrate(drizzle(sqlite, { schema }), { migrationsFolder: MIGRATIONS });

        matches = {};
        fetchReplayFile = vi.fn().mockResolvedValue(replayBytes);
        fetchMatchMetadata = vi.fn(async (matchId: string) => matchMetadata(matchId, matches[matchId]));
        const fetchManager = { fetchMatchMetadata, fetchReplayFile };

        const db = new ReplayDBService({ db: drizzle(sqlite, { schema }) } as unknown as ReplayDBConnection);
        eventBus = new SimpleEventBusImpl();
        progress = [];
        onSource(eventBus, ReplayAutoArchiveManager.name).subscribe((event) => {
            const { key, value } = (event as KeyValueUpdatedEvent<string, unknown>).payload;
            progress.push({ matchId: key, value });
        });
        sessions =new ValorantGameSessionManager(eventBus);
        replays = new ReplayManager(
            db,
            fetchManager as never,
            {} as never,
            { getPersistentPathBase: () => replaysDir } as never,
            eventBus,
            { filepaths: { 'valorant-saved': { path: [path.join(tmpRoot, 'saved')] } } } as never,
        );
        replays.onModuleInit();
        await replays.setup();

        startAutoArchive = (config) => {
            autoArchive = new ReplayAutoArchiveManager(config, eventBus, replays, fetchManager as never, db);
            autoArchive.onModuleInit();
        };
        startAutoArchive(autoArchiveConfig());
    });

    afterEach(() => {
        autoArchive.onModuleDestroy();
        vi.useRealTimers();
        sqlite.close();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    describe('saves what the settings select for the queue of the ended match', () => {
        it.each([
            ['stats only', { stats: ALL, replays: NONE }, 'competitive', { stats: true, replay: false }],
            ['replay only', { stats: NONE, replays: ALL }, 'competitive', { stats: false, replay: true }],
            ['both', { stats: ALL, replays: ALL }, 'competitive', { stats: true, replay: true }],
            ['stats for all, replay for one selected queue', { stats: ALL, replays: ONLY_COMPETITIVE }, 'competitive', { stats: true, replay: true }],
            ['stats for all, replay skipped outside the selected queue', { stats: ALL, replays: ONLY_COMPETITIVE }, 'unrated', { stats: true, replay: false }],
            ['replay for queues that are not excluded', { stats: ALL, replays: EXCEPT_COMPETITIVE }, 'unrated', { stats: true, replay: true }],
            ['replay skipped for an excluded queue', { stats: ALL, replays: EXCEPT_COMPETITIVE }, 'competitive', { stats: true, replay: false }],
            ['a custom queue ID', { stats: { type: 'SELECTED_ONLY', includedQueueIds: ['newmode'] }, replays: NONE }, 'newmode', { stats: true, replay: false }],
            ['a custom game when custom games are selected', { stats: { type: 'SELECTED_ONLY', includedQueueIds: [CUSTOM_GAME_QUEUE_ID] }, replays: NONE }, CUSTOM_GAME_QUEUE_ID, { stats: true, replay: false }],
            ['a custom game with its replay skipped when custom games are excluded', { stats: ALL, replays: { type: 'NON_SELECTED', excludedQueueIds: [CUSTOM_GAME_QUEUE_ID] } }, CUSTOM_GAME_QUEUE_ID, { stats: true, replay: false }],
            ['a custom game under ALL', { stats: ALL, replays: ALL }, CUSTOM_GAME_QUEUE_ID, { stats: true, replay: true }],
        ] satisfies [string, AutoArchiveSettings, string, { stats: boolean; replay: boolean }][])(
            '%s',
            async (_name, settings, queueID, expected) => {
                configure(settings);

                endMatch(MATCH_ID, { queueID });

                await expectSaved(MATCH_ID, expected);
            },
        );

        it('after waiting the configured initial delay', async () => {
            autoArchive.onModuleDestroy();
            startAutoArchive(autoArchiveConfig(300));
            configure({ stats: ALL, replays: ALL });

            endMatch(MATCH_ID);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(replays.matchRegistered(MATCH_ID)).toBe(false);

            await expectSaved(MATCH_ID, { stats: true, replay: true });
        });

        it('stores stats without a replay when the match recorded none', async () => {
            configure({ stats: ALL, replays: ALL });

            endMatch(MATCH_ID, { isReplayRecorded: false });

            await expectSaved(MATCH_ID, { stats: true, replay: false });
        });
    });

    describe('reports its progress', () => {
        it('records the auto-archive flow on the saved match', async () => {
            configure({ stats: ALL, replays: ALL });

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: true });

            const saved = await replays.getReplay(MATCH_ID);
            expect(saved.isSuccess() && saved.data.importFlowId).toBe('AUTO_ARCHIVE');
        });

        it('announces saving, then what ended up stored', async () => {
            configure({ stats: ALL, replays: ONLY_COMPETITIVE });

            endMatch(MATCH_ID, { queueID: 'unrated' });

            await vi.waitFor(() => {
                expect(progress).toEqual([
                    { matchId: MATCH_ID, value: { state: 'SAVING' } },
                    { matchId: MATCH_ID, value: { state: 'SAVED', stored: { stats: true, replay: false } } },
                ]);
            });
        });

        it('stays silent about a match the settings do not select', async () => {
            configure({ stats: ONLY_COMPETITIVE, replays: ONLY_COMPETITIVE });

            endMatch(IGNORED_MATCH_ID, { queueID: 'unrated' });

            await expectIgnoredWhileControlIsSaved();
            await vi.waitFor(() => {
                expect(progress.at(-1)?.value).toMatchObject({ state: 'SAVED' });
            });
            expect(progress.every(({ matchId }) => matchId === MATCH_ID)).toBe(true);
        });

        it('stays silent about a match that is already fully stored', async () => {
            await replays.archiveMatch(matchMetadata(IGNORED_MATCH_ID), { stats: true, replay: true });
            configure({ stats: ALL, replays: ALL });

            endMatch(IGNORED_MATCH_ID);
            endMatch(MATCH_ID);
            await vi.waitFor(() => {
                expect(progress.at(-1)?.value).toMatchObject({ state: 'SAVED' });
            });

            expect(progress.every(({ matchId }) => matchId === MATCH_ID)).toBe(true);
        });
    });

    describe('saves nothing', () => {
        it('for a match outside both selections', async () => {
            configure({ stats: ONLY_COMPETITIVE, replays: ONLY_COMPETITIVE });

            endMatch(IGNORED_MATCH_ID, { queueID: 'unrated' });

            await expectIgnoredWhileControlIsSaved();
        });

        it('for a custom game when only queues are selected', async () => {
            configure({ stats: ONLY_COMPETITIVE, replays: ONLY_COMPETITIVE });

            endMatch(IGNORED_MATCH_ID, { queueID: CUSTOM_GAME_QUEUE_ID, provisioningFlowID: 'CustomGame' });

            await expectIgnoredWhileControlIsSaved();
        });

        it('for the Shooting Range, even when everything is selected', async () => {
            configure({ stats: ALL, replays: ALL });

            endMatch(IGNORED_MATCH_ID, { provisioningFlowID: 'ShootingRange' });

            await expectIgnoredWhileControlIsSaved();
        });

        it('for old matches reported while browsing the match history', async () => {
            configure({ stats: ALL, replays: ALL });

            eventBus.publish({
                type: EventType.KeyValueUpdated,
                source: ValorantMatchStatsManager.name,
                timestamp: Date.now(),
                payload: {
                    key: IGNORED_MATCH_ID,
                    value: AsyncResult.success(matchMetadata(IGNORED_MATCH_ID).riotMatchMetadata),
                },
            });

            await expectIgnoredWhileControlIsSaved();
        });

        it('by default, until the user selects something', async () => {
            endMatch(IGNORED_MATCH_ID);

            configure({ stats: ALL, replays: ALL });

            await expectIgnoredWhileControlIsSaved();
        });

        it('while storage is not set up', async () => {
            configure({ stats: ALL, replays: ALL });
            fs.rmSync(replaysDir, { recursive: true, force: true });

            endMatch(IGNORED_MATCH_ID);
            await new Promise((resolve) => setTimeout(resolve, 20));

            await replays.setup();
            await expectIgnoredWhileControlIsSaved();
        });
    });

    describe('when the replay download fails', () => {
        const LONGEST_DELAY_MS = Math.max(...RETRY_DELAYS_MS);

        const waitForScheduledRetry = () => vi.waitFor(() => {
            expect(vi.getTimerCount()).toBeGreaterThan(0);
        });

        const fireScheduledRetry = async () => {
            await waitForScheduledRetry();
            await vi.advanceTimersByTimeAsync(LONGEST_DELAY_MS);
        };

        const letPendingWorkFinish = async () => {
            await vi.advanceTimersByTimeAsync(LONGEST_DELAY_MS);
            await new Promise<void>((resolve) => setImmediate(resolve));
        };

        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            configure({ stats: ALL, replays: ALL });
        });

        it('keeps the stats, then completes the entry on a later retry', async () => {
            fetchReplayFile.mockRejectedValueOnce(new Error('replay not ready'));

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: false });

            await fireScheduledRetry();

            await expectSaved(MATCH_ID, { stats: true, replay: true });
        });

        it('announces saving once across retries, then everything that ended up stored', async () => {
            fetchReplayFile.mockRejectedValueOnce(new Error('replay not ready'));

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: false });
            await fireScheduledRetry();

            await vi.waitFor(() => {
                expect(progress.map(({ value }) => value)).toEqual([
                    { state: 'SAVING' },
                    { state: 'SAVED', stored: { stats: true, replay: true } },
                ]);
            });
        });

        it('reports the failure and what was kept once every retry has failed', async () => {
            fetchReplayFile.mockRejectedValue(new Error('replay not ready'));

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: false });
            for (const _ of RETRY_DELAYS_MS) {
                await fireScheduledRetry();
            }

            await vi.waitFor(() => {
                expect(progress.map(({ value }) => value)).toEqual([
                    { state: 'SAVING' },
                    { state: 'FAILED', stored: { stats: true, replay: false } },
                ]);
            });
        });

        it('reports a failure when the match details never become available', async () => {
            fetchMatchMetadata.mockRejectedValue(new Error('riot api down'));

            endMatch(MATCH_ID);
            for (const _ of RETRY_DELAYS_MS) {
                await fireScheduledRetry();
            }

            await vi.waitFor(() => {
                expect(progress.map(({ value }) => value)).toEqual([
                    { state: 'FAILED', stored: { stats: false, replay: false } },
                ]);
            });
        });

        it('keeps the stats and marks the replay as failed once every retry has failed', async () => {
            fetchReplayFile.mockRejectedValue(new Error('replay not ready'));

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: false });
            for (const _ of RETRY_DELAYS_MS) {
                await fireScheduledRetry();
            }
            await vi.waitFor(() => {
                expect(fetchReplayFile).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
                expect(partsOf(MATCH_ID)).toEqual({ stats: PartDownloadState.STORED, replay: PartDownloadState.FAILED });
            });

            fetchReplayFile.mockResolvedValue(replayBytes);
            await letPendingWorkFinish();

            await expectSaved(MATCH_ID, { stats: true, replay: false });
        });

        it('cancels pending retries on shutdown', async () => {
            fetchReplayFile.mockRejectedValueOnce(new Error('replay not ready'));

            endMatch(MATCH_ID);
            await expectSaved(MATCH_ID, { stats: true, replay: false });
            await waitForScheduledRetry();

            autoArchive.onModuleDestroy();
            await letPendingWorkFinish();

            await expectSaved(MATCH_ID, { stats: true, replay: false });
        });
    });

    describe('settings', () => {
        it('are off by default and persist once updated', () => {
            expect(autoArchive.getSettings()).toEqual({ stats: NONE, replays: NONE });

            const settings: AutoArchiveSettings = { stats: ALL, replays: ONLY_COMPETITIVE };
            configure(settings);

            expect(autoArchive.getSettings()).toEqual(settings);
        });

        it('fall back to off when the stored value is invalid', () => {
            configure({ stats: ALL, replays: ALL });
            sqlite.prepare(`UPDATE app_meta SET value = '{"stats":{"type":"SOME"}}'`).run();

            expect(autoArchive.getSettings()).toEqual({ stats: NONE, replays: NONE });
        });

        it('turn off when storage is deleted', async () => {
            configure({ stats: ALL, replays: ALL });

            await replays.teardown();

            expect(autoArchive.getSettings()).toEqual({ stats: NONE, replays: NONE });
        });
    });
});

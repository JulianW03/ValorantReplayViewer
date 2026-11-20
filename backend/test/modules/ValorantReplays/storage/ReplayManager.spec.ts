import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/db/schema';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import type { FetchedMatchMetadata } from '@/modules/Valorant/ValorantReplays/remote/ReplayFetchManager';
import { ReplayDBService } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBService';
import { ReplayDBConnection } from '@/modules/Valorant/ValorantReplays/storage/db/ReplayDBConnection';
import {
    IllegalDownloadStateError,
    MatchAlreadyExistsError,
    MatchNotFoundError,
    ReplayFileMissingError,
    UserMetadataVersionMismatchError,
} from '@/modules/Valorant/ValorantReplays/storage/ReplayStorageErrors';
import {
    AsyncResult,
    CURRENT_REPLAY_FORMAT_VERSION,
    ImportFlowIdSchema,
    PartDownloadState,
    ReplayMetadataV2,
    RiotMatchApiResponseDTOSchema,
} from '@vrv/shared';
import exampleMatch from '../../../schemas/RiotMatchAPI/example_1.json';

const MIGRATIONS = path.resolve(__dirname, '../../../../db/migrations');
const MATCH_ID = 'b84da47a-eef3-4497-ab6d-0c7a92151519';
const DOWNLOADER_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
const UNKNOWN_ID = '11111111-2222-4333-8444-555555555555';
const { MANUAL_DOWNLOAD, INJECTION_PLACEHOLDER, AUTO_ARCHIVE, FILE_UPLOAD } = ImportFlowIdSchema.enum;
const { MISSING, DOWNLOADING, STORED, FAILED } = PartDownloadState;
const FULLY_STORED = { parts: { stats: STORED, replay: STORED } };

function downloadedMetadata(): ReplayMetadataV2 {
    return {
        formatVersion: CURRENT_REPLAY_FORMAT_VERSION,
        uuid: MATCH_ID,
        riotMatchMetadata: {
            matchMetadata: RiotMatchApiResponseDTOSchema.parse(exampleMatch),
            puuidResolver: {},
        },
        downloaderMetadata: { downloadedAt: 1_700_000_000_000, downloaderId: DOWNLOADER_ID },
        userMetadata: { name: 'My replay', tags: ['ranked', 'ace'], notes: 'clutch' },
    };
}

function metadataWithoutRecordedReplay(): ReplayMetadataV2 {
    const metadata = downloadedMetadata();
    metadata.riotMatchMetadata!.matchMetadata.matchInfo.isReplayRecorded = false;
    return metadata;
}

function unwrap<T>(result: AsyncResult<T, Error>): T {
    if (result.isSuccess()) return result.data;
    throw result.isFailure() ? result.error : new Error('Result is pending');
}

describe('ReplayManager', () => {
    let tmpRoot: string;
    let replaysDir: string;
    let demosDir: string;
    let sqlite: Database.Database;
    let fetchMatchMetadata: ReturnType<typeof vi.fn>;
    let fetchReplayFile: ReturnType<typeof vi.fn>;
    let manager: ReplayManager;
    const replayBytes = Buffer.from('replay-file-content');

    const createManager = () => {
        const db = drizzle(sqlite, { schema });
        const dbService = new ReplayDBService({ db } as unknown as ReplayDBConnection);
        const instance = new ReplayManager(
            dbService,
            { fetchMatchMetadata, fetchReplayFile } as never,
            {} as never,
            { getPersistentPathBase: () => replaysDir } as never,
            { publish: vi.fn() } as never,
            { filepaths: { 'valorant-saved': { path: [path.join(tmpRoot, 'saved')] } } } as never,
        );
        instance.onModuleInit();
        return instance;
    };

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vrv-replays-'));
        replaysDir = path.join(tmpRoot, 'replays');
        demosDir = path.join(tmpRoot, 'saved', 'Demos');

        sqlite = new Database(':memory:');
        sqlite.pragma('foreign_keys = ON');
        migrate(drizzle(sqlite, { schema }), { migrationsFolder: MIGRATIONS });

        fetchMatchMetadata = vi.fn().mockImplementation(async () => downloadedMetadata());
        fetchReplayFile = vi.fn().mockResolvedValue(replayBytes);
        manager = createManager();
    });

    afterEach(() => {
        sqlite.close();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('exposes a downloaded match as ReplayMetadataV2 backed by the stored files', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        const replay = unwrap(await manager.getReplay(MATCH_ID));
        const expected = downloadedMetadata();
        expect(replay).toEqual({
            ...expected,
            importFlowId: MANUAL_DOWNLOAD,
            replayFileMetadata: {
                fileSizeBytes: replayBytes.length,
                checksum: createHash('sha256').update(replayBytes).digest('hex'),
            },
        });
        expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
        await expect(manager.getStatus()).resolves.toMatchObject({ isSetup: true, matchCount: 1 });
    });

    it('keeps stored matches across restarts', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        const restarted = createManager();

        expect(restarted.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
        expect(unwrap(await restarted.getReplay(MATCH_ID)).uuid).toBe(MATCH_ID);
    });

    it('marks every part as failed and stores nothing when the match details cannot be fetched', async () => {
        fetchMatchMetadata.mockRejectedValue(new Error('network down'));

        await expect(manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD)).rejects.toThrow('network down');

        expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: FAILED, replay: FAILED } });
        expect(manager.matchRegistered(MATCH_ID)).toBe(false);
    });

    it('keeps the stats of a fresh download whose replay fails', async () => {
        fetchReplayFile.mockRejectedValue(new Error('replay not ready'));

        await expect(manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD)).rejects.toThrow('replay not ready');

        expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: STORED, replay: FAILED } });
        expect(unwrap(await manager.getReplay(MATCH_ID)).riotMatchMetadata).toEqual(downloadedMetadata().riotMatchMetadata);
    });

    it('stores only the stats of a match that recorded no replay', async () => {
        fetchMatchMetadata.mockImplementation(async () => metadataWithoutRecordedReplay());

        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: STORED, replay: MISSING } });
        expect(unwrap(await manager.getReplay(MATCH_ID)).replayFileMetadata).toBeNull();
    });

    it('reports the parts in flight and rejects a second download of the same match meanwhile', async () => {
        let releaseReplay!: (buffer: Buffer) => void;
        fetchReplayFile.mockReturnValue(new Promise<Buffer>((resolve) => releaseReplay = resolve));

        const download = manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
        await vi.waitFor(() => {
            expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: STORED, replay: DOWNLOADING } });
        });
        await expect(manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD)).rejects.toThrow(IllegalDownloadStateError);

        releaseReplay(replayBytes);
        await download;
        expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
    });

    it('treats files missing on disk as absent instead of failing', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
        fs.rmSync(path.join(replaysDir, MATCH_ID, `${MATCH_ID}.vrf`));

        const withoutReplay = unwrap(await manager.getReplay(MATCH_ID));
        expect(withoutReplay.replayFileMetadata).toBeNull();
        expect(withoutReplay.riotMatchMetadata).toEqual(downloadedMetadata().riotMatchMetadata);
        await expect(manager.moveToValorantDemos(MATCH_ID)).rejects.toThrow(ReplayFileMissingError);

        fs.rmSync(path.join(replaysDir, MATCH_ID), { recursive: true });

        const withoutAnyFile = unwrap(await manager.getReplay(MATCH_ID));
        expect(withoutAnyFile.riotMatchMetadata).toBeNull();
        expect(withoutAnyFile.userMetadata?.name).toBe('My replay');
    });

    describe('matches stored without one of their parts', () => {
        const archiveStatsOnly = () =>
            manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: true, replay: false });

        it('reports which parts a stats-only match holds, also after a restart', async () => {
            await archiveStatsOnly();

            const replay = unwrap(await manager.getReplay(MATCH_ID));
            expect(replay.riotMatchMetadata).toEqual(downloadedMetadata().riotMatchMetadata);
            expect(replay.replayFileMetadata).toBeNull();
            const statsOnly = { parts: { stats: STORED, replay: MISSING } };
            expect(manager.getKeyView(MATCH_ID)).toEqual(statsOnly);
            expect(createManager().getKeyView(MATCH_ID)).toEqual(statsOnly);
        });

        it('reports which parts a replay-only match holds', async () => {
            await manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: false, replay: true });

            const replay = unwrap(await manager.getReplay(MATCH_ID));
            expect(replay.riotMatchMetadata).toBeNull();
            expect(replay.replayFileMetadata?.fileSizeBytes).toBe(replayBytes.length);
            expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: MISSING, replay: STORED } });
        });

        it('adds the missing replay on download and keeps what the user edited', async () => {
            await archiveStatsOnly();
            const { version } = unwrap(manager.getUserMetadata(MATCH_ID));
            unwrap(manager.updateUserMetadata(MATCH_ID, version, { name: 'Renamed', notes: 'mine', tags: ['kept'] }));

            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

            const replay = unwrap(await manager.getReplay(MATCH_ID));
            expect(replay.replayFileMetadata?.fileSizeBytes).toBe(replayBytes.length);
            expect(replay.userMetadata).toEqual({ name: 'Renamed', notes: 'mine', tags: ['kept'] });
            expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
        });

        it('adds the missing stats of a replay-only match on download', async () => {
            await manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: false, replay: true });

            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

            const replay = unwrap(await manager.getReplay(MATCH_ID));
            expect(replay.riotMatchMetadata).toEqual(downloadedMetadata().riotMatchMetadata);
            expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
        });

        it('lets a stats-only match serve as the injection placeholder', async () => {
            await archiveStatsOnly();

            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD, true);
            await manager.moveToValorantDemos(MATCH_ID);

            expect(fs.readFileSync(path.join(demosDir, `${MATCH_ID}.vrf`))).toEqual(replayBytes);
        });

        it('keeps the stats when the replay cannot be downloaded', async () => {
            fetchReplayFile.mockRejectedValue(new Error('replay not ready'));

            await expect(
                manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: true, replay: true }),
            ).rejects.toThrow('replay not ready');

            const replay = unwrap(await manager.getReplay(MATCH_ID));
            expect(replay.riotMatchMetadata).toEqual(downloadedMetadata().riotMatchMetadata);
            expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: STORED, replay: FAILED } });
        });

        it('marks only the part that could not be stored as failed', async () => {
            fetchReplayFile.mockRejectedValue(new Error('replay not ready'));

            await expect(
                manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: false, replay: true }),
            ).rejects.toThrow('replay not ready');

            expect(manager.matchRegistered(MATCH_ID)).toBe(false);
            expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: MISSING, replay: FAILED } });
        });

        it('reports a failed download of a missing part and only retries it explicitly', async () => {
            await archiveStatsOnly();
            fetchReplayFile.mockRejectedValueOnce(new Error('replay not ready'));

            await expect(manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD)).rejects.toThrow('replay not ready');
            expect(manager.getKeyView(MATCH_ID)).toEqual({ parts: { stats: STORED, replay: FAILED } });
            await expect(manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD)).rejects.toThrow(IllegalDownloadStateError);

            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD, true);
            expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
        });
    });

    it('rejects importing a duplicate unless override is requested', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
        const request = {
            type: 'replayFile' as const,
            userMetadata: { name: 'Imported', tags: [], notes: null },
        };
        const vrf = Buffer.alloc(0x30 + 72);
        vrf.write(MATCH_ID, 0x30, 'utf16le');

        const duplicate = await manager.importReplay(vrf, request, false);
        expect(duplicate.isFailure() && duplicate.error).toBeInstanceOf(MatchAlreadyExistsError);

        const overridden = unwrap(await manager.importReplay(vrf, request, true));
        expect(overridden.userMetadata?.name).toBe('Imported');
        expect(overridden.riotMatchMetadata).toBeNull();
        expect(overridden.replayFileMetadata?.fileSizeBytes).toBe(vrf.length);
    });

    it('exports a package that imports back into the same metadata', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
        const original = unwrap(await manager.getReplay(MATCH_ID));
        const zip = unwrap(await manager.exportMatchToZip(MATCH_ID));

        unwrap(await manager.deleteMatch(MATCH_ID));
        const imported = unwrap(await manager.importReplay(zip, { type: 'package' }, false));

        expect(imported).toEqual({ ...original, importFlowId: FILE_UPLOAD });
    });

    describe('import flow', () => {
        const importFlowOf = async (matchId = MATCH_ID, instance = manager) =>
            unwrap(await instance.getReplay(matchId)).importFlowId;

        it('records the flow that stored the match and keeps it across restarts', async () => {
            await manager.triggerDownload(MATCH_ID, INJECTION_PLACEHOLDER, true);

            expect(await importFlowOf()).toBe(INJECTION_PLACEHOLDER);
            expect(await importFlowOf(MATCH_ID, createManager())).toBe(INJECTION_PLACEHOLDER);
        });

        it('keeps the first flow when a later one adds the missing part', async () => {
            await manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: true, replay: false });

            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

            expect(manager.getKeyView(MATCH_ID)).toEqual(FULLY_STORED);
            expect(await importFlowOf()).toBe(AUTO_ARCHIVE);
        });

        it('does not take the flow from an imported package', async () => {
            await manager.archiveMatch(downloadedMetadata() as FetchedMatchMetadata, { stats: true, replay: true });
            const zip = unwrap(await manager.exportMatchToZip(MATCH_ID));

            unwrap(await manager.deleteMatch(MATCH_ID));
            unwrap(await manager.importReplay(zip, { type: 'package' }, false));

            expect(await importFlowOf()).toBe(FILE_UPLOAD);
        });

        it('replaces the flow when an upload overrides the match', async () => {
            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
            const vrf = Buffer.alloc(0x30 + 72);
            vrf.write(MATCH_ID, 0x30, 'utf16le');

            unwrap(await manager.importReplay(
                vrf,
                { type: 'replayFile', userMetadata: { name: 'Imported', tags: [], notes: null } },
                true,
            ));

            expect(await importFlowOf()).toBe(FILE_UPLOAD);
        });
    });

    it('deletes a single match with its files', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        unwrap(await manager.deleteMatch(MATCH_ID));

        expect(fs.existsSync(path.join(replaysDir, MATCH_ID))).toBe(false);
        const lookup = await manager.getReplay(MATCH_ID);
        expect(lookup.isFailure() && lookup.error).toBeInstanceOf(MatchNotFoundError);
        const unknown = await manager.deleteMatch(UNKNOWN_ID);
        expect(unknown.isFailure() && unknown.error).toBeInstanceOf(MatchNotFoundError);
    });

    it('teardown removes the replay folder and all database entries', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        await manager.teardown();

        expect(fs.existsSync(replaysDir)).toBe(false);
        await expect(manager.getStatus()).resolves.toEqual({ isSetup: false, matchCount: 0, totalSizeBytes: 0 });
        expect(manager.matchRegistered(MATCH_ID)).toBe(false);
        expect(manager.getKeyView(MATCH_ID)).toBeNull();
    });

    it('copies the stored replay into the VALORANT Demos folder for injection', async () => {
        await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);

        await manager.injectReplayOverPlaceholder(MATCH_ID, UNKNOWN_ID);

        expect(fs.readFileSync(path.join(demosDir, `${UNKNOWN_ID}.vrf`))).toEqual(replayBytes);
    });

    describe('user metadata', () => {
        beforeEach(async () => {
            await manager.triggerDownload(MATCH_ID, MANUAL_DOWNLOAD);
        });

        it('applies a patch against the current version and registers new tags', async () => {
            const initial = unwrap(manager.getUserMetadata(MATCH_ID));

            const updated = unwrap(manager.updateUserMetadata(MATCH_ID, initial.version, {
                name: 'Renamed',
                tags: ['ranked', 'brand-new'],
            }));

            expect(updated.version).not.toBe(initial.version);
            expect(updated.userMetadata).toEqual({ name: 'Renamed', notes: 'clutch', tags: ['ranked', 'brand-new'] });
            expect(unwrap(await manager.getReplay(MATCH_ID)).userMetadata).toEqual(updated.userMetadata);
        });

        it('rejects a patch based on a stale version and keeps the data', async () => {
            const initial = unwrap(manager.getUserMetadata(MATCH_ID));
            unwrap(manager.updateUserMetadata(MATCH_ID, initial.version, { notes: 'first writer' }));

            const stale = manager.updateUserMetadata(MATCH_ID, initial.version, { notes: 'second writer' });

            expect(stale.isFailure() && stale.error).toBeInstanceOf(UserMetadataVersionMismatchError);
            expect(unwrap(manager.getUserMetadata(MATCH_ID)).userMetadata.notes).toBe('first writer');
        });

        it('leaves fields absent from the patch untouched', () => {
            const initial = unwrap(manager.getUserMetadata(MATCH_ID));

            const updated = unwrap(manager.updateUserMetadata(MATCH_ID, initial.version, { notes: null }));

            expect(updated.userMetadata).toEqual({ ...initial.userMetadata, notes: null });
        });

        it('reports unknown matches', () => {
            const read = manager.getUserMetadata(UNKNOWN_ID);
            const write = manager.updateUserMetadata(UNKNOWN_ID, 1, { name: 'x' });

            expect(read.isFailure() && read.error).toBeInstanceOf(MatchNotFoundError);
            expect(write.isFailure() && write.error).toBeInstanceOf(MatchNotFoundError);
        });
    });
});

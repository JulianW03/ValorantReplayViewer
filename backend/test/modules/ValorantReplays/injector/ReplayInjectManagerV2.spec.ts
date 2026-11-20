import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { ReplayInjectManagerV2 } from '@/modules/Valorant/ValorantReplays/injector/ReplayInjectManagerV2';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { MatchHistoryManager } from '@/modules/Valorant/MatchHistory/MatchHistoryManager';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { ValorantGameLoopManager } from '@/modules/Valorant/ValorantGameLoopModule/ValorantGameLoopManager';
import { InjectState } from '@/modules/Valorant/ValorantReplays/injector/states/ReplayStates';
import { AsyncResult, ReplayMetadataV2, RiotMatchMetadata } from '@vrv/shared';

function replaySavedMetadata(hasReplayFile = true): AsyncResult<ReplayMetadataV2, Error> {
    if (hasReplayFile) return AsyncResult.success({
        replayFileMetadata: { fileSizeBytes: 1, checksum: 'abc' },
    } as ReplayMetadataV2);

    return AsyncResult.failure(new Error('No replay file available'))
}

function historyEntry(matchId: string, isReplayRecorded: boolean): RiotMatchMetadata {
    return {
        matchMetadata: { matchInfo: { matchId, isReplayRecorded } },
    } as RiotMatchMetadata;
}

describe('ReplayInjectManagerV2', () => {
    let manager: ReplayInjectManagerV2;
    let io: ReplayManager & {
        getReplay: ReturnType<typeof vi.fn>;
        triggerDownload: ReturnType<typeof vi.fn>;
        moveToValorantDemos: ReturnType<typeof vi.fn>;
        injectReplayOverPlaceholder: ReturnType<typeof vi.fn>;
        restoreReplayFile: ReturnType<typeof vi.fn>;
    };
    let matchHistory: MatchHistoryManager & { getMatchDataAfter: ReturnType<typeof vi.fn> };
    let eventBus: SimpleEventBus & { publish: ReturnType<typeof vi.fn> };
    let unsubscribe: ReturnType<typeof vi.fn>;
    let gameLoopHandler: (event: { payload: { value: string | null } }) => void;

    beforeEach(() => {
        io = {
            assertNotBusy: vi.fn(),
            getReplay: vi.fn().mockResolvedValue(replaySavedMetadata()),
            triggerDownload: vi.fn().mockResolvedValue(undefined),
            moveToValorantDemos: vi.fn().mockResolvedValue(undefined),
            injectReplayOverPlaceholder: vi.fn().mockResolvedValue(undefined),
            restoreReplayFile: vi.fn().mockResolvedValue(undefined),
        } as any;

        matchHistory = {
            getMatchDataAfter: vi.fn().mockResolvedValue({
                'placeholder-1': historyEntry('placeholder-1', true),
            }),
        } as any;

        unsubscribe = vi.fn();

        eventBus = {
            publish: vi.fn(),
            subscribeOnSource: vi.fn((_source: string, handler: any) => {
                gameLoopHandler = handler;
                return unsubscribe;
            }),
        } as any;

        manager = new ReplayInjectManagerV2(io, matchHistory, eventBus);
        manager.onModuleInit();
    });

    describe('startInject validation', () => {
        it('rejects when the match has no saved replay file', async () => {
            io.getReplay.mockResolvedValue(replaySavedMetadata(false));

            await expect(manager.startInject('match-1')).rejects.toThrow(ConflictException);
        });

        it('rejects when saved metadata could not be loaded', async () => {
            io.getReplay.mockResolvedValue(AsyncResult.failure(new Error('boom')));

            await expect(manager.startInject('match-1')).rejects.toThrow(ConflictException);
        });

        it('rejects when no replay-recorded match exists in history to use as a placeholder', async () => {
            matchHistory.getMatchDataAfter.mockResolvedValue({
                'not-recorded': historyEntry('not-recorded', false),
            });

            await expect(manager.startInject('match-1')).rejects.toThrow(ConflictException);
        });

        it('rejects a second inject while one is already in progress', async () => {
            await manager.startInject('match-1');

            await expect(manager.startInject('match-2')).rejects.toThrow(ConflictException);
        });
    });

    describe('starting an inject', () => {
        it('downloads the placeholder and reaches AWAITING_REPLAY_START with the requested and placeholder match ids', async () => {
            await manager.startInject('match-1');

            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
            });

            expect(manager.getView()).toEqual({
                state: InjectState.AWAITING_REPLAY_START,
                targetMatchId: 'match-1',
                placeholderMatchId: 'placeholder-1',
            });
            expect(io.triggerDownload).toHaveBeenCalledWith('placeholder-1', 'INJECTION_PLACEHOLDER', true);
            expect(io.moveToValorantDemos).toHaveBeenCalledWith('placeholder-1');
        });
    });

    describe('full inject/restore cycle driven by gameflow events', () => {
        it('swaps the file on REPLAY, and restores it on MENUS, returning to IDLE', async () => {
            await manager.startInject('match-1');
            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
            });

            gameLoopHandler({ payload: { value: 'REPLAY' } });

            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.INJECTED);
            });
            expect(io.injectReplayOverPlaceholder).toHaveBeenCalledWith('match-1', 'placeholder-1');

            gameLoopHandler({ payload: { value: 'MENUS' } });

            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.IDLE);
            });
            expect(io.restoreReplayFile).toHaveBeenCalledWith('placeholder-1');
        });

        it('ignores gameflow values other than REPLAY/MENUS', async () => {
            await manager.startInject('match-1');
            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
            });

            gameLoopHandler({ payload: { value: 'LOBBY' } });

            expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
        });
    });

    describe('cancelInject', () => {
        it('cancels a pending inject and returns to IDLE', async () => {
            await manager.startInject('match-1');
            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
            });

            manager.cancelInject();

            expect(manager.getView()?.state).toBe(InjectState.IDLE);
        });

        it('allows a fresh inject to start after a cancel', async () => {
            await manager.startInject('match-1');
            await vi.waitFor(() => {
                expect(manager.getView()?.state).toBe(InjectState.AWAITING_REPLAY_START);
            });
            manager.cancelInject();

            await manager.startInject('match-2');

            expect(manager.getView()?.targetMatchId).toBe('match-2');
        });
    });

    describe('onModuleDestroy', () => {
        it('unsubscribes from gameflow state updates', () => {

            manager.onModuleDestroy();

            expect(unsubscribe).toHaveBeenCalled();
        });
    });

    it('subscribes to gameflow state from ValorantGameLoopManager', () => {
        expect(eventBus.subscribeOnSource).toHaveBeenCalledWith(
            ValorantGameLoopManager.name,
            expect.any(Function),
        );
    });
});

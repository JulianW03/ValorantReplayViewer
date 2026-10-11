import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { MatchHistoryManager } from '@/modules/Valorant/MatchHistory/MatchHistoryManager';
import { RiotValorantAPIManager } from '@/integrations/riot/RiotValorantAPIManager';
import { ValorantMatchStatsManager } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsManager';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { EventType } from '@/core/events/EventTypes';
import * as rxjsAdapters from '@/core/events/adapters/rxjsAdapters';
import { AsyncResult } from '#/utils/AsyncResult';

// We mock the adapter so we can push events into a Subject we control,
// instead of needing a real SimpleEventBus wiring.
vi.mock('@/core/events/adapters/rxjsAdapters');

function makeMatch(id: string, gameStartTime: number) {
    return { MatchID: id, GameStartTime: gameStartTime } as any;
}

function statsEvent(id: string, value: unknown) {
    return {
        type: EventType.KeyValueUpdated,
        source: 'ValorantMatchStatsManager',
        payload: { key: id, action: 'CREATED', value },
    };
}

function statsSuccess(id: string, gameStartMillis = 0) {
    return statsEvent(
        id,
        AsyncResult.success({
            matchMetadata: { matchInfo: { gameStartMillis } },
            puuidResolver: {},
        }),
    );
}

describe('MatchHistoryManager', () => {
    let manager: MatchHistoryManager;
    let riot: RiotValorantAPIManager & { matches: { getHistory: ReturnType<typeof vi.fn> } };
    let stats: ValorantMatchStatsManager & {
        requestMatchFetch: ReturnType<typeof vi.fn>;
        getBestEffortBatchedResult: ReturnType<typeof vi.fn>;
    };
    let eventBus: SimpleEventBus;
    let eventSubject: Subject<any>;

    beforeEach(() => {
        riot = {
            matches: { getHistory: vi.fn() },
        } as any;
        // Safe default so any incidental auto-triggered loadMore() (e.g. from
        // getMatchIdsAfter's `orderedMatchIds.length < limit` check) doesn't
        // crash on an unmocked call. Individual tests override this as needed.
        riot.matches.getHistory.mockResolvedValue([]);

        stats = {
            requestMatchFetch: vi.fn(),
            getBestEffortBatchedResult: vi.fn().mockResolvedValue({}),
        } as any;

        eventBus = {} as any;

        eventSubject = new Subject();
        (rxjsAdapters.onSource as ReturnType<typeof vi.fn>).mockReturnValue(eventSubject);

        manager = new MatchHistoryManager(riot, eventBus, stats);
        manager.onModuleInit();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ---------------------------------------------------------------------
    // match stats emissions -> match history (via event subscription)
    // ---------------------------------------------------------------------
    describe('match stats drive match history', () => {
        it('adds a match to history once its stats become available', async () => {
            eventSubject.next(statsSuccess('match-1'));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['match-1']);
        });

        it('does not add a match while its stats are still pending', async () => {
            eventSubject.next(statsEvent('match-1', AsyncResult.pending()));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual([]);
        });

        it('does not add a match whose stats fetch failed', async () => {
            eventSubject.next(statsEvent('match-1', AsyncResult.failure(new Error('boom'))));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual([]);
        });

        it('ignores events that are not key-value updates', async () => {
            eventSubject.next({ type: 'SomethingElse', payload: {} });

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual([]);
        });

        it('adds a match at most once even if its stats are emitted repeatedly', async () => {
            eventSubject.next(statsSuccess('match-1'));
            eventSubject.next(statsSuccess('match-1'));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['match-1']);
        });

        it('places a newly-available match before matches already loaded from history', async () => {
            riot.matches.getHistory.mockResolvedValue([makeMatch('old-1', 100)]);
            await manager.getMatchIdsAfter(null, 10); // loads old-1

            eventSubject.next(statsSuccess('new-1'));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['new-1', 'old-1']);
        });

        it('does not reorder a match already loaded from history when its stats arrive', async () => {
            riot.matches.getHistory.mockResolvedValue([makeMatch('a', 300), makeMatch('b', 200)]);
            await manager.getMatchIdsAfter(null, 10); // loads a, b

            eventSubject.next(statsSuccess('b'));

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['a', 'b']);
        });

        it('keeps a newly-available match ahead of a history page still being fetched', async () => {
            let resolvePage: (v: any) => void;
            riot.matches.getHistory.mockReturnValue(
                new Promise((resolve) => {
                    resolvePage = resolve;
                }),
            );

            const pending = manager.getMatchIdsAfter(null, 10); // triggers loadMore, now in flight

            // The finished match's stats land *while* the historical fetch is still pending.
            eventSubject.next(statsSuccess('live-1'));

            resolvePage!([makeMatch('hist-1', 200), makeMatch('hist-2', 100)]);
            const ids = await pending;

            // The newly-available match stays at the front; the historical page
            // (sorted desc by GameStartTime) is appended after it.
            expect(ids).toEqual(['live-1', 'hist-1', 'hist-2']);
        });

        it('does not double-insert when a history page later also contains the newly-available match', async () => {
            let resolvePage: (v: any) => void;
            riot.matches.getHistory.mockReturnValue(
                new Promise((resolve) => {
                    resolvePage = resolve;
                }),
            );

            const pending = manager.getMatchIdsAfter(null, 10);

            eventSubject.next(statsSuccess('live-1'));

            // Riot's own paginated history has since caught up and now also
            // reports the just-finished match.
            resolvePage!([makeMatch('live-1', 500), makeMatch('hist-1', 100)]);
            const ids = await pending;

            expect(ids).toEqual(['live-1', 'hist-1']);
        });
    });

    // ---------------------------------------------------------------------
    // account uuid change -> state reset (via event subscription)
    // ---------------------------------------------------------------------
    describe('account uuid change resets state', () => {
        function pushUuid(uuid: string | null) {
            eventSubject.next({
                type: EventType.StateUpdated,
                payload: { value: uuid === null ? null : { uuid } },
            });
        }

        it('clears loaded matches and the exhausted flag when the uuid changes', async () => {
            // Short page marks history as exhausted for the current user.
            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('a', 100)]);
            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['a']);

            riot.matches.getHistory.mockClear();
            await manager.getMatchIdsAfter(null, 100);
            expect(riot.matches.getHistory).not.toHaveBeenCalled(); // still exhausted, proves 'a' was cached

            pushUuid('user-2');

            // A fresh fetch must happen: neither the old match nor the
            // exhausted flag should have survived the uuid change.
            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('b', 50)]);
            const idsAfterReset = await manager.getMatchIdsAfter(null, 10);
            expect(idsAfterReset).toEqual(['b']);
            expect(riot.matches.getHistory).toHaveBeenCalledWith(0, 20);
        });

        it('re-adds a previously-seen match after a reset when its stats are emitted again', async () => {
            eventSubject.next(statsSuccess('match-1'));
            expect(await manager.getMatchIdsAfter(null, 10)).toEqual(['match-1']);

            pushUuid('user-2');
            expect(await manager.getMatchIdsAfter(null, 10)).toEqual([]);

            eventSubject.next(statsSuccess('match-1'));
            expect(await manager.getMatchIdsAfter(null, 10)).toEqual(['match-1']);
        });

        it('does not reset state when the same uuid is emitted again', async () => {
            pushUuid('user-1');

            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('a', 100)]);
            await manager.getMatchIdsAfter(null, 10);
            riot.matches.getHistory.mockClear();

            pushUuid('user-1'); // same uuid again, must be a no-op (distinctUntilChanged)

            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['a']);
            expect(riot.matches.getHistory).not.toHaveBeenCalled();
        });

        it('treats a transition to a null uuid (logout) as a change and resets state', async () => {
            pushUuid('user-1');

            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('a', 100)]);
            await manager.getMatchIdsAfter(null, 10);

            pushUuid(null);

            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('b', 50)]);
            const ids = await manager.getMatchIdsAfter(null, 10);
            expect(ids).toEqual(['b']);
        });
    });

    // ---------------------------------------------------------------------
    // loadMore / doLoadMore (exercised through getMatchIdsAfter(null, ...))
    // ---------------------------------------------------------------------
    describe('loading match history from Riot', () => {
        it('requests the correct offset range and sorts results by GameStartTime desc', async () => {
            riot.matches.getHistory.mockResolvedValue([
                makeMatch('a', 100),
                makeMatch('b', 300),
                makeMatch('c', 200),
            ]);

            const ids = await manager.getMatchIdsAfter(null, 10);

            expect(riot.matches.getHistory).toHaveBeenCalledWith(0, 20);
            expect(ids).toEqual(['b', 'c', 'a']);
            expect(stats.requestMatchFetch).toHaveBeenCalledTimes(3);
        });

        it('skips entries that are already known', async () => {
            // Seed a full page (== default count of 20) so `exhausted` stays false;
            // a short first page would otherwise mark us exhausted and mask the
            // very shortfall-triggered load this test is meant to exercise.
            const seedPage = Array.from({ length: 20 }, (_, i) => makeMatch(`seed${i}`, 1000 - i));
            riot.matches.getHistory.mockResolvedValueOnce(seedPage);
            await manager.getMatchIdsAfter(null, 20); // seeds seed0..seed19 (in that order)

            // Asking after the *last* seeded match creates a genuine shortfall,
            // which triggers a second loadMore() call.
            riot.matches.getHistory.mockResolvedValueOnce([
                makeMatch('seed19', 1000 - 19), // duplicate, must be skipped
                makeMatch('new-1', 5),
            ]);

            stats.requestMatchFetch.mockClear();
            const ids = await manager.getMatchIdsAfter('seed19', 5);
            expect(ids).toEqual(['new-1']);
            expect(stats.requestMatchFetch).toHaveBeenCalledTimes(1);
            expect(stats.requestMatchFetch).toHaveBeenCalledWith('new-1');
        });

        it('marks history as exhausted once a short page is returned, and stops calling Riot', async () => {
            riot.matches.getHistory.mockResolvedValueOnce(
                Array.from({ length: 5 }, (_, i) => makeMatch(`m${i}`, i)),
            ); // shorter than default count of 20 -> exhausted

            await manager.getMatchIdsAfter(null, 10);
            expect(riot.matches.getHistory).toHaveBeenCalledTimes(1);

            // Ask for more than we have; since exhausted, Riot must not be called again.
            const ids = await manager.getMatchIdsAfter(null, 100);
            expect(riot.matches.getHistory).toHaveBeenCalledTimes(1);
            expect(ids).toHaveLength(5);
        });

        it('de-duplicates concurrent loadMore calls into a single Riot request', async () => {
            let resolvePage: (v: any) => void;
            riot.matches.getHistory.mockReturnValue(
                new Promise((resolve) => {
                    resolvePage = resolve;
                }),
            );

            const p1 = manager.getMatchIdsAfter(null, 10);
            const p2 = manager.getMatchIdsAfter(null, 10);

            resolvePage!([makeMatch('a', 1)]);
            await Promise.all([p1, p2]);

            expect(riot.matches.getHistory).toHaveBeenCalledTimes(1);
        });
    });

    // ---------------------------------------------------------------------
    // getMatchIdsAfter
    // ---------------------------------------------------------------------
    describe('getMatchIdsAfter', () => {
        it('returns [] when afterMatchId is unknown', async () => {
            const ids = await manager.getMatchIdsAfter('unknown-id', 10);
            expect(ids).toEqual([]);
            expect(riot.matches.getHistory).not.toHaveBeenCalled();
        });

        it('does not call loadMore when enough matches already follow afterMatchId', async () => {
            riot.matches.getHistory.mockResolvedValue([
                makeMatch('a', 300),
                makeMatch('b', 200),
                makeMatch('c', 100),
            ]);
            await manager.getMatchIdsAfter(null, 10); // seeds a,b,c
            riot.matches.getHistory.mockClear();

            const ids = await manager.getMatchIdsAfter('a', 2);
            expect(ids).toEqual(['b', 'c']);
            expect(riot.matches.getHistory).not.toHaveBeenCalled();
        });

        it('caps the loadMore request size at 20 when the shortfall is larger', async () => {
            // Seed a full page (== default count) so `exhausted` stays false.
            riot.matches.getHistory.mockResolvedValueOnce(
                Array.from({ length: 20 }, (_, i) => makeMatch(`seed${i}`, i)),
            );
            await manager.getMatchIdsAfter(null, 20); // fills 20, not exhausted (page.length === count)

            riot.matches.getHistory.mockResolvedValueOnce(
                Array.from({ length: 20 }, (_, i) => makeMatch(`more${i}`, 100 + i)),
            );
            await manager.getMatchIdsAfter('seed0', 50); // large shortfall

            expect(riot.matches.getHistory).toHaveBeenLastCalledWith(20, 40); // count capped to 20
        });

        it('does not call loadMore when history is already exhausted, even with a shortfall', async () => {
            riot.matches.getHistory.mockResolvedValueOnce([makeMatch('a', 100)]); // short page -> exhausted
            await manager.getMatchIdsAfter(null, 10);
            riot.matches.getHistory.mockClear();

            const ids = await manager.getMatchIdsAfter('a', 10);
            expect(ids).toEqual([]);
            expect(riot.matches.getHistory).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------------
    // getMatchDataAfter
    // ---------------------------------------------------------------------
    describe('getMatchDataAfter', () => {
        it('resolves ids then delegates to stats.getBestEffortBatchedResult with a 5s timeout', async () => {
            riot.matches.getHistory.mockResolvedValue([makeMatch('a', 100)]);
            await manager.getMatchDataAfter(null, 10);

            expect(stats.getBestEffortBatchedResult).toHaveBeenCalledWith(['a'], 5_000);
        });
    });

    // ---------------------------------------------------------------------
    // getMatchIdsBefore / getMatchDataBefore
    // ---------------------------------------------------------------------
    describe('getMatchIdsBefore', () => {
        beforeEach(async () => {
            riot.matches.getHistory.mockResolvedValue([
                makeMatch('a', 400),
                makeMatch('b', 300),
                makeMatch('c', 200),
                makeMatch('d', 100),
            ]);
            await manager.getMatchIdsAfter(null, 10); // seeds a,b,c,d in that order
        });

        it('returns [] when beforeMatchId is unknown', async () => {
            const ids = await manager.getMatchIdsBefore('unknown', 10);
            expect(ids).toEqual([]);
        });

        it('returns the slice preceding the given match id', async () => {
            const ids = await manager.getMatchIdsBefore('c', 10);
            expect(ids).toEqual(['a', 'b']);
        });

        it('clamps the start index to 0 when limit exceeds available preceding items', async () => {
            const ids = await manager.getMatchIdsBefore('b', 10);
            expect(ids).toEqual(['a']);
        });
    });

    describe('getMatchDataBefore', () => {
        it('resolves ids then delegates to stats.getBestEffortBatchedResult with a 5s timeout', async () => {
            riot.matches.getHistory.mockResolvedValue([makeMatch('a', 200), makeMatch('b', 100)]);
            await manager.getMatchIdsAfter(null, 10);

            await manager.getMatchDataBefore('b', 10);
            expect(stats.getBestEffortBatchedResult).toHaveBeenCalledWith(['a'], 5_000);
        });
    });
});
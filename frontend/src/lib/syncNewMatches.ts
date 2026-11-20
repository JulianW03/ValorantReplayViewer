import type { InfiniteData } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queries';
import { useAppStore } from '@/store/useAppStore';
import { compareMatchOrder, type GUID, type RiotMatchMetadata } from '@vrv/shared';

/**
 * Keeps the `recentMatches` query cache in sync with `ValorantMatchStatsManager` WS
 * events (fired when a match ends and its stats have been fetched): any match not yet
 * known to the cache is inserted at the position matching its `gameStartMillis`, so
 * newly finished matches show up without polling the REST API.
 *
 * This is a plain module-level subscription rather than a hook — it has no props, no
 * render output, and no per-page lifecycle, so it's registered once here (imported for
 * its side effect in `main.tsx`) instead of being mounted from a component tree.
 */
useAppStore.subscribe((state, prevState) => {
    const cache = state.matchStatsCache;
    if (cache === null || cache === prevState.matchStatsCache) return;

    for (const [matchId, result] of Object.entries(cache)) {
        if (result.type !== 'SUCCESS' || prevState.matchStatsCache?.[matchId] === result) continue;

        const match = result.data;
        queryClient.setQueryData<InfiniteData<RiotMatchMetadata[], GUID | null>>(
            queryKeys.recentMatches,
            (old) => {
                if (!old || old.pages.some((page) => page.some((m) => m.matchMetadata.matchInfo.matchId === matchId))) {
                    return old;
                }

                const pageSize = old.pages[0]?.length ?? 20;

                const matches = old.pages.flat();
                matches.push(match);

                matches.sort((a, b) =>
                    compareMatchOrder(
                        a.matchMetadata.matchInfo,
                        b.matchMetadata.matchInfo,
                    )
                );

                const pages: RiotMatchMetadata[][] = [];

                for (let i = 0; i < matches.length; i += pageSize) {
                    pages.push(matches.slice(i, i + pageSize));
                }

                return {
                    ...old,
                    pages,
                };
            },
        );
    }
});

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfigOverrides, MatchStatsResult } from '@/lib/api';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import type { GUID } from '#/schemas/GUIDSchema.ts';
import { DownloadState, type DownloadStateDTO } from '#/schemas/DownloadState.schema.ts';
import type { MapAssetDTO } from '#/schemas/assets/MapAssetDTO.ts';
import type { AgentAssetDTO } from '#/schemas/assets/AgentAssetDTO.ts';
import type { WeaponAssetDTO } from '#/schemas/assets/WeaponAssetDTO.ts';
import type { GearAssetDTO } from '#/schemas/assets/GearAssetDTO.ts';
import type { ProductSessionDTO } from '#/schemas/ProductSession.schema.ts';
import type { RiotMatchMetadata } from '#/schemas/ReplayFormatV2.schema.ts';
import type { ReplayImportRequest } from '#/schemas/upload/ImportReplay.schema.ts';
import type { UserMetadataPatch } from '#/schemas/replays/ReplayStorageApi.schema.ts';

// ---- Query keys ----

export const queryKeys = {
    isConnected: ['isConnected'] as const,
    playerAlias: ['playerAlias'] as const,
    playerUuid: ['playerUuid'] as const,
    storageStatus: ['storageStatus'] as const,
    storedMatches: (page: number) => ['storedMatches', page] as const,
    currentShippingVersion: ['currentShippingVersion'] as const,
    recentMatches: ['recentMatches'] as const,
    downloadStates: ['downloadStates'] as const,
    injectStatus: ['injectStatus'] as const,
    matchStats: (matchId: string) => ['matchStats', matchId] as const,
    matchMetadata: (matchId: string) => ['matchMetadata', matchId] as const,
    userMetadata: (matchId: string) => ['userMetadata', matchId] as const,
    mapRegistry: ['mapRegistry'] as const,
    agentRegistry: ['agentRegistry'] as const,
    weaponRegistry: ['weaponRegistry'] as const,
    gearRegistry: ['gearRegistry'] as const,
    productSessionRegistry: ['productSessionRegistry'] as const,
    effectiveConfig: ['effectiveConfig'] as const,
    configOverrides: ['configOverrides'] as const,
    gameLoopState: ['gameLoopState'] as const,
    socialPresenceRegistry: ['socialPresenceRegistry'] as const,
    updateStatus: ['updateStatus'] as const,
} as const;

// ---- Riot Client ----

export function useIsConnected() {
    return useQuery({
        queryKey: queryKeys.isConnected,
        queryFn: () => api.riotClient.isConnected(),
        refetchInterval: (query) => (query.state.data === false ? 2000 : false),
        staleTime: 0,
        retry: 2,
    });
}

export function usePlayerAlias() {
    const existing = useAppStore((s) => s.playerAlias);
    const setPlayerAlias = useAppStore((s) => s.setPlayerAlias);

    useQuery({
        queryKey: queryKeys.playerAlias,
        queryFn: async () => {
            const alias = await api.account.getAlias();
            setPlayerAlias(alias);
            return alias;
        },
        enabled: existing === null,
        staleTime: Infinity,
        retry: 3,
    });

    return existing;
}

export function usePlayerUuid() {
    const existing = useAppStore((s) => s.playerUuid);
    const setPlayerUuid = useAppStore((s) => s.setPlayerUuid);

    useQuery({
        queryKey: queryKeys.playerUuid,
        queryFn: async () => {
            const uuid = await api.account.getPuuid();
            setPlayerUuid(uuid);
            return uuid;
        },
        enabled: existing === null,
        staleTime: Infinity,
        retry: 3,
    });

    return existing;
}

export function useConnect() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.riotClient.connect(),
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.isConnected }),
    });
}

// ---- Storage ----

export function useStorageStatus() {
    return useQuery({
        queryKey: queryKeys.storageStatus,
        queryFn: () => api.storage.getStatus(),
    });
}

export function useSetupStorage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.storage.setup(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storageStatus }),
    });
}

export function useTeardownStorage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.storage.teardown(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.storageStatus });
            queryClient.invalidateQueries({ queryKey: ['storedMatches'] });
        },
    });
}

// ---- Stored matches ----

export const STORED_MATCHES_PAGE_SIZE = 10;

export function useStoredMatches(page: number) {
    return useQuery({
        queryKey: queryKeys.storedMatches(page),
        queryFn: () => api.storage.listMatches(page, STORED_MATCHES_PAGE_SIZE),
        placeholderData: keepPreviousData,
    });
}

export function useDeleteMatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (matchId: string) => api.storage.deleteMatch(matchId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storedMatches'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.storageStatus });
        },
    });
}

export function useUploadReplay() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ file, data, override }: { file: File; data: ReplayImportRequest; override: boolean }) =>
            api.storage.importReplay(file, data, override),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storedMatches'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.storageStatus });
        },
    });
}

// Always refetched when editing starts, so the form never saves against a stale ETag.
export function useUserMetadata(matchId: string, enabled: boolean) {
    return useQuery({
        queryKey: queryKeys.userMetadata(matchId),
        queryFn: () => api.storage.getUserMetadata(matchId),
        enabled,
        staleTime: 0,
        gcTime: 0,
    });
}

export function useUpdateUserMetadata() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ matchId, patch, etag }: { matchId: string; patch: UserMetadataPatch; etag: string }) =>
            api.storage.patchUserMetadata(matchId, patch, etag),
        onSuccess: (updated, { matchId }) => {
            queryClient.setQueryData(queryKeys.userMetadata(matchId), updated);
            queryClient.invalidateQueries({ queryKey: ['storedMatches'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.matchMetadata(matchId) });
        },
    });
}

// ---- Recent matches ----

// Backend caps `matchHistory.getRecentMatches` at 20 per page (GetRecentMatchesDto).
export const RECENT_MATCHES_PAGE_SIZE = 15;

/**
 * `matchHistory` responses already contain full match data, so seed the
 * `matchStatsCache` store from them for any match that isn't cached yet.
 * This lets `useMatchStats` skip its own fetch once a row is expanded.
 */
function seedMatchStatsCache(matches: RiotMatchMetadata[]) {
    const { matchStatsCache, setMatchStat } = useAppStore.getState();
    for (const match of matches) {
        const matchId = match.matchMetadata.matchInfo.matchId;
        if (matchStatsCache?.[matchId] === undefined) {
            setMatchStat(matchId, { type: 'SUCCESS', data: match });
        }
    }
}

/**
 * Infinite, cursor-paginated match history. Each page is fetched using the oldest
 * match id of the previous page as the `after` cursor; the first page has no cursor.
 * A page shorter than the page size (including an empty page) means the end of the
 * remote history has been reached.
 */
export function useRecentMatches() {
    return useInfiniteQuery({
        queryKey: queryKeys.recentMatches,
        queryFn: async ({ pageParam }) => {
            const matches = await api.matchHistory.getRecentMatches({
                after: pageParam,
                limit: RECENT_MATCHES_PAGE_SIZE,
            });
            seedMatchStatsCache(matches);
            return matches;
        },
        initialPageParam: null as GUID | null,
        getNextPageParam: (lastPage) =>
            lastPage.length < RECENT_MATCHES_PAGE_SIZE
                ? undefined
                : lastPage[lastPage.length - 1]?.matchMetadata?.matchInfo?.matchId,
    });
}

export function useShippingVersion() {
    const existing = useAppStore((s) => s.currentValorantShippingVersion);
    const setShippingVersion = useAppStore((s) => s.setCurrentShippingVersion);

    useQuery({
        queryKey: queryKeys.currentShippingVersion,
        queryFn: async () => {
            const versionInfo = await api.valorantVersionInfo.get();
            setShippingVersion(versionInfo.version);
            return versionInfo;
        },
        enabled: existing === null,
        staleTime: Infinity,
        retry: 3,
    });

    return existing;
}

// ---- Download states ----

export function useDownloadState(matchId: string): DownloadStateDTO | undefined {
    const downloadStates = useAppStore((s) => s.downloadStates);
    const setDownloadStates = useAppStore((s) => s.setDownloadStates);

    useQuery({
        queryKey: queryKeys.downloadStates,
        queryFn: async () => {
            const states = await api.storage.getAllDownloadStates();
            setDownloadStates(states);
            return states;
        },
        // Skip if already populated — either by a prior REST fetch or a WS snapshot
        // that arrived before this hook first mounted.
        enabled: downloadStates === null,
        staleTime: Infinity,
        retry: false,
    });

    return downloadStates?.[matchId];
}

/**
 * Convenience boolean selectors derived from `useDownloadState`.
 * Use these in components to branch on the current state without
 * manually comparing `DownloadState` enum values.
 */
export function useDownloadStateFlags(matchId: string) {
    const dto = useDownloadState(matchId) ?? undefined;

    return {
        /** No entry exists or the last attempt failed — a download can be started. */
        canDownload: dto === undefined || dto.state === DownloadState.FAILED,
        /** A download is currently in progress. */
        isDownloading: dto?.state === DownloadState.DOWNLOADING,
        /** The download failed and can be retried. */
        isFailed: dto?.state === DownloadState.FAILED,
        /** The replay is locally stored and ready to use. */
        isDownloaded: dto?.state === DownloadState.DOWNLOADED,
        /** The raw DTO — useful when you need the state value itself. */
        dto,
    } as const;
}

/**
 * Triggers a download for a match.
 * The store is updated exclusively via the WebSocket `KeyValueUpdated` event
 * that the backend emits when the state transitions to `DOWNLOADING`.
 */
export function useTriggerDownload() {
    return useMutation({
        mutationFn: (matchId: string) => api.remote.triggerDownload(matchId),
    });
}

/**
 * Retries a failed download. Identical shape to `useTriggerDownload` —
 * kept separate so call sites can distinguish intent.
 */
export function useRetryDownload() {
    return useMutation({
        mutationFn: (matchId: string) => api.remote.retryDownload(matchId),
    });
}

// ---- Match stats ----

/**
 * Returns match stats for a single match, lazily fetched from the REST endpoint.
 *
 * Pass `enabled = false` to defer fetching (e.g. for collapsed rows).
 * Returns `null` if the backend reports no stats yet (HTTP 404).
 */
export function useMatchStats(matchId: string, enabled = true) {
    const wsData = useAppStore((s) => s.matchStatsCache?.[matchId]);
    const setMatchStat = useAppStore((s) => s.setMatchStat);

    const query = useQuery<MatchStatsResult | null>({
        queryKey: queryKeys.matchStats(matchId),
        queryFn: async () => {
            try {
                const result = await api.matchStats.getById(matchId);
                setMatchStat(matchId, result);
                return result;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        // Skip REST call when WS already delivered data.
        enabled: enabled && wsData === undefined,
        staleTime: Infinity,
        retry: false,
    });

    // WS data always wins — short-circuit React Query entirely.
    if (wsData !== undefined) {
        return { data: wsData, isLoading: false, isError: false, isFetching: false } as const;
    }
    return query;
}

export function useTriggerMatchStatsFetch() {
    const setMatchStat = useAppStore((s) => s.setMatchStat);
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (matchId: string) => api.matchStats.triggerFetch(matchId),
        onMutate: (matchId) => {
            setMatchStat(matchId, { type: 'PENDING' } as MatchStatsResult);
            queryClient.removeQueries({ queryKey: queryKeys.matchStats(matchId) });
        },
    });
}

// ---- Map registry ----

//TODO: This error handling is not good.
export function useMapRegistry() {
    const setMapRegistry = useAppStore((s) => s.setMapRegistry);
    const existing = useAppStore((s) => s.mapRegistry);

    useQuery<Record<string, MapAssetDTO> | null>({
        queryKey: queryKeys.mapRegistry,
        queryFn: async () => {
            try {
                const raw = await api.assets.getAllMaps();
                setMapRegistry(raw);
                return raw;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        enabled: existing === null,
        refetchInterval: (query) => query.state.data === null ? 3000 : false,
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}

export function useAgentRegistry() {
    const setAgentRegistry = useAppStore((s) => s.setAgentRegistry);
    const existing = useAppStore((s) => s.agentRegistry);

    useQuery<Record<string, AgentAssetDTO> | null>({
        queryKey: queryKeys.agentRegistry,
        queryFn: async () => {
            try {
                const raw = await api.assets.getAllAgents();
                setAgentRegistry(raw);
                return raw;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        enabled: existing === null,
        refetchInterval: (query) => query.state.data === null ? 3000 : false,
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}

export function useWeaponRegistry() {
    const setWeaponRegistry = useAppStore((s) => s.setWeaponRegistry);
    const existing = useAppStore((s) => s.weaponRegistry);

    useQuery<Record<string, WeaponAssetDTO> | null>({
        queryKey: queryKeys.weaponRegistry,
        queryFn: async () => {
            try {
                const raw = await api.assets.getAllWeapons();
                setWeaponRegistry(raw);
                return raw;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        enabled: existing === null,
        refetchInterval: (query) => query.state.data === null ? 3000 : false,
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}

export function useGearRegistry() {
    const setGearRegistry = useAppStore((s) => s.setGearRegistry);
    const existing = useAppStore((s) => s.gearRegistry);

    useQuery<Record<string, GearAssetDTO> | null>({
        queryKey: queryKeys.gearRegistry,
        queryFn: async () => {
            try {
                const raw = await api.assets.getAllGear();
                setGearRegistry(raw);
                return raw;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        enabled: existing === null,
        refetchInterval: (query) => query.state.data === null ? 3000 : false,
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}

export function useProductSessionRegistry() {
    const sessionRegistry = useAppStore((s) => s.sessionRegistry);
    const setSessionRegistry = useAppStore((s) => s.setSessionRegistry);

    useQuery({
        queryKey: queryKeys.productSessionRegistry,
        queryFn: async () => {
            const data = await api.sessions.getAllProductSessions();
            setSessionRegistry(data);
            return data;
        },
        enabled: sessionRegistry === null,
        staleTime: Infinity,
        retry: false,
    });

    return sessionRegistry;
}

export function useProductSession(productId: string): ProductSessionDTO | null {
    const registry = useProductSessionRegistry();
    if (!registry) return null;
    return Object.values(registry).find((s) => s.productId === productId) ?? null;
}

// ---- Injector ----

export function useInjectStatus() {
    const existing = useAppStore((s) => s.currentInjectState);
    const setCurrentInjectState = useAppStore((s) => s.setCurrentInjectState);

    useQuery({
        queryKey: queryKeys.injectStatus,
        queryFn: async () => {
            const data = await api.injector.getStatus();
            setCurrentInjectState(data);
            return data;
        },
        staleTime: Infinity,
        retry: 3,
    });

    return existing;
}

export function useStartInject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (matchId: string) => api.injector.startInject(matchId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.injectStatus }),
    });
}

export function useCancelInject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.injector.cancelInject(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.injectStatus }),
    });
}

// ---- Configuration ----

export function useEffectiveConfig() {
    return useQuery({
        queryKey: queryKeys.effectiveConfig,
        queryFn: () => api.config.getCurrent(),
        staleTime: 30_000,
    });
}

export function useConfigOverrides() {
    return useQuery({
        queryKey: queryKeys.configOverrides,
        queryFn: async () => {
            try {
                return await api.config.getOverrides();
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('HTTP 404')) {
                    return null;
                }
                throw e;
            }
        },
        staleTime: 30_000,
    });
}

export function useSaveConfigOverrides() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (overrides: ConfigOverrides) => api.config.saveOverrides(overrides),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.configOverrides });
            queryClient.invalidateQueries({ queryKey: queryKeys.effectiveConfig });
        },
    });
}

export function useDeleteConfigOverrides() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api.config.deleteOverrides(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.configOverrides });
            queryClient.invalidateQueries({ queryKey: queryKeys.effectiveConfig });
        },
    });
}

export function useShutdown() {
    return useMutation({
        mutationFn: () => api.processControl.shutdown(),
    });
}

export function useMatchMetadata(matchId: string, enabled = true) {
    return useQuery({
        queryKey: queryKeys.matchMetadata(matchId),
        queryFn: () => api.storage.getMetadata(matchId),
        enabled,
        staleTime: Infinity,
        retry: false,
    });
}

// ---- Game status ----

/**
 * Current Valorant game-loop state (e.g. 'MENUS', 'REPLAY'). This is a raw
 * passthrough string sourced from Riot's own session payload — there is no
 * fixed/known set of values, so it's surfaced as-is rather than mapped to an enum.
 * Returns `null` until the Riot Client has reported a state yet.
 */
export function useGameLoopState() {
    const existing = useAppStore((s) => s.currentGameLoopState);
    const setCurrentGameLoopState = useAppStore((s) => s.setCurrentGameLoopState);

    useQuery<string | null>({
        queryKey: queryKeys.gameLoopState,
        queryFn: async () => {
            const state = await api.gameLoop.getState();
            setCurrentGameLoopState(state);
            return state;
        },
        enabled: existing === null,
        refetchInterval: (query) => (query.state.data === null ? 3000 : false),
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}

/**
 * Social presence for every known Riot product (Valorant, League, TFT, ...)
 * that currently has one, keyed by product id.
 */
export function useSocialPresenceRegistry() {
    const registry = useAppStore((s) => s.socialPresenceRegistry);
    const setSocialPresenceRegistry = useAppStore((s) => s.setSocialPresenceRegistry);

    useQuery({
        queryKey: queryKeys.socialPresenceRegistry,
        queryFn: async () => {
            const data = await api.socialPresence.getAll();
            setSocialPresenceRegistry(data);
            return data;
        },
        enabled: registry === null,
        staleTime: Infinity,
        retry: false,
    });

    return registry;
}

// ---- Update check ----

export function useUpdateStatus() {
    const existing = useAppStore((s) => s.updateStatus);
    const setUpdateStatus = useAppStore((s) => s.setUpdateStatus);

    useQuery({
        queryKey: queryKeys.updateStatus,
        queryFn: async () => {
            const status = await api.updateCheck.getStatus();
            setUpdateStatus(status);
            return status;
        },
        enabled: existing === null,
        staleTime: Infinity,
        retry: false,
    });

    return existing;
}
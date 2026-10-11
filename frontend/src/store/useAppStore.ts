import { create } from 'zustand';
import { InjectStates, type InjectStatus, type MatchStatsResult } from '@/lib/api';

import type { DownloadStateDTO } from '#/schemas/DownloadState.schema.ts';
import type { AgentAssetDTO } from '#/schemas/assets/AgentAssetDTO.ts';
import type { MapAssetDTO } from '#/schemas/assets/MapAssetDTO.ts';
import type { WeaponAssetDTO } from '#/schemas/assets/WeaponAssetDTO.ts';
import type { GearAssetDTO } from '#/schemas/assets/GearAssetDTO.ts';
import type { ProductSessionDTO } from '#/schemas/ProductSession.schema.ts';
import type { PlayerAliasDTO } from '#/schemas/PlayerAlias.schema.ts';
import type { PlayerUuidDTO } from '#/schemas/PlayerUuid.schema.ts';
import type { MinimalVersionInfo } from '#/dto/MinimalVersionInfo.ts';
import type { SocialPresence } from '#/schemas/SocialPresence/SocialPresence.schema.ts';
import type { UpdateStatus } from '#/schemas/updateCheck/UpdateStatus.schema.ts';

export type EventType =
    | 'StateUpdated'
    | 'KeyValueUpdated';

export type EventMap = {
    StateUpdated: { value: unknown | null };
    KeyValueUpdated: {
        key: PropertyKey;
        value: unknown | null;
    };
};

export type AnyBasicEvent = {
    [K in EventType]: BasicEvent<K>;
}[EventType];

export interface BasicEvent<TType extends EventType> {
    readonly type: TType;
    readonly payload: EventMap[TType];
    readonly timestamp: number;
    readonly source: string;
}

export type EventOf<T extends EventType> = BasicEvent<T>;

export type StateUpdatedEvent<T> =
    Omit<BasicEvent<'StateUpdated'>, 'payload'> & {
    readonly payload: { value: T | null };
};

export type KeyValueUpdatedEvent<K extends PropertyKey, V> =
    Omit<BasicEvent<'KeyValueUpdated'>, 'payload'> & {
    readonly payload: { key: K; value: V | null };
};


interface AppState {
    wsConnected: boolean;
    playerAlias: PlayerAliasDTO | null;
    playerUuid: PlayerUuidDTO | null;

    downloadStates: Record<string, DownloadStateDTO> | null;

    currentInjectState: InjectStatus;
    currentValorantShippingVersion: string | null;

    matchStatsCache: Record<string, MatchStatsResult> | null;

    mapRegistry: Record<string, MapAssetDTO> | null;
    agentRegistry: Record<string, AgentAssetDTO> | null;
    weaponRegistry: Record<string, WeaponAssetDTO> | null;
    gearRegistry: Record<string, GearAssetDTO> | null;
    sessionRegistry: Record<string, ProductSessionDTO> | null;

    currentGameLoopState: string | null;
    socialPresenceRegistry: Record<string, SocialPresence> | null;
    updateStatus: UpdateStatus | null;

    setWsConnected: (connected: boolean) => void;
    setPlayerAlias: (alias: PlayerAliasDTO) => void;
    setPlayerUuid: (uuid: PlayerUuidDTO) => void;

    setCurrentInjectState: (currentInjectState: InjectStatus) => void;

    // downloadStates mutations
    setDownloadStates: (states: Record<string, DownloadStateDTO> | null) => void;
    setDownloadStat: (matchId: string, downloadState: DownloadStateDTO | null) => void;

    // matchStatsCache mutations
    setMatchStatsCache: (cache: Record<string, MatchStatsResult> | null) => void;
    setMatchStat: (matchId: string, result: MatchStatsResult | null) => void;

    setMapRegistry: (registry: Record<string, MapAssetDTO>) => void;
    setAgentRegistry: (agentRegistry: Record<string, AgentAssetDTO>) => void;
    setWeaponRegistry: (weaponRegistry: Record<string, WeaponAssetDTO>) => void;
    setGearRegistry: (gearRegistry: Record<string, GearAssetDTO>) => void;
    setSessionRegistry: (registry: Record<string, ProductSessionDTO>) => void;
    setCurrentShippingVersion: (version: string | null) => void;

    setCurrentGameLoopState: (state: string | null) => void;
    setSocialPresenceRegistry: (registry: Record<string, SocialPresence> | null) => void;
    setUpdateStatus: (status: UpdateStatus | null) => void;

    /**
     * Routes incoming WebSocket events to per-source handlers.
     * To react to a new manager's events, add an entry to `handlers` keyed
     * by the manager's class name (the value of `event.source`).
     */
    handleWSEvent: (event: AnyBasicEvent) => void;
}

export const useAppStore = create<AppState>((set) => {
    // ---------------------------------------------------------------------------
    // Mutations
    // ---------------------------------------------------------------------------

    const setWsConnected = (connected: boolean) => set({ wsConnected: connected });
    const setPlayerAlias = (alias: PlayerAliasDTO) => set({ playerAlias: alias });
    const setPlayerUuid = (uuid: PlayerUuidDTO) => set({ playerUuid: uuid });

    const setDownloadStates = (states: Record<string, DownloadStateDTO> | null) =>
        set({ downloadStates: states });

    /**
     * Upserts or removes a single match's download state.
     * Passing `null` removes the entry from the map.
     * If the map hasn't been hydrated yet (`null`), a deletion is a no-op and
     * an upsert seeds the map with just this entry.
     */
    const setDownloadStat = (matchId: string, downloadState: DownloadStateDTO | null) =>
        set((s) => {
            if (downloadState === null) {
                const prev = s.downloadStates;
                if (prev == null) return {};
                const next = { ...prev };
                delete next[matchId];
                return { downloadStates: next };
            }
            return { downloadStates: { ...(s.downloadStates ?? {}), [matchId]: downloadState } };
        });

    const setMatchStatsCache = (cache: Record<string, MatchStatsResult> | null) =>
        set({ matchStatsCache: cache });

    /**
     * Upserts or removes a single match's stats entry.
     * Passing `null` removes the entry.
     */
    const setMatchStat = (matchId: string, result: MatchStatsResult | null) =>
        set((s) => {
            if (result === null) {
                const prev = s.matchStatsCache;
                if (prev == null) return {};
                const next = { ...prev };
                delete next[matchId];
                return { matchStatsCache: next };
            }
            return { matchStatsCache: { ...(s.matchStatsCache ?? {}), [matchId]: result } };
        });

    const setMapRegistry = (registry: Record<string, MapAssetDTO>) =>
        set({ mapRegistry: registry });

    const setAgentRegistry = (registry: Record<string, AgentAssetDTO>) =>
        set({ agentRegistry: registry });

    const setWeaponRegistry = (registry: Record<string, WeaponAssetDTO>) =>
        set({ weaponRegistry: registry });

    const setGearRegistry = (registry: Record<string, GearAssetDTO>) =>
        set({ gearRegistry: registry });

    const setSessionRegistry = (registry: Record<string, ProductSessionDTO>) =>
        set({ sessionRegistry: registry });

    const setCurrentShippingVersion = (version: string | null) =>
        set({ currentValorantShippingVersion: version });

    const setCurrentInjectStatus = (currentInjectState: InjectStatus) =>
        set({ currentInjectState });

    const setCurrentGameLoopState = (state: string | null) =>
        set({ currentGameLoopState: state });

    const setSocialPresenceRegistry = (registry: Record<string, SocialPresence> | null) =>
        set({ socialPresenceRegistry: registry });

    const setUpdateStatus = (status: UpdateStatus | null) =>
        set({ updateStatus: status });

    /**
     * Upserts or removes a single product's presence entry.
     * Passing `null` removes the entry from the map.
     */
    const setSocialPresence = (productId: string, presence: SocialPresence | null) =>
        set((s) => {
            if (presence === null) {
                const prev = s.socialPresenceRegistry;
                if (prev == null) return {};
                const next = { ...prev };
                delete next[productId];
                return { socialPresenceRegistry: next };
            }
            return { socialPresenceRegistry: { ...(s.socialPresenceRegistry ?? {}), [productId]: presence } };
        });

    // ---------------------------------------------------------------------------
    // WebSocket event router
    // ---------------------------------------------------------------------------

    const handleWSEvent = (event: AnyBasicEvent) => {
        const handlers: Partial<Record<string, (event: AnyBasicEvent) => void>> = {
            AccountNameAndTagLineManager: (event) => {
                if (event.type !== 'StateUpdated') return;
                set({ playerAlias: event.payload.value as PlayerAliasDTO | null });
            },

            AccountPuuidManager: (event) => {
                if (event.type !== 'StateUpdated') return;
                set({ playerUuid: event.payload.value as PlayerUuidDTO | null });
            },

            ReplayInjectManagerV2: (event) => {
                if (event.type !== 'StateUpdated') return;
                set({ currentInjectState: event.payload.value as InjectStatus });
            },

            ReplayManager: (event) => {
                switch (event.type) {
                    case 'KeyValueUpdated': {
                        // A single match's state changed.
                        const matchId = event.payload.key as string;
                        const dto = event.payload.value as DownloadStateDTO | null;
                        setDownloadStat(matchId, dto);
                        break;
                    }
                    case 'StateUpdated': {
                        // Full snapshot delivered on connect / reconnect.
                        const snapshot = event.payload.value as Record<string, DownloadStateDTO> | null;
                        setDownloadStates(snapshot);
                        break;
                    }
                }
            },

            ValorantMatchStatsManager: (event) => {
                if (event.type !== 'KeyValueUpdated') return;
                const matchId = event.payload.key as string;
                const result = event.payload.value as MatchStatsResult | null;
                setMatchStat(matchId, result);
            },

            ValorantVersionInfoManager: (event) => {
                if (event.type !== 'StateUpdated') return;
                const info = event.payload.value as MinimalVersionInfo | null;
                set({ currentValorantShippingVersion: info?.version ?? null });
            },

            ValorantGameLoopManager: (event) => {
                if (event.type !== 'StateUpdated') return;
                set({ currentGameLoopState: event.payload.value as string | null });
            },

            SocialPresenceManager: (event) => {
                switch (event.type) {
                    case 'StateUpdated': {
                        const registry = event.payload.value as Record<string, SocialPresence> | null;
                        setSocialPresenceRegistry(registry);
                        break;
                    }
                    case 'KeyValueUpdated': {
                        const productId = event.payload.key as string;
                        const presence = event.payload.value as SocialPresence | null;
                        setSocialPresence(productId, presence);
                        break;
                    }
                }
            },

            UpdateCheckerManager: (event) => {
                if (event.type !== 'StateUpdated') return;
                setUpdateStatus(event.payload.value as UpdateStatus | null);
            },

            ProductSessionManager: (event) => {
                switch (event.type) {
                    case 'StateUpdated': {
                        const sessions = event.payload.value as Record<string, ProductSessionDTO>;
                        if (sessions !== undefined) set({ sessionRegistry: sessions });
                        break;
                    }
                    case 'KeyValueUpdated': {
                        const sessionId = event.payload.key as string;
                        const session = event.payload.value as ProductSessionDTO | null;
                        set((s) => {
                            if (session === null) {
                                if (!s.sessionRegistry) return {};
                                const next = { ...s.sessionRegistry };
                                delete next[sessionId];
                                return { sessionRegistry: next };
                            }
                            return {
                                sessionRegistry: {
                                    ...(s.sessionRegistry ?? {}),
                                    [sessionId]: session,
                                },
                            };
                        });
                        break;
                    }
                }
            },
        };

        handlers[event.source]?.(event);
    };

    // ---------------------------------------------------------------------------
    // Initial state
    // ---------------------------------------------------------------------------

    return {
        wsConnected: false,
        playerAlias: null,
        playerUuid: null,
        currentValorantShippingVersion: null,
        downloadStates: null,
        matchStatsCache: null,
        mapRegistry: null,
        agentRegistry: null,
        weaponRegistry: null,
        gearRegistry: null,
        sessionRegistry: null,
        currentGameLoopState: null,
        socialPresenceRegistry: null,
        updateStatus: null,
        currentInjectState: {
            state: InjectStates.IDLE,
            targetMatchId: null,
            placeholderMatchId: null,
        },

        setWsConnected,
        setPlayerAlias,
        setPlayerUuid,
        setDownloadStates,
        setDownloadStat,
        setCurrentInjectState: setCurrentInjectStatus,
        setMatchStatsCache,
        setMatchStat,
        setMapRegistry,
        setAgentRegistry,
        setWeaponRegistry,
        setGearRegistry,
        setSessionRegistry,
        setCurrentShippingVersion,
        setCurrentGameLoopState,
        setSocialPresenceRegistry,
        setUpdateStatus,
        handleWSEvent,
    };
});
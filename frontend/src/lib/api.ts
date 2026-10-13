import * as LocalLinkResolver from '@/lib/LocalLinkResolver.ts';
import type { DownloadStateDTO } from '#/schemas/DownloadState.schema.ts';
import type { GUID } from '#/schemas/GUIDSchema.ts';
import type { PlayerAliasDTO } from '#/schemas/PlayerAlias.schema.ts';
import type { ProductSessionDTO } from '#/schemas/ProductSession.schema.ts';
import type { PlayerUuidDTO } from '#/schemas/PlayerUuid.schema.ts';
import type { MapAssetDTO } from '#/schemas/assets/MapAssetDTO.ts';
import type { AgentAssetDTO } from '#/schemas/assets/AgentAssetDTO.ts';
import type { WeaponAssetDTO } from '#/schemas/assets/WeaponAssetDTO.ts';
import type { GearAssetDTO } from '#/schemas/assets/GearAssetDTO.ts';
import type { ReplayMetadataV2, RiotMatchMetadata, UserMetadata } from '#/schemas/ReplayFormatV2.schema.ts';
import type { MinimalVersionInfo } from '#/dto/MinimalVersionInfo.ts';
import type { StorageStatusDTO } from '#/schemas/StorageStatusDTO.ts';
import type { ReplayImportRequest } from '#/schemas/upload/ImportReplay.schema.ts';
import type { SocialPresence } from '#/schemas/SocialPresence/SocialPresence.schema.ts';
import type { UpdateStatus } from '#/schemas/updateCheck/UpdateStatus.schema.ts';
import type {
    DownloadStatesResponse,
    ReplayListResponse,
    UserMetadataPatch,
} from '#/schemas/replays/ReplayStorageApi.schema.ts';
import { InjectState as InjectStates, type InjectState, type InjectStatus } from '#/schemas/InjectStatus.schema.ts';

export { InjectStates };
export type { InjectState, InjectStatus };

export const API_BASE = LocalLinkResolver.resolve('/api/v1', 'http');

// ---- Match stats (from Riot API via backend cache) ----


export type MatchStatsResult =
    | { type: 'PENDING' }
    | { type: 'SUCCESS'; data: RiotMatchMetadata }
    | { type: 'FAILURE'; error: { message: string } }


// ---- Configuration ----

export type SupportedRegion = 'na' | 'latam' | 'eu' | 'ap' | 'kr' | 'br';
export type SupportedShard = 'na' | 'pbe' | 'eu' | 'ap' | 'kr';

export const SUPPORTED_REGIONS: SupportedRegion[] = ['na', 'latam', 'eu', 'ap', 'kr', 'br'];
export const SUPPORTED_SHARDS: SupportedShard[] = ['na', 'pbe', 'eu', 'ap', 'kr'];

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';
export const LOG_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

export interface ConfigOverrides {
    overrides: {
        'valorant-api': {
            region?: SupportedRegion | null;
            shard?: SupportedShard | null;
        };
        'valorant-version-read': {
            version?: string | null;
        };
    };
}

export interface EffectiveConfig {
    overrides: {
        'valorant-api': {
            region?: SupportedRegion | null;
            shard?: SupportedShard | null;
        };
        'valorant-version-read': {
            version?: string | null;
        };
    };
    configurations: {
        app: {
            port: number;
            logging: {
                levels: LogLevel[];
                'file-levels'?: LogLevel[];
                'max-log-files': number;
            };
            'additional-cors-origins': string[];
        };
        'valorant-version-read': {
            'retry-timeout-ms': number;
            regex: string;
        };
        'update-check': {
            'check-interval-seconds': number;
            'github-user': string;
            'github-repo': string;
        };
    };
    version: {
        config: number;
        app: string;
    };
    version: {
        config: number;
        app: string;
    };
}

// ---- HTTP client ----

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export interface WithETag<T> {
    data: T;
    etag: string;
}

async function send(path: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const body = await response.json();
            message = body.message ?? message;
        } catch {
            // ignore parse errors
        }
        throw new ApiError(message, response.status);
    }
    return response;
}

async function request<T = void>(path: string, options?: RequestInit): Promise<T> {
    const response = await send(path, options);
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
        return response.json() as Promise<T>;
    }
    return undefined as T;
}

async function requestWithETag<T>(path: string, options?: RequestInit): Promise<WithETag<T>> {
    const response = await send(path, options);
    const etag = response.headers.get('etag');
    if (!etag) {
        throw new Error(`Response of ${path} carries no ETag`);
    }
    return { data: await response.json() as T, etag };
}

/**
 * Like `request`, but for endpoints that return a bare `text/plain` / `text/html`
 * body rather than JSON (e.g. the game-loop state string). Maps 404 to `null`.
 */
async function requestText(path: string, options?: RequestInit): Promise<string | null> {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const body = await response.json();
            message = body.message ?? message;
        } catch {
            // ignore parse errors
        }
        throw new Error(message);
    }
    const text = await response.text();
    return text.length > 0 ? text : null;
}

// ---- API ----

export const api = {
    riotClient: {
        isConnected: () => request<boolean>('/riotclient/status/connected'),
        connect: () => request('/riotclient/connect', { method: 'POST' }),
    },
    application: {
        getVersion: () => request<string>('/application/version'),
    },
    valorantVersionInfo: {
        get: () => request<MinimalVersionInfo>('/caching/valorant-version-info'),
    },
    storage: {
        getAllDownloadStates: () => request<DownloadStatesResponse>('/plugins/replay/storage/download-states'),
        getStatus: () => request<StorageStatusDTO>('/plugins/replay/storage/status'),
        setup: () => request('/plugins/replay/storage', { method: 'POST' }),
        teardown: () => request('/plugins/replay/storage', { method: 'DELETE' }),
        listMatches: (page: number, pageSize: number) => {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            return request<ReplayListResponse>(`/plugins/replay/storage/matches?${params}`);
        },
        getMetadata: (matchId: string) => request<ReplayMetadataV2>(`/plugins/replay/storage/matches/${matchId}/metadata`),
        getUserMetadata: (matchId: string) =>
            requestWithETag<UserMetadata>(`/plugins/replay/storage/matches/${matchId}/user-metadata`),
        patchUserMetadata: (matchId: string, patch: UserMetadataPatch, etag: string) =>
            requestWithETag<UserMetadata>(`/plugins/replay/storage/matches/${matchId}/user-metadata`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'If-Match': etag },
                body: JSON.stringify(patch),
            }),
        deleteMatch: (matchId: string) =>
            request(`/plugins/replay/storage/matches/${matchId}`, { method: 'DELETE' }),
        importReplay: (file: File, data: ReplayImportRequest, override = false) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('data', JSON.stringify(data));
            return request<ReplayMetadataV2>(`/plugins/replay/storage/import?override=${override}`, { method: 'POST', body: formData });
        },
    },
    matchHistory: {
        getRecentMatches: ({ after, limit }: { after: GUID | null, limit: number }) => {
            const params = new URLSearchParams();
            if (after) {
                params.set('after', after);
            }
            params.set('limit', limit.toString());
            return request<RiotMatchMetadata[]>(`/plugins/history/matches/recent?${params}`);
        },
        getNewMatches: ({ after, limit }: { after: GUID, limit: number }) => {
            const params = new URLSearchParams();
            params.set('since', after.toString());
            params.set('limit', limit.toString());
            return request<RiotMatchMetadata[]>(`/plugins/history/matches/new?${params}`);
        },
    },
    remote: {
        triggerDownload: (matchId: string) =>
            request(`/plugins/replay/remote/matches/recent/${matchId}/download`, { method: 'POST' }),
        retryDownload: (matchId: string) =>
            request(`/plugins/replay/remote/matches/recent/${matchId}/download/retry`, { method: 'POST' }),
        getDownloadState: (matchId: string) =>
            request<DownloadStateDTO | null>(
                `/plugins/replay/remote/matches/recent/${matchId}/download/state`,
            ),
    },
    injector: {
        getStatus: () => request<InjectStatus>('/plugins/replay/injector/status'),
        startInject: (matchId: string) =>
            request(`/plugins/replay/injector/matches/${matchId}`, { method: 'POST' }),
        cancelInject: () => request('/plugins/replay/injector', { method: 'DELETE' }),
    },
    account: {
        getAlias: () => request<PlayerAliasDTO>('/caching/riot-account/alias'),
        getPuuid: () => request<PlayerUuidDTO>('/caching/riot-account/puuid'),
    },
    sessions: {
        getAllProductSessions: () => request<Record<string, ProductSessionDTO>>('/caching/product-sessions'),
    },
    assets: {
        getAllMaps: () => request<Record<string, MapAssetDTO>>('/assets/maps/'),
        getAllAgents: () => request<Record<string, AgentAssetDTO>>('/assets/agents'),
        getAllWeapons: () => request<Record<string, WeaponAssetDTO>>('/assets/weapons'),
        getAllGear: () => request<Record<string, GearAssetDTO>>('/assets/gear'),
    },
    matchStats: {
        getById: (matchId: string) =>
            request<MatchStatsResult>(`/caching/valorant-game-stats/${matchId}`),
        triggerFetch: (matchId: string) =>
            request(`/caching/valorant-game-stats/${matchId}/fetch`, { method: 'POST' }),
    },
    config: {
        getCurrent: () => request<EffectiveConfig>('/configuration/current'),
        getOverrides: () => request<ConfigOverrides>('/configuration/overrides'),
        saveOverrides: (overrides: ConfigOverrides) =>
            request<ConfigOverrides>('/configuration/overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(overrides),
            }),
        deleteOverrides: () => request('/configuration/overrides', { method: 'DELETE' }),
    },
    processControl: {
        shutdown: () => request('/process-control/shutdown', { method: 'POST' }),
    },
    gameLoop: {
        getState: () => requestText('/caching/valorant-loop-session/state'),
    },
    socialPresence: {
        getAll: () => request<Record<string, SocialPresence> | null>('/caching/valorant/multigame-presences'),
    },
    updateCheck: {
        getStatus: () => request<UpdateStatus>('/plugins/update-check/status'),
    },
} as const;

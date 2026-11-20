import { Inject, Injectable } from '@nestjs/common';
import { type RiotClientService } from '@/core/riotclient/RiotClientService';
import { RIOT_CLIENT_SERVICE } from '@/core/riotclient/RiotClientTokens';
import { PlayerAccountLookupV2NamesetsForPuuidResponse, PluginPlayerAccountApi } from '../../../gen';
import { AsyncMapDataBehavior } from '@/core/data/behaviors/async/AsyncMapDataBehavior';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { AsyncResult, GUID, PlayerAliasDTO } from '@vrv/shared';

export type PuuidToPlayerAliasErrorUnion = NetworkRequestError;

class NetworkRequestError extends Error {
    constructor(message: string) {
        super(message);
    }
}

@Injectable()
export class PuuidToPlayerAliasManager extends AsyncMapDataBehavior<
    string,
    PlayerAliasDTO,
    PuuidToPlayerAliasErrorUnion
> {
    protected manager: IMapDataManager<string, PlayerAccountLookupV2NamesetsForPuuidResponse, AsyncResult<PlayerAliasDTO, PuuidToPlayerAliasErrorUnion>>;

    constructor(
        @Inject(RIOT_CLIENT_SERVICE)
        protected readonly riotClientService: RiotClientService,
    ) {
        const base = new SimpleMapDataManager<GUID, AsyncResult<PlayerAliasDTO, PuuidToPlayerAliasErrorUnion>>();
        super(base);
    }

    public requestBatchFetch(puuids: string[], maxTimeoutMs: number = 5_000): void {
        const pluginApi = this.riotClientService.getCachedApi(PluginPlayerAccountApi);

        const batchPromise = pluginApi
            .playerAccountLookupV2NamesetsForPuuidsPost(
                { puuids },
                { timeout: maxTimeoutMs },
            )
            .then((resp) => resp.data?.namesets ?? []);


        for (const puuid of puuids) {
            this.injectPromise(puuid, batchPromise.then((namesets) => {
                const entry = namesets.find((n) => n.puuid === puuid);
                if (!entry) {
                    throw new NetworkRequestError(`No entry found for puuid ${puuid}`);
                }
                return this.map(entry);
            }));
        }
    }

    protected map(value: PlayerAccountLookupV2NamesetsForPuuidResponse): PlayerAliasDTO {
        const alias = value.alias;

        if (!alias || !alias.gameName || !alias.tagLine) {
            throw new Error('Failed to fetch player alias for puuid ' + value.puuid);
        }

        return {
            gameName: alias.gameName,
            tagLine: alias.tagLine,
        };
    }
}
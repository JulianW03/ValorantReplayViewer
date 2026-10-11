import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { KeyValueUpdatedEvent } from '@/core/events/BasicEvent';
import { RiotValorantAPIManager } from '@/integrations/riot/RiotValorantAPIManager';
import { PuuidToPlayerAliasManager } from '@/modules/PuuidToPlayerAliasModule/PuuidToPlayerAliasManager';
import { AsyncMapDataBehavior } from '@/core/data/behaviors/async/AsyncMapDataBehavior';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { EmittingMapDataBehavior } from '@/core/data/behaviors/emission/EmittingMapDataBehavior';
import { GUID } from '#/schemas/GUIDSchema';
import { MatchStatus, MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import { RiotMatchMetadata } from '#/schemas/ReplayFormatV2.schema';
import { AsyncResult } from '#/utils/AsyncResult';

@Injectable()
export class ValorantMatchStatsManager
    extends AsyncMapDataBehavior<GUID, RiotMatchMetadata, Error>
    implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(this.constructor.name);

    private unsubscribe: (() => void) | null = null;

    constructor(
        protected readonly eventBus: SimpleEventBus,
        protected readonly valorantApi: RiotValorantAPIManager,
        protected readonly playerAliasManager: PuuidToPlayerAliasManager,
    ) {
        const base = new SimpleMapDataManager<GUID, AsyncResult<RiotMatchMetadata, Error>>();
        const emitting = new EmittingMapDataBehavior(base, eventBus, ValorantMatchStatsManager.name);
        super(emitting);
    }

    onModuleInit() {
        this.unsubscribe = this.eventBus.subscribeOnSource(
            ValorantGameSessionManager.name,
            this.gameSessionStateChange.bind(this),
        );
    }

    onModuleDestroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.deleteState();
    }

    public requestMatchFetch(matchId: GUID) {
        if (this.externalRepresentation.getKeyView(matchId) !== null) {
            return;
        }

        this.injectPromise(matchId, this.fetchMatchData(matchId));
    }

    private gameSessionStateChange(
        event: KeyValueUpdatedEvent<GUID, MatchStatus>,
    ) {
        if (event.payload.value !== MatchStatusSchema.enum.ENDED) {
            return;
        }

        const matchId = event.payload.key;
        this.requestMatchFetch(matchId);
    }

    private async fetchMatchData(matchId: GUID): Promise<RiotMatchMetadata> {
        const result = await this.valorantApi.matches.getDetails(matchId);
        const puuids = result.players.map(p => p.subject).filter((p) => p !== undefined);
        this.playerAliasManager.requestBatchFetch(puuids);
        this.logger.debug(
            `Requested player alias batch fetch for match ID ${matchId} with puuids: ${puuids.join(', ')}`,
        );
        const aliasMap = await this.playerAliasManager.getBestEffortBatchedResult(puuids, 5_000);

        const failedEntries = Object.entries(aliasMap).filter((key, value) => value === null);

        if (failedEntries.length > 0) {
            this.logger.warn(
                `Failed alias lookups for match ID ${matchId}: ${failedEntries.map(([key, value]) => key).join(', ')}`,
            );
        }


        return {
            matchMetadata: result,
            puuidResolver: aliasMap,
        };
    }
}

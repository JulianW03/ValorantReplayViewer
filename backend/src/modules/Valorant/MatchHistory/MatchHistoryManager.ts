import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RiotValorantAPIManager } from '@/integrations/riot/RiotValorantAPIManager';
import { ValorantMatchStatsManager } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsManager';
import { DataDeletable } from '@/core/data/interfaces/capabilities/DataDeletable';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { distinctUntilChanged, filter, map, Subscription } from 'rxjs';
import { onSource } from '@/core/events/adapters/rxjsAdapters';
import { EventType } from '@/core/events/EventTypes';
import { KeyValueUpdatedEvent, StateUpdatedEvent } from '@/core/events/BasicEvent';
import { GUID } from '#/schemas/GUIDSchema';
import { RiotMatchMetadata } from '#/schemas/ReplayFormatV2.schema';
import { AsyncResult } from '#/utils/AsyncResult';
import { PlayerUuidDTO } from '#/schemas/PlayerUuid.schema';
import { AccountPuuidManager } from '@/modules/Account/AccountPuuidModule/AccountPuuidManager';

@Injectable()
export class MatchHistoryManager implements DataDeletable, OnModuleInit, OnModuleDestroy {
    private readonly orderedMatchIds: GUID[] = [];
    private readonly knownMatchIds = new Set<GUID>();
    private readonly logger = new Logger(MatchHistoryManager.name);

    private loadingMore: Promise<void> | null = null;
    private remoteMatchHistoryEndReached = false;
    private matchStatsSubscription: Subscription;
    private userSubscription: Subscription;

    constructor(
        private readonly riot: RiotValorantAPIManager,
        private readonly eventBus: SimpleEventBus,
        private readonly stats: ValorantMatchStatsManager,
    ) {
    }

    onModuleDestroy() {
        this.userSubscription?.unsubscribe();
        this.matchStatsSubscription?.unsubscribe();
    }

    onModuleInit() {
        this.userSubscription = onSource(this.eventBus, AccountPuuidManager.name)
            .pipe(
                filter((it) => it.type === EventType.StateUpdated),
                map(it => (it as StateUpdatedEvent<PlayerUuidDTO>).payload.value?.uuid),
                distinctUntilChanged(),
            )
            .subscribe((it) => {
                this.deleteState();
            });
        this.matchStatsSubscription = onSource(this.eventBus, ValorantMatchStatsManager.name)
            .subscribe((it) => {
                if (it.type !== EventType.KeyValueUpdated) return;

                const typed = it as KeyValueUpdatedEvent<GUID, AsyncResult<RiotMatchMetadata, Error>>;
                const result = typed.payload.value;
                if (!result?.isSuccess()) return;

                this.onMatchStatsAvailable(typed.payload.key, result.data);
            });
    }


    deleteState(): void {
        this.orderedMatchIds.length = 0;
        this.knownMatchIds.clear();
        this.loadingMore = null;
        this.remoteMatchHistoryEndReached = false;
    }

    private onMatchStatsAvailable(matchId: GUID, metadata: RiotMatchMetadata): void {
        if (this.knownMatchIds.has(matchId)) {
            return;
        }

        if (!this.shouldAppear(metadata)) {
            this.logger.debug(`Match ${matchId} filtered out, wont appear in match history`);
            return;
        }

        this.knownMatchIds.add(matchId);
        this.orderedMatchIds.unshift(matchId);
        this.logger.debug(`Match ${matchId} stats available, prepended to match history`);
    }

    private shouldAppear(_metadata: RiotMatchMetadata): boolean {
        // We dont want Practice matches
        if (_metadata.matchMetadata.matchInfo.provisioningFlowID === "ShootingRange") return false;
        return true;
    }

    private async loadMore(count = 20): Promise<void> {
        if (this.remoteMatchHistoryEndReached) {
            this.logger.debug('Wont load more data: External API has reached its limit.');
            return;
        }

        if (this.loadingMore) {
            this.logger.debug('A load is in progress, wont start new one.');
            return this.loadingMore;
        }

        this.loadingMore = this.doLoadMore(count);

        try {
            await this.loadingMore;
        } finally {
            this.loadingMore = null;
        }
    }

    private async doLoadMore(count = 20): Promise<void> {
        /**
         * We use the fact that we (hopefully) have received new matches and therefore
         * have our offset into the pagination as a nice side effect.
         * */
        const page = await this.riot.matches.getHistory(
            this.orderedMatchIds.length,
            this.orderedMatchIds.length + count,
        );

        if (page.length < count) {
            this.logger.debug('We\'ve seem to have hit the end of the match history. Marking as exhausted.');
            this.remoteMatchHistoryEndReached = true;
        }

        page.sort((a, b) => b.GameStartTime - a.GameStartTime);
        page.forEach(entry => {
            if (this.knownMatchIds.has(entry.MatchID)) {
                return;
            }

            this.knownMatchIds.add(entry.MatchID);
            this.orderedMatchIds.push(entry.MatchID);
            this.stats.requestMatchFetch(entry.MatchID);
        });
    }

    public async getMatchIdsAfter(
        afterMatchId: GUID | null,
        limit = 10,
    ): Promise<GUID[]> {
        if (afterMatchId === null) {
            this.logger.debug('No after provided, will therefore use / return our latest (newest) match data.');
            if (this.orderedMatchIds.length < limit) {
                await this.loadMore();
            }

            return this.orderedMatchIds.slice(0, limit);
        }

        const index = this.orderedMatchIds.indexOf(afterMatchId);
        if (index === -1) {
            /**
             * TODO:
             * This should propagate as an error probably to make it clear to the client that the requests must be done
             * sequentially and cant just use any random "pointer".
             **/
            return [];
        }

        const available = this.orderedMatchIds.length - (index + 1);

        const missing = limit - available;

        if (missing > 0 && !this.remoteMatchHistoryEndReached) {
            await this.loadMore(Math.min(missing, 20));
        }

        return this.orderedMatchIds.slice(index + 1, index + 1 + limit);
    }

    public async getMatchDataAfter(
        afterMatchId: GUID | null,
        limit = 10,
    ): Promise<Record<GUID, RiotMatchMetadata | null>> {
        const ids = await this.getMatchIdsAfter(afterMatchId, limit);

        return this.stats.getBestEffortBatchedResult(
            ids,
            5_000,
        );
    }

    public async getMatchIdsBefore(
        beforeMatchId: GUID,
        limit = 10,
    ): Promise<GUID[]> {
        const index = this.orderedMatchIds.indexOf(beforeMatchId);

        if (index === -1) {
            return [];
        }

        const start = Math.max(0, index - limit);

        return this.orderedMatchIds.slice(start, index);
    }

    public async getMatchDataBefore(
        beforeMatchId: GUID,
        limit = 10,
    ): Promise<Record<GUID, RiotMatchMetadata | null>> {
        const ids = await this.getMatchIdsBefore(
            beforeMatchId,
            limit,
        );

        return this.stats.getBestEffortBatchedResult(
            ids,
            5_000,
        );
    }
}
import { Inject, Injectable } from '@nestjs/common';
import type { RiotClientService } from '@/core/riotclient/RiotClientService';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { RCUMessageType } from '@/core/riotclient/messaging/RCUMessage';
import { RIOT_CLIENT_SERVICE, RIOT_CLIENT_STATE_DISPATCHING_SERVICE } from '@/core/riotclient/RiotClientTokens';
import type { RiotClientStateDispatcher } from '@/core/riotclient/RiotClientStateDispatcher';
import { ForwardedMessage, TrieRCUMessageDispatcher } from '@/core/riotclient/messaging/trie/TrieRCUMessageDispatcher';
import { AnyPathPattern, parsePatternString } from '@/core/riotclient/messaging/path/PatternParser';
import { RCUDataAdapter } from '@/core/data/adapters/RCUDataAdapter';
import { MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import type { GUID } from '@vrv/shared';

@Injectable()
export class ValorantGameInProgressRCUAdapter extends RCUDataAdapter<ValorantGameSessionManager> {
    private static PATH_PATTERNS = parsePatternString('/riot-messaging-service/v1/messages/ares-core-game/core-game/v1/matches/{matchId}');

    constructor(
        @Inject(RIOT_CLIENT_SERVICE)
        protected readonly rcService: RiotClientService,
        protected readonly gameSessionManager: ValorantGameSessionManager,
        @Inject(RIOT_CLIENT_STATE_DISPATCHING_SERVICE)
        stateDispatcher: RiotClientStateDispatcher,
        messageDispatcher: TrieRCUMessageDispatcher,
    ) {
        super(rcService, gameSessionManager, stateDispatcher, messageDispatcher);
    }

    protected async handleRCUEvent(
        {
            message: {
                type,
                data,
            },
            matchResult,
        }: ForwardedMessage,
    ): Promise<void> {
        const matchId = matchResult.params['matchId'] as GUID;

        switch (type) {
            case RCUMessageType.UPDATE:
            case RCUMessageType.CREATE:
                this.manager.updateKeyValue(matchId, MatchStatusSchema.enum.IN_PROGRESS);
                break;
            case RCUMessageType.DELETE:
            default:
                break;
        }
    }

    protected getPathParts(): AnyPathPattern[] {
        return ValorantGameInProgressRCUAdapter.PATH_PATTERNS;
    }
}

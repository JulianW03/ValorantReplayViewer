import { Inject, Injectable } from '@nestjs/common';
import type { RiotClientService } from '@/core/riotclient/RiotClientService';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { RCUMessageType } from '@/core/riotclient/messaging/RCUMessage';
import { RIOT_CLIENT_SERVICE, RIOT_CLIENT_STATE_DISPATCHING_SERVICE } from '@/core/riotclient/RiotClientTokens';
import { ForwardedMessage, TrieRCUMessageDispatcher } from '@/core/riotclient/messaging/trie/TrieRCUMessageDispatcher';
import { AnyPathPattern, parsePatternString } from '@/core/riotclient/messaging/path/PatternParser';
import type { RiotClientStateDispatcher } from '@/core/riotclient/RiotClientStateDispatcher';
import { RCUDataAdapter } from '@/core/data/adapters/RCUDataAdapter';
import { MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import { GUID } from '@vrv/shared';

interface RMSMessage {
    ackRequired: boolean;
    id: string;
    payload: JsonNode;
    ressource: string;
    service: string;
    timestamp: number;
    version: string;
}

@Injectable()
export class ValorantMatchEndedRCUAdapter extends RCUDataAdapter<ValorantGameSessionManager> {
    private static PATH_PATTERNS = parsePatternString('/riot-messaging-service/v1/messages/ares-match-details/match-details/v1/matches');

    constructor(
        @Inject(RIOT_CLIENT_SERVICE)
        rcService: RiotClientService,
        gameSessionManager: ValorantGameSessionManager,
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
        switch (type) {
            case RCUMessageType.UPDATE:
            case RCUMessageType.CREATE:
                const typedData = data as unknown as RMSMessage;
                const matchId = typedData.payload as GUID;
                this.manager.updateKeyValue(matchId, MatchStatusSchema.enum.ENDED);
                break;
            case RCUMessageType.DELETE:
            default:
                break;
        }
    }

    protected getPathParts(): AnyPathPattern[] {
        return ValorantMatchEndedRCUAdapter.PATH_PATTERNS;
    }
}

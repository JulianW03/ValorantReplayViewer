import { type RiotClientService } from '@/core/riotclient/RiotClientService';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { RIOT_CLIENT_STATE_DISPATCHING_SERVICE, RIOT_CLIENT_SERVICE } from '@/core/riotclient/RiotClientTokens';
import { AccountNameAndTagLineManager } from '@/modules/Account/AccountNameAndTagLineModule/AccountNameAndTagLineManager';
import { RCUMessageType } from '@/core/riotclient/messaging/RCUMessage';
import { PlayerAccountGameNameAndTagLine, PluginPlayerAccountApi } from '../../../../gen';
import { AnyPathPattern, parsePatternString } from '@/core/riotclient/messaging/path/PatternParser';
import { type RiotClientStateDispatcher } from '@/core/riotclient/RiotClientStateDispatcher';
import { ForwardedMessage, TrieRCUMessageDispatcher } from '@/core/riotclient/messaging/trie/TrieRCUMessageDispatcher';
import { RCUDataAdapter } from '@/core/data/adapters/RCUDataAdapter';

@Injectable()
export class AccountNameAndTagLineRCUAdapter extends RCUDataAdapter<AccountNameAndTagLineManager> {
    private static readonly PATH_PATTERNS = parsePatternString('/player-account/aliases/v1/display-name');
    protected logger = new Logger(this.constructor.name);

    constructor(
        @Inject(RIOT_CLIENT_SERVICE)
        rcService: RiotClientService,
        manager: AccountNameAndTagLineManager,
        @Inject(RIOT_CLIENT_STATE_DISPATCHING_SERVICE)
        stateDispatcher: RiotClientStateDispatcher,
        messageDispatcher: TrieRCUMessageDispatcher,
    ) {
        super(
            rcService,
            manager,
            stateDispatcher,
            messageDispatcher,
        );
    }

    protected getPathParts(): AnyPathPattern[] {
        return AccountNameAndTagLineRCUAdapter.PATH_PATTERNS;
    }


    protected async handleRCUEvent(
        message: ForwardedMessage,
    ): Promise<void> {
        const type = message.message.type;
        const data = message.message.data;
        switch (type) {
            case RCUMessageType.CREATE:
            case RCUMessageType.UPDATE: {
                this.manager.updateValue(data as PlayerAccountGameNameAndTagLine);
                break;
            }
            case RCUMessageType.DELETE: {
                this.manager.deleteState();
                break;
            }
        }
    }

    protected async handleConnected(): Promise<void> {
        this.logger.log('Handle connected for AccountNameAndTagLineManager');
        const api = this.rcService.getCachedApi(PluginPlayerAccountApi)
        const resp = await api
            .playerAccountAliasesV1DisplayNameGet()
            .catch((e) => {
                this.logger.warn(
                    'Failed to fetch initial account name and tag line',
                    e.response?.data || e,
                );
                return null;
            });
        if (!resp || resp.status !== HttpStatus.OK) return;
        if (this.manager.getView() === null) {
            this.logger.log(
                'Setting initial account name and tag line',
                resp.data,
            );
            this.manager.updateValue(resp.data);
        }
    }

    protected async handleDisconnected(): Promise<void> {
    }
}

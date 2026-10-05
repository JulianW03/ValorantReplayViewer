import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ProductSessionManager } from '@/modules/ProductSessionModule/ProductSessionManager';
import { RCUMessageType } from '@/core/riotclient/messaging/RCUMessage';
import { PluginProductSessionApi, ProductSessionSession } from '../../../gen';
import type { RiotClientService } from '@/core/riotclient/RiotClientService';
import { RIOT_CLIENT_SERVICE, RIOT_CLIENT_STATE_DISPATCHING_SERVICE } from '@/core/riotclient/RiotClientTokens';
import type { RiotClientStateDispatcher } from '@/core/riotclient/RiotClientStateDispatcher';
import { TrieRCUMessageDispatcher } from '@/core/riotclient/messaging/trie/TrieRCUMessageDispatcher';
import { AnyPathPattern, parsePatternString } from '@/core/riotclient/messaging/path/PatternParser';
import { RCUDataAdapter } from '@/core/data/adapters/RCUDataAdapter';

@Injectable()
export class ProductSessionRCUAdapter extends RCUDataAdapter<ProductSessionManager> {

    private static PATH_PATTERNS = parsePatternString('/product-session/v1/sessions/{sessionId}');

    constructor(
        @Inject(RIOT_CLIENT_SERVICE)
        rcService: RiotClientService,
        manager: ProductSessionManager,
        @Inject(RIOT_CLIENT_STATE_DISPATCHING_SERVICE)
        stateDispatcher: RiotClientStateDispatcher,
        messageDispatcher: TrieRCUMessageDispatcher,
    ) {
        super(rcService, manager, stateDispatcher, messageDispatcher);
    }

    protected async handleRCUEvent(
        forward,
    ): Promise<void> {
        const type = forward.message.type;
        const data = forward.message.data;
        const match = forward.matchResult.params;
        switch (type) {
            case RCUMessageType.CREATE:
            case RCUMessageType.UPDATE: {
                const typedData = data as unknown as ProductSessionSession;
                const sessionId = match['sessionId'];
                if (this.manager.getKeyView(sessionId) === null) {
                    this.logger.debug(
                        `Registering new product session with ID: ${sessionId}`,
                        typedData,
                    );
                }
                this.manager.updateKeyValue(sessionId, typedData);
                break;
            }
            case RCUMessageType.DELETE: {
                const sessionId = match['sessionId'];
                this.logger.debug(
                    `Unregistering product session with ID: ${sessionId}`,
                );
                this.manager.deleteKey(sessionId);
                break;
            }
            default:
                throw new Error(`Unsupported message type: ${type}`);
        }
    }

    protected async handleConnected(): Promise<void> {
        const api = this.rcService.getCachedApi(PluginProductSessionApi);
        const resp = await api.productSessionV1SessionsGet();
        if (!resp || resp.status !== HttpStatus.OK) {
            this.logger.warn(
                'Failed to fetch initial product session data on RCU connection',
                resp?.status,
            );
            return;
        }

        this.manager.updateValue(resp.data);
    }

    protected getPathParts(): AnyPathPattern[] {
        return ProductSessionRCUAdapter.PATH_PATTERNS;
    }
}

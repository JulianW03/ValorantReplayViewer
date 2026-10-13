import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server } from 'ws';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { AccountNameAndTagLineManager } from '@/modules/Account/AccountNameAndTagLineModule/AccountNameAndTagLineManager';
import { ValorantGameLoopManager } from '@/modules/Valorant/ValorantGameLoopModule/ValorantGameLoopManager';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { ValorantMatchStatsManager } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsManager';
import { ValorantVersionInfoManager } from '@/modules/Valorant/ValorantVersionInfo/ValorantVersionInfoManager';
import { ProductSessionManager } from '@/modules/ProductSessionModule/ProductSessionManager';
import { ReplayManager } from '@/modules/Valorant/ValorantReplays/storage/ReplayManager';
import { ReplayInjectManagerV2 } from '@/modules/Valorant/ValorantReplays/injector/ReplayInjectManagerV2';
import { SocialPresenceManager } from '@/modules/SocialPresence/SocialPresenceManager';
import { UpdateCheckerManager } from '@/modules/UpdateChecker/UpdateCheckerManager';
import { IncomingMessage } from 'node:http';
import { InjectConfig } from '@/config/configLoader';
import type { EnvConfigV1DTO } from '@/config/ConfigV1.schema';

@WebSocketGateway({})
@Injectable()
export class WSEventPublisher
    implements
        OnModuleInit,
        OnModuleDestroy,
        OnGatewayConnection,
        OnGatewayDisconnect
{
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly bus: SimpleEventBus
    ) {}

    private static readonly ALLOWED_SOURCES = new Set([
        AccountNameAndTagLineManager.name,
        ValorantGameLoopManager.name,
        ValorantGameSessionManager.name,
        ValorantMatchStatsManager.name,
        SocialPresenceManager.name,
        ReplayInjectManagerV2.name,
        ValorantVersionInfoManager.name,
        ProductSessionManager.name,
        ReplayManager.name,
        UpdateCheckerManager.name,
    ]);

    private unsubscribeAll: (() => void) | null = null;

    handleConnection(client: WebSocket, request: IncomingMessage) {}

    handleDisconnect(client: any): any {}

    onModuleDestroy(): any {
        this.unsubscribeAll?.();
    }

    onModuleInit(): any {

        this.unsubscribeAll = this.bus.subscribeOnAll((event) => {
            if (
                !event.source ||
                !WSEventPublisher.ALLOWED_SOURCES.has(event.source)
            ) {
                return;
            }

            const payload = JSON.stringify({ type: 'event', data: event });

            this.server.clients.forEach((client) => {
                if (client.readyState === client.OPEN) {
                    client.send(payload);
                }
            });
        });
    }
}

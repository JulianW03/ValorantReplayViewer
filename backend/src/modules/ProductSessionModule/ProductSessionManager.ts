import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { ProductSessionSession } from '../../../gen';
import { OutputMappingRecomputingMapBehavior } from '@/core/data/behaviors/viewMapping/OutputMappingRecomputingMapBehavior';
import { EmittingMapDataBehavior } from '@/core/data/behaviors/emission/EmittingMapDataBehavior';
import { EventType } from '@/core/events/EventTypes';
import { KeyUpdateActionType, KeyValueUpdatedEvent, StateUpdatedEvent } from '@/core/events/BasicEvent';
import { Injectable } from '@nestjs/common';
import { ProductSessionDTO } from '@vrv/shared';

export type SessionId = string;

export type SessionLaunchSubscriptionParams = {
    eventBus: SimpleEventBus;
    productId: string;
    callback: (sessionId: string, session: ProductSessionDTO) => void;
}

@Injectable()
export class ProductSessionManager implements IMapDataManager<SessionId, ProductSessionSession, ProductSessionDTO> {
    private readonly manager: IMapDataManager<SessionId, ProductSessionSession, ProductSessionDTO>;

    constructor(
        readonly eventBus: SimpleEventBus,
    ) {
        const store = new SimpleMapDataManager<SessionId, ProductSessionSession>();
        const mapped = new OutputMappingRecomputingMapBehavior(store, ProductSessionManager.mapSession);
        this.manager = new EmittingMapDataBehavior(mapped, eventBus, this.constructor.name);
    }

    private static mapSession(session: ProductSessionSession): ProductSessionDTO {
        const launchConfiguration = session.launchConfiguration!;

        return {
            productId: session.productId!,
            isInternal: session.isInternal!,
            launchConfiguration: {
                arguments: [...launchConfiguration.arguments!],
                executable: launchConfiguration.executable!,
                workingDirectory: launchConfiguration?.workingDirectory!,
                locale: launchConfiguration.locale!,
            },
        };
    }

    public getSessionByProductId(productId: string): ProductSessionDTO | null {
        const sessions = this.manager.getView();
        if (!sessions) return null;

        const eligibleSession = Object.values(sessions).find(
            (s) => s?.productId === productId,
        ) as ProductSessionDTO | undefined;

        return eligibleSession ?? null;
    }

    getKeyView(key: SessionId): ProductSessionDTO | null {
        return this.manager.getKeyView(key);
    }

    getView(): Record<SessionId, ProductSessionDTO> | null {
        return this.manager.getView();
    }

    updateKeyValue(key: SessionId, value: ProductSessionSession): void {
        this.manager.updateKeyValue(key, value);
    }

    updateKeyValueBatch(entries: Record<SessionId, ProductSessionSession>): void {
        this.manager.updateKeyValueBatch(entries);
    }

    updateValue(entries: Record<SessionId, ProductSessionSession>): void {
        this.manager.updateValue(entries);
    }

    deleteState(): void {
        this.manager.deleteState();
    }

    deleteKey(key: SessionId): void {
        this.manager.deleteKey(key);
    }

    public static readonly onNewSessionLaunch = ({
                                                     eventBus,
                                                     productId,
                                                     callback,
                                                 }: SessionLaunchSubscriptionParams) => {
        return eventBus.subscribeOnSource(ProductSessionManager.name, (event) => {
            switch (event.type) {
                case EventType.StateUpdated: {
                    const stateUpdatedEvent = event as StateUpdatedEvent<Record<string, ProductSessionDTO>>
                    const updatedSessionMap = stateUpdatedEvent.payload.value;
                    const res = Array.from(Object.entries(updatedSessionMap ?? {})).find(
                        ([_, session]) => session?.productId === productId,
                    );

                    if (res) {
                        const [sessionId, updatedSession] = res;
                        callback(sessionId, updatedSession);
                    }
                }
                    break;
                case EventType.KeyValueUpdated:
                    const evt = event as KeyValueUpdatedEvent<string, ProductSessionDTO>;
                    const type = evt.payload.action;
                    const updatedSessionEntry = evt.payload.value;
                    const updatedSessionId = evt.payload.key;
                    if (type === KeyUpdateActionType.CREATED && updatedSessionEntry?.productId === productId) {
                        callback(updatedSessionId, updatedSessionEntry);
                    }
                    break;
                default:
                    break;
            }
        });
    };
}
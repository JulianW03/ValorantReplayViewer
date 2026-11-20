import { Injectable } from '@nestjs/common';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { SocialPresenceSessionV1 } from '../../../gen';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import {
    OutputMappingRecomputingMapBehavior,
} from '@/core/data/behaviors/viewMapping/OutputMappingRecomputingMapBehavior';
import { EmittingMapDataBehavior } from '@/core/data/behaviors/emission/EmittingMapDataBehavior';
import { MappingError } from '@/core/data/behaviors/viewMapping/MappingError';
import { Social_Presence, SocialPresence, SocialPresenceSchema } from '@vrv/shared';

export namespace MultigamePresence {
    export type ProductId = typeof Social_Presence.KNOWN_PRODUCTS[keyof typeof Social_Presence.KNOWN_PRODUCTS] | string;
}
@Injectable()
export class SocialPresenceManager implements IMapDataManager<MultigamePresence.ProductId, SocialPresenceSessionV1, SocialPresence> {
    private readonly manager: IMapDataManager<MultigamePresence.ProductId, SocialPresenceSessionV1, SocialPresence>;

    constructor(
        readonly eventBus: SimpleEventBus,
    ) {
        const store = new SimpleMapDataManager<MultigamePresence.ProductId, SocialPresenceSessionV1>();
        const mapped = new OutputMappingRecomputingMapBehavior(store, SocialPresenceManager.map);
        this.manager = new EmittingMapDataBehavior(mapped, eventBus, this.constructor.name);
    }

    private static map(session: SocialPresenceSessionV1): SocialPresence {
        try {
            return SocialPresenceSchema.parse(session);
        } catch (error) {
            throw new MappingError('Failed to parse social presence session', { cause: error });
        }
    }

    getKeyView(key: MultigamePresence.ProductId): SocialPresence | null {
        return this.manager.getKeyView(key);
    }

    getView(): Record<MultigamePresence.ProductId, SocialPresence> | null {
        return this.manager.getView();
    }

    updateKeyValue(key: MultigamePresence.ProductId, value: SocialPresenceSessionV1): void {
        this.manager.updateKeyValue(key, value);
    }

    updateKeyValueBatch(entries: Record<MultigamePresence.ProductId, SocialPresenceSessionV1>): void {
        this.manager.updateKeyValueBatch(entries);
    }

    updateValue(entries: Record<MultigamePresence.ProductId, SocialPresenceSessionV1>): void {
        this.manager.updateValue(entries);
    }

    deleteKey(key: MultigamePresence.ProductId): void {
        this.manager.deleteKey(key);
    }

    deleteState(): void {
        this.manager.deleteState();
    }
}

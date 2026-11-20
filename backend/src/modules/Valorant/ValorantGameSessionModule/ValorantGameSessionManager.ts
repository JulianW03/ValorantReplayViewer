import { Injectable, Logger } from '@nestjs/common';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { IMapDataManager } from '@/core/data/interfaces/IMapDataManager';
import { EmittingMapDataBehavior } from '@/core/data/behaviors/emission/EmittingMapDataBehavior';
import { SimpleMapDataManager } from '@/core/data/SimpleMapDataManager';
import { KeyDataUpdatable } from '@/core/data/interfaces/capabilities/KeyDataUpdatable';
import { DataDeletable } from '@/core/data/interfaces/capabilities/DataDeletable';
import { KeyDataViewable } from '@/core/data/interfaces/capabilities/KeyDataViewable';
import { MatchStatus, MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import { GUID } from '@vrv/shared';

@Injectable()
export class ValorantGameSessionManager implements KeyDataUpdatable<GUID, MatchStatus>, DataDeletable, KeyDataViewable<GUID, MatchStatus> {
    private readonly manager: IMapDataManager<
        GUID,
        MatchStatus,
        MatchStatus
    >;
    private readonly logger = new Logger(this.constructor.name);

    constructor(protected readonly eventBus: SimpleEventBus) {
        const base = new SimpleMapDataManager<GUID, MatchStatus>();
        this.manager = new EmittingMapDataBehavior(base, eventBus, this.constructor.name);
    }

    private latestMatchId: GUID | null = null;

    private static ValidTransitionStates: Record<MatchStatus, MatchStatus[]> = {
        [MatchStatusSchema.enum.CHAMPION_SELECTION]: [
            MatchStatusSchema.enum.IN_PROGRESS,
            MatchStatusSchema.enum.ASSUMED_CANCELLED,
        ],
        [MatchStatusSchema.enum.IN_PROGRESS]: [MatchStatusSchema.enum.ENDED],
        [MatchStatusSchema.enum.ENDED]: [],
        // An example would be quitting a deathmatch game, while its in progress,
        // We could start another game right after, but the game would later on end
        // so we need to allow this transition
        [MatchStatusSchema.enum.ASSUMED_CANCELLED]: [MatchStatusSchema.enum.ENDED],
    };

    private verifyTransition(
        oldStatus: MatchStatus | null,
        newStatus: MatchStatus,
    ): boolean {
        if (oldStatus === null) {
            return true;
        }

        const validTransitions =
            ValorantGameSessionManager.ValidTransitionStates[oldStatus] || [];
        return validTransitions.includes(newStatus);
    }

    protected getViewForValue(value: MatchStatus | null): MatchStatus | null {
        return value;
    }

    deleteState(): void {
        this.manager.deleteState();
    }

    getKeyView(key: GUID): MatchStatus | null {
        return this.manager.getKeyView(key);
    }

    getView(): Record<GUID, MatchStatus> | null {
        return this.manager.getView();
    }

    updateKeyValue(key: GUID, value: MatchStatus): void {
        const prev = this.getKeyView(key);
        if (!this.verifyTransition(prev, value)) return;
        const prevMatchId = this.latestMatchId;
        if (prev === null) {
            this.latestMatchId = key;
            if (prevMatchId !== null) {
                this.logger.debug(
                    `Got a new match id ${key} that will replace ${prevMatchId} -> Attempting to transition it to ${MatchStatusSchema.enum.ASSUMED_CANCELLED}`,
                );
                this.updateKeyValue(prevMatchId, MatchStatusSchema.enum.ASSUMED_CANCELLED);
            }
        }
        this.logger.log(`Updating match status for ${key}: ${prev} -> ${value}`);
        this.manager.updateKeyValue(key, value);
    }


}

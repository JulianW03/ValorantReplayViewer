import { PlayerAccountGameNameAndTagLine } from '../../../../gen';
import { Injectable } from '@nestjs/common';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { IObjectDataManager } from '@/core/data/interfaces/IObjectDataManager';
import { SimpleObjectDataManager } from '@/core/data/SimpleObjectDataManager';
import {
    OutputMappingCachingObjectBehavior,
} from '@/core/data/behaviors/viewMapping/OutputMappingCachingObjectBehavior';
import { EmittingObjectDataBehavior } from '@/core/data/behaviors/emission/EmittingObjectDataBehavior';
import { PlayerAliasDTO } from '@vrv/shared';

@Injectable()
export class AccountNameAndTagLineManager implements IObjectDataManager<
    PlayerAccountGameNameAndTagLine,
    PlayerAliasDTO
> {
    protected readonly manager: IObjectDataManager<PlayerAccountGameNameAndTagLine, PlayerAliasDTO>;

    constructor(protected readonly eventBus: SimpleEventBus) {
        const base = new SimpleObjectDataManager();
        const map = new OutputMappingCachingObjectBehavior(base, AccountNameAndTagLineManager.map);
        this.manager = new EmittingObjectDataBehavior(map, eventBus, this.constructor.name);
    }

    deleteState(): void {
        this.manager.deleteState();
    }

    getView(): PlayerAliasDTO | null {
        return this.manager.getView();
    }

    updateValue(value: PlayerAccountGameNameAndTagLine): void {
        this.manager.updateValue(value);
    }

    protected static map(
        state: PlayerAccountGameNameAndTagLine,
    ): PlayerAliasDTO {
        return {
            tagLine: state.tagLine!,
            gameName: state.gameName!,
        };
    }
}

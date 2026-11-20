import { Injectable } from '@nestjs/common';
import { IObjectDataManager } from '@/core/data/interfaces/IObjectDataManager';
import { EntitlementsToken } from '../../../../gen';
import { SimpleObjectDataManager } from '@/core/data/SimpleObjectDataManager';
import { OutputMappingCachingObjectBehavior } from '@/core/data/behaviors/viewMapping/OutputMappingCachingObjectBehavior';
import { EmittingObjectDataBehavior } from '@/core/data/behaviors/emission/EmittingObjectDataBehavior';
import { SimpleEventBus } from '@/core/events/SimpleEventBus';
import { GUID, PlayerUuidDTO } from '@vrv/shared';

@Injectable()
export class AccountPuuidManager implements IObjectDataManager<EntitlementsToken, PlayerUuidDTO> {
    private readonly manager: IObjectDataManager<EntitlementsToken, PlayerUuidDTO>;

    constructor(protected readonly eventBus: SimpleEventBus) {
        const store = new SimpleObjectDataManager<EntitlementsToken>();
        const compute = new OutputMappingCachingObjectBehavior(store, AccountPuuidManager.map);
        this.manager = new EmittingObjectDataBehavior(compute, eventBus, AccountPuuidManager.name);
    }

    private static map(state: EntitlementsToken): PlayerUuidDTO {
        return {
            uuid: state.subject as GUID,
        };
    }

    deleteState(): void {
        this.manager.deleteState();
    }

    getView(): PlayerUuidDTO | null {
        return this.manager.getView();
    }

    updateValue(value: EntitlementsToken): void {
        this.manager.updateValue(value);
    }

}
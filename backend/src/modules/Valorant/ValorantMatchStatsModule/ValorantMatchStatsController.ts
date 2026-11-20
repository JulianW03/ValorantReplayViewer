import {
    BadRequestException,
    ClassSerializerInterceptor,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Param,
    Post,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { RiotClientReadyGuard } from '@/core/riotclient/RiotClientReadyGuard';
import { ValorantMatchStatsManager } from '@/modules/Valorant/ValorantMatchStatsModule/ValorantMatchStatsManager';
import { ProductSessionGuard, RequiredProduct } from '@/modules/ProductSessionModule/ProductSessionGuard';
import { type GUID, RiotMatchMetadataSchema } from '@vrv/shared';
import { AsyncResultSchema, Failure, Pending, Success } from '@/utils/AsyncResultSwagger';
import { createZodDto } from 'nestjs-zod';

class RiotMatchMetadataModel extends createZodDto(RiotMatchMetadataSchema) {
}

@RequiredProduct('valorant')
@UseGuards(RiotClientReadyGuard, ProductSessionGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller({
    version: '1',
    path: 'caching/valorant-game-stats',
})
export class ValorantMatchStatsController {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        protected readonly valorantMatchEndedManager: ValorantMatchStatsManager,
    ) {
    }

    @Get('')
    @ApiExtraModels(Pending, Success, Failure, RiotMatchMetadataModel)
    @ApiOkResponse({
        schema: {
            type: 'object',
            additionalProperties: AsyncResultSchema(
                getSchemaPath(RiotMatchMetadataModel),
            ),
        },
    })
    public async getMatchOverview() {
        const view = this.valorantMatchEndedManager.getView();

        if (view === null) {
            throw new NotFoundException();
        }

        return view;
    }

    @Get(':id')
    @ApiExtraModels(Success, Failure, Pending, RiotMatchMetadataModel)
    @ApiOkResponse({
        schema: AsyncResultSchema(getSchemaPath(RiotMatchMetadataModel)),
    })
    public async getById(@Param('id') id: GUID) {
        if (!id) throw new BadRequestException();
        const viewEntry = this.valorantMatchEndedManager.getKeyView(id);

        if (viewEntry === null) {
            throw new NotFoundException('No data for the given match ID');
        }

        return viewEntry;
    }

    @Post(':id/fetch')
    @HttpCode(HttpStatus.ACCEPTED.valueOf())
    public triggerFetch(@Param('id') id: GUID) {
        if (!id) throw new BadRequestException();
        this.valorantMatchEndedManager.requestMatchFetch(id);
    }
}

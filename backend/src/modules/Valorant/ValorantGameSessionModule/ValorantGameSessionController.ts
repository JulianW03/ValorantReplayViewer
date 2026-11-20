import {
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { RiotClientReadyGuard } from '@/core/riotclient/RiotClientReadyGuard';
import { ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { ValorantGameSessionManager } from '@/modules/Valorant/ValorantGameSessionModule/ValorantGameSessionManager';
import { ProductSessionGuard, RequiredProduct } from '@/modules/ProductSessionModule/ProductSessionGuard';
import { MatchStatusDTO } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatusDTO.schema';
import { MatchStatusSchema } from '@/modules/Valorant/ValorantGameSessionModule/MatchStatus.schema';
import type { GUID } from '@vrv/shared';

@RequiredProduct('valorant')
@UseGuards(RiotClientReadyGuard, ProductSessionGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller({
    path: 'caching/valorant-game-sessions/match-states',
    version: '1',
})
export class ValorantGameSessionController {
    constructor(
        protected readonly valorantGameSessionManager: ValorantGameSessionManager,
    ) {
    }

    @Get('')
    @ApiOkResponse({
        description:
            'Returns a map of match IDs to their current match status for all matches that are currently registered',
        type: Map<GUID, MatchStatusDTO>,
    })
    @ApiNotFoundResponse({
        description: 'Returned when there is no match in progress registered.',
    })
    public async getMatchInProgressRegistered() {
        const entries = this.valorantGameSessionManager.getView();
        if (entries === null) {
            throw new NotFoundException();
        }

        return entries;
    }

    @Get('/:matchId')
    @ApiOkResponse({
        description:
            'Returns the current match status for the specified match ID.',
        schema: {
            type: 'string',
            enum: Object.values(MatchStatusSchema.enum),
        },
    })
    @ApiNotFoundResponse({
        description: 'Returned when the specified match ID is not found.',
    })
    public async getMatchStateById(@Param('matchId') matchId: GUID) {
        const entry = this.valorantGameSessionManager.getKeyView(matchId);
        if (entry === null) {
            throw new NotFoundException();
        }

        return entry;
    }
}

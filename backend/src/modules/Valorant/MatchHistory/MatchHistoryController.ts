import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { ProductSessionGuard, RequiredProduct } from '@/modules/ProductSessionModule/ProductSessionGuard';
import { MatchHistoryManager } from '@/modules/Valorant/MatchHistory/MatchHistoryManager';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
    type GetRecentMatchesDTO,
    GetRecentMatchesDTOSchema,
} from '@/modules/Valorant/MatchHistory/GetRecentMatches.schema';
import { type GetNewMatchesDTO, GetNewMatchesDTOSchema } from '@/modules/Valorant/MatchHistory/GetNewMatches.schema';
import { RiotMatchApiResponseDTOSchema } from '@vrv/shared';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';

class RiotMatchApiResponseDTOModel extends createZodDto(RiotMatchApiResponseDTOSchema) {
}

@RequiredProduct('valorant')
@UseGuards(ProductSessionGuard)
@Controller({
    path: 'plugins/history/matches',
})
export class MatchHistoryController {
    private readonly logger = new Logger(MatchHistoryController.name);

    constructor(
        protected readonly matchHistoryManager: MatchHistoryManager,
    ) {
    }

    @Get('recent')
    @ApiOperation({
        summary: 'Get recent matches',
        description: 'Get matches older than a specified matchId',
    })
    @ApiOkResponse({
        description: 'List of recent matches sorted from most to least recent matches (older than the cursor).',
        type: RiotMatchApiResponseDTOModel,
        isArray: true,
    })
    async getRecentMatches(
        @Query(new ZodValidationPipe(GetRecentMatchesDTOSchema)) query: GetRecentMatchesDTO,
    ) {
        this.logger.debug(`Getting recent matches`, query);
        const data = await this.matchHistoryManager.getMatchDataAfter(
            query.after ?? null,
            query.limit,
        );
        return Object.values(data).sort((a, b) => (b?.matchMetadata?.matchInfo?.gameStartMillis ?? 0) - (a?.matchMetadata?.matchInfo?.gameStartMillis ?? 0));
    }


    @Get('new')
    @ApiOperation({
        summary: 'Get new matches',
        description: 'Get matches newer than a specified matchId',
    })
    @ApiOkResponse({
        description: 'List of new matches sorted from newest to least recent matches (newer than the cursor)',
        type: RiotMatchApiResponseDTOModel,
        isArray: true,
    })
    async getNewMatches(
        @Query(new ZodValidationPipe(GetNewMatchesDTOSchema)) query: GetNewMatchesDTO,
    ) {
        this.logger.debug(`Getting new matches`, query);
        const data = await this.matchHistoryManager.getMatchDataBefore(
            query.since,
            query.limit,
        );

        return Object.values(data).sort((a, b) => (b?.matchMetadata?.matchInfo?.gameStartMillis ?? 0) - (a?.matchMetadata?.matchInfo?.gameStartMillis ?? 0));
    }
}
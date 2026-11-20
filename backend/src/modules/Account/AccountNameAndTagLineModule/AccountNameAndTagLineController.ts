import { Controller, Get, HttpStatus, Logger, NotFoundException, UseGuards } from '@nestjs/common';
import {
    AccountNameAndTagLineManager,
} from '@/modules/Account/AccountNameAndTagLineModule/AccountNameAndTagLineManager';
import { ApiNotFoundResponse, ApiResponse } from '@nestjs/swagger';
import { RiotClientReadyGuard } from '@/core/riotclient/RiotClientReadyGuard';
import { PlayerAliasSchema } from '@vrv/shared';
import { createZodDto } from 'nestjs-zod';

class PlayerAliasModel extends createZodDto(PlayerAliasSchema) {
}

@UseGuards(RiotClientReadyGuard)
@Controller({
    path: 'caching/riot-account',
    version: '1',
})
export class AccountNameAndTagLineController {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        protected readonly accountNameAndTagLineManager: AccountNameAndTagLineManager,
    ) {
    }

    @Get('alias')
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Returns the active account name and tag line.',
        type: PlayerAliasModel,
    })
    @ApiNotFoundResponse({
        description:
            'Returned when the active account name and tag line are not found, possibly because the user is not logged in.',
        type: NotFoundException,
    })
    public async getActiveAccountNameAndTagLine() {
        const optState = this.accountNameAndTagLineManager.getView();
        if (optState === null) {
            throw new NotFoundException(
                'Active account name and tag line not found, maybe you are not logged in?',
            );
        }
        return optState;
    }
}

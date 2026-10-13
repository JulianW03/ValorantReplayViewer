import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { PREFIX_EXTERNAL } from '@/core/origin/OriginGuard';

@Controller({
    path: PREFIX_EXTERNAL,
    version: '1',
})
export class ExternalController {
    @Get('ping')
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Returns true, so allowed external origins can check that VRV is reachable.',
    })
    public ping(): boolean {
        return true;
    }
}

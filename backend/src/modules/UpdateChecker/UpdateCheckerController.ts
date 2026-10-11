import { Controller, Get, NotFoundException } from '@nestjs/common';
import { UpdateCheckerManager } from '@/modules/UpdateChecker/UpdateCheckerManager';

@Controller({
    path: 'plugins/update-check',
    version: '1',
})
export class UpdateCheckerController {
    constructor(
        private readonly updateCheckerManager: UpdateCheckerManager,
    ) {
    }

    @Get('status')
    public async getMultigamePresences() {
        const optView = this.updateCheckerManager.getView();
        if (!optView) {
            throw new NotFoundException()
        }
        return optView
    }
}
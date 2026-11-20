import { Inject, Injectable, Logger } from '@nestjs/common';
import { VALORANT_API_BASE_URL } from '@/integrations/NotOfficer/ValorantAPITokens';
import { AgentAssetDTOSchema, GearAssetDTOSchema, MapAssetDTOSchema, WeaponAssetDTOSchema } from '@vrv/shared';
import { z, ZodType } from 'zod';

@Injectable()
export class ValorantAssetAPI {
    protected readonly logger = new Logger(this.constructor.name);

    constructor(
        @Inject(VALORANT_API_BASE_URL)
        protected readonly baseUrl: string,
    ) {
    }

    protected async fetchAndParse<T extends ZodType>(
        endpoint: string,
        schema: T,
    ): Promise<z.infer<T>> {
        const url = `${this.baseUrl}${endpoint}`;

        this.logger.debug(`Fetching data from ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch data.`);
        }

        const json = await response.json();

        const parsed = await z.object({
            status: z.number(),
            data: schema,
        }).parseAsync(json);

        // @ts-ignore
        return parsed.data;
    }

    public async getMapList() {
        return this.fetchAndParse(
            '/v1/maps',
            z.array(MapAssetDTOSchema),
        );
    }

    public async getWeaponList() {
        return this.fetchAndParse(
            '/v1/weapons',
            z.array(WeaponAssetDTOSchema),
        );
    }

    public async getGearList() {
        return this.fetchAndParse(
            '/v1/gear',
            z.array(GearAssetDTOSchema),
        );
    }

    public getAgentList() {
        return this.fetchAndParse(
            '/v1/agents',
            z.array(AgentAssetDTOSchema),
        );
    }
}
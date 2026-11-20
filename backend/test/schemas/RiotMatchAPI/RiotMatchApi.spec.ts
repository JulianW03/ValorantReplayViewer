import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiotMatchApiResponseDTOSchema } from '@vrv/shared';

describe('RiotMatchApi Schema', () => {
    it("The schema should validate example_1.json", async () => {
        await expect(RiotMatchApiResponseDTOSchema.parseAsync(require('./example_1.json'))).resolves.toBeDefined();
    })

    it("The schema should validate example_2.json", async () => {
        await expect(RiotMatchApiResponseDTOSchema.parseAsync(require('./example_2.json'))).resolves.toBeDefined();
    })

    it("The schema should validate example_3.json", async () => {
        await expect(RiotMatchApiResponseDTOSchema.parseAsync(require('./example_3.json'))).resolves.toBeDefined();
    })
})
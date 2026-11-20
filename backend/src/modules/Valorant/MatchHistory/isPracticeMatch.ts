import { RiotMatchInfo } from '@vrv/shared';

export const isPracticeMatch = (matchInfo: RiotMatchInfo): boolean =>
    matchInfo.provisioningFlowID === 'ShootingRange';

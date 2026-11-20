import type { RiotMatchInfo } from '../schemas/RiotMatchApiReponseDTO';

export function compareMatchOrder(a: RiotMatchInfo, b: RiotMatchInfo): number {
    return (b.gameStartMillis + b.gameLengthMillis)
        - (a.gameStartMillis + a.gameLengthMillis);
}

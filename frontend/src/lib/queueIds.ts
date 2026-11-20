import { CUSTOM_GAME_QUEUE_ID } from '@vrv/shared';

export const KNOWN_QUEUE_IDS = {
    COMPETITIVE: 'competitive',
    SPIKE_RUSH: 'spikerush',
    UNRATED: 'unrated',
    SWIFTPLAY: 'swiftplay',
    DEATHMATCH: 'deathmatch',
    PREMIER: 'premier',
    TEAM_DEATHMATCH: 'hurm',
} as const;

export const QUEUE_ID_PRESETS: { id: string; label: string }[] = [
    { id: KNOWN_QUEUE_IDS.COMPETITIVE, label: 'Competitive' },
    { id: KNOWN_QUEUE_IDS.PREMIER, label: 'Premier' },
    { id: KNOWN_QUEUE_IDS.UNRATED, label: 'Unrated' },
    { id: KNOWN_QUEUE_IDS.SWIFTPLAY, label: 'Swiftplay' },
    { id: KNOWN_QUEUE_IDS.SPIKE_RUSH, label: 'Spike Rush' },
    { id: KNOWN_QUEUE_IDS.DEATHMATCH, label: 'Deathmatch' },
    { id: KNOWN_QUEUE_IDS.TEAM_DEATHMATCH, label: 'Team Deathmatch' },
    { id: CUSTOM_GAME_QUEUE_ID, label: 'Custom Games' },
];

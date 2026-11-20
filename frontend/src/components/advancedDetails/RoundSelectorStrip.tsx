import {
    type RiotMatchApiResponseDTO,
    TWO_TEAM_ROLE_IDS,
    type TWO_TEAMS_ROLE_ID,
    type TWO_TEAMS_TEAM_ID,
} from '@vrv/shared';

export const DISPLAY_ROUND_RESULTS = {
    WIN: 'WIN',
    LOSS: 'LOSS',
    UNKNOWN: '?',
};

export type DISPLAY_ROUND_RESULT = typeof DISPLAY_ROUND_RESULTS[keyof typeof DISPLAY_ROUND_RESULTS];

const COLORS: Record<DISPLAY_ROUND_RESULT, string> = {
    [DISPLAY_ROUND_RESULTS.WIN]: '#3BE0A0',
    [DISPLAY_ROUND_RESULTS.LOSS]: '#FF6B76',
    [DISPLAY_ROUND_RESULTS.UNKNOWN]: '#FAFAFA',
};

const ROUND_PHASES = {
    FIRST_HALF: 'FIRST_HALF',
    SECOND_HALF: 'SECOND_HALF',
    OVERTIME: 'OVERTIME',
};

type RoundPhase = typeof ROUND_PHASES[keyof typeof ROUND_PHASES];

type RoundResult = RiotMatchApiResponseDTO["roundResults"][number]
type PlayerSummary = RiotMatchApiResponseDTO["players"][number]

export interface RoundChipData {
    roundNum: number;
    displayNum: number;
    roundResult: DISPLAY_ROUND_RESULT;
    userRole: TWO_TEAMS_ROLE_ID | undefined;
    phase: RoundPhase;
}

export interface RoundSelectorStripProps {
    chips: RoundChipData[];
    selectedRound: number;
    onSelect: (roundNum: number) => void;
}

function getUserRole(round: RoundResult, userTeamId: TWO_TEAMS_TEAM_ID | undefined): TWO_TEAMS_ROLE_ID | undefined {
    if (userTeamId === undefined) return undefined;

    if (round.winningTeam === userTeamId) {
        return round.winningTeamRole as TWO_TEAMS_ROLE_ID;
    }

    return round.winningTeamRole === TWO_TEAM_ROLE_IDS.ATTACKER
        ? TWO_TEAM_ROLE_IDS.DEFENDER
        : TWO_TEAM_ROLE_IDS.ATTACKER;
}

function assignPhases(sorted: RoundResult[], players: PlayerSummary[]): RoundPhase[] {
    if (!sorted.length) return [];
    const any = players[0]?.teamId as TWO_TEAMS_TEAM_ID ?? undefined;
    const roles = sorted.map((r) => getUserRole(r, any));
    const firstRole = roles[0];

    let secondHalfStart = sorted.length;
    for (let i = 1; i < roles.length; i++) {
        if (roles[i] !== firstRole) {
            secondHalfStart = i;
            break;
        }
    }

    let overtimeStart = sorted.length;
    if (secondHalfStart < sorted.length) {
        const secondRole = roles[secondHalfStart];
        for (let i = secondHalfStart + 1; i < roles.length; i++) {
            if (roles[i] !== secondRole) {
                overtimeStart = i;
                break;
            }
        }
    }

    return roles.map((_, i) => {
        if (i < secondHalfStart) return ROUND_PHASES.FIRST_HALF;
        if (i < overtimeStart) return ROUND_PHASES.SECOND_HALF;
        return ROUND_PHASES.OVERTIME;
    });
}

export function getUserRoundResult(r: RoundResult, userTeamId: TWO_TEAMS_TEAM_ID | undefined): DISPLAY_ROUND_RESULT {
    if (userTeamId === undefined) return DISPLAY_ROUND_RESULTS.UNKNOWN;
    if (r.winningTeam === userTeamId) return DISPLAY_ROUND_RESULTS.WIN;
    return DISPLAY_ROUND_RESULTS.LOSS;
}

export function buildRoundChips(
    roundResults: RoundResult[],
    players: PlayerSummary[],
    userTeamId: TWO_TEAMS_TEAM_ID | undefined,
): RoundChipData[] {
    const sorted = [...roundResults].sort((a, b) => a.roundNum - b.roundNum);
    const phases = assignPhases(sorted, players);
    return sorted.map((r, i) => ({
        roundNum: r.roundNum,
        displayNum: r.roundNum + 1,
        roundResult: getUserRoundResult(r, userTeamId),
        userRole: getUserRole(r, userTeamId),
        phase: phases[i],
    } as RoundChipData));
}

function tintHex(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const rv = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${rv}, ${g}, ${b}, ${alpha})`;
}

const ROLE_LABEL: Record<string, string> = {
    [TWO_TEAM_ROLE_IDS.ATTACKER]: 'Attacking',
    [TWO_TEAM_ROLE_IDS.DEFENDER]: 'Defending',
};

const PHASE_ORDER: RoundPhase[] = [ROUND_PHASES.FIRST_HALF, ROUND_PHASES.SECOND_HALF, ROUND_PHASES.OVERTIME];

function RoundChip({
                       chip,
                       selected,
                       onSelect,
                   }: {
    chip: RoundChipData;
    selected: boolean;
    onSelect: () => void;
}) {
    const accent = COLORS[chip.roundResult];
    return (
        <button
            onClick={onSelect}
            className="relative flex flex-col items-center justify-center w-[42px] h-[50px] rounded cursor-pointer transition-[background,box-shadow] duration-150"
            style={{
                background: selected ? tintHex(accent, 0.18) : 'rgba(255,255,255,0.03)',
                borderBottom: `3px solid ${accent}`,
                boxShadow: selected
                    ? `inset 0 0 0 1.5px ${accent}`
                    : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            }}
        >
            <span
                className="font-semibold text-[19px] leading-none"
                style={{ color: selected ? '#FFFFFF' : '#B7C2CC' }}
            >
                {String(chip.displayNum).padStart(2, '0')}
            </span>
            <span
                className="text-[8px] tracking-[0.1em] mt-[3px] font-bold uppercase"
                style={{
                    color: chip.roundResult
                        ? selected ? '#ECE8E1' : '#7a8893'
                        : '#54616d',
                }}
            >
                {chip.roundResult}
            </span>
        </button>
    );
}

export function RoundSelectorStrip({ chips, selectedRound, onSelect }: RoundSelectorStripProps) {
    const byPhase = new Map<RoundPhase, RoundChipData[]>();
    for (const chip of chips) {
        const arr = byPhase.get(chip.phase) ?? [];
        arr.push(chip);
        byPhase.set(chip.phase, arr);
    }

    const presentPhases = PHASE_ORDER.filter((p) => byPhase.has(p));

    return (
        <div className="px-5 pt-4 pb-5 mb-4">
            <div className="flex flex-row flex-wrap gap-x-8 gap-y-4 items-start">
                {presentPhases.map((phase) => {
                    const phaseChips = byPhase.get(phase)!;
                    const label =
                        (phase === ROUND_PHASES.OVERTIME)
                            ? 'Overtime'
                            : (ROLE_LABEL[phaseChips[0].userRole!]);
                    return (
                        <div key={phase} className="flex flex-col gap-2 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] tracking-[0.15em] font-semibold text-[#5d6b78] uppercase">
                                    {label}
                                </span>
                                <span className="text-[10px] text-[#3a4753]">
                                    {phaseChips.filter((c) => c.roundResult === DISPLAY_ROUND_RESULTS.WIN).length}W –{' '}
                                    {phaseChips.filter((c) => c.roundResult === DISPLAY_ROUND_RESULTS.LOSS).length}L
                                </span>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {phaseChips.map((chip) => (
                                    <RoundChip
                                        key={chip.roundNum}
                                        chip={chip}
                                        selected={chip.roundNum === selectedRound}
                                        onSelect={() => onSelect(chip.roundNum)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

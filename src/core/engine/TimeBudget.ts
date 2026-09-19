const ASSUMED_MOVES_TO_GO = 30;

const CLOCK_RESERVE_MS = 1000;

const MAX_CLOCK_FRACTION = 0.15;

const OVERHEAD_MS = 50;

const MIN_BUDGET_MS = 50;

const INCREMENT_SHARE = 0.8;

const EARLY_LAST_MOVE = 10;
const MIDDLE_LAST_MOVE = 30;
const MIDDLE_FACTOR = 1.2;
const LATE_FACTOR = 1.4;

export interface ClockState {
    remaining: number;
    increment?: number;
    movesToGo?: number;
    moveNumber: number;
}

export function phaseFactor(moveNumber: number): number {
    if (moveNumber <= EARLY_LAST_MOVE) return 1;

    return moveNumber <= MIDDLE_LAST_MOVE ? MIDDLE_FACTOR : LATE_FACTOR;
}

export function budgetForFixedTime(movetimeMs: number): number {
    return Math.max(MIN_BUDGET_MS, movetimeMs - OVERHEAD_MS);
}

export function budgetForClock({
    remaining,
    increment = 0,
    movesToGo = ASSUMED_MOVES_TO_GO,
    moveNumber,
}: ClockState): number {
    const budget =
        (remaining / movesToGo + increment * INCREMENT_SHARE) *
            phaseFactor(moveNumber) -
        OVERHEAD_MS;

    return Math.max(
        MIN_BUDGET_MS,
        Math.min(
            budget,
            remaining * MAX_CLOCK_FRACTION,
            remaining - CLOCK_RESERVE_MS,
        ),
    );
}

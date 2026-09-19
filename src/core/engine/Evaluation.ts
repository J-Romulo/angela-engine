import { Board } from "../chess/board/Board";
import { Bishop } from "../chess/pieces/Bishop";
import { King } from "../chess/pieces/King";
import { Knight } from "../chess/pieces/Knight";
import { Pawn } from "../chess/pieces/Pawn";
import { Piece } from "../chess/pieces/Piece";
import { Queen } from "../chess/pieces/Queen";
import { Rook } from "../chess/pieces/Rook";

const PAWN_UNIT = 100;

const ENDGAME_THRESHOLD = 13;

const TABLES: Record<string, readonly number[]> = {
    "": Pawn.TABLE,
    N: Knight.TABLE,
    B: Bishop.TABLE,
    R: Rook.TABLE,
    Q: Queen.TABLE,
    K: King.TABLE,
};

const MOBILITY: Record<string, number> = { N: 3, B: 4, R: 2, Q: 0 };

const KNIGHT_JUMPS = [2, 1, 2, -1, -2, 1, -2, -1, 1, 2, 1, -2, -1, 2, -1, -2];

// prettier-ignore
const RAYS: Record<string, readonly number[]> = {
    B: [1, 1, 1, -1, -1, 1, -1, -1],
    R: [1, 0, -1, 0, 0, 1, 0, -1],
    Q: [1, 1, 1, -1, -1, 1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1],
};

const UNSAFE_WHITE = new Uint8Array(64);
const UNSAFE_BLACK = new Uint8Array(64);

const PASSED_PAWN = [0, 10, 17, 25, 45, 80, 130, 0];
const PASSED_PAWN_ENDGAME = [0, 15, 25, 40, 70, 120, 190, 0];

const MAX_WHITE_PAWN_ROW = new Int8Array(8);
const MAX_BLACK_PAWN_ROW = new Int8Array(8);
const MIN_WHITE_PAWN_ROW = new Int8Array(8);
const MIN_BLACK_PAWN_ROW = new Int8Array(8);

const CACHE_BITS = 20;
const CACHE_SIZE = 1 << CACHE_BITS;
const CACHE_MASK = BigInt(CACHE_SIZE - 1);

const CACHE_KEYS = new BigUint64Array(CACHE_SIZE);
const CACHE_SCORES = new Int32Array(CACHE_SIZE);

const CACHE_FILLED = new Uint8Array(CACHE_SIZE);

export type EvaluationStats = {
    computed: number;
    cacheHits: number;
};

export class EvaluationController {
    static stats: EvaluationStats = { computed: 0, cacheHits: 0 };

    static useCache = true;

    static resetStats() {
        this.stats = { computed: 0, cacheHits: 0 };
    }

    static clearCache() {
        CACHE_FILLED.fill(0);
    }

    static evaluatePosition(board: Board, turn: "white" | "black"): number {
        const sign = turn === "white" ? 1 : -1;

        if (!this.useCache) {
            this.stats.computed++;

            return sign * whiteScore(board);
        }

        const hash = board.hash;
        const slot = Number(hash & CACHE_MASK);

        if (CACHE_FILLED[slot] === 1 && CACHE_KEYS[slot] === hash) {
            this.stats.cacheHits++;

            return sign * CACHE_SCORES[slot];
        }

        const white = whiteScore(board);
        this.stats.computed++;

        CACHE_KEYS[slot] = hash;
        CACHE_SCORES[slot] = white;
        CACHE_FILLED[slot] = 1;

        return sign * white;
    }
}

function whiteScore(board: Board): number {
    if (board.hasInsufficientMaterial()) return 0;

    const endgame = isEndgame(board);

    markPawnAttacks(board.whitePawns, UNSAFE_WHITE, 1);
    markPawnAttacks(board.blackPawns, UNSAFE_BLACK, -1);
    markPawnSpans(board);

    return score(board, "white", endgame) - score(board, "black", endgame);
}

function score(
    board: Board,
    color: "black" | "white",
    endgame: boolean,
): number {
    const white = color === "white";
    const unsafe = white ? UNSAFE_BLACK : UNSAFE_WHITE;

    const pieces = white ? board.whitePieces : board.blackPieces;
    const pawns = white ? board.whitePawns : board.blackPawns;

    return (
        sum(board, pieces, white, endgame, unsafe) +
        sum(board, pawns, white, endgame, unsafe)
    );
}

function sum(
    board: Board,
    pieces: Piece[],
    white: boolean,
    endgame: boolean,
    unsafe: Uint8Array,
): number {
    let total = 0;

    for (const piece of pieces) {
        if (piece.captured) continue;

        const { row, column } = piece.position;

        const index = white ? (7 - row) * 8 + column : row * 8 + column;

        const table =
            endgame && piece.name === "K"
                ? King.ENDGAME_TABLE
                : TABLES[piece.name];

        total +=
            piece.value * PAWN_UNIT +
            (table?.[index] ?? 0) +
            mobility(board, piece, unsafe);

        if (piece.name === "") {
            total += passedPawn(row, column, white, endgame);
        }
    }

    return total;
}

function markPawnSpans(board: Board): void {
    MAX_WHITE_PAWN_ROW.fill(-1);
    MIN_WHITE_PAWN_ROW.fill(8);
    MAX_BLACK_PAWN_ROW.fill(-1);
    MIN_BLACK_PAWN_ROW.fill(8);

    for (const pawn of board.whitePawns) {
        if (pawn.captured) continue;

        const { row, column } = pawn.position;

        if (row > MAX_WHITE_PAWN_ROW[column]) MAX_WHITE_PAWN_ROW[column] = row;
        if (row < MIN_WHITE_PAWN_ROW[column]) MIN_WHITE_PAWN_ROW[column] = row;
    }

    for (const pawn of board.blackPawns) {
        if (pawn.captured) continue;

        const { row, column } = pawn.position;

        if (row > MAX_BLACK_PAWN_ROW[column]) MAX_BLACK_PAWN_ROW[column] = row;
        if (row < MIN_BLACK_PAWN_ROW[column]) MIN_BLACK_PAWN_ROW[column] = row;
    }
}

function passedPawn(
    row: number,
    column: number,
    white: boolean,
    endgame: boolean,
): number {
    if (white) {
        if (row !== MAX_WHITE_PAWN_ROW[column]) return 0;
    } else if (row !== MIN_BLACK_PAWN_ROW[column]) {
        return 0;
    }

    const first = column > 0 ? column - 1 : 0;
    const last = column < 7 ? column + 1 : 7;

    for (let file = first; file <= last; file++) {
        if (white) {
            if (MAX_BLACK_PAWN_ROW[file] > row) return 0;
        } else if (MIN_WHITE_PAWN_ROW[file] < row) {
            return 0;
        }
    }

    const advanced = white ? row : 7 - row;

    return endgame ? PASSED_PAWN_ENDGAME[advanced] : PASSED_PAWN[advanced];
}

function markPawnAttacks(
    pawns: Piece[],
    map: Uint8Array,
    forward: number,
): void {
    map.fill(0);

    for (const pawn of pawns) {
        if (pawn.captured) continue;

        const row = pawn.position.row + forward;
        if (row < 0 || row > 7) continue;

        const base = row * 8;
        const column = pawn.position.column;

        if (column > 0) map[base + column - 1] = 1;
        if (column < 7) map[base + column + 1] = 1;
    }
}

function mobility(board: Board, piece: Piece, unsafe: Uint8Array): number {
    const name = piece.name;

    const bonus = MOBILITY[name];
    if (!bonus) return 0;

    const squares = board.squares;
    const startRow = piece.position.row;
    const startColumn = piece.position.column;
    const color = piece.color;
    let reached = 0;

    if (name === "N") {
        for (let i = 0; i < 16; i += 2) {
            const row = startRow + KNIGHT_JUMPS[i];
            if (row < 0 || row > 7) continue;

            const column = startColumn + KNIGHT_JUMPS[i + 1];
            if (column < 0 || column > 7) continue;
            if (unsafe[row * 8 + column]) continue;

            const target = squares[row][column].piece;
            if (target !== null && target.color === color) continue;

            reached++;
        }

        return reached * bonus;
    }

    const rays = RAYS[name];
    if (rays === undefined) return 0;

    for (let i = 0; i < rays.length; i += 2) {
        const rowStep = rays[i];
        const columnStep = rays[i + 1];

        let row = startRow + rowStep;
        let column = startColumn + columnStep;

        while (row >= 0 && row < 8 && column >= 0 && column < 8) {
            const target = squares[row][column].piece;

            if (target !== null && target.color === color) break;
            if (unsafe[row * 8 + column] === 0) reached++;

            if (target !== null) break;

            row += rowStep;
            column += columnStep;
        }
    }

    return reached * bonus;
}

function isEndgame(board: Board): boolean {
    let heavy = 0;

    for (const pieces of [board.whitePieces, board.blackPieces]) {
        for (const piece of pieces) {
            if (piece.captured) continue;
            if (piece.name !== "K") heavy += piece.value;
        }
    }

    return heavy <= ENDGAME_THRESHOLD;
}

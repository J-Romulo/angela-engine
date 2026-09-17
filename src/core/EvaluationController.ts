import { Board } from "./board/Board";
import { Bishop } from "./pieces/Bishop";
import { King } from "./pieces/King";
import { Knight } from "./pieces/Knight";
import { Pawn } from "./pieces/Pawn";
import { Piece } from "./pieces/Piece";
import { Queen } from "./pieces/Queen";
import { Rook } from "./pieces/Rook";

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

/**
 * Centipeoes por casa segura alcancada. Baixos porque a tabela de posicao ja
 * codifica parte da mobilidade. A dama fica em zero: raios longos, o trecho
 * mais caro da contagem, e sinal fraco - dama ativa e dama exposta se parecem.
 */
const MOBILITY: Record<string, number> = { N: 3, B: 4, R: 2, Q: 0 };

/** Pares (linha, coluna) planos: lidos milhoes de vezes por busca. */
const KNIGHT_JUMPS = [2, 1, 2, -1, -2, 1, -2, -1, 1, 2, 1, -2, -1, 2, -1, -2];

// prettier-ignore
const RAYS: Record<string, readonly number[]> = {
    B: [1, 1, 1, -1, -1, 1, -1, -1],
    R: [1, 0, -1, 0, 0, 1, 0, -1],
    Q: [1, 1, 1, -1, -1, 1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1],
};

/** Casas atacadas por peao, uma por cor. Reaproveitadas: alocar sai caro. */
const UNSAFE_WHITE = new Uint8Array(64);
const UNSAFE_BLACK = new Uint8Array(64);

/**
 * Cache indexado pelo hash Zobrist. A avaliacao e funcao pura da posicao, entao
 * a entrada nunca envelhece. Vetores planos, e nao um `Map`: 13 bytes por
 * entrada contra os mais de 200 que a tabela de transposicao mostrou custar.
 */
const CACHE_BITS = 20;
const CACHE_SIZE = 1 << CACHE_BITS;
const CACHE_MASK = BigInt(CACHE_SIZE - 1);

const CACHE_KEYS = new BigUint64Array(CACHE_SIZE);
const CACHE_SCORES = new Int32Array(CACHE_SIZE);

/** Hash zero e valido: sem esta marca, a posicao 0 leria lixo como acerto. */
const CACHE_FILLED = new Uint8Array(CACHE_SIZE);

export type EvaluationStats = {
    computed: number;
    cacheHits: number;
};

export class EvaluationController {
    static stats: EvaluationStats = { computed: 0, cacheHits: 0 };

    /** Desligavel para medicao: o cache muda o custo, nunca o valor. */
    static useCache = true;

    static resetStats() {
        this.stats = { computed: 0, cacheHits: 0 };
    }

    /** So medicao e teste precisam: a entrada nao envelhece. */
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

/** Sempre do ponto de vista das brancas - e o que o cache guarda. */
function whiteScore(board: Board): number {
    if (board.hasInsufficientMaterial()) return 0;

    const endgame = isEndgame(board);

    // Montadas antes das duas contagens: cada lado le a tabela do outro.
    markPawnAttacks(board.whitePawns, UNSAFE_WHITE, 1);
    markPawnAttacks(board.blackPawns, UNSAFE_BLACK, -1);

    return score(board, "white", endgame) - score(board, "black", endgame);
}

function score(
    board: Board,
    color: "black" | "white",
    endgame: boolean,
): number {
    const white = color === "white";
    const unsafe = white ? UNSAFE_BLACK : UNSAFE_WHITE;

    // Lidos direto, sem getPieces: filtrar e concatenar alocaria dois vetores
    // por avaliacao.
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

        // As tabelas valem para as brancas, com a oitava fileira na primeira
        // linha. As pretas leem espelhado na vertical: peao preto na fileira 2
        // esta tao perto de promover quanto peao branco na 7.
        const index = white ? (7 - row) * 8 + column : row * 8 + column;

        const table =
            endgame && piece.name === "K"
                ? King.ENDGAME_TABLE
                : TABLES[piece.name];

        total +=
            piece.value * PAWN_UNIT +
            (table?.[index] ?? 0) +
            mobility(board, piece, unsafe);
    }

    return total;
}

/**
 * Marca as casas defendidas por peao da cor: casa guardada por peao nao e
 * mobilidade de verdade para uma peca maior, que nunca vai trocar de graca.
 */
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

/**
 * Casas seguras que a peca alcanca, sem verificar legalidade: conferir cravada
 * e xeque custaria uma busca por casa, e erra pouco. Peao e rei ficam de fora -
 * o peao ja entra pela tabela de posicao, e rei com muitas casas livres e rei
 * exposto.
 */
function mobility(board: Board, piece: Piece, unsafe: Uint8Array): number {
    const name = piece.name;

    // Peso zero sai antes de andar qualquer raio, em vez de pagar a contagem
    // para multiplicar por zero depois.
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

            // Peca adversaria conta como casa alcancada, mas fecha a linha.
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

import { Piece } from "./pieces/Piece";

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;

    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    };
}

const random = mulberry32(0x9e3779b9);

function random64(): bigint {
    return (BigInt(random()) << 32n) | BigInt(random());
}

const KINDS = 12; // 6 tipos x 2 cores
const SQUARES = 64;

export const PIECE_SQUARE = new BigUint64Array(KINDS * SQUARES);
for (let i = 0; i < PIECE_SQUARE.length; i++) {
    PIECE_SQUARE[i] = random64();
}

export const TURN = random64();

export const CASTLING = BigUint64Array.from([
    random64(),
    random64(),
    random64(),
    random64(),
]);

export const EN_PASSANT = BigUint64Array.from(
    Array.from({ length: 8 }, random64),
);

export type CastlingRight =
    | "whiteKing"
    | "whiteQueen"
    | "blackKing"
    | "blackQueen";

export const CASTLING_INDEX: Record<CastlingRight, number> = {
    whiteKing: 0,
    whiteQueen: 1,
    blackKing: 2,
    blackQueen: 3,
};

const KIND_INDEX: Record<string, number> = {
    "": 0,
    N: 1,
    B: 2,
    R: 3,
    Q: 4,
    K: 5,
};

export function pieceSquareIndex(
    piece: Piece,
    square: { row: number; column: number },
): number {
    const kind = KIND_INDEX[piece.name] + (piece.color === "white" ? 0 : 6);
    return kind * SQUARES + square.row * 8 + square.column;
}

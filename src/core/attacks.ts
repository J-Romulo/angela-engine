import type { Board } from "./board/Board";
import type { Position } from "./pieces/Piece";

type Direction = { row: number; column: number };

const KNIGHT_JUMPS: Direction[] = [
    { row: 2, column: 1 },
    { row: 2, column: -1 },
    { row: -2, column: 1 },
    { row: -2, column: -1 },
    { row: 1, column: 2 },
    { row: 1, column: -2 },
    { row: -1, column: 2 },
    { row: -1, column: -2 },
];

const ORTHOGONAL: Direction[] = [
    { row: 1, column: 0 },
    { row: -1, column: 0 },
    { row: 0, column: 1 },
    { row: 0, column: -1 },
];

const DIAGONAL: Direction[] = [
    { row: 1, column: 1 },
    { row: 1, column: -1 },
    { row: -1, column: 1 },
    { row: -1, column: -1 },
];

const KING_STEPS: Direction[] = [...ORTHOGONAL, ...DIAGONAL];

const inside = (row: number, column: number) =>
    row >= 0 && row < 8 && column >= 0 && column < 8;

export function isSquareAttacked(
    board: Board,
    square: Position,
    byColor: "black" | "white",
): boolean {
    const pawnRow = square.row + (byColor === "white" ? -1 : 1);
    for (const column of [square.column - 1, square.column + 1]) {
        if (!inside(pawnRow, column)) continue;

        const piece = board.squares[pawnRow][column].piece;
        if (piece && piece.name === "" && piece.color === byColor) return true;
    }

    if (hasAttackerAt(board, square, KNIGHT_JUMPS, byColor, "N")) return true;

    if (hasAttackerAt(board, square, KING_STEPS, byColor, "K")) return true;

    if (rayReaches(board, square, ORTHOGONAL, byColor, "R")) return true;
    if (rayReaches(board, square, DIAGONAL, byColor, "B")) return true;

    return false;
}

function hasAttackerAt(
    board: Board,
    square: Position,
    offsets: Direction[],
    byColor: "black" | "white",
    name: string,
): boolean {
    for (const offset of offsets) {
        const row = square.row + offset.row;
        const column = square.column + offset.column;
        if (!inside(row, column)) continue;

        const piece = board.squares[row][column].piece;
        if (piece && piece.name === name && piece.color === byColor)
            return true;
    }

    return false;
}

function rayReaches(
    board: Board,
    square: Position,
    directions: Direction[],
    byColor: "black" | "white",
    slider: "R" | "B",
): boolean {
    for (const direction of directions) {
        let row = square.row + direction.row;
        let column = square.column + direction.column;

        while (inside(row, column)) {
            const piece = board.squares[row][column].piece;

            if (piece) {
                if (
                    piece.color === byColor &&
                    (piece.name === slider || piece.name === "Q")
                ) {
                    return true;
                }
                break;
            }

            row += direction.row;
            column += direction.column;
        }
    }

    return false;
}

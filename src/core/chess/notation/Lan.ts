import { Board } from "../board/Board";
import { Movement, Piece, Position } from "../pieces/Piece";

const FILES = "abcdefgh";

function squareToLan(position: Position): string {
    return `${FILES[position.column]}${position.row + 1}`;
}

function parseSquare(square: string): Position | null {
    const column = FILES.indexOf(square[0]);
    const row = Number(square[1]) - 1;

    if (column < 0 || !Number.isInteger(row) || row < 0 || row > 7) return null;

    return { row, column };
}

export function toLan(piece: Piece, movement: Movement): string {
    const promotion = movement.type.includes("promotion")
        ? (movement.promotion ?? "Q").toLowerCase()
        : "";

    return `${squareToLan(piece.position)}${squareToLan(movement)}${promotion}`;
}

export function parseLan(
    board: Board,
    lan: string,
): { piece: Piece; movement: Movement } | null {
    const text = lan.trim().toLowerCase();
    if (text.length < 4 || text.length > 5) return null;

    const from = parseSquare(text.slice(0, 2));
    const to = parseSquare(text.slice(2, 4));
    if (!from || !to) return null;

    const piece = board.getSquare(from).piece;
    if (!piece || piece.color !== board.turn) return null;

    for (const movement of board.movementsOf(piece) ?? []) {
        if (movement.row !== to.row || movement.column !== to.column) continue;

        if (movement.type.includes("promotion")) {
            // Sem sufixo, a GUI esta pedindo dama.
            const wanted = (text[4] ?? "q").toUpperCase();
            if ((movement.promotion ?? "Q") !== wanted) continue;
        }

        return { piece, movement };
    }

    return null;
}

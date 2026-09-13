import { Board } from "./board/Board";
import { Bishop } from "./pieces/Bishop";
import { King } from "./pieces/King";
import { Knight } from "./pieces/Knight";
import { Pawn } from "./pieces/Pawn";
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

export class EvaluationController {
    static evaluatePosition(board: Board, turn: "white" | "black"): number {
        const opponent = turn === "white" ? "black" : "white";
        const endgame = isEndgame(board);

        return score(board, turn, endgame) - score(board, opponent, endgame);
    }
}

function score(
    board: Board,
    color: "black" | "white",
    endgame: boolean,
): number {
    let total = 0;

    for (const piece of board.getPieces(null, color, false)) {
        const { row, column } = piece.position;

        // As tabelas valem para as brancas, com a oitava fileira na primeira
        // linha. As pretas leem espelhado na vertical: peao preto na fileira 2
        // esta tao perto de promover quanto peao branco na 7.
        const index =
            color === "white" ? (7 - row) * 8 + column : row * 8 + column;

        const table =
            endgame && piece.name === "K"
                ? King.ENDGAME_TABLE
                : TABLES[piece.name];

        total += piece.value * PAWN_UNIT + (table?.[index] ?? 0);
    }

    return total;
}

function isEndgame(board: Board): boolean {
    let heavy = 0;

    for (const color of ["white", "black"] as const) {
        for (const piece of board.getPieces(null, color, false)) {
            if (piece.name !== "K" && piece.name !== "") heavy += piece.value;
        }
    }

    return heavy <= ENDGAME_THRESHOLD;
}

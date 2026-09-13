import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Knight extends Piece {
    value = 3;

    // prettier-ignore
    static readonly TABLE: readonly number[] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
    ];

    movementJumps = [
        { row: 1, column: 2 }, // Right - top
        { row: -1, column: 2 }, // Right - bottom

        { row: 1, column: -2 }, // Left - top
        { row: -1, column: -2 }, // Left - bottom

        { row: 2, column: 1 }, // Top - right
        { row: 2, column: -1 }, // Top - left

        { row: -2, column: 1 }, // Bottom - right
        { row: -2, column: -1 }, // Bottom - left
    ];

    constructor(
        color: "black" | "white",
        type: 1 | 2,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: type === 1 ? type : 6,
                row: color === "black" ? 7 : 0,
            },
            "N",
        );
    }

    validMovements(board: Board) {
        const validMovements: Movement[] = [];
        const king = board.getPieces("K", this.color)[0] as King;

        for (const { row: rowDir, column: colDir } of this.movementJumps) {
            const row = this.position.row + rowDir;
            const col = this.position.column + colDir;

            if (row > 7 || row < 0 || col > 7 || col < 0) continue;

            const possibleSquare = board.getSquare({ row, column: col });
            const occupied = !possibleSquare.empty;

            if (occupied && possibleSquare.piece!.color === this.color)
                continue;

            const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(
                board,
                { row, column: col },
                this,
            );

            if (putsOwnKingInCheck) continue;

            validMovements.push({
                row,
                column: col,
                type: (occupied ? "capture" : "move") as Movement["type"],
                check: this.searchForCheck(board, this.movementJumps, {
                    row,
                    column: col,
                }),
            });
        }

        return validMovements;
    }
}

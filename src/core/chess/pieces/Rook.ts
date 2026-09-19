import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Rook extends Piece {
    value = 5;

    // prettier-ignore
    static readonly TABLE: readonly number[] = [
      0,   0,   0,   0,   0,   0,   0,   0,
      5,  10,  10,  10,  10,  10,  10,   5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
      0,   0,   0,   5,   5,   0,   0,   0,
    ];

    movementDirections = [
        { row: 0, column: 1 }, // Right
        { row: 0, column: -1 }, // Left
        { row: 1, column: 0 }, // Top
        { row: -1, column: 0 }, // Bottom
    ];

    constructor(
        color: "black" | "white",
        type: 1 | 2,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: type === 1 ? 0 : 7,
                row: color === "black" ? 7 : 0,
            },
            "R",
        );
    }

    validMovements(board: Board) {
        const validMovements: Movement[] = [];
        const king = board.getPieces("K", this.color)[0] as King;

        for (const { row: rowDir, column: colDir } of this.movementDirections) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });
                const occupied = !possibleSquare.empty;

                if (occupied && possibleSquare.piece!.color === this.color) {
                    break;
                }

                const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(
                    board,
                    { row, column: col },
                    this,
                );

                if (!putsOwnKingInCheck) {
                    validMovements.push({
                        row,
                        column: col,
                        type: (occupied
                            ? "capture"
                            : "move") as Movement["type"],
                        check: this.searchForCheck(
                            board,
                            this.movementDirections,
                            { row, column: col },
                            true,
                        ),
                    });
                }

                // Peca adversaria e capturada, mas bloqueia o resto da linha.
                if (occupied) break;

                row += rowDir;
                col += colDir;
            }
        }

        return validMovements;
    }
}

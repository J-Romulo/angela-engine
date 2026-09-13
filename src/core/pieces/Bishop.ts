import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Bishop extends Piece {
    value = 3;

    movementDirections = [
        { row: 1, column: 1 }, // Top-right
        { row: 1, column: -1 }, // Top-left
        { row: -1, column: 1 }, // Bottom-right
        { row: -1, column: -1 }, // Bottom-left
    ];

    constructor(
        color: "black" | "white",
        type: 1 | 2,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: type === 1 ? 2 : 5,
                row: color === "black" ? 7 : 0,
            },
            "B",
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

import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Queen extends Piece {
    value = 9;

    movementDirections = [
        { row: 0, column: 1 }, // Right
        { row: 0, column: -1 }, // Left
        { row: 1, column: 0 }, // Top
        { row: -1, column: 0 }, // Bottom
        { row: 1, column: 1 }, // Top-right diagonal
        { row: 1, column: -1 }, // Top-left diagonal
        { row: -1, column: 1 }, // Bottom-right diagonal
        { row: -1, column: -1 }, // Bottom-left diagonal
    ];

    constructor(
        color: "black" | "white",
        type?: number,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: 3,
                row: color === "black" ? 7 : 0,
            },
            "Q",
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

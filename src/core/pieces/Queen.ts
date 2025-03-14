import { Board } from "../board/Board";
import { Piece } from "./Piece";

export class Queen extends Piece {
    constructor(color: 'black' | 'white') {
        super(color, {
            column: 3,
            row: color === 'black' ? 7 : 0
        })
    }

    validMovements(board: Board) {
        const validMovements = [];

        const directions = [
            { row: 0, column: 1 }, // Right
            { row: 0, column: -1 }, // Left
            { row: 1, column: 0 }, // Top
            { row: -1, column: 0 }, // Bottom
            { row: 1, column: 1 }, // Top-right diagonal
            { row: 1, column: -1 }, // Top-left diagonal
            { row: -1, column: 1 }, // Bottom-right diagonal
            { row: -1, column: -1 } // Bottom-left diagonal
        ];

        for (const { row: rowDir, column: colDir } of directions) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });
                
                if (possibleSquare.empty) {
                    validMovements.push({ row, column: col });
                } else {
                    if (possibleSquare.piece!.color !== this.color) {
                        validMovements.push({ row, column: col });
                    }
                    break;
                }

                row += rowDir;
                col += colDir;
            }
        }

        return validMovements;
    }
}
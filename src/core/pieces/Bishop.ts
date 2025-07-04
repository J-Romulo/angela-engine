import { Board } from "../board/Board";
import { Movement, Piece } from "./Piece"

export class Bishop extends Piece {
    constructor(color: 'black' | 'white', type: 1 | 2, position?: { row: number, column: number }) {
        super(color, position || {
            column: type === 1 ? 2 : 5,
            row: color === 'black' ? 7 : 0
        }, 'B')
    }

    validMovements(board: Board) {
        const validMovements = [];
        const directions = [
            { row: 1, column: 1 }, // Top-right
            { row: 1, column: -1 }, // Top-left
            { row: -1, column: 1 }, // Bottom-right
            { row: -1, column: -1 } // Bottom-left
        ];

        for (const { row: rowDir, column: colDir } of directions) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });
                
                if (possibleSquare.empty) {
                    validMovements.push({ row, column: col, type: 'move' as Movement['type'] });
                } else {
                    if (possibleSquare.piece!.color !== this.color) {
                        validMovements.push({ row, column: col, type: 'capture' as Movement['type'] });
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
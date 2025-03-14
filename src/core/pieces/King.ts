import { Board } from "../board/Board";
import { Piece } from "./Piece";

export class King extends Piece {
    constructor(color: 'black' | 'white') {
        super(color, {
            column: 4,
            row: color === 'black' ? 7 : 0
        })
    }

    validMovements(board: Board) {
        const validMovements = [];

        const kingMoves = [
            { row: 1, column: 1 }, // Right - top
            { row: 0, column: 1 }, // Right
            { row: -1, column: 1 }, // Right - bottom

            { row: 1, column: 0 }, // Top

            { row: -1, column: 0 }, // Bottom

            { row: 1, column: -1 }, // left - top
            { row: 0, column: -1 }, // left
            { row: -1, column: -1 }, // left - bottom

        ];

        for (const { row: rowDir, column: colDir } of kingMoves) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            if(row > 7 || row < 0 || col > 7 || col < 0) return
            const possibleSquare = board.getSquare({ row, column: col });
            
            if (possibleSquare.empty) {
                validMovements.push({ row, column: col });
            } else {
                if (possibleSquare.piece!.color !== this.color) {
                    validMovements.push({ row, column: col });
                }
            }
        }

        return validMovements;
    }
}
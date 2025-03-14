import { Board } from "../board/Board";
import { Piece } from "./Piece"

export class Knight extends Piece {
    constructor(color: 'black' | 'white', type: 1 | 2) {
        super(color, {
            column: type === 1 ? type : 6,
            row: color === 'black' ? 7 : 0
        })
    }

    validMovements(board: Board) {
        const validMovements = [];

        const knightJumps = [
            { row: 1, column: 2 }, // Right - top
            { row: -1, column: 2 }, // Right - bottom

            { row: 1, column: -2 }, // Left - top
            { row: -1, column: -2 }, // Left - bottom

            { row: 2, column: 1 }, // Top - right
            { row: 2, column: -1 }, // Top - left

            { row: -2, column: 1 }, // Bottom - right
            { row: -2, column: -1 }, // Bottom - left
        ];

        for (const { row: rowDir, column: colDir } of knightJumps) {
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
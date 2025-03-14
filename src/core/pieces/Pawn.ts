import { Board } from "../board/Board"
import { Piece } from "./Piece"

export class Pawn extends Piece {
    firstMove = true
    // enpassant
    constructor(color: 'black' | 'white', column: number) {
        super(color, {
            column,
            row: color === 'black' ? 6 : 1
        })
    }

    validMovements(board: Board) {
        const validMovements = [];
        const direction = this.color === 'white' ? 1 : -1;
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        // Move one square forward
        const oneSquare = { column: currentColumn, row: currentRow + direction };

        if(oneSquare.row > 7 || oneSquare.row < 0) return
        
        if (board.getSquare(oneSquare).empty) {
            validMovements.push(oneSquare);
        }

        // Move two squares forward on first move
        if (this.firstMove) {
            const twoSquares = { column: currentColumn, row: currentRow + 2 * direction };
            if (board.getSquare(oneSquare).empty && board.getSquare(twoSquares).empty) {
                validMovements.push(twoSquares);
            }
        }

        // Capture diagonally
        const diagonalMoves = [
            { column: currentColumn + 1, row: currentRow + direction },
            { column: currentColumn - 1, row: currentRow + direction }
        ];

        for (const move of diagonalMoves) {
            if(move.column > 7 || move.column < 0) return
            const targetSquare = board.getSquare(move);
            if (!targetSquare.empty && targetSquare.piece!.color !== this.color) {
                validMovements.push(move);
            }
        }

        return validMovements;
    }
}
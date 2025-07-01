import { Board } from "../board/Board";
import { Movement, Piece } from "./Piece";

export class King extends Piece {
    constructor(color: 'black' | 'white') {
        super(color, {
            column: 4,
            row: color === 'black' ? 7 : 0
        }, 'K')
    }

    validMovements(board: Board) {
        const validMovements = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

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

            if(row > 7 || row < 0 || col > 7 || col < 0) continue;
            const possibleSquare = board.getSquare({ row, column: col });
            
            if (possibleSquare.empty) {
                validMovements.push({ row, column: col, type: 'move' as Movement['type'] });
            } else {
                if (possibleSquare.piece!.color !== this.color) {
                    validMovements.push({ row, column: col, type: 'capture' as Movement['type'] });
                }
            }
        }

        //King castling
        if(this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn + 2, row: currentRow }
            ]

            let castlingPossible = true
            for (const move of castlingSquares) {
                if(move.column > 7 || move.column < 0) {
                    castlingPossible
                    break
                }
                const targetSquare = board.getSquare(move);
                if(!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if(castlingPossible) {
                const rookSquare = board.getSquare({ column: currentColumn + 3, row: currentRow });
                if(!rookSquare.empty && rookSquare.piece!.color === this.color && rookSquare.piece!.movementsMade === 0) {
                    validMovements.push({ column: currentColumn + 2, row: currentRow, type: 'king_castling' as Movement['type'] });
                }
            }
        }

        //Queen castling
        if(this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn - 1, row: currentRow },
                { column: currentColumn - 2, row: currentRow },
                { column: currentColumn - 3, row: currentRow },
            ]

            let castlingPossible = true
            for (const move of castlingSquares) {
                if(move.column > 7 || move.column < 0){
                    castlingPossible = false;
                    break;
                }
                const targetSquare = board.getSquare(move);
                if(!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if(castlingPossible) {
                const rookSquare = board.getSquare({ column: currentColumn - 4, row: currentRow });
                if(!rookSquare.empty && rookSquare.piece!.color === this.color && rookSquare.piece!.movementsMade === 0) {
                    validMovements.push({ column: currentColumn - 2, row: currentRow, type: 'queen_castling' as Movement['type'] });
                }
            }
        }

        return validMovements;
    }
}
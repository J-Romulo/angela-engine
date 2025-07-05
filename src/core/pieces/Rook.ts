import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece"

export class Rook extends Piece {
    constructor(color: 'black' | 'white', type: 1 | 2, position?: { row: number, column: number }) {
        super(color, position || {
            column: type === 1 ? 0 : 7,
            row: color === 'black' ? 7 : 0
        }, 'R')
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        const directions = [
            { row: 0, column: 1 }, // Right
            { row: 0, column: -1 }, // Left
            { row: 1, column: 0 }, // Top
            { row: -1, column: 0 } // Bottom
        ];

        for (const { row: rowDir, column: colDir } of directions) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });
                
                if (possibleSquare.empty) {
                    const isCheck = this.searchForCheck(board, { row, column: col });
                    if(!checkKingInCheck){
                        const king = board.getPieces('K', this.color)[0] as King;
                        const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { row, column: col }, this);

                        if(!putsOwnKingInCheck) {
                            validMovements.push({ row, column: col, type: 'move' as Movement['type'], check: isCheck });
                        }
                    }else {
                        validMovements.push({ row, column: col, type: 'move' as Movement['type'], check: isCheck });
                    }
                } else {
                    if (possibleSquare.piece!.color !== this.color) {
                        const isCheck = this.searchForCheck(board, { row, column: col });

                        if(!checkKingInCheck){
                            const king = board.getPieces('K', this.color)[0] as King;
                            const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { row, column: col }, this);

                            if(!putsOwnKingInCheck) {
                                validMovements.push({ row, column: col, type: 'capture' as Movement['type'], check: isCheck });
                            }
                        }else {
                            validMovements.push({ row, column: col, type: 'capture' as Movement['type'], check: isCheck });
                        }
                    }
                    break;
                }

                row += rowDir;
                col += colDir;
            }
        }

        //King castling
        if(this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn - 1, row: currentRow },
                { column: currentColumn - 2, row: currentRow }
            ]

            let castlingPossible = true
            for (const move of castlingSquares) {
                if(move.column > 7 || move.column < 0){
                    castlingPossible = false 
                    break
                }
                const targetSquare = board.getSquare(move);
                if(!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if(castlingPossible) {
                const kingSquare = board.getSquare({ column: currentColumn - 3, row: currentRow });
                if(!kingSquare.empty && kingSquare.piece!.color === this.color && kingSquare.piece!.movementsMade === 0) {
                    validMovements.push({ column: currentColumn - 2, row: currentRow, type: 'king_castling' as Movement['type'] });
                }
            }
        }

        //Queen castling
        if(this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn + 2, row: currentRow },
                { column: currentColumn + 3, row: currentRow },
            ]

            let castlingPossible = true
            for (const move of castlingSquares) {
                if(move.column > 7 || move.column < 0){ 
                    castlingPossible = false 
                    break
                }
                const targetSquare = board.getSquare(move);
                if(!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if(castlingPossible) {
                const kingSquare = board.getSquare({ column: currentColumn + 4, row: currentRow });
                if(!kingSquare.empty && kingSquare.piece!.color === this.color && kingSquare.piece!.movementsMade === 0) {
                    validMovements.push({ column: currentColumn + 3, row: currentRow, type: 'queen_castling' as Movement['type'] });
                }
            }
        }

        return validMovements;
    }

    searchForCheck(board: Board, position?: { row: number; column: number; }): boolean {
        const currentPosition = position || this.position;
        const directions = [
            { row: 0, column: 1 }, // Right
            { row: 0, column: -1 }, // Left
            { row: 1, column: 0 }, // Top
            { row: -1, column: 0 } // Bottom
        ];

        for (const { row: rowDir, column: colDir } of directions) {
            let row = currentPosition.row + rowDir;
            let col = currentPosition.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });
                
                if (possibleSquare.empty) {
                    row += rowDir;
                    col += colDir;
                    continue;
                }

                if (possibleSquare.piece!.color !== this.color && possibleSquare.piece instanceof King) {
                    return true;
                }
                break;
            }
        }

        return false;
    }
}
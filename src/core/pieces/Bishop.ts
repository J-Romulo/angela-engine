import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece"

export class Bishop extends Piece {
    constructor(color: 'black' | 'white', type: 1 | 2, position?: { row: number, column: number }) {
        super(color, position || {
            column: type === 1 ? 2 : 5,
            row: color === 'black' ? 7 : 0
        }, 'B')
    }

    validMovements(board: Board, checkKingInCheck = false) {
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

        return validMovements;
    }

    searchForCheck(board: Board, position?: { row: number, column: number }): boolean {
        const currentPosition = position || this.position;
        const directions = [
            { row: 1, column: 1 }, // Top-right
            { row: 1, column: -1 }, // Top-left
            { row: -1, column: 1 }, // Bottom-right
            { row: -1, column: -1 } // Bottom-left
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
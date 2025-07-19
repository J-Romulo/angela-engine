import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece"

export class Knight extends Piece {
    movementJumps = [
        { row: 1, column: 2 }, // Right - top
        { row: -1, column: 2 }, // Right - bottom

        { row: 1, column: -2 }, // Left - top
        { row: -1, column: -2 }, // Left - bottom

        { row: 2, column: 1 }, // Top - right
        { row: 2, column: -1 }, // Top - left

        { row: -2, column: 1 }, // Bottom - right
        { row: -2, column: -1 }, // Bottom - left
    ];

    constructor(color: 'black' | 'white', type: 1 | 2, position?: { row: number, column: number }) {
        super(color, position || {
                column: type === 1 ? type : 6,
                row: color === 'black' ? 7 : 0,
            },
            'N'
        );
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements = [];

        for (const { row: rowDir, column: colDir } of this.movementJumps) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            if(row > 7 || row < 0 || col > 7 || col < 0) continue;
            
            const possibleSquare = board.getSquare({ row, column: col });
            
            if (possibleSquare.empty) {
                const isCheck = checkKingInCheck ? false : this.searchForCheck(board, this.movementJumps, { row, column: col });
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
                    const isCheck = checkKingInCheck ? false : this.searchForCheck(board, this.movementJumps, { row, column: col });

                    if(!checkKingInCheck){
                        const king = board.getPieces('K', this.color)[0] as King;
                        const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { row, column: col }, this);

                        if(!putsOwnKingInCheck) {
                            validMovements.push({ row, column: col, type: 'capture' as Movement['type'], check: isCheck });
                        }
                    }else {
                        validMovements.push({ row, column: col, type: 'capture' as Movement['type'], check: possibleSquare.piece instanceof King ? true : isCheck });
                    }
                }
            }
        }

        return validMovements;
    }
}
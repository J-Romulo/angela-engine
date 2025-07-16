import { Board } from "../board/Board"
import { King } from "./King";
import { Piece, Movement } from "./Piece"

export class Pawn extends Piece {
    constructor(color: 'black' | 'white', column: number) {
        super(color, {
            column,
            row: color === 'black' ? 6 : 1
        })
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements: Movement[] = [];
        const direction = this.color === 'white' ? 1 : -1;
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        // Move one square forward
        const oneSquare = { column: currentColumn, row: currentRow + direction, type: 'move' as Movement['type'] };

        if(oneSquare.row > 7 || oneSquare.row < 0) return
        
        if ((oneSquare.row <= 7 && oneSquare.row >= 0) && board.getSquare(oneSquare).empty) {
            const isCheck = checkKingInCheck ? false : this.searchForCheck(board, { row: oneSquare.row, column: oneSquare.column });

            if(!checkKingInCheck){
                const king = board.getPieces('K', this.color)[0] as King;
                const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { row: oneSquare.row, column: oneSquare.column }, this);

                if(!putsOwnKingInCheck) {
                    validMovements.push({ row: oneSquare.row, column: oneSquare.column, type: 'move' as Movement['type'], check: isCheck });
                }
            }else {
                validMovements.push({ row: oneSquare.row, column: oneSquare.column, type: 'move' as Movement['type'], check: isCheck });
            }
        }

        // Move two squares forward on first move
        if (this.movementsMade === 0) {
            const twoSquares = { column: currentColumn, row: currentRow + 2 * direction, type: 'move' as Movement['type'] };
            if (board.getSquare(oneSquare).empty && board.getSquare(twoSquares).empty) {
                const isCheck = checkKingInCheck ? false : this.searchForCheck(board, { row: twoSquares.row, column: twoSquares.column });

                if(!checkKingInCheck){
                    const king = board.getPieces('K', this.color)[0] as King;
                    const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { row: twoSquares.row, column: twoSquares.column }, this);

                    if(!putsOwnKingInCheck) {
                        validMovements.push({ row: twoSquares.row, column: twoSquares.column, type: 'move' as Movement['type'], check: isCheck });
                    }
                }else {
                    validMovements.push({ row: twoSquares.row, column: twoSquares.column, type: 'move' as Movement['type'], check: isCheck });
                }
            }
        }

        // Capture diagonally
        const diagonalMoves = [
            { column: currentColumn + 1, row: currentRow + direction, type: 'capture' as Movement['type'] },
            { column: currentColumn - 1, row: currentRow + direction, type: 'capture' as Movement['type'] }
        ];

        for (const move of diagonalMoves) {
            if(move.column > 7 || move.column < 0) continue
            const targetSquare = board.getSquare(move);
            if (!targetSquare.empty && targetSquare.piece!.color !== this.color) {
                const isCheck = checkKingInCheck ? false : this.searchForCheck(board, { row: move.row, column: move.column });

                if(!checkKingInCheck){
                    const king = board.getPieces('K', this.color)[0] as King;
                    const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { column: move.column, row: move.row }, this);

                    if(!putsOwnKingInCheck) {
                        validMovements.push({ column: move.column, row: move.row, type: 'capture' as Movement['type'], check: isCheck });
                    }
                }else {
                    validMovements.push({ column: move.column, row: move.row, type: 'capture' as Movement['type'], check: targetSquare.piece instanceof King ? true : isCheck });
                }
            }
        }

        // En passant
        // Capturing pawn has to have moved 3 rows
        // Captured pawn has to be next to the capturing pawn
        // Captured pawn has have moved 2 rows in last turn
        // Capture has to be made immediately after the pawn has moved 2 rows
        if(this.movementsMade === 3) {
            const sideSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn - 1, row: currentRow }
            ]
    
            for (const move of sideSquares) {
                if(move.column > 7 || move.column < 0) break
                const targetSquare = board.getSquare(move);
                if (!targetSquare.empty && targetSquare.piece!.color !== this.color && targetSquare.piece instanceof Pawn) {
                    const isCheck = checkKingInCheck ? false : this.searchForCheck(board, { row: move.row, column: move.column });

                    if(
                        targetSquare.piece.lastPosition && 
                        targetSquare.piece.movementsMade === 2 &&
                        Math.abs(targetSquare.piece.position.row - targetSquare.piece.lastPosition.row) === 2 &&
                        targetSquare.piece.lastPosition.round === board.round - 1
                    ) {
                        if(!checkKingInCheck){
                            const king = board.getPieces('K', this.color)[0] as King;
                            const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(board, { column: move.column, row: currentRow + direction }, this);

                            if(!putsOwnKingInCheck) {
                                validMovements.push({ column: move.column, row: currentRow + direction, type: 'en-passant' as Movement['type'], check: isCheck });
                            }
                        }else {
                            validMovements.push({ column: move.column, row: currentRow + direction, type: 'en-passant' as Movement['type'], check: targetSquare.piece instanceof King ? true : isCheck });
                        }
                    }
                }
            }
        }

        return validMovements;
    }

    searchForCheck(board: Board, position?: { row: number; column: number; }): boolean {
        const currentPosition = position || this.position;
        const direction = this.color === 'white' ? 1 : -1;


        const diagonalMoves = [
            { column: currentPosition.column + 1, row: currentPosition.row + direction },
            { column: currentPosition.column - 1, row: currentPosition.row + direction }
        ];

        for (const move of diagonalMoves) {
            if(move.column > 7 || move.column < 0) continue
            const targetSquare = board.getSquare(move);
            if (!targetSquare.empty && targetSquare.piece!.color !== this.color && targetSquare.piece instanceof King) {
                return true;
            }
        }

        return false;
    }
}
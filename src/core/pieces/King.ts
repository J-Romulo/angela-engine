import { Board } from "../board/Board";
import { Movement, Piece, Position } from "./Piece";

export class King extends Piece {
    movementDirections = [
        { row: 1, column: 1 }, // Right - top
        { row: 0, column: 1 }, // Right
        { row: -1, column: 1 }, // Right - bottom

        { row: 1, column: 0 }, // Top

        { row: -1, column: 0 }, // Bottom

        { row: 1, column: -1 }, // left - top
        { row: 0, column: -1 }, // left
        { row: -1, column: -1 }, // left - bottom
    ];

    constructor(color: "black" | "white") {
        super(
            color,
            {
                column: 4,
                row: color === "black" ? 7 : 0,
            },
            "K",
        );
    }

    validMovements(board: Board) {
        const validMovements = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        for (const { row: rowDir, column: colDir } of this.movementDirections) {
            const row = this.position.row + rowDir;
            const col = this.position.column + colDir;

            if (row > 7 || row < 0 || col > 7 || col < 0) continue;
            const possibleSquare = board.getSquare({ row, column: col });
            const putsInCheck = this.checkIfMovePutsKingInCheck(
                board,
                { row, column: col },
                this,
            );

            if (putsInCheck) continue;

            if (possibleSquare.empty) {
                validMovements.push({
                    row,
                    column: col,
                    type: "move" as Movement["type"],
                });
            } else {
                if (possibleSquare.piece!.color !== this.color) {
                    validMovements.push({
                        row,
                        column: col,
                        type: "capture" as Movement["type"],
                    });
                }
            }
        }

        //King castling
        if (this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn + 2, row: currentRow },
            ];

            let castlingPossible = true;
            for (const move of castlingSquares) {
                if (move.column > 7 || move.column < 0) {
                    castlingPossible = false;
                    break;
                }
                const targetSquare = board.getSquare(move);
                if (!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if (castlingPossible) {
                const rookSquare = board.getSquare({
                    column: currentColumn + 3,
                    row: currentRow,
                });
                if (
                    !rookSquare.empty &&
                    rookSquare.piece!.color === this.color &&
                    rookSquare.piece!.movementsMade === 0
                ) {
                    validMovements.push({
                        column: currentColumn + 2,
                        row: currentRow,
                        type: "king_castling" as Movement["type"],
                    });
                }
            }
        }

        //Queen castling
        if (this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn - 1, row: currentRow },
                { column: currentColumn - 2, row: currentRow },
                { column: currentColumn - 3, row: currentRow },
            ];

            let castlingPossible = true;
            for (const move of castlingSquares) {
                if (move.column > 7 || move.column < 0) {
                    castlingPossible = false;
                    break;
                }
                const targetSquare = board.getSquare(move);
                if (!targetSquare.empty) {
                    castlingPossible = false;
                    break;
                }
            }

            if (castlingPossible) {
                const rookSquare = board.getSquare({
                    column: currentColumn - 4,
                    row: currentRow,
                });
                if (
                    !rookSquare.empty &&
                    rookSquare.piece!.color === this.color &&
                    rookSquare.piece!.movementsMade === 0
                ) {
                    validMovements.push({
                        column: currentColumn - 2,
                        row: currentRow,
                        type: "queen_castling" as Movement["type"],
                    });
                }
            }
        }

        return validMovements;
    }

    checkIfMovePutsKingInCheck(
        board: Board,
        movement: Position,
        piece: Piece,
    ): boolean {
        const originalPosition = {
            row: (piece as Piece).position.row,
            column: (piece as Piece).position.column,
        };

        let oldSquare = board.getSquare({
            row: (piece as Piece).position.row,
            column: (piece as Piece).position.column,
        });
        let newSquare = board.getSquare({
            row: movement.row,
            column: movement.column,
        });
        piece.move(
            { row: movement.row, column: movement.column },
            board.round,
            true,
        );

        const originalPiece = newSquare.piece;
        newSquare.piece = piece;
        newSquare.empty = false;

        oldSquare.piece = null;
        oldSquare.empty = true;

        const pieces =
            this.color === "white"
                ? [
                      ...board.blackPieces.filter((piece) => !piece.captured),
                      ...board.blackPawns.filter((piece) => !piece.captured),
                  ]
                : [
                      ...board.whitePieces.filter((piece) => !piece.captured),
                      ...board.whitePawns.filter((piece) => !piece.captured),
                  ];

        let putsInCheck = false;
        pieces.forEach((pieceToAnalise) => {
            if (
                pieceToAnalise instanceof King ||
                pieceToAnalise === originalPiece
            )
                return;

            const validMovements = pieceToAnalise.validMovements(board, true);
            if (validMovements && validMovements.length) {
                validMovements.forEach((validMovement) => {
                    if (validMovement.check) {
                        putsInCheck = true;
                    }
                });
            }
        });

        oldSquare = board.getSquare({
            row: (piece as Piece).position.row,
            column: (piece as Piece).position.column,
        });
        newSquare = board.getSquare({
            row: originalPosition.row,
            column: originalPosition.column,
        });
        piece.move(
            { row: originalPosition.row, column: originalPosition.column },
            board.round,
            true,
        );

        newSquare.piece = piece;
        newSquare.empty = false;

        oldSquare.piece = originalPiece || null;
        oldSquare.empty = originalPiece ? false : true;

        return putsInCheck;
    }
}

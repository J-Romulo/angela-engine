import { Board } from "../board/Board";
import { King } from "./King";
import { Piece, Movement } from "./Piece";

export class Pawn extends Piece {
    value = 1;

    movementDirection = this.color === "white" ? 1 : -1;

    attackDirections = [
        { column: 1, row: this.movementDirection },
        { column: -1, row: this.movementDirection },
    ];

    constructor(color: "black" | "white", column: number) {
        super(color, {
            column,
            row: color === "black" ? 6 : 1,
        });
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements: Movement[] = [];
        const direction = this.color === "white" ? 1 : -1;
        const currentRow = this.position.row;
        const currentColumn = this.position.column;
        const promotionRow = direction === 1 ? 7 : 0;

        const forwardType: Movement["type"] =
            currentRow + direction === promotionRow ? "promotion" : "move";

        // Move one square forward
        const oneSquare = {
            column: currentColumn,
            row: currentRow + direction,
            type: "move" as Movement["type"],
        };

        if (oneSquare.row > 7 || oneSquare.row < 0) return;

        if (
            oneSquare.row <= 7 &&
            oneSquare.row >= 0 &&
            board.getSquare(oneSquare).empty
        ) {
            const isCheck = checkKingInCheck
                ? false
                : this.searchForCheck(board, this.attackDirections, {
                      row: oneSquare.row,
                      column: oneSquare.column,
                  });

            if (!checkKingInCheck) {
                const king = board.getPieces("K", this.color)[0] as King;
                const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(
                    board,
                    { row: oneSquare.row, column: oneSquare.column },
                    this,
                );

                if (!putsOwnKingInCheck) {
                    validMovements.push({
                        row: oneSquare.row,
                        column: oneSquare.column,
                        type: forwardType,
                        check: isCheck,
                    });
                }
            } else {
                validMovements.push({
                    row: oneSquare.row,
                    column: oneSquare.column,
                    type: forwardType,
                    check: isCheck,
                });
            }
        }

        // Move two squares forward on first move
        if (this.movementsMade === 0) {
            const twoSquares = {
                column: currentColumn,
                row: currentRow + 2 * direction,
                type: "move" as Movement["type"],
            };
            if (
                board.getSquare(oneSquare).empty &&
                board.getSquare(twoSquares).empty
            ) {
                const isCheck = checkKingInCheck
                    ? false
                    : this.searchForCheck(board, this.attackDirections, {
                          row: twoSquares.row,
                          column: twoSquares.column,
                      });

                if (!checkKingInCheck) {
                    const king = board.getPieces("K", this.color)[0] as King;
                    const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(
                        board,
                        { row: twoSquares.row, column: twoSquares.column },
                        this,
                    );

                    if (!putsOwnKingInCheck) {
                        validMovements.push({
                            row: twoSquares.row,
                            column: twoSquares.column,
                            type: "move" as Movement["type"],
                            check: isCheck,
                        });
                    }
                } else {
                    validMovements.push({
                        row: twoSquares.row,
                        column: twoSquares.column,
                        type: "move" as Movement["type"],
                        check: isCheck,
                    });
                }
            }
        }

        // Capture diagonally
        const diagonalMoves = [
            {
                column: currentColumn + 1,
                row: currentRow + direction,
                type: "capture" as Movement["type"],
            },
            {
                column: currentColumn - 1,
                row: currentRow + direction,
                type: "capture" as Movement["type"],
            },
        ];

        for (const move of diagonalMoves) {
            if (move.column > 7 || move.column < 0) continue;
            const targetSquare = board.getSquare(move);
            if (
                !targetSquare.empty &&
                targetSquare.piece!.color !== this.color
            ) {
                const isCheck = checkKingInCheck
                    ? false
                    : this.searchForCheck(board, this.attackDirections, {
                          row: move.row,
                          column: move.column,
                      });

                const captureType: Movement["type"] =
                    move.row === promotionRow ? "promotion_capture" : "capture";

                if (!checkKingInCheck) {
                    const king = board.getPieces("K", this.color)[0] as King;
                    const putsOwnKingInCheck = king.checkIfMovePutsKingInCheck(
                        board,
                        { column: move.column, row: move.row },
                        this,
                    );

                    if (!putsOwnKingInCheck) {
                        validMovements.push({
                            column: move.column,
                            row: move.row,
                            type: captureType,
                            check: isCheck,
                        });
                    }
                } else {
                    validMovements.push({
                        column: move.column,
                        row: move.row,
                        type: captureType,
                        check:
                            targetSquare.piece instanceof King ? true : isCheck,
                    });
                }
            }
        }

        // En passant
        // Capturing pawn has to have moved 3 rows
        // Captured pawn has to be next to the capturing pawn
        // Captured pawn has have moved 2 rows in last turn
        // Capture has to be made immediately after the pawn has moved 2 rows
        if (this.movementsMade === 3) {
            const sideSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn - 1, row: currentRow },
            ];

            for (const move of sideSquares) {
                if (move.column > 7 || move.column < 0) break;
                const targetSquare = board.getSquare(move);
                if (
                    !targetSquare.empty &&
                    targetSquare.piece!.color !== this.color &&
                    targetSquare.piece instanceof Pawn
                ) {
                    const isCheck = checkKingInCheck
                        ? false
                        : this.searchForCheck(board, this.attackDirections, {
                              row: move.row,
                              column: move.column,
                          });

                    if (
                        targetSquare.piece.lastPosition &&
                        targetSquare.piece.movementsMade === 2 &&
                        Math.abs(
                            targetSquare.piece.position.row -
                                targetSquare.piece.lastPosition.row,
                        ) === 2 &&
                        targetSquare.piece.lastPosition.round ===
                            board.round - 1
                    ) {
                        if (!checkKingInCheck) {
                            const king = board.getPieces(
                                "K",
                                this.color,
                            )[0] as King;
                            const putsOwnKingInCheck =
                                king.checkIfMovePutsKingInCheck(
                                    board,
                                    {
                                        column: move.column,
                                        row: currentRow + direction,
                                    },
                                    this,
                                );

                            if (!putsOwnKingInCheck) {
                                validMovements.push({
                                    column: move.column,
                                    row: currentRow + direction,
                                    type: "en_passant" as Movement["type"],
                                    check: isCheck,
                                });
                            }
                        } else {
                            validMovements.push({
                                column: move.column,
                                row: currentRow + direction,
                                type: "en_passant" as Movement["type"],
                                check:
                                    targetSquare.piece instanceof King
                                        ? true
                                        : isCheck,
                            });
                        }
                    }
                }
            }
        }

        return validMovements;
    }
}

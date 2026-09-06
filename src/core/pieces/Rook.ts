import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Rook extends Piece {
    value = 5;

    movementDirections = [
        { row: 0, column: 1 }, // Right
        { row: 0, column: -1 }, // Left
        { row: 1, column: 0 }, // Top
        { row: -1, column: 0 }, // Bottom
    ];

    constructor(
        color: "black" | "white",
        type: 1 | 2,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: type === 1 ? 0 : 7,
                row: color === "black" ? 7 : 0,
            },
            "R",
        );
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        for (const { row: rowDir, column: colDir } of this.movementDirections) {
            let row = this.position.row + rowDir;
            let col = this.position.column + colDir;

            while (row >= 0 && row < 8 && col >= 0 && col < 8) {
                const possibleSquare = board.getSquare({ row, column: col });

                if (possibleSquare.empty) {
                    const isCheck = checkKingInCheck
                        ? false
                        : this.searchForCheck(
                              board,
                              this.movementDirections,
                              { row, column: col },
                              true,
                          );
                    if (!checkKingInCheck) {
                        const king = board.getPieces(
                            "K",
                            this.color,
                        )[0] as King;
                        const putsOwnKingInCheck =
                            king.checkIfMovePutsKingInCheck(
                                board,
                                { row, column: col },
                                this,
                            );

                        if (!putsOwnKingInCheck) {
                            validMovements.push({
                                row,
                                column: col,
                                type: "move" as Movement["type"],
                                check: isCheck,
                            });
                        }
                    } else {
                        validMovements.push({
                            row,
                            column: col,
                            type: "move" as Movement["type"],
                            check: isCheck,
                        });
                    }
                } else {
                    if (possibleSquare.piece!.color !== this.color) {
                        const isCheck = checkKingInCheck
                            ? false
                            : this.searchForCheck(
                                  board,
                                  this.movementDirections,
                                  {
                                      row,
                                      column: col,
                                  },
                              );

                        if (!checkKingInCheck) {
                            const king = board.getPieces(
                                "K",
                                this.color,
                            )[0] as King;
                            const putsOwnKingInCheck =
                                king.checkIfMovePutsKingInCheck(
                                    board,
                                    { row, column: col },
                                    this,
                                );

                            if (!putsOwnKingInCheck) {
                                validMovements.push({
                                    row,
                                    column: col,
                                    type: "capture" as Movement["type"],
                                    check: isCheck,
                                });
                            }
                        } else {
                            validMovements.push({
                                row,
                                column: col,
                                type: "capture" as Movement["type"],
                                check:
                                    possibleSquare.piece instanceof King
                                        ? true
                                        : isCheck,
                            });
                        }
                    }
                    break;
                }

                row += rowDir;
                col += colDir;
            }
        }

        // O roque nao ataca casa nenhuma, entao nao entra em varredura de
        // ataque - e gera-lo ali recursaria pelas casas atacadas.
        if (checkKingInCheck) return validMovements;

        //King castling
        if (this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn - 1, row: currentRow },
                { column: currentColumn - 2, row: currentRow },
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

            const kingColumn = currentColumn - 3;
            if (castlingPossible && kingColumn >= 0) {
                const kingSquare = board.getSquare({
                    column: kingColumn,
                    row: currentRow,
                });
                if (
                    !kingSquare.empty &&
                    kingSquare.piece!.color === this.color &&
                    kingSquare.piece!.movementsMade === 0 &&
                    kingSquare.piece instanceof King &&
                    !kingSquare.piece.pathIsAttacked(board, [
                        kingColumn,
                        kingColumn + 1,
                        kingColumn + 2,
                    ])
                ) {
                    validMovements.push({
                        column: currentColumn - 2,
                        row: currentRow,
                        type: "king_castling" as Movement["type"],
                        check: this.searchForCheck(
                            board,
                            this.movementDirections,
                            { row: currentRow, column: currentColumn - 2 },
                            true,
                        ),
                    });
                }
            }
        }

        //Queen castling
        if (this.movementsMade === 0) {
            const castlingSquares = [
                { column: currentColumn + 1, row: currentRow },
                { column: currentColumn + 2, row: currentRow },
                { column: currentColumn + 3, row: currentRow },
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

            const kingColumn = currentColumn + 4;
            if (castlingPossible && kingColumn <= 7) {
                const kingSquare = board.getSquare({
                    column: kingColumn,
                    row: currentRow,
                });
                if (
                    !kingSquare.empty &&
                    kingSquare.piece!.color === this.color &&
                    kingSquare.piece!.movementsMade === 0 &&
                    kingSquare.piece instanceof King &&
                    !kingSquare.piece.pathIsAttacked(board, [
                        kingColumn,
                        kingColumn - 1,
                        kingColumn - 2,
                    ])
                ) {
                    validMovements.push({
                        column: currentColumn + 3,
                        row: currentRow,
                        type: "queen_castling" as Movement["type"],
                        check: this.searchForCheck(
                            board,
                            this.movementDirections,
                            { row: currentRow, column: currentColumn + 3 },
                            true,
                        ),
                    });
                }
            }
        }

        return validMovements;
    }
}

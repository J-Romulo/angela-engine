import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Queen extends Piece {
    value = 9;

    movementDirections = [
        { row: 0, column: 1 }, // Right
        { row: 0, column: -1 }, // Left
        { row: 1, column: 0 }, // Top
        { row: -1, column: 0 }, // Bottom
        { row: 1, column: 1 }, // Top-right diagonal
        { row: 1, column: -1 }, // Top-left diagonal
        { row: -1, column: 1 }, // Bottom-right diagonal
        { row: -1, column: -1 }, // Bottom-left diagonal
    ];

    constructor(
        color: "black" | "white",
        type?: number,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: 3,
                row: color === "black" ? 7 : 0,
            },
            "Q",
        );
    }

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements = [];

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
                        let isCheck = checkKingInCheck
                            ? false
                            : this.searchForCheck(
                                  board,
                                  this.movementDirections,
                                  { row, column: col },
                                  true,
                              );

                        if (possibleSquare.piece instanceof King)
                            isCheck = true;

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
                                check: isCheck,
                            });
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
}

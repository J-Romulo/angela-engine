import { Board } from "../board/Board";
import { King } from "./King";
import { Movement, Piece } from "./Piece";

export class Bishop extends Piece {
    value = 3;

    movementDirections = [
        { row: 1, column: 1 }, // Top-right
        { row: 1, column: -1 }, // Top-left
        { row: -1, column: 1 }, // Bottom-right
        { row: -1, column: -1 }, // Bottom-left
    ];

    constructor(
        color: "black" | "white",
        type: 1 | 2,
        position?: { row: number; column: number },
    ) {
        super(
            color,
            position || {
                column: type === 1 ? 2 : 5,
                row: color === "black" ? 7 : 0,
            },
            "B",
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

        return validMovements;
    }
}

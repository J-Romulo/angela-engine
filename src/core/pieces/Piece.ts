import type { Board } from "../board/Board";

export type Position = {
    column: number;
    row: number;
};

export type Movement = Position & {
    type:
        | "move"
        | "capture"
        | "en_passant"
        | "king_castling"
        | "queen_castling"
        | "promotion"
        | "promotion_capture";

    check?: boolean;
    promotion?: "Q" | "R" | "B" | "N";
};
export abstract class Piece {
    color: "black" | "white";
    position: Position;
    name: string;
    movementsMade = 0;
    captured = false;

    abstract value: number;

    constructor(color: "black" | "white", position: Position, name = "") {
        this.color = color;
        this.position = position;
        this.name = name;
    }

    move(newPosition: Position, falseMove = false) {
        if (!falseMove) {
            this.calculateMovementsMade(this.position, newPosition);
        }
        this.position = newPosition;
    }

    abstract validMovements(board: Board): Movement[] | undefined;

    searchForCheck(
        board: Board,
        directions: Position[],
        position: Position,
        continuosMove = false,
    ): boolean {
        for (const { row: rowDir, column: colDir } of directions) {
            let row = position.row + rowDir;
            let col = position.column + colDir;

            let squaresMoved = 0;
            while (
                row >= 0 &&
                row < 8 &&
                col >= 0 &&
                col < 8 &&
                (continuosMove || squaresMoved < 1)
            ) {
                squaresMoved++;
                const possibleSquare = board.getSquare({ row, column: col });

                if (possibleSquare.empty) {
                    row += rowDir;
                    col += colDir;
                    continue;
                }

                if (
                    possibleSquare.piece!.color !== this.color &&
                    possibleSquare.piece!.name === "K"
                ) {
                    return true;
                }
                break;
            }
        }

        return false;
    }

    calculateMovementsMade(oldPosition: Position, newPosition: Position) {
        this.movementsMade +=
            Math.abs(oldPosition.row - newPosition.row) +
            Math.abs(oldPosition.column - newPosition.column);
    }
}

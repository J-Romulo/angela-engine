import { Board } from "../board/Board";
import { King } from "./King";

export type Position = {
    column: number;
    row: number;
};

export type LastPosition = Position & {
    round: number;
};

export type Movement = Position & {
    type:
        | "move"
        | "capture"
        | "en_passant"
        | "king_castling"
        | "queen_castling"
        | "promotion"
        | "file_disambiguation"
        | "rank_disambiguation"
        | "full_disambiguation"
        | "promotion_capture";

    check?: boolean;
};
export abstract class Piece {
    color: "black" | "white";
    position: Position;
    lastPosition?: LastPosition;
    name: string;
    movementsMade = 0;
    captured = false;

    constructor(color: "black" | "white", position: Position, name = "") {
        this.color = color;
        this.position = position;
        this.name = name;
    }

    move(newPosition: Position, round: number, falseMove = false) {
        if (!falseMove) {
            this.lastPosition = { ...this.position, round };
            this.calculateMovementsMade(this.position, newPosition);
        }
        this.position = newPosition;
    }

    abstract validMovements(
        board: Board,
        checkKingInCheck?: boolean,
    ): Movement[] | undefined;

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
                    possibleSquare.piece instanceof King
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

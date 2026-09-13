import { Board } from "../board/Board";
import { King } from "./King";
import { Piece, Movement } from "./Piece";

export class Pawn extends Piece {
    value = 1;

    // prettier-ignore
    static readonly TABLE: readonly number[] = [
      0,   0,   0,   0,   0,   0,   0,   0,
     50,  50,  50,  50,  50,  50,  50,  50,
     10,  10,  20,  30,  30,  20,  10,  10,
      5,   5,  10,  25,  25,  10,   5,   5,
      0,   0,   0,  20,  20,   0,   0,   0,
      5,  -5, -10,   0,   0, -10,  -5,   5,
      5,  10,  10, -20, -20,  10,  10,   5,
      0,   0,   0,   0,   0,   0,   0,   0,
    ];

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

    validMovements(board: Board) {
        const validMovements: Movement[] = [];
        const king = board.getPieces("K", this.color)[0] as King;

        const direction = this.color === "white" ? 1 : -1;
        const currentRow = this.position.row;
        const currentColumn = this.position.column;
        const promotionRow = direction === 1 ? 7 : 0;

        const push = (
            row: number,
            column: number,
            type: Movement["type"],
            directions = this.attackDirections,
        ) => {
            if (king.checkIfMovePutsKingInCheck(board, { row, column }, this)) {
                return;
            }

            validMovements.push({
                row,
                column,
                type,
                check: this.searchForCheck(board, directions, { row, column }),
            });
        };

        const oneSquare = {
            column: currentColumn,
            row: currentRow + direction,
        };
        if (oneSquare.row > 7 || oneSquare.row < 0) return validMovements;

        // Avanco de uma casa
        if (board.getSquare(oneSquare).empty) {
            push(
                oneSquare.row,
                oneSquare.column,
                oneSquare.row === promotionRow ? "promotion" : "move",
            );

            // Avanco de duas, so na primeira saida do peao
            const twoSquares = {
                column: currentColumn,
                row: currentRow + 2 * direction,
            };
            if (this.movementsMade === 0 && board.getSquare(twoSquares).empty) {
                push(twoSquares.row, twoSquares.column, "move");
            }
        }

        // Capturas na diagonal
        for (const column of [currentColumn + 1, currentColumn - 1]) {
            if (column > 7 || column < 0) continue;

            const row = currentRow + direction;
            const targetSquare = board.getSquare({ row, column });

            if (targetSquare.empty) continue;
            if (targetSquare.piece!.color === this.color) continue;

            push(
                row,
                column,
                row === promotionRow ? "promotion_capture" : "capture",
            );
        }

        // En passant. A coluna nula descarta o bloco sem tocar no tabuleiro, e
        // e o caso na esmagadora maioria dos lances.
        if (
            board.enPassantColumn !== null &&
            currentRow === (direction === 1 ? 4 : 3)
        ) {
            for (const column of [currentColumn + 1, currentColumn - 1]) {
                // `continue`, nao `break`: na coluna h o primeiro lado sai do
                // tabuleiro e o outro ainda precisa ser olhado.
                if (column > 7 || column < 0) continue;
                if (board.enPassantColumn !== column) continue;

                const targetSquare = board.getSquare({
                    row: currentRow,
                    column,
                });
                if (
                    targetSquare.empty ||
                    targetSquare.piece!.color === this.color ||
                    targetSquare.piece!.name !== ""
                ) {
                    continue;
                }

                // O peao capturado sai de uma casa que NAO e a de destino. Sem
                // retira-lo da simulacao ele continua bloqueando a linha, e uma
                // captura que expoe o proprio rei passa por legal.
                const capturedPawn = targetSquare.piece!;
                targetSquare.piece = null;
                targetSquare.empty = true;
                capturedPawn.captured = true;

                push(currentRow + direction, column, "en_passant");

                capturedPawn.captured = false;
                targetSquare.piece = capturedPawn;
                targetSquare.empty = false;
            }
        }

        return expandPromotions(validMovements);
    }
}

const PROMOTION_PIECES = ["Q", "R", "B", "N"] as const;

function expandPromotions(movements: Movement[]): Movement[] {
    let hasPromotion = false;
    for (const movement of movements) {
        if (
            movement.type === "promotion" ||
            movement.type === "promotion_capture"
        ) {
            hasPromotion = true;
            break;
        }
    }
    if (!hasPromotion) return movements;

    return movements.flatMap((movement) =>
        movement.type === "promotion" || movement.type === "promotion_capture"
            ? PROMOTION_PIECES.map((promotion) => ({ ...movement, promotion }))
            : movement,
    );
}

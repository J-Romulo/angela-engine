import { Board } from "../board/Board";
import { isSquareAttacked } from "../attacks";
import { Movement, Piece, Position } from "./Piece";

const rookDirections = [
    { row: 0, column: 1 },
    { row: 0, column: -1 },
    { row: 1, column: 0 },
    { row: -1, column: 0 },
];

export class King extends Piece {
    value = 0;

    /** Meio-jogo: o rei quer o canto, atras dos peoes. */
    // prettier-ignore
    static readonly TABLE: readonly number[] = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
     20,  20,   0,   0,   0,   0,  20,  20,
     20,  30,  10,   0,   0,  10,  30,  20,
    ];

    /** Final: o rei vira peca ativa e quer o centro. Sem isso ele fica */
    /** escondido no canto e o final de peoes se perde sozinho. */
    // prettier-ignore
    static readonly ENDGAME_TABLE: readonly number[] = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10,   0,   0, -10, -20, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  30,  40,  40,  30, -10, -30,
    -30, -10,  20,  30,  30,  20, -10, -30,
    -30, -30,   0,   0,   0,   0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
    ];

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
        const validMovements: Movement[] = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        for (const { row: rowDir, column: colDir } of this.movementDirections) {
            const row = this.position.row + rowDir;
            const col = this.position.column + colDir;

            if (row > 7 || row < 0 || col > 7 || col < 0) continue;

            const possibleSquare = board.getSquare({ row, column: col });
            if (
                !possibleSquare.empty &&
                possibleSquare.piece!.color === this.color
            ) {
                continue;
            }

            if (
                this.checkIfMovePutsKingInCheck(
                    board,
                    { row, column: col },
                    this,
                )
            ) {
                continue;
            }

            validMovements.push({
                row,
                column: col,
                type: (possibleSquare.empty
                    ? "move"
                    : "capture") as Movement["type"],
            });
        }

        // Direito lido do estado do tabuleiro, nao deduzido de movementsMade.
        //King castling
        if (
            this.color === "white"
                ? board.castlingRights.whiteKing
                : board.castlingRights.blackKing
        ) {
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

            if (
                castlingPossible &&
                this.pathIsAttacked(board, [
                    currentColumn,
                    currentColumn + 1,
                    currentColumn + 2,
                ])
            ) {
                castlingPossible = false;
            }

            if (castlingPossible) {
                const rookSquare = board.getSquare({
                    column: currentColumn + 3,
                    row: currentRow,
                });
                if (
                    !rookSquare.empty &&
                    rookSquare.piece!.color === this.color
                ) {
                    validMovements.push({
                        column: currentColumn + 2,
                        row: currentRow,
                        type: "king_castling" as Movement["type"],
                        check: this.searchForCheck(
                            board,
                            rookDirections,
                            { row: currentRow, column: currentColumn + 1 },
                            true,
                        ),
                    });
                }
            }
        }

        //Queen castling
        if (
            this.color === "white"
                ? board.castlingRights.whiteQueen
                : board.castlingRights.blackQueen
        ) {
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

            if (
                castlingPossible &&
                this.pathIsAttacked(board, [
                    currentColumn,
                    currentColumn - 1,
                    currentColumn - 2,
                ])
            ) {
                castlingPossible = false;
            }

            if (castlingPossible) {
                const rookSquare = board.getSquare({
                    column: currentColumn - 4,
                    row: currentRow,
                });
                if (
                    !rookSquare.empty &&
                    rookSquare.piece!.color === this.color
                ) {
                    validMovements.push({
                        column: currentColumn - 2,
                        row: currentRow,
                        type: "queen_castling" as Movement["type"],
                        check: this.searchForCheck(
                            board,
                            rookDirections,
                            { row: currentRow, column: currentColumn - 1 },
                            true,
                        ),
                    });
                }
            }
        }

        return validMovements;
    }

    /**
     * Nenhuma casa do caminho do roque pode estar atacada: nem a de saida, nem
     * as de passagem. Varredura direta - antes isto movia o rei de verdade para
     * cada casa so para perguntar.
     */
    pathIsAttacked(board: Board, columns: number[]): boolean {
        const enemy = this.color === "white" ? "black" : "white";

        return columns.some((column) =>
            isSquareAttacked(board, { row: this.position.row, column }, enemy),
        );
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

        // Consultar a propria casa da peca ("estou em xeque agora?") nao pode
        // mexer no tabuleiro: origem e destino sao o mesmo Square e as
        // escritas abaixo acabariam apagando a peca.
        const samePosition =
            originalPosition.row === movement.row &&
            originalPosition.column === movement.column;

        let oldSquare = board.getSquare({
            row: (piece as Piece).position.row,
            column: (piece as Piece).position.column,
        });
        let newSquare = board.getSquare({
            row: movement.row,
            column: movement.column,
        });

        const originalPiece = samePosition ? null : newSquare.piece;

        if (!samePosition) {
            piece.move({ row: movement.row, column: movement.column }, true);

            newSquare.piece = piece;
            newSquare.empty = false;

            oldSquare.piece = null;
            oldSquare.empty = true;
        }

        const putsInCheck = isSquareAttacked(
            board,
            this.position,
            this.color === "white" ? "black" : "white",
        );

        if (!samePosition) {
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
                true,
            );

            newSquare.piece = piece;
            newSquare.empty = false;

            oldSquare.piece = originalPiece || null;
            oldSquare.empty = originalPiece ? false : true;
        }

        return putsInCheck;
    }
}

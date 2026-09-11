import { Board } from "../board/Board";
import { Movement, Piece, Position } from "./Piece";

const rookDirections = [
    { row: 0, column: 1 },
    { row: 0, column: -1 },
    { row: 1, column: 0 },
    { row: -1, column: 0 },
];

export class King extends Piece {
    value = 0;

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

    validMovements(board: Board, checkKingInCheck = false) {
        const validMovements = [];
        const currentRow = this.position.row;
        const currentColumn = this.position.column;

        for (const { row: rowDir, column: colDir } of this.movementDirections) {
            const row = this.position.row + rowDir;
            const col = this.position.column + colDir;

            if (row > 7 || row < 0 || col > 7 || col < 0) continue;
            const possibleSquare = board.getSquare({ row, column: col });

            // Em uma varredura de ataque interessa apenas quais casas o rei
            // cobre; filtrar aqui recursaria de volta no rei adversario.
            const putsInCheck = checkKingInCheck
                ? false
                : this.checkIfMovePutsKingInCheck(
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
                        check:
                            checkKingInCheck &&
                            possibleSquare.piece instanceof King,
                    });
                }
            }
        }

        // O roque nao ataca casa nenhuma, entao nao entra em varredura de
        // ataque - e gera-lo ali recursaria pelas casas atacadas.
        if (checkKingInCheck) return validMovements;

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
     * True se o rei estiver em xeque em alguma das casas informadas da sua
     * fileira - usado para barrar o roque saindo de, passando por ou parando
     * em casa atacada.
     */
    pathIsAttacked(board: Board, columns: number[]): boolean {
        return columns.some((column) =>
            this.checkIfMovePutsKingInCheck(
                board,
                { row: this.position.row, column },
                this,
            ),
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
            piece.move(
                { row: movement.row, column: movement.column },
                board.round,
                true,
            );

            newSquare.piece = piece;
            newSquare.empty = false;

            oldSquare.piece = null;
            oldSquare.empty = true;
        }

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
            // O rei adversario tambem cobre casas: sem ele os dois reis
            // conseguiriam ficar lado a lado.
            if (pieceToAnalise === originalPiece) return;

            const validMovements = pieceToAnalise.validMovements(board, true);
            if (validMovements && validMovements.length) {
                validMovements.forEach((validMovement) => {
                    if (validMovement.check) {
                        putsInCheck = true;
                    }
                });
            }
        });

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
                board.round,
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

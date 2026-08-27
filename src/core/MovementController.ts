import { Board } from "./board/Board";
import { NotationValidator } from "./NotationValidator";
import { Bishop } from "./pieces/Bishop";
import { Knight } from "./pieces/Knight";
import { Pawn } from "./pieces/Pawn";
import { Movement, Piece } from "./pieces/Piece";
import { Queen } from "./pieces/Queen";
import { Rook } from "./pieces/Rook";

const notationToColumn: { [key: string]: number } = {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
    e: 4,
    f: 5,
    g: 6,
    h: 7,
};

export const notationToPiece: {
    [key: string]:
        | typeof Queen
        | typeof Rook
        | typeof Bishop
        | typeof Knight
        | typeof Pawn;
} = {
    Q: Queen,
    R: Rook,
    B: Bishop,
    N: Knight,
};

/** Reads the promoted piece out of notation like "e8=Q+", defaulting to queen. */
function getPromotionSymbol(move: string): string {
    return move.match(/=([QRBN])/)?.[1] ?? "Q";
}

export class MovementController {
    constructor(private board: Board) {
        this.board = board;
    }

    executeMovement(move: string): boolean {
        if (!NotationValidator.isValidMove(move)) {
            throw new Error("Invalid move format.");
        }

        const moveType = NotationValidator.getMoveType(move);

        if (moveType.includes("castling")) {
            return this.castlingMovement(moveType);
        }

        const { pieceSymbol, ...ambiguation } =
            NotationValidator.getPieceSymbol(move, moveType);
        const [column, row] =
            NotationValidator.getDestinationSquare(move)?.split("") ?? [];

        const validPieces = this.getValidPieces(pieceSymbol || "");
        const { validMove, validPiece } = this.getValidMovement(
            validPieces,
            column,
            row,
            ambiguation,
        );

        if (!validMove || !validPiece) {
            throw new Error("Invalid move for the selected piece.");
        }

        this.applyMovement(validPiece, validMove, getPromotionSymbol(move));

        return this.reportGameEnd(validMove);
    }

    applyMovement(piece: Piece, movement: Movement, promotionSymbol = "Q") {
        if (movement.type.includes("castling")) {
            this.castlingMovement(movement.type);
            return;
        }

        const to = { row: movement.row, column: movement.column };
        let movingPiece = piece;

        if (movement.type === "en_passant" && this.board.getSquare(to).empty) {
            this.enPassantCapture(to.column, to.row);
        }

        if (movement.type.includes("promotion")) {
            const PromotionPieceClass =
                notationToPiece[promotionSymbol] ?? Queen;

            const promotedPiece = new PromotionPieceClass(
                piece.color,
                1,
                piece.position,
            );
            promotedPiece.movementsMade = piece.movementsMade;
            promotedPiece.lastPosition = piece.lastPosition;

            this.board.replacePiece(piece, promotedPiece);
            movingPiece = promotedPiece;
        }

        this.movePieceInTheBoard(movingPiece, to);

        this.board.setTurn(this.board.turn === "white" ? "black" : "white");
        this.board.setRound(this.board.round + 1);
    }

    reportGameEnd(movement: Movement): boolean {
        if (movement.check) {
            this.board.check = true;
            if (this.verifyNoValidMoves()) {
                console.log(
                    "Checkmate! Game over." +
                        (this.board.turn === "white" ? "Black" : "White") +
                        " wins!",
                );
                return true;
            }
        } else {
            if (this.verifyNoValidMoves()) {
                console.log("Stalemate! Game over. It's a draw.");
                return true;
            }
            this.board.check = false;
        }

        return false;
    }

    getValidPieces(pieceType: string) {
        const validPieces = this.board.getPieces(pieceType, this.board.turn);
        if (!validPieces) {
            throw new Error(`Invalid piece type: ${pieceType}`);
        }
        return validPieces;
    }

    getValidMovement(
        pieces: Piece[],
        column: string,
        row: string,
        ambiguition: {
            ambiguousColumn?: string | null;
            ambiguousRow?: string | null;
        },
    ): { validMove: Movement | null; validPiece: Piece | null } {
        let validMove: Movement | null = null;
        let validPiece: Piece | null = null;

        // Loop inside loop, WARNING
        pieces
            .filter((piece) => {
                if (ambiguition.ambiguousColumn && ambiguition.ambiguousRow) {
                    return (
                        piece.position.column ===
                            notationToColumn[ambiguition.ambiguousColumn] &&
                        piece.position.row ===
                            parseInt(ambiguition.ambiguousRow) - 1
                    );
                } else if (ambiguition.ambiguousColumn) {
                    return (
                        piece.position.column ===
                        notationToColumn[ambiguition.ambiguousColumn]
                    );
                } else if (ambiguition.ambiguousRow) {
                    return (
                        piece.position.row ===
                        parseInt(ambiguition.ambiguousRow) - 1
                    );
                }
                return true;
            })
            .forEach((piece) => {
                const validMovements = piece.validMovements(this.board);
                if (validMovements && validMovements.length > 0) {
                    validMovements.forEach((validMovement) => {
                        if (
                            validMovement.column === notationToColumn[column] &&
                            validMovement.row === parseInt(row) - 1
                        ) {
                            validMove = validMovement;
                            validPiece = piece;
                            return;
                        }
                    });
                }
            });

        return {
            validMove,
            validPiece,
        };
    }

    castlingMovement(moveType: Movement["type"]) {
        const king = this.board.getPieces("K", this.board.turn)[0];

        const rook = this.board
            .getPieces("R", this.board.turn)
            .filter((rook) => {
                return (
                    rook.position.row === king.position.row &&
                    rook.position.column ===
                        king.position.column +
                            (moveType === "king_castling" ? 3 : -4)
                );
            })[0];

        if (!rook || !king) {
            throw new Error("Invalid castling move.");
        }

        const kingMovements = king
            .validMovements(this.board)
            ?.filter((movement) => movement.type === moveType);
        const rookMovements = rook
            .validMovements(this.board)
            ?.filter((movement) => movement.type === moveType);

        if (
            !kingMovements ||
            !rookMovements ||
            kingMovements.length === 0 ||
            rookMovements.length === 0
        ) {
            throw new Error("Invalid castling move.");
        }

        this.movePieceInTheBoard(king, {
            row: kingMovements[0].row,
            column: kingMovements[0].column,
        });
        this.movePieceInTheBoard(rook, {
            row: rookMovements[0].row,
            column: rookMovements[0].column,
        });

        this.board.setTurn(this.board.turn === "white" ? "black" : "white");
        this.board.setRound(this.board.round + 1);

        return false;
    }

    enPassantCapture(column: number, row: number) {
        const enPassantCapture = this.board.getSquare({
            row: row + (this.board.turn === "white" ? -1 : 1),
            column: column,
        });

        enPassantCapture.piece = null;
        enPassantCapture.empty = true;
    }

    movePieceInTheBoard(
        piece: Piece,
        newPosition: { row: number; column: number },
    ) {
        const oldSquare = this.board.getSquare({
            row: (piece as Piece).position.row,
            column: (piece as Piece).position.column,
        });
        const newSquare = this.board.getSquare({
            row: newPosition.row,
            column: newPosition.column,
        });
        piece.move(
            { row: newPosition.row, column: newPosition.column },
            this.board.round,
        );

        if (newSquare.piece) {
            newSquare.piece.captured = true;
        }

        newSquare.piece = piece;
        newSquare.empty = false;

        oldSquare.piece = null;
        oldSquare.empty = true;
    }

    verifyNoValidMoves() {
        const king = this.board.getPieces("K", this.board.turn)[0];

        if (!king) {
            throw new Error("King not found.");
        }

        const kingValidMovements = king.validMovements(this.board, false);

        if (kingValidMovements && kingValidMovements.length > 0) {
            return false; // King can still move
        }

        const pieces = this.board.getPieces(null, this.board.turn);

        for (const piece of pieces) {
            const validMovements = piece.validMovements(this.board, false);
            if (validMovements && validMovements.length > 0) {
                return false; // At least one piece can still move
            }
        }

        return true;
    }
}

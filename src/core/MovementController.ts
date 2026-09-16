import { isSquareAttacked } from "./attacks";
import { Board } from "./board/Board";
import { NotationValidator } from "./NotationValidator";
import { Bishop } from "./pieces/Bishop";
import { King } from "./pieces/King";
import { Knight } from "./pieces/Knight";
import { Pawn } from "./pieces/Pawn";
import { Movement, Piece, Position } from "./pieces/Piece";
import { Queen } from "./pieces/Queen";
import { Rook } from "./pieces/Rook";
import { CastlingRight } from "./zobrist";

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

function getPromotionSymbol(move: string): string {
    return move.match(/=([QRBN])/)?.[1] ?? "Q";
}

type MovedPiece = {
    piece: Piece;
    from: Position;
    to: Position;
    movementsMade: number;
};

export type MoveUndo = {
    moved: MovedPiece;
    rook: MovedPiece | null;

    captured: Piece | null;
    capturedSquare: Position | null;

    promotion: { pawn: Piece; pawnIndex: number; promoted: Piece } | null;

    hash: bigint;
    castlingRights: Record<CastlingRight, boolean>;
    enPassantColumn: number | null;
    halfmoveClock: number;
    turn: "black" | "white";
    round: number;
};

export type GameStatus =
    | "checkmate"
    | "stalemate"
    | "threefold"
    | "fifty_moves"
    | "insufficient_material"
    | "ongoing";

export const FIFTY_MOVE_LIMIT = 100;

export class MovementController {
    constructor(private board: Board) {
        this.board = board;
    }

    executeMovement(move: string): boolean {
        const resolved = this.resolveSan(move);

        if (!resolved) {
            throw new Error("Invalid move for the selected piece.");
        }

        const repetitions = this.applyMovement(
            resolved.piece,
            resolved.movement,
            resolved.promotionSymbol,
        );

        return this.reportGameEnd(repetitions);
    }

    /**
     * Resolve notacao algebrica sem aplicar nada e sem imprimir - o caminho
     * UCI depende disso: escrita fora do protocolo derruba a GUI.
     */
    resolveSan(move: string): {
        piece: Piece;
        movement: Movement;
        promotionSymbol: string;
    } | null {
        if (!NotationValidator.isValidMove(move)) {
            throw new Error("Invalid move format.");
        }

        const moveType = NotationValidator.getMoveType(move);

        if (moveType.includes("castling")) {
            const king = this.board.getPieces("K", this.board.turn)[0];
            const movement = (this.board.movementsOf(king) ?? []).find(
                (candidate) => candidate.type === moveType,
            );

            if (!king || !movement) return null;

            return { piece: king, movement, promotionSymbol: "Q" };
        }

        const { pieceSymbol, ...ambiguation } =
            NotationValidator.getPieceSymbol(move);
        const [column, row] =
            NotationValidator.getDestinationSquare(move)?.split("") ?? [];

        const validPieces = this.getValidPieces(pieceSymbol || "");
        const { validMove, validPiece } = this.getValidMovement(
            validPieces,
            column,
            row,
            ambiguation,
        );

        if (!validMove || !validPiece) return null;

        return {
            piece: validPiece,
            movement: validMove,
            promotionSymbol: getPromotionSymbol(move),
        };
    }

    makeMovement(
        piece: Piece,
        movement: Movement,
        promotionSymbol?: string,
    ): MoveUndo {
        const board = this.board;
        board.clearMovementsCache();

        const undo: MoveUndo = {
            moved: null as unknown as MovedPiece,
            rook: null,
            captured: null,
            capturedSquare: null,
            promotion: null,
            hash: board.hash,
            castlingRights: { ...board.castlingRights },
            enPassantColumn: board.enPassantColumn,
            halfmoveClock: board.halfmoveClock,
            turn: board.turn,
            round: board.round,
        };

        if (movement.type.includes("castling")) {
            const { king, rook } = this.castlingMovement(movement.type);
            undo.moved = king;
            undo.rook = rook;
            return undo;
        }

        const to = { row: movement.row, column: movement.column };
        let movingPiece = piece;

        if (movement.type === "en_passant" && board.getSquare(to).empty) {
            const taken = this.enPassantCapture(to.column, to.row);
            if (taken) {
                undo.captured = taken.victim;
                undo.capturedSquare = taken.square;
            }
        }

        if (movement.type.includes("promotion")) {
            const PromotionPieceClass =
                notationToPiece[promotionSymbol ?? movement.promotion ?? "Q"] ??
                Queen;

            const promotedPiece = new PromotionPieceClass(
                piece.color,
                1,
                piece.position,
            );
            promotedPiece.movementsMade = piece.movementsMade;

            const pawns =
                piece.color === "white" ? board.whitePawns : board.blackPawns;

            undo.promotion = {
                pawn: piece,
                pawnIndex: pawns.indexOf(piece),
                promoted: promotedPiece,
            };

            board.replacePiece(piece, promotedPiece);
            movingPiece = promotedPiece;
        }

        const { moved, captured } = this.movePieceInTheBoard(movingPiece, to);
        undo.moved = moved;

        const irreversible = piece.name === "" || captured || undo.captured;
        board.halfmoveClock = irreversible ? 0 : board.halfmoveClock + 1;

        if (captured) {
            undo.captured = captured;
            undo.capturedSquare = { ...to };
        }

        board.setTurn(board.turn === "white" ? "black" : "white");
        board.setRound(board.round + 1);
        board.history.push(board.hash);

        return undo;
    }

    unmakeMovement(undo: MoveUndo) {
        const board = this.board;
        board.clearMovementsCache();

        board.turn = undo.turn;
        board.round = undo.round;
        board.hash = undo.hash;
        board.castlingRights = undo.castlingRights;
        board.enPassantColumn = undo.enPassantColumn;
        board.halfmoveClock = undo.halfmoveClock;
        board.history.pop();

        this.relocate(undo.moved);
        if (undo.rook) this.relocate(undo.rook);

        if (undo.promotion) {
            const { pawn, pawnIndex, promoted } = undo.promotion;
            const origin = board.getSquare(undo.moved.from);

            origin.piece = pawn;
            origin.empty = false;
            pawn.position = { ...undo.moved.from };

            const pieces =
                pawn.color === "white" ? board.whitePieces : board.blackPieces;
            const pawns =
                pawn.color === "white" ? board.whitePawns : board.blackPawns;

            pieces.splice(pieces.indexOf(promoted), 1);
            pawns.splice(pawnIndex, 0, pawn);
        }

        if (undo.captured && undo.capturedSquare) {
            const square = board.getSquare(undo.capturedSquare);
            undo.captured.captured = false;
            undo.captured.position = { ...undo.capturedSquare };
            square.piece = undo.captured;
            square.empty = false;
        }
    }

    private relocate(moved: MovedPiece) {
        const board = this.board;

        const destination = board.getSquare(moved.to);
        destination.piece = null;
        destination.empty = true;

        moved.piece.position = { ...moved.from };
        moved.piece.movementsMade = moved.movementsMade;

        const origin = board.getSquare(moved.from);
        origin.piece = moved.piece;
        origin.empty = false;
    }

    applyMovement(piece: Piece, movement: Movement, promotionSymbol?: string) {
        this.makeMovement(piece, movement, promotionSymbol);
        return this.board.repetitionCount();
    }

    isInCheck(color: "black" | "white" = this.board.turn): boolean {
        const king = this.board.getPieces("K", color)[0];
        if (!king) return false;

        return isSquareAttacked(
            this.board,
            king.position,
            color === "white" ? "black" : "white",
        );
    }

    gameStatus(repetitions = 0): GameStatus {
        if (this.verifyNoValidMoves()) {
            return this.isInCheck() ? "checkmate" : "stalemate";
        }

        if (this.board.hasInsufficientMaterial())
            return "insufficient_material";

        if (this.board.halfmoveClock >= FIFTY_MOVE_LIMIT) return "fifty_moves";

        if (repetitions >= 3) return "threefold";

        return "ongoing";
    }

    reportGameEnd(repetitions: number): boolean {
        this.board.check = this.isInCheck();

        const status = this.gameStatus(repetitions);

        switch (status) {
            case "checkmate":
                console.log(
                    "Checkmate! Game over. " +
                        (this.board.turn === "white" ? "Black" : "White") +
                        " wins!",
                );
                return true;
            case "stalemate":
                console.log("Stalemate! Game over. It's a draw.");
                return true;
            case "insufficient_material":
                console.log("Draw by insufficient material! Game over.");
                return true;
            case "fifty_moves":
                console.log("Draw by the fifty-move rule! Game over.");
                return true;
            case "threefold":
                console.log("Draw by threefold repetition! Game over.");
                return true;
            default:
                return false;
        }
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
        this.board.clearMovementsCache();

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

        if (!kingMovements || kingMovements.length === 0) {
            throw new Error("Invalid castling move.");
        }

        const kingMovement = kingMovements[0];

        const rookColumn =
            kingMovement.column + (moveType === "king_castling" ? -1 : 1);

        const movedKing = this.movePieceInTheBoard(king, {
            row: kingMovement.row,
            column: kingMovement.column,
        }).moved;
        const movedRook = this.movePieceInTheBoard(rook, {
            row: kingMovement.row,
            column: rookColumn,
        }).moved;

        this.board.halfmoveClock += 1;

        this.board.setTurn(this.board.turn === "white" ? "black" : "white");
        this.board.setRound(this.board.round + 1);
        this.board.history.push(this.board.hash);

        return { movement: kingMovement, king: movedKing, rook: movedRook };
    }

    enPassantCapture(column: number, row: number) {
        const enPassantCapture = this.board.getSquare({
            row: row + (this.board.turn === "white" ? -1 : 1),
            column: column,
        });

        const victim = enPassantCapture.piece;
        if (victim) {
            victim.captured = true;
            this.board.togglePieceAt(victim, victim.position);
        }

        enPassantCapture.piece = null;
        enPassantCapture.empty = true;

        return victim
            ? { victim, square: { ...victim.position } as Position }
            : null;
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

        const from = { ...piece.position };
        const captured = newSquare.piece;
        const moved: MovedPiece = {
            piece,
            from,
            to: { ...newPosition },
            movementsMade: piece.movementsMade,
        };

        this.board.togglePieceAt(piece, from);
        if (captured) this.board.togglePieceAt(captured, newPosition);

        piece.move({ row: newPosition.row, column: newPosition.column });

        this.board.togglePieceAt(piece, newPosition);

        this.updateBoardState(piece, from, newPosition, captured);

        if (newSquare.piece) {
            newSquare.piece.captured = true;
        }

        newSquare.piece = piece;
        newSquare.empty = false;

        oldSquare.piece = null;
        oldSquare.empty = true;

        return { moved, captured };
    }

    private updateBoardState(
        piece: Piece,
        from: { row: number; column: number },
        to: { row: number; column: number },
        captured: Piece | null,
    ) {
        if (piece instanceof King) {
            if (piece.color === "white") {
                this.revokeRight("whiteKing");
                this.revokeRight("whiteQueen");
            } else {
                this.revokeRight("blackKing");
                this.revokeRight("blackQueen");
            }
        }

        if (piece instanceof Rook) this.revokeRookRight(piece.color, from);
        if (captured instanceof Rook) {
            this.revokeRookRight(captured.color, to);
        }

        const doublePush =
            piece instanceof Pawn && Math.abs(to.row - from.row) === 2;

        this.setEnPassantColumn(
            doublePush && this.enPassantIsCapturable(piece, to)
                ? to.column
                : null,
        );
    }

    private enPassantIsCapturable(
        pawn: Piece,
        to: { row: number; column: number },
    ): boolean {
        for (const column of [to.column - 1, to.column + 1]) {
            if (column < 0 || column > 7) continue;

            const neighbour = this.board.getSquare({
                row: to.row,
                column,
            }).piece;

            if (neighbour instanceof Pawn && neighbour.color !== pawn.color) {
                return true;
            }
        }

        return false;
    }

    private revokeRight(right: CastlingRight) {
        if (!this.board.castlingRights[right]) return;

        this.board.castlingRights[right] = false;
        this.board.toggleCastlingRight(right);
    }

    private setEnPassantColumn(column: number | null) {
        const board = this.board;
        if (board.enPassantColumn === column) return;

        if (board.enPassantColumn !== null) {
            board.toggleEnPassantColumn(board.enPassantColumn);
        }

        board.enPassantColumn = column;

        if (column !== null) board.toggleEnPassantColumn(column);
    }

    private revokeRookRight(
        color: "black" | "white",
        square: { row: number; column: number },
    ) {
        const homeRow = color === "white" ? 0 : 7;
        if (square.row !== homeRow) return;

        if (square.column === 7) {
            this.revokeRight(color === "white" ? "whiteKing" : "blackKing");
        } else if (square.column === 0) {
            this.revokeRight(color === "white" ? "whiteQueen" : "blackQueen");
        }
    }

    verifyNoValidMoves() {
        const king = this.board.getPieces("K", this.board.turn)[0];

        if (!king) {
            throw new Error("King not found.");
        }

        const kingValidMovements = this.board.movementsOf(king);

        if (kingValidMovements && kingValidMovements.length > 0) {
            return false; // King can still move
        }

        const pieces = this.board.getPieces(null, this.board.turn);

        for (const piece of pieces) {
            const validMovements = this.board.movementsOf(piece);
            if (validMovements && validMovements.length > 0) {
                return false; // At least one piece can still move
            }
        }

        return true;
    }
}

import { Board } from "../core/board/Board";
import { MovementController } from "../core/MovementController";
import { Bishop } from "../core/pieces/Bishop";
import { King } from "../core/pieces/King";
import { Knight } from "../core/pieces/Knight";
import { Pawn } from "../core/pieces/Pawn";
import { Piece } from "../core/pieces/Piece";
import { Queen } from "../core/pieces/Queen";
import { Rook } from "../core/pieces/Rook";

export function perft(depth: number, position: string): number {
    return countNodes(prepareBoardFromPosition(position), depth);
}

function countNodes(board: Board, depth: number): number {
    if (depth === 0) return 1;

    const currentPlayerPieces = board.getPieces(null, board.turn, false);

    const allValidMoves = currentPlayerPieces.flatMap((piece) =>
        (board.movementsOf(piece) ?? []).map((movement) => ({
            piece,
            movement,
        })),
    );

    let nodes = 0;
    const controller = new MovementController(board);

    for (const { piece, movement } of allValidMoves) {
        const hashBefore = board.hash;
        const undo = controller.makeMovement(piece, movement);

        nodes += countNodes(board, depth - 1);

        controller.unmakeMovement(undo);

        if (board.hash !== hashBefore) {
            throw new Error(
                `unmake nao restaurou o hash apos ${piece.name || "P"}` +
                    `${piece.position.column}${piece.position.row}` +
                    `-${movement.column}${movement.row} (${movement.type})`,
            );
        }
    }

    return nodes;
}

const FILES = "abcdefgh";

export function prepareBoardFromPosition(position: string): Board {
    const [placement, activeColor, castling, enPassant, , fullmove] = position
        .trim()
        .split(/\s+/);

    const board = emptyBoard();

    placement.split("/").forEach((rankText, index) => {
        const row = 7 - index;
        let column = 0;

        for (const symbol of rankText) {
            if (symbol >= "1" && symbol <= "8") {
                column += Number(symbol);
                continue;
            }
            placePiece(board, symbol, row, column);
            column++;
        }
    });

    board.turn = activeColor === "b" ? "black" : "white";

    board.round =
        (Number(fullmove || 1) - 1) * 2 + (board.turn === "white" ? 1 : 2);

    applyCastlingRights(board, castling);
    applyEnPassant(board, enPassant);

    board.hash = board.recomputeHash();

    return board;
}

function emptyBoard(): Board {
    const board = new Board();

    board.whitePieces = [];
    board.blackPieces = [];
    board.whitePawns = [];
    board.blackPawns = [];
    board.positions = new Map();
    board.clearMovementsCache();

    for (const row of board.squares) {
        for (const square of row) {
            square.piece = null;
            square.empty = true;
        }
    }

    return board;
}

function placePiece(board: Board, symbol: string, row: number, column: number) {
    const color = symbol === symbol.toUpperCase() ? "white" : "black";
    let piece: Piece;

    switch (symbol.toUpperCase()) {
        case "R":
            piece = new Rook(color, 1);
            break;
        case "N":
            piece = new Knight(color, 1);
            break;
        case "B":
            piece = new Bishop(color, 1);
            break;
        case "Q":
            piece = new Queen(color);
            break;
        case "K":
            piece = new King(color);
            break;
        default:
            piece = new Pawn(color, column);
            break;
    }

    piece.position = { row, column };

    if (piece instanceof Pawn) {
        piece.movementsMade = Math.abs(row - (color === "white" ? 1 : 6));
    }

    if (piece instanceof Pawn) {
        (color === "white" ? board.whitePawns : board.blackPawns).push(piece);
    } else {
        (color === "white" ? board.whitePieces : board.blackPieces).push(piece);
    }

    const square = board.squares[row][column];
    square.piece = piece;
    square.empty = false;
}

function applyCastlingRights(board: Board, castling: string) {
    const rights = castling ?? "-";

    board.castlingRights = {
        whiteKing: rights.includes("K"),
        whiteQueen: rights.includes("Q"),
        blackKing: rights.includes("k"),
        blackQueen: rights.includes("q"),
    };
}

function applyEnPassant(board: Board, enPassant: string) {
    board.enPassantColumn = null;
    if (!enPassant || enPassant === "-") return;

    const column = FILES.indexOf(enPassant[0]);
    if (column < 0) return;

    const pawnRow = Number(enPassant[1]) - 1 === 2 ? 3 : 4;
    const pawn = board.squares[pawnRow][column].piece;
    if (!(pawn instanceof Pawn)) return;

    for (const side of [column - 1, column + 1]) {
        if (side < 0 || side > 7) continue;

        const neighbour = board.squares[pawnRow][side].piece;
        if (neighbour instanceof Pawn && neighbour.color !== pawn.color) {
            board.enPassantColumn = column;
            return;
        }
    }
}

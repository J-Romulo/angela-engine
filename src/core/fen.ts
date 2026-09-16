import { Bishop } from "./pieces/Bishop";
import { King } from "./pieces/King";
import { Knight } from "./pieces/Knight";
import { Pawn } from "./pieces/Pawn";
import { Piece } from "./pieces/Piece";
import { Queen } from "./pieces/Queen";
import { Rook } from "./pieces/Rook";
import { Board } from "./board/Board";

const FILES = "abcdefgh";

export function prepareBoardFromPosition(position: string): Board {
    const [placement, activeColor, castling, enPassant, halfmove, fullmove] =
        position.trim().split(/\s+/);

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

    board.halfmoveClock = Number(halfmove || 0);

    applyCastlingRights(board, castling);
    applyEnPassant(board, enPassant);

    board.hash = board.recomputeHash();
    board.history = [board.hash];

    return board;
}

function emptyBoard(): Board {
    const board = new Board();

    board.whitePieces = [];
    board.blackPieces = [];
    board.whitePawns = [];
    board.blackPawns = [];
    board.history = [];
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

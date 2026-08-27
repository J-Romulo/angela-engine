import { Bishop } from "../pieces/Bishop";
import { King } from "../pieces/King";
import { Knight } from "../pieces/Knight";
import { Pawn } from "../pieces/Pawn";
import { Piece, Position } from "../pieces/Piece";
import { Queen } from "../pieces/Queen";
import { Rook } from "../pieces/Rook";

export type Square = {
    color: "black" | "white";
    piece: Piece | null;
    empty: boolean;
};

export class Board {
    squares: Square[][];
    round: number = 1;
    turn: "white" | "black" = "white";
    check: boolean = false;

    whitePieces: Piece[] = [];
    blackPieces: Piece[] = [];

    whitePawns: Piece[] = [];
    blackPawns: Piece[] = [];

    constructor() {
        this.whitePieces = [
            new Rook("white", 1),
            new Knight("white", 1),
            new Bishop("white", 1),
            new Queen("white"),
            new King("white"),
            new Bishop("white", 2),
            new Knight("white", 2),
            new Rook("white", 2),
        ];

        this.blackPieces = [
            new Rook("black", 1),
            new Knight("black", 1),
            new Bishop("black", 1),
            new Queen("black"),
            new King("black"),
            new Bishop("black", 2),
            new Knight("black", 2),
            new Rook("black", 2),
        ];
        this.squares = this.initializeBoard();
    }

    clone(): Board {
        const prototypeByName: Record<string, object> = {
            R: Rook.prototype,
            N: Knight.prototype,
            B: Bishop.prototype,
            Q: Queen.prototype,
            K: King.prototype,
            "": Pawn.prototype,
        };
        const copy = structuredClone(this) as Board;
        Object.setPrototypeOf(copy, Board.prototype);

        for (const piece of [
            ...copy.whitePieces,
            ...copy.blackPieces,
            ...copy.whitePawns,
            ...copy.blackPawns,
        ]) {
            Object.setPrototypeOf(piece, prototypeByName[piece.name]);
        }

        return copy;
    }

    initializeBoard() {
        const board = [];
        for (let row = 0; row < 8; row++) {
            const boardRow: Square[] = [];
            for (let col = 0; col < 8; col++) {
                const color: "black" | "white" =
                    (row + col) % 2 === 0 ? "black" : "white";
                let piece: Piece | null = null;
                let empty = true;

                if (row === 0) {
                    piece = this.whitePieces[col];
                    empty = false;
                } else if (row === 7) {
                    piece = this.blackPieces[col];
                    empty = false;
                } else if (row === 1 || row === 6) {
                    piece = new Pawn(row === 1 ? "white" : "black", col);
                    if (row === 1) {
                        this.whitePawns.push(piece);
                    } else {
                        this.blackPawns.push(piece);
                    }
                    empty = false;
                }

                boardRow.push({ color, piece, empty });
            }

            board.push(boardRow);
        }

        return board;
    }

    getSquare(position: Position) {
        return this.squares[position.row][position.column];
    }

    getPieces(
        name: string | null,
        color: "black" | "white",
        captured = false,
    ): Piece[] {
        if (name === null) {
            return color === "black"
                ? [
                      ...this.blackPieces.filter((pieces) => !pieces.captured),
                      ...this.blackPawns.filter((pieces) => !pieces.captured),
                  ]
                : [
                      ...this.whitePieces.filter((pieces) => !pieces.captured),
                      ...this.whitePawns.filter((pieces) => !pieces.captured),
                  ];
        }

        if (name === "") {
            const pawns = color === "black" ? this.blackPawns : this.whitePawns;
            return pawns.filter((piece) => piece.captured === captured);
        }

        const pieces = color === "black" ? this.blackPieces : this.whitePieces;
        return pieces.filter(
            (piece) => piece.name === name && piece.captured === captured,
        );
    }

    setTurn(turn: "black" | "white") {
        this.turn = turn;
    }

    setRound(round: number) {
        this.round = round;
    }

    replacePiece(pieceToReplace: Piece, newPiece: Piece) {
        this.squares[pieceToReplace.position.row][
            pieceToReplace.position.column
        ].piece = newPiece;

        const pawns =
            pieceToReplace.color === "white"
                ? this.whitePawns
                : this.blackPawns;
        const pieces =
            pieceToReplace.color === "white"
                ? this.whitePieces
                : this.blackPieces;
        const index = pawns.indexOf(pieceToReplace);

        if (index > -1) {
            pawns.splice(index, 1);
            pieces.push(newPiece);
        }
    }
}

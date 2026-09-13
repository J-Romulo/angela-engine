import { Bishop } from "../pieces/Bishop";
import { King } from "../pieces/King";
import { Knight } from "../pieces/Knight";
import { Pawn } from "../pieces/Pawn";
import { Movement, Piece, Position } from "../pieces/Piece";
import { Queen } from "../pieces/Queen";
import { Rook } from "../pieces/Rook";
import {
    CASTLING,
    CASTLING_INDEX,
    CastlingRight,
    EN_PASSANT,
    PIECE_SQUARE,
    pieceSquareIndex,
    TURN,
} from "../zobrist";

export type PositionRecord = {
    hash: bigint;
    valuation: number;
    repeated: number;
};

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

    positions: Map<bigint, { valuation: number; repeated: number }> = new Map();

    castlingRights: Record<CastlingRight, boolean> = {
        whiteKing: true,
        whiteQueen: true,
        blackKing: true,
        blackQueen: true,
    };

    enPassantColumn: number | null = null;

    hash = 0n;

    private movementsCache: Map<Piece, Movement[] | undefined> = new Map();
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
        this.hash = this.recomputeHash();
    }

    movementsOf(piece: Piece): Movement[] | undefined {
        if (this.movementsCache.has(piece)) {
            return this.movementsCache.get(piece);
        }

        const movements = piece.validMovements(this);
        this.movementsCache.set(piece, movements);

        return movements;
    }

    clearMovementsCache() {
        this.movementsCache.clear();
    }

    togglePieceAt(piece: Piece, square: { row: number; column: number }) {
        this.hash ^= PIECE_SQUARE[pieceSquareIndex(piece, square)];
    }

    toggleTurn() {
        this.hash ^= TURN;
    }

    toggleCastlingRight(right: CastlingRight) {
        this.hash ^= CASTLING[CASTLING_INDEX[right]];
    }

    toggleEnPassantColumn(column: number) {
        this.hash ^= EN_PASSANT[column];
    }

    recomputeHash(): bigint {
        let hash = 0n;

        for (const color of ["white", "black"] as const) {
            for (const piece of this.getPieces(null, color, false)) {
                hash ^= PIECE_SQUARE[pieceSquareIndex(piece, piece.position)];
            }
        }

        if (this.turn === "white") hash ^= TURN;

        for (const right of Object.keys(CASTLING_INDEX) as CastlingRight[]) {
            if (this.castlingRights[right]) {
                hash ^= CASTLING[CASTLING_INDEX[right]];
            }
        }

        if (this.enPassantColumn !== null) {
            hash ^= EN_PASSANT[this.enPassantColumn];
        }

        return hash;
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

    savePosition(): PositionRecord {
        const hashString = this.hash;

        if (this.positions.has(hashString)) {
            const positionData = this.positions.get(hashString)!;
            positionData.repeated += 1;
            this.positions.set(hashString, positionData);

            return {
                hash: hashString,
                valuation: positionData.valuation,
                repeated: positionData.repeated,
            };
        } else {
            this.positions.set(hashString, {
                valuation: 0,
                repeated: 1,
            });

            return {
                hash: hashString,
                valuation: 0,
                repeated: 1,
            };
        }
    }

    getPositionString(): string {
        let hashString = this.turn;

        const whitePieces = [
            ...this.whitePieces.filter((piece) => !piece.captured),
            ...this.whitePawns.filter((piece) => !piece.captured),
        ];
        const blackPieces = [
            ...this.blackPieces.filter((piece) => !piece.captured),
            ...this.blackPawns.filter((piece) => !piece.captured),
        ];

        for (const piece of [...whitePieces, ...blackPieces]) {
            hashString += `${piece.name}${piece.color}${piece.position.row}${piece.position.column}`;
        }

        const { whiteKing, whiteQueen, blackKing, blackQueen } =
            this.castlingRights;

        hashString += `|${whiteKing ? "K" : ""}${whiteQueen ? "Q" : ""}${
            blackKing ? "k" : ""
        }${blackQueen ? "q" : ""}`;
        hashString += `|${this.enPassantColumn ?? "-"}`;

        return hashString;
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
        if (turn !== this.turn) this.toggleTurn();
        this.turn = turn;
    }

    setRound(round: number) {
        this.round = round;
    }

    replacePiece(pieceToReplace: Piece, newPiece: Piece) {
        this.togglePieceAt(pieceToReplace, pieceToReplace.position);
        this.togglePieceAt(newPiece, pieceToReplace.position);

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

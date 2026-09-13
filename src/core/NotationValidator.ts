/* eslint-disable no-useless-escape */
import { Movement } from "./pieces/Piece";

export class NotationValidator {
    // Castling (O-O for kingside, O-O-O for queenside)
    static readonly KING_CASTLING = /^O-O?$/;
    static readonly QUEEN_CASTLING = /^O-O-O?$/;

    // Comprehensive pattern that matches most standard algebraic notation
    static readonly ALGEBRAIC_NOTATION =
        /^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[\+#]?(?:\s+e\.p\.)?$/;

    static isValidMove(notation: string): boolean {
        return this.ALGEBRAIC_NOTATION.test(notation.trim());
    }

    static getMoveType(notation: string): Movement["type"] {
        const move = notation.trim();

        if (this.KING_CASTLING.test(move.replace(/[\+#]/, ""))) {
            return "king_castling";
        }

        if (this.QUEEN_CASTLING.test(move.replace(/[\+#]/, ""))) {
            return "queen_castling";
        }

        if (move.includes("x")) {
            if (move.includes("=")) {
                return "promotion_capture";
            }
            if (move.includes("e.p.")) {
                return "en_passant";
            }
            return "capture";
        }

        if (move.includes("=")) {
            return "promotion";
        }

        return "move";
    }

    static getDestinationSquare(notation: string): string | null {
        // Remove check/checkmate symbols and promotion
        const cleanMove = notation
            .replace(/[\+#].*$/, "")
            .replace(/=[QRBN]/, "");

        // Handle castling
        if (this.KING_CASTLING.test(cleanMove)) {
            return null; // Castling doesn't have a single destination square
        }

        // Extract the destination square (last two characters that match square pattern)
        const match = cleanMove.match(/[a-h][1-8]$/);
        return match ? match[0] : null;
    }

    static readonly SAN_MOVE =
        /^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])(?:=[QRBN])?[\+#]?(?:\s*e\.p\.)?$/;

    static getPieceSymbol(notation: string): {
        pieceSymbol: string | null;
        ambiguousColumn?: string | null;
        ambiguousRow?: string | null;
    } {
        const match = notation.trim().match(this.SAN_MOVE);

        if (!match) {
            return {
                pieceSymbol: null,
                ambiguousColumn: null,
                ambiguousRow: null,
            };
        }

        const [, piece, column, row] = match;

        return {
            // Sem letra de peca, e peao - que `getValidPieces` representa por "".
            pieceSymbol: piece ?? "",
            ambiguousColumn: column ?? null,
            ambiguousRow: row ?? null,
        };
    }
}

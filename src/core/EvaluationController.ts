/* eslint-disable prettier/prettier */
import { Board } from "./board/Board";

export class EvaluationController {
    static evaluatePosition(board: Board, turn: "white" | "black", currentPlayerValidMoves: number, opponentValidMoves: number): number {
        const currentPlayerPieces = board.getPieces(null, turn, false);
        const opponentColor = turn === "white" ? "black" : "white";
        const opponentPieces = board.getPieces(null, opponentColor, false);

        const currentNumBishops = currentPlayerPieces.filter((piece) => piece.name === "B").length;
        const currentNumKnights = currentPlayerPieces.filter((piece) => piece.name === "N").length;
        const currentNumRooks = currentPlayerPieces.filter((piece) => piece.name === "R").length;
        const currentNumQueens = currentPlayerPieces.filter((piece) => piece.name === "Q").length;
        const currentNumPawns = currentPlayerPieces.filter((piece) => piece.name === "").length;
        const currentNumKings = currentPlayerPieces.filter((piece) => piece.name === "K").length;

        const opponentNumBishops = opponentPieces.filter((piece) => piece.name === "B").length;
        const opponentNumKnights = opponentPieces.filter((piece) => piece.name === "N").length;
        const opponentNumRooks = opponentPieces.filter((piece) => piece.name === "R").length;
        const opponentNumQueens = opponentPieces.filter((piece) => piece.name === "Q").length;
        const opponentNumPawns = opponentPieces.filter((piece) => piece.name === "").length;
        const opponentNumKings = opponentPieces.filter((piece) => piece.name === "K").length;
        

        return (
            200 * (currentNumKings - opponentNumKings) +
            9 * (currentNumQueens - opponentNumQueens) +
            5 * (currentNumRooks - opponentNumRooks) +
            3 * ( (currentNumBishops - opponentNumBishops) + (currentNumKnights - opponentNumKnights)) +
            1 * (currentNumPawns - opponentNumPawns) +
            0.1 * (currentPlayerValidMoves - opponentValidMoves)
        )
    }
}
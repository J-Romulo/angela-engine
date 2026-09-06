import { Board } from "./board/Board";
import { EvaluationController } from "./EvaluationController";
import { MovementController } from "./MovementController";
import { Movement, Piece } from "./pieces/Piece";

const MAX_DEPTH = 3;
const MATE = 1_000_000;

type SearchResult = {
    piece: Piece | null;
    move: Movement | null;
    evaluation: number;
};
export class SearchController {
    static search(board: Board, turn: "white" | "black") {
        return this.searchBestMove(board, turn);
    }

    static searchBestMove(
        board: Board,
        turn: "white" | "black",
        alpha = -Infinity,
        beta = +Infinity,
        depth = MAX_DEPTH,
    ): SearchResult {
        const opponent = turn === "white" ? "black" : "white";
        const bestPieceAndMove: SearchResult = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        };
        const currentPlayerPieces = board.getPieces(null, turn, false);

        movesLoop: for (const piece of currentPlayerPieces) {
            const validMovements = piece.validMovements(board, false);
            for (const movement of validMovements || []) {
                const boardCopy = this.makeNewBoard(board, piece, movement);
                const movementController = new MovementController(boardCopy);

                const opponentIsStuck = movementController.verifyNoValidMoves();

                let evaluation: number;
                if (opponentIsStuck) {
                    evaluation = movement.check ? MATE + depth : 0;
                } else if (depth <= 1) {
                    evaluation = EvaluationController.evaluatePosition(
                        boardCopy,
                        turn,
                        this.countMoves(boardCopy, turn),
                        this.countMoves(boardCopy, opponent),
                    );
                } else {
                    evaluation = -this.searchBestMove(
                        boardCopy,
                        opponent,
                        -beta,
                        -alpha,
                        depth - 1,
                    ).evaluation;
                }

                if (evaluation > bestPieceAndMove.evaluation) {
                    bestPieceAndMove.evaluation = evaluation;
                    bestPieceAndMove.move = movement;
                    bestPieceAndMove.piece = piece;

                    if (evaluation > alpha) {
                        alpha = evaluation;
                    }
                }

                if (evaluation >= beta) {
                    break movesLoop;
                }
            }
        }

        return bestPieceAndMove;
    }

    private static makeNewBoard(
        board: Board,
        piece: Piece,
        movement: Movement,
    ): Board {
        const boardCopy = board.clone();
        const pieceCopy = boardCopy.getSquare(piece.position).piece;

        const movementController = new MovementController(boardCopy);
        movementController.applyMovement(pieceCopy!, movement);

        return boardCopy;
    }

    private static countMoves(board: Board, color: "white" | "black"): number {
        return board
            .getPieces(null, color, false)
            .reduce(
                (total, p) =>
                    total + (p.validMovements(board, false)?.length ?? 0),
                0,
            );
    }
}

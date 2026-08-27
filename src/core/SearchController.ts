import { Board } from "./board/Board";
import { EvaluationController } from "./EvaluationController";
import { MovementController } from "./MovementController";
import { Movement, Piece } from "./pieces/Piece";

export class SearchController {
    static search(board: Board, turn: "white" | "black") {
        const currentPlayerPieces = board.getPieces(null, turn, false);

        const bestPieceAndMove: {
            piece: Piece | null;
            move: Movement | null;
            evaluation: number;
        } = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        };

        for (const piece of currentPlayerPieces) {
            const validMovements = piece.validMovements(board, false);

            let biggerEvaluation = -Infinity;
            let bestMove: Movement | null = null;
            for (const movement of validMovements || []) {
                const boardCopy = board.clone();
                const pieceCopy = boardCopy.getSquare(piece.position).piece;

                const movementController = new MovementController(boardCopy);
                movementController.applyMovement(pieceCopy!, movement);

                let opponentValidMoves = 0;
                const opponentPieces = boardCopy.getPieces(
                    null,
                    turn === "white" ? "black" : "white",
                    false,
                );
                for (const piece of opponentPieces) {
                    const validMovements = piece.validMovements(
                        boardCopy,
                        false,
                    );
                    opponentValidMoves += validMovements
                        ? validMovements.length
                        : 0;
                }

                let currentPlayerValidMoves = 0;
                for (const piece of currentPlayerPieces) {
                    const validMovements = piece.validMovements(
                        boardCopy,
                        false,
                    );
                    currentPlayerValidMoves += validMovements
                        ? validMovements.length
                        : 0;
                }

                const opponentHasNoMoves =
                    movementController.verifyNoValidMoves();

                // No reply and we are giving check: mate, nothing scores higher.
                if (opponentHasNoMoves && movement.check) {
                    return {
                        piece,
                        move: movement,
                        evaluation: Infinity,
                    };
                }

                // No reply and no check: stalemate. Score it as a draw and let
                // it compete, rather than returning it as the answer.
                const evaluation = opponentHasNoMoves
                    ? 0
                    : EvaluationController.evaluatePosition(
                          boardCopy,
                          turn,
                          currentPlayerValidMoves,
                          opponentValidMoves,
                      );

                if (evaluation > biggerEvaluation) {
                    biggerEvaluation = evaluation;
                    bestMove = movement;
                }
            }

            if (biggerEvaluation > bestPieceAndMove.evaluation) {
                bestPieceAndMove.piece = piece;
                bestPieceAndMove.move = bestMove;
                bestPieceAndMove.evaluation = biggerEvaluation;
            }
        }

        return bestPieceAndMove;
    }
}

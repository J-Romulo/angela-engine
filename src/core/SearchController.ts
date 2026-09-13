import { Board } from "./board/Board";
import { EvaluationController } from "./EvaluationController";
import { MovementController } from "./MovementController";
import { Movement, Piece, Position } from "./pieces/Piece";

const MAX_DEPTH = 4;
const MATE = 1_000_000;
const TT_MOVE_SCORE = 1000;

type TTEntry = {
    depth: number;
    from: Position;
    move: Movement;
};

type ScoredMove = {
    piece: Piece;
    movement: Movement;
};

type SearchResult = {
    piece: Piece | null;
    move: Movement | null;
    evaluation: number;
};

const CAPTURE_BASE = 100;
const PROMOTION_BONUS = 90;
const CASTLING_BONUS = 20;
const CHECK_BONUS = 25;

export class SearchController {
    static search(board: Board, turn: "white" | "black") {
        let bestMove = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        } as SearchResult;

        const transpositionTable = new Map<bigint, TTEntry>();
        const rootKey = board.hash;

        for (let i = 1; i <= MAX_DEPTH; i++) {
            bestMove = this.searchBestMove(
                board,
                turn,
                -Infinity,
                +Infinity,
                i,
                transpositionTable,
                rootKey,
            );
        }
        return bestMove;
    }

    static searchBestMove(
        board: Board,
        turn: "white" | "black",
        alpha = -Infinity,
        beta = +Infinity,
        depth = MAX_DEPTH,
        transpositionTable: Map<bigint, TTEntry> = new Map(),
        rootKey: bigint = board.hash,
    ): SearchResult {
        const opponent = turn === "white" ? "black" : "white";
        const bestPieceAndMove: SearchResult = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        };
        const currentPlayerPieces = board.getPieces(null, turn, false);

        const ttEntry = transpositionTable.get(rootKey);
        const allValidMoves = this.orderMoves(
            currentPlayerPieces.flatMap((piece) =>
                (board.movementsOf(piece) ?? []).map((movement) => ({
                    piece,
                    movement,
                })),
            ),
            board,
            ttEntry,
        );

        const movementController = new MovementController(board);

        for (const { piece, movement } of allValidMoves) {
            const undo = movementController.makeMovement(piece, movement);

            const opponentIsStuck = movementController.verifyNoValidMoves();

            let evaluation: number;
            if (opponentIsStuck) {
                evaluation = movement.check ? MATE + depth : 0;
            } else if (depth <= 1) {
                evaluation = EvaluationController.evaluatePosition(
                    board,
                    turn,
                    this.countMoves(board, turn),
                    this.countMoves(board, opponent),
                );
            } else {
                evaluation = -this.searchBestMove(
                    board,
                    opponent,
                    -beta,
                    -alpha,
                    depth - 1,
                    transpositionTable,
                    board.hash,
                ).evaluation;
            }

            movementController.unmakeMovement(undo);

            if (evaluation > bestPieceAndMove.evaluation) {
                bestPieceAndMove.evaluation = evaluation;
                bestPieceAndMove.move = movement;
                bestPieceAndMove.piece = piece;

                if (evaluation > alpha) {
                    alpha = evaluation;
                }
            }

            if (evaluation >= beta) {
                break;
            }
        }

        if (
            bestPieceAndMove.piece &&
            bestPieceAndMove.move &&
            (!ttEntry || depth >= ttEntry.depth)
        ) {
            transpositionTable.set(rootKey, {
                move: bestPieceAndMove.move,
                depth,
                from: { ...bestPieceAndMove.piece.position },
            });
        }

        return bestPieceAndMove;
    }

    private static orderMoves(
        moves: ScoredMove[],
        board: Board,
        ttEntry?: TTEntry,
    ): ScoredMove[] {
        function isTtMove(move: ScoredMove): boolean {
            if (!ttEntry) return false;
            return (
                move.piece.position.column === ttEntry.from.column &&
                move.piece.position.row === ttEntry.from.row &&
                move.movement.column === ttEntry.move.column &&
                move.movement.row === ttEntry.move.row &&
                move.movement.type === ttEntry.move.type
            );
        }

        function scoreMove(move: ScoredMove): number {
            if (isTtMove(move)) return TT_MOVE_SCORE;

            let score = 0;

            const victim =
                move.movement.type === "en_passant"
                    ? 1
                    : (board.getSquare({
                          row: move.movement.row,
                          column: move.movement.column,
                      }).piece?.value ?? 0);

            if (victim > 0) {
                const attacker = move.piece.value || 10;
                score += CAPTURE_BASE + victim * 10 - attacker;
            }

            if (move.movement.type.includes("promotion")) {
                score += PROMOTION_BONUS;
            }
            if (move.movement.type.includes("castling")) {
                score += CASTLING_BONUS;
            }
            if (move.movement.check) score += CHECK_BONUS;

            return score;
        }

        return [...moves].sort((a, b) => scoreMove(b) - scoreMove(a));
    }

    private static countMoves(board: Board, color: "white" | "black"): number {
        return board
            .getPieces(null, color, false)
            .reduce(
                (total, p) => total + (board.movementsOf(p)?.length ?? 0),
                0,
            );
    }
}

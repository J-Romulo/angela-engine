import { Board } from "./board/Board";
import { EvaluationController } from "./EvaluationController";
import { FIFTY_MOVE_LIMIT, MovementController } from "./MovementController";
import { Movement, Piece, Position } from "./pieces/Piece";

const MAX_DEPTH = 6;
export const MATE = 1_000_000;
const TT_MOVE_SCORE = 1000;

export const MATE_THRESHOLD = MATE - 1000;

const MAX_TT_ENTRIES = 1 << 20;

const MIN_GROWTH = 1.5;
const MAX_GROWTH = 6;
const FIRST_GROWTH_GUESS = 3;

const MIN_SOFT_LIMIT_DEPTH = 3;

/**
 * Iteracao curta demais nao da razao confiavel - com a tabela quente as
 * primeiras saem quase de graca, a razao explode e a estimativa manda parar
 * com o orcamento quase inteiro na mesa.
 */
const MIN_TRUSTED_ITERATION_MS = 30;

/** Abaixo desta fracao do orcamento sempre vale tentar mais uma. */
const ALWAYS_TRY_RATIO = 0.3;

type TTFlag = "exact" | "lower" | "upper";

type TTEntry = {
    depth: number;
    flag: TTFlag;
    score: number;
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

const QUIESCENCE_MAX_PLY = 6;

const isNoisy = (movement: Movement) =>
    movement.type === "capture" ||
    movement.type === "en_passant" ||
    movement.type.includes("promotion");

export type SearchStats = {
    depth: number;
    nodes: number;
    quiescenceNodes: number;
    ttProbes: number;
    ttHits: number;
    ttCutoffs: number;
};

export class SearchController {
    static stats: SearchStats = emptyStats();

    static useTranspositionTable = true;

    static maxDepth = MAX_DEPTH;

    private static table = new Map<bigint, TTEntry>();

    private static deadline = Infinity;
    private static stopped = false;
    private static clockCounter = 0;

    static clearTable() {
        this.table.clear();
    }

    private static outOfTime(): boolean {
        if (this.stopped) return true;
        if (this.deadline === Infinity) return false;
        if (++this.clockCounter & 1023) return false;

        if (Date.now() >= this.deadline) this.stopped = true;
        return this.stopped;
    }

    private static evictOldest() {
        const target = Math.floor(MAX_TT_ENTRIES / 4);
        let removed = 0;

        for (const key of this.table.keys()) {
            this.table.delete(key);
            if (++removed >= target) break;
        }
    }

    static search(
        board: Board,
        turn: "white" | "black",
        timeLimitMs = Infinity,
    ) {
        this.stats = emptyStats();
        this.stopped = false;
        this.clockCounter = 0;

        const startedAt = Date.now();
        this.deadline =
            timeLimitMs === Infinity ? Infinity : startedAt + timeLimitMs;

        let bestMove = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        } as SearchResult;

        let previousIterationMs = 0;

        for (let i = 1; i <= this.maxDepth; i++) {
            const iterationStartedAt = Date.now();
            const result = this.searchBestMove(
                board,
                turn,
                -Infinity,
                +Infinity,
                i,
                0,
            );

            if (this.stopped && i > 1) break;

            bestMove = result;
            this.stats.depth = i;

            if (this.stopped) break;

            // Mate forcado: aprofundar nao tem o que melhorar.
            if (Math.abs(bestMove.evaluation) > MATE_THRESHOLD) break;

            const iterationMs = Date.now() - iterationStartedAt;
            const growth =
                previousIterationMs >= MIN_TRUSTED_ITERATION_MS
                    ? Math.min(
                          MAX_GROWTH,
                          Math.max(
                              MIN_GROWTH,
                              iterationMs / previousIterationMs,
                          ),
                      )
                    : FIRST_GROWTH_GUESS;

            const spent = Date.now() - startedAt;

            if (
                i >= MIN_SOFT_LIMIT_DEPTH &&
                spent > timeLimitMs * ALWAYS_TRY_RATIO &&
                iterationMs * growth > this.deadline - Date.now()
            ) {
                break;
            }

            previousIterationMs = iterationMs;
        }

        return bestMove;
    }

    static searchBestMove(
        board: Board,
        turn: "white" | "black",
        alpha = -Infinity,
        beta = +Infinity,
        depth = MAX_DEPTH,
        ply = 0,
    ): SearchResult {
        this.stats.nodes++;

        const opponent = turn === "white" ? "black" : "white";
        const bestPieceAndMove: SearchResult = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        };

        if (this.stopped) return bestPieceAndMove;

        // Empate por 50 lances. So fora da raiz, que precisa devolver lance -
        // e so depois do mate, ja descartado pelo no de cima, que testa
        // `verifyNoValidMoves` antes de recursar.
        if (ply > 0 && board.halfmoveClock >= FIFTY_MOVE_LIMIT) {
            return { piece: null, move: null, evaluation: 0 };
        }

        const currentPlayerPieces = board.getPieces(null, turn, false);

        const alphaOriginal = alpha;
        const key = board.hash;

        this.stats.ttProbes++;
        const ttEntry = this.useTranspositionTable
            ? this.table.get(key)
            : undefined;

        if (ttEntry) {
            this.stats.ttHits++;

            if (ply > 0 && ttEntry.depth >= depth) {
                const score = scoreFromTT(ttEntry.score, ply);

                const usable =
                    ttEntry.flag === "exact" ||
                    (ttEntry.flag === "lower" && score >= beta) ||
                    (ttEntry.flag === "upper" && score <= alpha);

                if (usable) {
                    this.stats.ttCutoffs++;
                    return { piece: null, move: null, evaluation: score };
                }
            }
        }
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
            if (this.outOfTime()) break;

            const undo = movementController.makeMovement(piece, movement);

            const opponentIsStuck = movementController.verifyNoValidMoves();

            let evaluation: number;
            if (opponentIsStuck) {
                evaluation = movementController.isInCheck()
                    ? MATE - (ply + 1)
                    : 0;
            } else if (depth <= 1) {
                evaluation = -this.quiescence(
                    board,
                    opponent,
                    -beta,
                    -alpha,
                    movementController,
                    ply + 1,
                    0,
                );
            } else {
                evaluation = -this.searchBestMove(
                    board,
                    opponent,
                    -beta,
                    -alpha,
                    depth - 1,
                    ply + 1,
                ).evaluation;
            }

            movementController.unmakeMovement(undo);

            if (this.stopped) break;

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
            this.useTranspositionTable &&
            !this.stopped &&
            bestPieceAndMove.piece &&
            bestPieceAndMove.move &&
            (!ttEntry || depth >= ttEntry.depth)
        ) {
            const flag: TTFlag =
                bestPieceAndMove.evaluation <= alphaOriginal
                    ? "upper"
                    : bestPieceAndMove.evaluation >= beta
                      ? "lower"
                      : "exact";

            this.table.set(key, {
                depth,
                flag,
                score: scoreToTT(bestPieceAndMove.evaluation, ply),
                move: bestPieceAndMove.move,
                from: { ...bestPieceAndMove.piece.position },
            });

            if (this.table.size > MAX_TT_ENTRIES) this.evictOldest();
        }

        return bestPieceAndMove;
    }

    private static quiescence(
        board: Board,
        color: "white" | "black",
        alpha: number,
        beta: number,
        controller: MovementController,
        ply: number,
        quiescencePly: number,
    ): number {
        this.stats.quiescenceNodes++;

        if (this.stopped) return alpha;

        if (board.halfmoveClock >= FIFTY_MOVE_LIMIT) return 0;

        const opponent = color === "white" ? "black" : "white";
        const inCheck = controller.isInCheck(color);

        if (!inCheck) {
            // Piso do no: ninguem e obrigado a capturar. Captura so interessa
            // se bater isto.
            const standPat = EvaluationController.evaluatePosition(
                board,
                color,
            );

            if (standPat >= beta) return beta;
            if (standPat > alpha) alpha = standPat;
        } else if (quiescencePly >= QUIESCENCE_MAX_PLY) {
            return EvaluationController.evaluatePosition(board, color);
        }

        const moves = board
            .getPieces(null, color, false)
            .flatMap((piece) =>
                (board.movementsOf(piece) ?? [])
                    .filter((movement) => inCheck || isNoisy(movement))
                    .map((movement) => ({ piece, movement })),
            );

        if (moves.length === 0) {
            return inCheck ? -(MATE - ply) : alpha;
        }

        for (const { piece, movement } of this.orderMoves(moves, board)) {
            if (this.outOfTime()) break;

            const undo = controller.makeMovement(piece, movement);

            const score = -this.quiescence(
                board,
                opponent,
                -beta,
                -alpha,
                controller,
                ply + 1,
                quiescencePly + 1,
            );

            controller.unmakeMovement(undo);

            if (this.stopped) break;

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
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
}

function scoreToTT(score: number, ply: number): number {
    if (score > MATE_THRESHOLD) return score + ply;
    if (score < -MATE_THRESHOLD) return score - ply;
    return score;
}

function scoreFromTT(score: number, ply: number): number {
    if (score > MATE_THRESHOLD) return score - ply;
    if (score < -MATE_THRESHOLD) return score + ply;
    return score;
}

function emptyStats(): SearchStats {
    return {
        depth: 0,
        nodes: 0,
        quiescenceNodes: 0,
        ttProbes: 0,
        ttHits: 0,
        ttCutoffs: 0,
    };
}

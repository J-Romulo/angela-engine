import { Board } from "./board/Board";
import { EvaluationController } from "./EvaluationController";
import { FIFTY_MOVE_LIMIT, MovementController } from "./MovementController";
import { Movement, Piece, Position } from "./pieces/Piece";

export const MATE = 1_000_000;
export const MATE_THRESHOLD = MATE - 1000;

/** Teto de seguranca: quem decide onde parar e o orcamento de tempo. */
const MAX_DEPTH = 64;

const DEFAULT_TT_ENTRIES = 1 << 20;

/** Mediana medida do custo da proxima profundidade sobre o ja gasto. */
const ITERATION_GROWTH = 1.3;
const MIN_SOFT_LIMIT_DEPTH = 3;

const QUIESCENCE_MAX_PLY = 6;

/** Faixas de ordenacao, separadas para nao se misturarem. */
const TT_MOVE_SCORE = 1_000_000;
const NOISY_BASE = 100_000;
const KILLER_SCORES = [90_000, 80_000];

const CAPTURE_BASE = 100;
const PROMOTION_BONUS = 90;
const CASTLING_BONUS = 20;
const CHECK_BONUS = 25;

const KILLER_SLOTS = 2;
const MAX_HEURISTIC_PLY = 128;

/** Passando disso, a tabela de historico inteira e dividida ao meio. */
const HISTORY_LIMIT = 1 << 14;

/** Lance tardio e quieto e buscado mais raso; se surpreender, refaz cheio. */
const LMR_MIN_DEPTH = 3;
const LMR_FIRST_MOVES = 3;
const LMR_DEEP_MOVE = 8;

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

export type SearchStats = {
    depth: number;
    nodes: number;
    quiescenceNodes: number;
    ttHits: number;
    ttCutoffs: number;
};

const squareIndex = (position: Position) => position.row * 8 + position.column;

const isNoisy = (movement: Movement) =>
    movement.type === "capture" ||
    movement.type === "en_passant" ||
    movement.type.includes("promotion");

export class SearchController {
    static stats: SearchStats = emptyStats();

    static useTranspositionTable = true;

    static maxDepth = MAX_DEPTH;

    private static table = new Map<bigint, TTEntry>();

    /** Teto de entradas da tabela. O UCI expoe isto como a opcao Hash. */
    static maxTableEntries = DEFAULT_TT_ENTRIES;

    /** Indexado por ply: a mesma refutacao serve contra os lances irmaos. */
    private static killers: (Movement | undefined)[][] = [];

    /** Acumulado por cor, casa de origem e casa de destino. */
    private static history = new Int32Array(2 * 64 * 64);

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
        const target = Math.floor(this.maxTableEntries / 4);
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
        onIteration?: (
            result: SearchResult,
            depth: number,
            elapsedMs: number,
        ) => void,
    ) {
        this.stats = emptyStats();
        this.stopped = false;
        this.clockCounter = 0;
        this.resetHeuristics();

        const startedAt = Date.now();
        this.deadline =
            timeLimitMs === Infinity ? Infinity : startedAt + timeLimitMs;

        let bestMove = {
            piece: null,
            move: null,
            evaluation: -Infinity,
        } as SearchResult;

        for (let i = 1; i <= this.maxDepth; i++) {
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
            onIteration?.(result, i, Date.now() - startedAt);

            if (this.stopped) break;

            // Mate forcado: aprofundar nao tem o que melhorar.
            if (Math.abs(bestMove.evaluation) > MATE_THRESHOLD) break;

            const spent = Date.now() - startedAt;

            if (
                i >= MIN_SOFT_LIMIT_DEPTH &&
                spent * ITERATION_GROWTH > this.deadline - Date.now()
            ) {
                break;
            }
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

        // Fora da raiz apenas: a raiz precisa devolver um lance.
        if (ply > 0 && board.halfmoveClock >= FIFTY_MOVE_LIMIT) {
            return { piece: null, move: null, evaluation: 0 };
        }

        // Uma repeticao ja basta: se a linha leva a repetir, os dois lados
        // podem insistir, e o resultado pratico e empate.
        if (ply > 0 && board.isRepetition()) {
            return { piece: null, move: null, evaluation: 0 };
        }

        const alphaOriginal = alpha;
        const key = board.hash;

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
            board.getPieces(null, turn, false).flatMap((piece) =>
                (board.movementsOf(piece) ?? []).map((movement) => ({
                    piece,
                    movement,
                })),
            ),
            board,
            turn,
            ply,
            ttEntry,
        );

        const movementController = new MovementController(board);

        // Um escaneamento por no: estar em xeque desliga a reducao.
        const inCheck = movementController.isInCheck(turn);

        let index = 0;

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
                const reduction = lateMoveReduction(
                    index,
                    depth,
                    movement,
                    inCheck,
                );

                evaluation = -this.searchBestMove(
                    board,
                    opponent,
                    -beta,
                    -alpha,
                    depth - 1 - reduction,
                    ply + 1,
                ).evaluation;

                // Surpreendeu: refaz cheio, para nao aceitar valor de busca
                // rasa demais.
                if (reduction > 0 && evaluation > alpha) {
                    evaluation = -this.searchBestMove(
                        board,
                        opponent,
                        -beta,
                        -alpha,
                        depth - 1,
                        ply + 1,
                    ).evaluation;
                }
            }

            movementController.unmakeMovement(undo);
            index++;

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
                // Captura ja tem ordenacao propria.
                if (!isNoisy(movement)) {
                    this.rememberCutoff(turn, piece, movement, ply, depth);
                }

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

            if (this.table.size > this.maxTableEntries) this.evictOldest();
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
            // Piso do no: ninguem e obrigado a capturar.
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

        for (const { piece, movement } of this.orderMoves(
            moves,
            board,
            color,
            ply,
        )) {
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

    /** Killers nao sobrevivem a busca; o historico sobrevive pela metade. */
    private static resetHeuristics() {
        this.killers = Array.from({ length: MAX_HEURISTIC_PLY }, () =>
            new Array(KILLER_SLOTS).fill(undefined),
        );

        for (let i = 0; i < this.history.length; i++) this.history[i] >>= 1;
    }

    /** Chamado no corte em beta, so para lance quieto. */
    private static rememberCutoff(
        color: "black" | "white",
        piece: Piece,
        movement: Movement,
        ply: number,
        depth: number,
    ) {
        const side = color === "white" ? 0 : 1;
        const index =
            (side * 64 + squareIndex(piece.position)) * 64 +
            squareIndex(movement);

        this.history[index] += depth * depth;

        if (this.history[index] > HISTORY_LIMIT) {
            for (let i = 0; i < this.history.length; i++) this.history[i] >>= 1;
        }

        if (ply >= MAX_HEURISTIC_PLY) return;

        const slots = this.killers[ply];
        if (slots[0] && sameMove(slots[0], movement)) return;

        for (let i = KILLER_SLOTS - 1; i > 0; i--) slots[i] = slots[i - 1];
        slots[0] = movement;
    }

    private static orderMoves(
        moves: ScoredMove[],
        board: Board,
        color: "black" | "white",
        ply: number,
        ttEntry?: TTEntry,
    ): ScoredMove[] {
        const killers = ply < MAX_HEURISTIC_PLY ? this.killers[ply] : undefined;
        const history = this.history;
        const side = color === "white" ? 0 : 1;

        function isTtMove(move: ScoredMove): boolean {
            if (!ttEntry) return false;
            return (
                move.piece.position.column === ttEntry.from.column &&
                move.piece.position.row === ttEntry.from.row &&
                sameMove(ttEntry.move, move.movement)
            );
        }

        function killerRank(movement: Movement): number {
            if (!killers) return -1;

            for (let i = 0; i < killers.length; i++) {
                const killer = killers[i];
                if (killer && sameMove(killer, movement)) return i;
            }

            return -1;
        }

        function scoreMove(move: ScoredMove): number {
            if (isTtMove(move)) return TT_MOVE_SCORE;

            const victim =
                move.movement.type === "en_passant"
                    ? 1
                    : (board.getSquare({
                          row: move.movement.row,
                          column: move.movement.column,
                      }).piece?.value ?? 0);

            const promotion = move.movement.type.includes("promotion");

            if (victim > 0 || promotion) {
                let score = NOISY_BASE;

                if (victim > 0) {
                    const attacker = move.piece.value || 10;
                    score += CAPTURE_BASE + victim * 10 - attacker;
                }
                if (promotion) score += PROMOTION_BONUS;
                if (move.movement.check) score += CHECK_BONUS;

                return score;
            }

            const rank = killerRank(move.movement);
            if (rank >= 0) return KILLER_SCORES[rank];

            // Lance quieto: sobra o que o historico aprendeu na partida.
            let score =
                history[
                    (side * 64 + squareIndex(move.piece.position)) * 64 +
                        squareIndex(move.movement)
                ];

            if (move.movement.type.includes("castling")) {
                score += CASTLING_BONUS;
            }
            if (move.movement.check) score += CHECK_BONUS;

            return score;
        }

        return [...moves].sort((a, b) => scoreMove(b) - scoreMove(a));
    }
}

/** Quanto tirar da profundidade deste lance. Zero significa buscar cheio. */
function lateMoveReduction(
    index: number,
    depth: number,
    movement: Movement,
    inCheck: boolean,
): number {
    if (depth < LMR_MIN_DEPTH) return 0;
    if (index < LMR_FIRST_MOVES) return 0;
    if (inCheck || movement.check || isNoisy(movement)) return 0;

    const reduction = index >= LMR_DEEP_MOVE && depth >= 6 ? 2 : 1;

    // A busca reduzida nunca pode cair abaixo de profundidade 1.
    return Math.min(reduction, depth - 2);
}

function sameMove(a: Movement, b: Movement): boolean {
    return a.row === b.row && a.column === b.column && a.type === b.type;
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
        ttHits: 0,
        ttCutoffs: 0,
    };
}

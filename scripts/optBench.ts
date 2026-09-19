import { EvaluationController } from "../src/core/engine/Evaluation";
import { prepareBoardFromPosition } from "../src/core/chess/notation/Fen";
import { SearchController } from "../src/core/engine/Search";

/**
 * Custo do delta pruning e do cache de avaliacao, isolados e juntos. As quatro
 * linhas tem que devolver os mesmos scores; score diferente na linha do delta e
 * margem curta demais.
 */
const DEPTH = Number(process.argv[2] ?? 4);

const BENCH: [string, string][] = [
    ["inicial", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    [
        "kiwipete",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    ],
    [
        "meio-jogo",
        "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    ],
    ["final de peoes", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"],
];

const CONFIGS: [string, boolean, boolean][] = [
    ["nenhum", false, false],
    ["delta", true, false],
    ["cache", false, true],
    ["ambos", true, true],
];

SearchController.maxDepth = DEPTH;

for (const [label, delta, cache] of CONFIGS) {
    SearchController.useDeltaPruning = delta;
    EvaluationController.useCache = cache;

    let totalMs = 0;
    let totalNodes = 0;
    let totalQuiescence = 0;
    const scores: string[] = [];

    for (const [, fen] of BENCH) {
        SearchController.clearTable();
        EvaluationController.clearCache();
        EvaluationController.resetStats();

        const board = prepareBoardFromPosition(fen);
        const startedAt = Date.now();
        const result = SearchController.search(board, board.turn);

        totalMs += Date.now() - startedAt;
        totalNodes += SearchController.stats.nodes;
        totalQuiescence += SearchController.stats.quiescenceNodes;
        scores.push((result.evaluation / 100).toFixed(2));
    }

    const { computed, cacheHits } = EvaluationController.stats;
    const hitRate =
        computed + cacheHits > 0
            ? ((cacheHits / (computed + cacheHits)) * 100).toFixed(0)
            : "-";

    console.log(
        `${label.padEnd(8)}` +
            `${String(totalNodes).padStart(8)} nos` +
            `${String(totalQuiescence).padStart(9)} quiesc` +
            `${String(totalMs).padStart(7)} ms` +
            `  acerto de cache ${hitRate.padStart(3)}%` +
            `  scores ${scores.join(" ")}`,
    );
}

SearchController.useDeltaPruning = true;
EvaluationController.useCache = true;

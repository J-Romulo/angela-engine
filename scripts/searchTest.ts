import { prepareBoardFromPosition } from "../src/application/Perft";
import { MovementController } from "../src/core/MovementController";
import { MATE, SearchController } from "../src/core/SearchController";

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

/** Mate em 1: o score tem que ser exatamente MATE - 1, em qualquer profundidade. */
const MATES: [string, string][] = [
    ["descoberta de cavalo", "R3N1k1/5ppp/8/8/8/8/8/6K1 w - - 0 1"],
    ["descoberta de rei", "k7/3N4/K7/8/8/8/8/R7 w - - 0 1"],
    ["dama, com afogamento ao lado", "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1"],
];

const square = (position: { row: number; column: number }) =>
    `${"abcdefgh"[position.column]}${position.row + 1}`;

type Result = ReturnType<typeof SearchController.search>;

const moveLabel = (result: Result) =>
    result.piece
        ? `${result.piece.name || "P"}${square(result.piece.position)}-${square(result.move!)}`
        : "-";

function run(fen: string, cold = true) {
    // Sem limpar, a medicao herda o trabalho da posicao anterior.
    if (cold) SearchController.clearTable();

    const board = prepareBoardFromPosition(fen);
    const startedAt = Date.now();
    const result = SearchController.search(board, board.turn);

    return {
        board,
        result,
        elapsed: Date.now() - startedAt,
        stats: SearchController.stats,
        label: moveLabel(result),
    };
}

function benchmark() {
    console.log(`\n=== BENCHMARK (depth ${DEPTH}) ===`);
    console.log(
        "posicao          TT     nos  quiesc   ttHit  ttCut     ms  lance      eval",
    );

    for (const [name, fen] of BENCH) {
        for (const useTt of [true, false]) {
            SearchController.useTranspositionTable = useTt;
            const { result, elapsed, stats, label } = run(fen);

            console.log(
                `${name.padEnd(15)} ${(useTt ? "on" : "off").padEnd(4)}` +
                    `${String(stats.nodes).padStart(7)}` +
                    `${String(stats.quiescenceNodes).padStart(8)}` +
                    `${String(stats.ttHits).padStart(8)}` +
                    `${String(stats.ttCutoffs).padStart(7)}` +
                    `${String(elapsed).padStart(7)}` +
                    `  ${label.padEnd(9)}` +
                    `${(result.evaluation / 100).toFixed(2).padStart(10)}`,
            );
        }
    }

    SearchController.useTranspositionTable = true;
}

function mateSuite() {
    console.log(`\n=== MATE EM 1 ===`);
    let failed = 0;

    for (const [name, fen] of MATES) {
        const { board, result, label } = run(fen);

        // O lance escolhido tem que dar mate de verdade, nao so pontuar como tal.
        const controller = new MovementController(board);
        const log = console.log;
        console.log = () => {};
        controller.applyMovement(result.piece!, result.move!);
        console.log = log;
        const status = controller.gameStatus();

        const scoreOk = result.evaluation === MATE - 1;
        const mateOk = status === "checkmate";
        if (!scoreOk || !mateOk) failed++;

        console.log(
            `${scoreOk && mateOk ? "OK    " : "FALHOU"}  ${name.padEnd(30)}` +
                ` ${label.padEnd(9)} ${status.padEnd(10)}` +
                ` score=${result.evaluation} (esperado ${MATE - 1})`,
        );
    }

    return failed;
}

/** Segunda busca, com a tabela quente, tem que chegar no mesmo resultado. */
function warmTableSuite() {
    console.log(`\n=== TABELA QUENTE ===`);
    let failed = 0;

    for (const [name, fen] of BENCH) {
        const first = run(fen);
        const second = run(fen, false);

        const ok =
            first.label === second.label &&
            first.result.evaluation === second.result.evaluation;
        if (!ok) failed++;

        console.log(
            `${ok ? "OK    " : "FALHOU"}  ${name.padEnd(15)}` +
                ` 1a: ${first.label.padEnd(9)} ${(first.result.evaluation / 100).toFixed(2).padStart(8)}` +
                `  ${String(first.stats.nodes).padStart(7)} nos` +
                ` | 2a: ${second.label.padEnd(9)} ${(second.result.evaluation / 100).toFixed(2).padStart(8)}` +
                `  ${String(second.stats.nodes).padStart(7)} nos`,
        );
    }

    return failed;
}

/** O relogio tem que ser o limite, nao a profundidade. */
function timeSuite() {
    console.log(`
=== ORCAMENTO DE TEMPO ===`);

    let failed = 0;
    const previous = SearchController.maxDepth;
    SearchController.maxDepth = 20;

    for (const [name, fen] of BENCH) {
        for (const budget of [300, 1500]) {
            SearchController.clearTable();

            const board = prepareBoardFromPosition(fen);
            const hashBefore = board.hash;

            const startedAt = Date.now();
            const result = SearchController.search(board, board.turn, budget);
            const elapsed = Date.now() - startedAt;
            const depth = SearchController.stats.depth;

            const inBudget = elapsed <= budget * 1.3 + 100;
            const hasMove = result.move !== null && result.piece !== null;
            const intact = board.hash === hashBefore;
            const ok = inBudget && hasMove && intact;

            if (!ok) failed++;

            console.log(
                `${ok ? "OK    " : "FALHOU"}  ${name.padEnd(15)}` +
                    ` orcamento ${String(budget).padStart(4)}ms` +
                    ` gastou ${String(elapsed).padStart(5)}ms` +
                    ` depth ${String(depth).padStart(2)}` +
                    `  lance ${hasMove ? moveLabel(result).padEnd(9) : "NENHUM   "}` +
                    ` tabuleiro ${intact ? "intacto" : "CORROMPIDO"}`,
            );
        }
    }

    SearchController.maxDepth = previous;
    return failed;
}

/**
 * Aborto nao pode deixar valor de subarvore cortada na tabela.
 *
 * As tres buscas usam a MESMA profundidade de propria: com teto maior, o
 * aborto deixaria entradas mais fundas que a verificacao, e a diferenca no
 * resultado seria legitima - conhecimento melhor, nao lixo.
 */
function poisonSuite() {
    console.log(`
=== TABELA APOS ABORTO ===`);

    let failed = 0;

    // Abaixo de 5 o aborto deixa poucas entradas e o teste perde o dente.
    const previous = SearchController.maxDepth;
    SearchController.maxDepth = Math.max(DEPTH, 5);

    for (const [name, fen] of BENCH) {
        SearchController.clearTable();
        const cleanBoard = prepareBoardFromPosition(fen);
        const startedAt = Date.now();
        const clean = SearchController.search(cleanBoard, cleanBoard.turn);

        // Fracao do tempo real: garante aborto no meio da ultima iteracao, que
        // e onde o maior numero de nos fica pela metade.
        const budget = Math.max(20, Math.floor((Date.now() - startedAt) * 0.6));

        SearchController.clearTable();
        const abortBoard = prepareBoardFromPosition(fen);
        SearchController.search(abortBoard, abortBoard.turn, budget);

        // Mesma busca da primeira linha, agora com a tabela suja do aborto.
        const dirtyBoard = prepareBoardFromPosition(fen);
        const dirty = SearchController.search(dirtyBoard, dirtyBoard.turn);

        const ok =
            moveLabel(clean) === moveLabel(dirty) &&
            clean.evaluation === dirty.evaluation;
        if (!ok) failed++;

        console.log(
            `${ok ? "OK    " : "FALHOU"}  ${name.padEnd(15)}` +
                ` limpa: ${moveLabel(clean).padEnd(9)} ${(clean.evaluation / 100).toFixed(2).padStart(8)}` +
                ` | suja: ${moveLabel(dirty).padEnd(9)} ${(dirty.evaluation / 100).toFixed(2).padStart(8)}`,
        );
    }

    SearchController.maxDepth = previous;
    return failed;
}

SearchController.maxDepth = DEPTH;

benchmark();
const failed = mateSuite() + warmTableSuite() + timeSuite() + poisonSuite();

console.log(`\n${failed === 0 ? "tudo passou" : `${failed} falharam`}`);
process.exitCode = failed === 0 ? 0 : 1;

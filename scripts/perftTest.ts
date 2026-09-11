import { perft } from "../src/application/Perft";

type PerftCase = {
    name: string;
    fen: string;
    nodes: number[];
};

const CASES: PerftCase[] = [
    {
        name: "1. posicao inicial",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        nodes: [20, 400, 8902, 197281, 4865609],
    },
    {
        name: "2. Kiwipete (roque, xeque, muita peca)",
        fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        nodes: [48, 2039, 97862, 4085603],
    },
    {
        name: "3. final de peoes (en passant, promocao)",
        fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
        nodes: [14, 191, 2812, 43238, 674624],
    },
    {
        name: "4. promocoes e roque parcial",
        fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        nodes: [6, 264, 9467, 422333],
    },
    {
        name: "5. posicao 4 espelhada",
        fen: "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1",
        nodes: [6, 264, 9467, 422333],
    },
    {
        name: "6. posicao travada",
        fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
        nodes: [44, 1486, 62379, 2103487],
    },
    {
        name: "7. meio-jogo simetrico",
        fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
        nodes: [46, 2079, 89890, 3894594],
    },
];

const MAX_DEPTH = Number(process.argv[2] ?? 2);

function run() {
    let passed = 0;
    let failed = 0;

    for (const testCase of CASES) {
        console.log(`\n${testCase.name}`);
        console.log(`   ${testCase.fen}`);

        const depths = Math.min(MAX_DEPTH, testCase.nodes.length);

        for (let depth = 1; depth <= depths; depth++) {
            const expected = testCase.nodes[depth - 1];
            const startedAt = Date.now();
            const nodes = perft(depth, testCase.fen);
            const elapsed = Date.now() - startedAt;

            const ok = nodes === expected;
            if (ok) passed++;
            else failed++;

            const diff = nodes - expected;
            console.log(
                `   perft(${depth}) = ${String(nodes).padStart(8)}` +
                    `  esperado ${String(expected).padStart(8)}` +
                    `  ${ok ? "OK" : `FALHOU (${diff > 0 ? "+" : ""}${diff})`}` +
                    `  ${elapsed}ms`,
            );

            if (!ok) break;
        }
    }

    console.log(`\n${passed} passaram, ${failed} falharam`);
    process.exitCode = failed === 0 ? 0 : 1;
}

run();

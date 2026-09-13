import { prepareBoardFromPosition } from "../src/application/Perft";
import { Board } from "../src/core/board/Board";
import { GameStatus, MovementController } from "../src/core/MovementController";

type CheckCase = {
    name: string;
    fen: string;
    move: string;
    expected: GameStatus;
};

const CASES: CheckCase[] = [
    {
        name: "1. mate por descoberta (cavalo sai da linha da torre)",
        fen: "R3N1k1/5ppp/8/8/8/8/8/6K1 w - - 0 1",
        move: "Nd6",
        expected: "checkmate",
    },
    {
        name: "2. mate por descoberta (rei sai da linha da torre)",
        fen: "k7/3N4/K7/8/8/8/8/R7 w - - 0 1",
        move: "Kb6",
        expected: "checkmate",
    },
    {
        name: "3. mate por xeque direto",
        fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
        move: "Qf8",
        expected: "checkmate",
    },
    {
        name: "4. afogamento continua sendo afogamento",
        fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
        move: "Qf7",
        expected: "stalemate",
    },
    {
        // Centesimo meio-lance sem captura nem peao.
        name: "5. regra dos 50 lances",
        fen: "R3N1k1/5ppp/8/8/8/8/8/6K1 w - - 99 1",
        move: "Kg2",
        expected: "fifty_moves",
    },
    {
        // Mate tem precedencia sobre o relogio.
        name: "6. mate no centesimo meio-lance",
        fen: "R3N1k1/5ppp/8/8/8/8/8/6K1 w - - 99 1",
        move: "Nd6",
        expected: "checkmate",
    },
    {
        // Captura zera o relogio.
        name: "7. captura no nonagesimo nono",
        fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 99 1",
        move: "dxe6",
        expected: "ongoing",
    },
    {
        name: "8. material insuficiente: rei e bispo contra rei",
        fen: "8/8/8/3k4/8/8/3r4/K1B5 w - - 0 1",
        move: "Bxd2",
        expected: "insufficient_material",
    },
    {
        // Dois cavalos nao forcam mate, mas ha mate com cooperacao: a FIDE nao
        // trata como posicao morta.
        name: "9. dois cavalos nao sao material insuficiente",
        fen: "8/8/8/3k4/8/1NN5/3r4/K7 w - - 0 1",
        move: "Nxd2",
        expected: "ongoing",
    },
    {
        name: "10. bispos de cores diferentes seguem em jogo",
        fen: "4b3/8/8/3k4/8/8/3r4/K1B5 w - - 0 1",
        move: "Bxd2",
        expected: "ongoing",
    },
    {
        name: "11. bispos na mesma cor de casa empatam",
        fen: "5b2/8/8/3k4/8/8/3r4/K1B5 w - - 0 1",
        move: "Bxd2",
        expected: "insufficient_material",
    },
    {
        name: "12. posicao normal segue em jogo",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        move: "e4",
        expected: "ongoing",
    },
];

function silenced<T>(action: () => T): T {
    const log = console.log;
    console.log = () => {};
    try {
        return action();
    } finally {
        console.log = log;
    }
}

/** Cavalos indo e voltando: a posicao inicial se repete a cada quatro lances. */
const REPETITION_LINE = [
    "Nf3",
    "Nf6",
    "Ng1",
    "Ng8", // 2a ocorrencia da posicao inicial
    "Nf3",
    "Nf6",
    "Ng1",
    "Ng8", // 3a ocorrencia
];

function repetitionSuite(): number {
    const board = new Board();
    const controller = new MovementController(board);
    let failed = 0;

    console.log();
    console.log("repeticao: cavalos indo e voltando");

    REPETITION_LINE.forEach((move, index) => {
        silenced(() => controller.executeMovement(move));

        const ply = index + 1;
        const expectedCount = ply === 4 ? 2 : ply === 8 ? 3 : null;
        const expectedStatus = ply === 8 ? "threefold" : "ongoing";

        const count = board.repetitionCount();
        const status = controller.gameStatus(count);

        // So os plies 4 e 8 voltam a posicao inicial; o resto e posicao nova.
        const ok =
            status === expectedStatus &&
            (expectedCount === null || count === expectedCount);

        if (!ok) failed++;

        if (expectedCount !== null || !ok) {
            const expectation = expectedCount
                ? `${expectedStatus}, ${expectedCount} ocorrencias`
                : expectedStatus;

            console.log(
                `   ${ok ? "OK    " : "FALHOU"} apos ${move.padEnd(4)}` +
                    ` ocorrencias=${count} status=${status}` +
                    ` (esperado ${expectation})`,
            );
        }
    });

    return failed;
}

function run() {
    let passed = 0;
    let failed = 0;

    for (const testCase of CASES) {
        const board = prepareBoardFromPosition(testCase.fen);
        const controller = new MovementController(board);

        silenced(() => controller.executeMovement(testCase.move));
        const status = controller.gameStatus();

        const ok = status === testCase.expected;
        if (ok) passed++;
        else failed++;

        console.log(`\n${testCase.name}`);
        console.log(`   ${testCase.fen}`);
        console.log(
            `   ${testCase.move.padEnd(5)} ${status.padEnd(10)}` +
                `  esperado ${testCase.expected.padEnd(10)}` +
                `  ${ok ? "OK" : "FALHOU"}`,
        );
    }
    failed += repetitionSuite();

    console.log(`\n${passed} passaram, ${failed} falharam`);
    process.exitCode = failed === 0 ? 0 : 1;
}

run();

import { prepareBoardFromPosition } from "../src/application/Perft";
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
        name: "5. posicao normal segue em jogo",
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

    console.log(`\n${passed} passaram, ${failed} falharam`);
    process.exitCode = failed === 0 ? 0 : 1;
}

run();

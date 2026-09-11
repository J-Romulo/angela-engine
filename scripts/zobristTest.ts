import { Board } from "../src/core/board/Board";
import { MovementController } from "../src/core/MovementController";
import { prepareBoardFromPosition } from "../src/application/Perft";

const POSITIONS: [string, string][] = [
    ["inicial", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    [
        "Kiwipete",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    ],
    ["final de peoes", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"],
    [
        "promocoes",
        "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    ],
    ["travada", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"],
];

const DEPTH = Number(process.argv[2] ?? 3);

const hashByString = new Map<string, bigint>();
const stringByHash = new Map<bigint, string>();

let nodes = 0;
let driftErrors = 0;
let identityErrors = 0;

function check(board: Board, line: string[]) {
    nodes++;

    const fromScratch = board.recomputeHash();
    if (fromScratch !== board.hash) {
        if (driftErrors++ < 3) {
            console.log(`\nXOR PERDIDO apos: ${line.join(" ") || "(raiz)"}`);
            console.log(`   incremental: ${board.hash}`);
            console.log(`   do zero    : ${fromScratch}`);
        }
        return;
    }

    const asString = board.getPositionString();
    const seenHash = hashByString.get(asString);
    const seenString = stringByHash.get(board.hash);

    if (seenHash !== undefined && seenHash !== board.hash) {
        if (identityErrors++ < 3) {
            console.log(
                `\nMESMA STRING, HASHES DIFERENTES apos: ${line.join(" ")}`,
            );
        }
    } else if (seenString !== undefined && seenString !== asString) {
        if (identityErrors++ < 3) {
            console.log(
                `\nMESMO HASH, STRINGS DIFERENTES apos: ${line.join(" ")}`,
            );
            console.log(`   a: ${seenString}`);
            console.log(`   b: ${asString}`);
        }
    } else {
        hashByString.set(asString, board.hash);
        stringByHash.set(board.hash, asString);
    }
}

function walk(board: Board, depth: number, line: string[]) {
    check(board, line);
    if (depth === 0 || driftErrors || identityErrors) return;

    for (const piece of board.getPieces(null, board.turn, false)) {
        for (const movement of board.movementsOf(piece) ?? []) {
            const copy = board.clone();
            const pieceCopy = copy.getSquare(piece.position).piece!;
            try {
                new MovementController(copy).applyMovement(pieceCopy, movement);
            } catch {
                continue;
            }
            walk(copy, depth - 1, [
                ...line,
                `${piece.name || "P"}${piece.position.column}${piece.position.row}-${movement.column}${movement.row}`,
            ]);
            if (driftErrors || identityErrors) return;
        }
    }
}

for (const [name, fen] of POSITIONS) {
    const before = nodes;
    const startedAt = Date.now();
    walk(prepareBoardFromPosition(fen), DEPTH, []);
    console.log(
        `${name.padEnd(16)} ${String(nodes - before).padStart(7)} nos  ${Date.now() - startedAt}ms` +
            `  ${driftErrors || identityErrors ? "FALHOU" : "OK"}`,
    );
    if (driftErrors || identityErrors) break;
}

console.log(`\n${nodes} posicoes verificadas`);
console.log(
    `hashes distintos: ${stringByHash.size} | strings distintas: ${hashByString.size}`,
);
console.log(
    driftErrors || identityErrors
        ? `FALHAS: ${driftErrors} de sincronia, ${identityErrors} de identidade`
        : "hash incremental e identidade batem em todas",
);
process.exitCode = driftErrors || identityErrors ? 1 : 0;

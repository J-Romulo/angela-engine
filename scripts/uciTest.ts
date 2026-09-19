import { prepareBoardFromPosition } from "../src/core/chess/notation/Fen";
import { Board } from "../src/core/chess/board/Board";
import { parseLan, toLan } from "../src/core/chess/notation/Lan";
import { MovementController } from "../src/core/chess/Movement";
import { UciController } from "../src/application/UciController";
import { UciView } from "../src/presentation/UciView";

const POSITIONS: [string, string][] = [
    ["inicial", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    [
        "kiwipete",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    ],
    ["en passant e promocao", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"],
    [
        "promocoes",
        "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    ],
];

/** Todo lance legal tem que sobreviver a ida e volta pela notacao longa. */
function roundTrip(board: Board, depth: number): [number, number] {
    let checked = 0;
    let failed = 0;

    const controller = new MovementController(board);
    const moves = board.getPieces(null, board.turn, false).flatMap((piece) =>
        (board.movementsOf(piece) ?? []).map((movement) => ({
            piece,
            movement,
        })),
    );

    for (const { piece, movement } of moves) {
        const lan = toLan(piece, movement);
        const parsed = parseLan(board, lan);

        // Comparacao por valor, nao por identidade: o make limpa o cache de
        // lances, e a regeracao devolve objetos novos.
        const same =
            parsed !== null &&
            parsed.piece === piece &&
            parsed.movement.row === movement.row &&
            parsed.movement.column === movement.column &&
            parsed.movement.type === movement.type &&
            parsed.movement.promotion === movement.promotion;

        checked++;
        if (!same) {
            failed++;
            console.log(
                `   FALHOU ${lan} (${movement.type}) nao voltou no mesmo lance`,
            );
        }

        if (depth > 1) {
            const undo = controller.makeMovement(piece, movement);
            const [deeper, deeperFailed] = roundTrip(board, depth - 1);
            controller.unmakeMovement(undo);

            checked += deeper;
            failed += deeperFailed;
        }
    }

    return [checked, failed];
}

function lanSuite(): number {
    console.log("=== NOTACAO LONGA ===");

    let failed = 0;

    for (const [name, fen] of POSITIONS) {
        const board = prepareBoardFromPosition(fen);
        const [checked, caseFailed] = roundTrip(board, 2);

        failed += caseFailed;
        console.log(
            `${caseFailed === 0 ? "OK    " : "FALHOU"} ${name.padEnd(22)} ${String(checked).padStart(6)} lances`,
        );
    }

    // Texto que nao e lance legal nao pode virar lance.
    const board = prepareBoardFromPosition(POSITIONS[0][1]);
    const invalid = ["e2e5", "xxxx", "e7e5", "e2", "a1a1"];

    for (const lan of invalid) {
        if (parseLan(board, lan) !== null) {
            failed++;
            console.log(`FALHOU ${lan} devia ser recusado`);
        }
    }
    console.log(`OK     ${invalid.length} lances invalidos recusados`);

    return failed;
}

const PROTOCOL_PREFIXES = [
    "id ",
    "option ",
    "uciok",
    "readyok",
    "info ",
    "bestmove ",
];

/** Roda uma sessao inteira e devolve tudo que a engine escreveu. */
function session(lines: string[]): string[] {
    const written: string[] = [];
    const view = new UciView((line) => written.push(line));
    const controller = new UciController(view);

    for (const line of lines) {
        if (!controller.handle(line)) break;
    }

    return written;
}

function expect(name: string, condition: boolean, detail = ""): number {
    console.log(
        `${condition ? "OK    " : "FALHOU"} ${name}${detail ? "  " + detail : ""}`,
    );
    return condition ? 0 : 1;
}

function protocolSuite(): number {
    console.log();
    console.log("=== PROTOCOLO ===");

    let failed = 0;

    const handshake = session(["uci"]);
    failed += expect(
        "handshake responde id e uciok",
        handshake.some((l) => l.startsWith("id name")) &&
            handshake.some((l) => l.startsWith("id author")) &&
            handshake[handshake.length - 1] === "uciok",
    );

    failed += expect(
        "isready responde readyok",
        session(["isready"]).join() === "readyok",
    );

    // Lance devolvido tem que ser legal na posicao pedida.
    const opening = session([
        "position startpos moves e2e4 e7e5",
        "go movetime 300",
    ]);
    const best = opening[opening.length - 1];
    const board = prepareBoardFromPosition(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    const movements = new MovementController(board);
    for (const lan of ["e2e4", "e7e5"]) {
        const parsed = parseLan(board, lan)!;
        movements.applyMovement(parsed.piece, parsed.movement);
    }
    failed += expect(
        "bestmove e legal na posicao",
        best.startsWith("bestmove ") &&
            parseLan(board, best.slice("bestmove ".length)) !== null,
        best,
    );

    // Mate em 1: a engine tem que ver e reportar como mate, nao como centipeoes.
    const mate = session([
        "ucinewgame",
        "position fen R3N1k1/5ppp/8/8/8/8/8/6K1 w - - 0 1",
        "go depth 3",
    ]);
    const mateMove = mate[mate.length - 1];
    failed += expect(
        "mate em 1 reportado como mate",
        mate.some((l) => l.includes("score mate 1")) &&
            ["bestmove e8d6", "bestmove e8f6"].includes(mateMove),
        mateMove,
    );

    // Qualquer linha fora do protocolo derruba a GUI.
    const everything = [...handshake, ...opening, ...mate];
    const strays = everything.filter(
        (line) => !PROTOCOL_PREFIXES.some((prefix) => line.startsWith(prefix)),
    );
    failed += expect(
        "nenhuma linha fora do protocolo",
        strays.length === 0,
        strays.join(" | "),
    );

    // Lance ilegal vindo da GUI nao pode derrubar a engine.
    const broken = session(["position startpos moves e2e5", "go movetime 100"]);
    failed += expect(
        "lance ilegal nao derruba a engine",
        broken[broken.length - 1].startsWith("bestmove "),
    );

    // Livro ligado responde na hora, sem buscar.
    const bookStartedAt = Date.now();
    const book = session([
        "setoption name OwnBook value true",
        "position startpos",
        "go movetime 3000",
    ]);
    const bookElapsed = Date.now() - bookStartedAt;
    failed += expect(
        "OwnBook responde do livro",
        book.some((l) => l === "info string book move") &&
            book[book.length - 1].startsWith("bestmove ") &&
            bookElapsed < 500,
        `${bookElapsed}ms ${book[book.length - 1]}`,
    );

    // Desligado por padrao: sem setoption, tem que buscar.
    const noBook = session(["position startpos", "go movetime 200"]);
    failed += expect(
        "sem OwnBook a engine busca",
        noBook.some((l) => l.startsWith("info depth")) &&
            !noBook.some((l) => l.includes("book move")),
    );

    // Orcamento por relogio: 4s divididos por 30, menos overhead, da ~80ms.
    const startedAt = Date.now();
    session(["position startpos", "go wtime 4000 btime 4000"]);
    const elapsed = Date.now() - startedAt;
    failed += expect(
        "orcamento sai do relogio",
        elapsed < 1000,
        `${elapsed}ms`,
    );

    return failed;
}

const failed = lanSuite() + protocolSuite();
console.log(`\n${failed === 0 ? "tudo passou" : `${failed} falharam`}`);
process.exitCode = failed === 0 ? 0 : 1;

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { writeFileSync } from "fs";
import { createInterface } from "readline";

import { Board } from "../src/core/chess/board/Board";
import { parseLan } from "../src/core/chess/notation/Lan";
import { MovementController } from "../src/core/chess/Movement";

/**
 * Match entre duas compilacoes da engine, por UCI. Processos separados porque
 * tabela, killers e historico sao estaticos: no mesmo processo um herdaria o
 * trabalho do outro.
 *
 * Uso:
 *   ts-node scripts/matchTest.ts --a <dist_a> --b <dist_b> [--movetime 200]
 *                                [--depth 4] [--games 24] [--out resumo.json]
 *
 * Com `--depth` as duas buscam igual: mede o conhecimento da avaliacao sem
 * cobrar o que ela custa. Com `--movetime`, cobra.
 */

const MOVE_TIMEOUT_SLACK_MS = 10_000;
const DEPTH_TIMEOUT_MS = 300_000;
const MAX_PLIES = 300;

type SearchLimit = { movetime: number; depth?: number };

/** Aberturas em LAN. Cada uma e jogada duas vezes, com as cores trocadas. */
const OPENINGS: string[][] = [
    ["e2e4", "e7e5"],
    ["e2e4", "c7c5"],
    ["e2e4", "e7e6"],
    ["e2e4", "c7c6"],
    ["d2d4", "d7d5"],
    ["d2d4", "g8f6"],
    ["c2c4", "e7e5"],
    ["c2c4", "c7c5"],
    ["g1f3", "d7d5"],
    ["d2d4", "d7d5", "c2c4", "c7c6"],
    ["e2e4", "e7e5", "g1f3", "b8c6"],
    ["d2d4", "g8f6", "c2c4", "e7e6"],
];

type Args = {
    a: string;
    b: string;
    movetime: number;
    depth?: number;
    games: number;
    out?: string;
};

function readArgs(): Args {
    const raw = process.argv.slice(2);
    const value = (flag: string) => {
        const at = raw.indexOf(`--${flag}`);
        return at < 0 ? undefined : raw[at + 1];
    };

    const a = value("a");
    const b = value("b");

    if (!a || !b) {
        throw new Error("faltam --a <dist_a> e --b <dist_b>");
    }

    const depth = value("depth");

    return {
        a,
        b,
        movetime: Number(value("movetime") ?? 200),
        depth: depth === undefined ? undefined : Number(depth),
        games: Number(value("games") ?? OPENINGS.length * 2),
        out: value("out"),
    };
}

class UciEngine {
    private readonly process: ChildProcessWithoutNullStreams;
    private readonly lines: string[] = [];
    private waiter: ((line: string) => void) | null = null;

    constructor(
        readonly name: string,
        distPath: string,
    ) {
        this.process = spawn(process.execPath, [distPath, "--uci"], {
            stdio: ["pipe", "pipe", "pipe"],
        });

        createInterface({ input: this.process.stdout }).on("line", (line) => {
            this.lines.push(line);
            this.waiter?.(line);
        });

        this.process.stderr.on("data", (chunk: Buffer) =>
            console.error(`[${name}] ${chunk.toString().trim()}`),
        );
    }

    private send(command: string) {
        this.process.stdin.write(`${command}\n`);
    }

    /** Resolve com a primeira linha que casar, a partir da proxima recebida. */
    private waitFor(prefix: string, timeoutMs: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waiter = null;
                reject(
                    new Error(
                        `${this.name} nao respondeu "${prefix}" em ${timeoutMs}ms`,
                    ),
                );
            }, timeoutMs);

            this.waiter = (line: string) => {
                if (!line.startsWith(prefix)) return;

                clearTimeout(timer);
                this.waiter = null;
                resolve(line);
            };
        });
    }

    async start(): Promise<void> {
        this.send("uci");
        await this.waitFor("uciok", 20_000);
        this.send("isready");
        await this.waitFor("readyok", 20_000);
    }

    async newGame(): Promise<void> {
        this.send("ucinewgame");
        this.send("isready");
        await this.waitFor("readyok", 20_000);
    }

    async bestMove(moves: string[], limit: SearchLimit): Promise<string> {
        const position =
            moves.length > 0
                ? `position startpos moves ${moves.join(" ")}`
                : "position startpos";

        this.send(position);

        // Profundidade fixa nao tem prazo previsivel: o teto de espera cresce.
        const [command, timeout] =
            limit.depth === undefined
                ? [
                      `go movetime ${limit.movetime}`,
                      limit.movetime + MOVE_TIMEOUT_SLACK_MS,
                  ]
                : [`go depth ${limit.depth}`, DEPTH_TIMEOUT_MS];

        this.send(command);

        const line = await this.waitFor("bestmove", timeout);

        return line.split(/\s+/)[1] ?? "0000";
    }

    quit() {
        this.send("quit");
        setTimeout(() => this.process.kill(), 1000).unref();
    }
}

type GameOutcome = {
    opening: string;
    whiteEngine: string;
    result: "1-0" | "0-1" | "1/2-1/2";
    reason: string;
    plies: number;
};

async function playGame(
    white: UciEngine,
    black: UciEngine,
    opening: string[],
    limit: SearchLimit,
): Promise<GameOutcome> {
    const board = new Board();
    const controller = new MovementController(board);
    const moves: string[] = [];

    // A engine fala; o log da partida nao.
    const log = console.log;
    console.log = () => {};

    const finish = (
        result: GameOutcome["result"],
        reason: string,
    ): GameOutcome => {
        console.log = log;
        return {
            opening: opening.join(" ") || "startpos",
            whiteEngine: white.name,
            result,
            reason,
            plies: moves.length,
        };
    };

    try {
        await white.newGame();
        await black.newGame();

        for (const lan of opening) {
            const parsed = parseLan(board, lan);
            if (!parsed) return finish("1/2-1/2", `abertura invalida: ${lan}`);

            controller.applyMovement(parsed.piece, parsed.movement);
            moves.push(lan);
        }

        while (moves.length < MAX_PLIES) {
            const sideToMove = board.turn;
            const engine = sideToMove === "white" ? white : black;

            const lan = await engine.bestMove(moves, limit);
            const parsed = parseLan(board, lan);

            // Lance ilegal e derrota: o adversario nao tem como continuar.
            if (!parsed) {
                return finish(
                    sideToMove === "white" ? "0-1" : "1-0",
                    `${engine.name} devolveu lance ilegal: ${lan}`,
                );
            }

            const repetitions = controller.applyMovement(
                parsed.piece,
                parsed.movement,
            );
            moves.push(lan);

            const status = controller.gameStatus(repetitions);
            if (status === "ongoing") continue;

            if (status === "checkmate") {
                // Quem acabou de jogar deu o mate.
                return finish(sideToMove === "white" ? "1-0" : "0-1", "mate");
            }

            return finish("1/2-1/2", status);
        }

        return finish("1/2-1/2", `limite de ${MAX_PLIES} meios-lances`);
    } finally {
        console.log = log;
    }
}

/** Vitorias, empates e derrotas de A, a partir do placar por partida. */
function tally(scores: number[]) {
    const wins = scores.filter((value) => value === 1).length;
    const draws = scores.filter((value) => value === 0.5).length;

    return { wins, draws, losses: scores.length - wins - draws };
}

/** Elo do placar, com margem de 95% pela variancia dos resultados. */
function elo(scores: number[]): { elo: number; margin: number } {
    const games = scores.length;
    if (games === 0) return { elo: 0, margin: 0 };

    const score = scores.reduce((sum, value) => sum + value, 0) / games;

    if (score <= 0) return { elo: -Infinity, margin: 0 };
    if (score >= 1) return { elo: Infinity, margin: 0 };

    const variance =
        scores.reduce((sum, value) => sum + (value - score) ** 2, 0) /
        Math.max(1, games - 1);
    const deviation = Math.sqrt(variance / games);

    const toElo = (value: number) => -400 * Math.log10(1 / value - 1);

    const low = Math.max(0.001, score - 1.96 * deviation);
    const high = Math.min(0.999, score + 1.96 * deviation);

    return {
        elo: toElo(score),
        margin: (toElo(high) - toElo(low)) / 2,
    };
}

async function main() {
    const args = readArgs();

    const a = new UciEngine("A", args.a);
    const b = new UciEngine("B", args.b);

    await a.start();
    await b.start();

    console.log(`A = ${args.a}`);
    console.log(`B = ${args.b}`);
    const limit: SearchLimit = { movetime: args.movetime, depth: args.depth };

    console.log(
        `${args.games} partidas, ` +
            (args.depth === undefined
                ? `movetime ${args.movetime}ms`
                : `profundidade fixa ${args.depth}`) +
            `, placar do ponto de vista de A\n`,
    );

    const outcomes: GameOutcome[] = [];
    const scores: number[] = [];

    for (let game = 0; game < args.games; game++) {
        const opening = OPENINGS[Math.floor(game / 2) % OPENINGS.length];
        const aIsWhite = game % 2 === 0;

        const outcome = await playGame(
            aIsWhite ? a : b,
            aIsWhite ? b : a,
            opening,
            limit,
        );

        outcomes.push(outcome);

        const scoreForWhite =
            outcome.result === "1-0" ? 1 : outcome.result === "0-1" ? 0 : 0.5;
        const scoreForA = aIsWhite ? scoreForWhite : 1 - scoreForWhite;
        scores.push(scoreForA);

        const { wins, draws, losses } = tally(scores);

        console.log(
            `${String(game + 1).padStart(3)}. ` +
                `A de ${(aIsWhite ? "brancas" : "pretas").padEnd(7)}` +
                ` ${outcome.result.padEnd(7)} ${String(outcome.plies).padStart(3)} lances` +
                `  ${outcome.reason.padEnd(24)}` +
                `  parcial ${wins}-${losses}-${draws}`,
        );
    }

    a.quit();
    b.quit();

    const { wins, draws, losses } = tally(scores);
    const { elo: rating, margin } = elo(scores);

    const points = scores.reduce((sum, value) => sum + value, 0);

    console.log(
        `\nA: +${wins} =${draws} -${losses} em ${scores.length} partidas` +
            ` (${((points / scores.length) * 100).toFixed(1)}%)`,
    );
    console.log(
        `Elo de A sobre B: ${rating >= 0 ? "+" : ""}${rating.toFixed(0)} +- ${margin.toFixed(0)} (95%)`,
    );

    if (args.out) {
        writeFileSync(
            args.out,
            JSON.stringify(
                { args, wins, draws, losses, elo: rating, margin, outcomes },
                null,
                2,
            ),
        );
        console.log(`resumo em ${args.out}`);
    }
}

void main().then(
    () => process.exit(0),
    (error: Error) => {
        console.error(error.message);
        process.exit(1);
    },
);

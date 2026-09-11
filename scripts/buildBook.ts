import { createReadStream, writeFileSync } from "fs";
import { createInterface } from "readline";
import { Board } from "../src/core/board/Board";
import { MovementController } from "../src/core/MovementController";

const PGN_FILE = process.argv[2] ?? "games.pgn";
const OUT_FILE = process.argv[3] ?? "src/core/opening-book.json";
const MAX_PLIES = Number(process.argv[4] ?? 10);
const MIN_GAMES = Number(process.argv[5] ?? 20);
const MAX_GAMES = Number(process.argv[6] ?? Infinity);

const MIN_ELO = 2200;
const MIN_BASE_SECONDS = 180; // sem bullet
const MIN_PLIES_IN_GAME = 20; // descarta abandono/desconexao

/** Pontos do lado que jogou, em meios-pontos. */
const RESULT_POINTS: Record<string, [number, number]> = {
    "1-0": [2, 0],
    "0-1": [0, 2],
    "1/2-1/2": [1, 1],
};

type Entry = { weight: number; games: number };
const book = new Map<string, Map<string, Entry>>();

let seen = 0;
let accepted = 0;
let replayed = 0;
let failed = 0;

/** Tira sufixos que nao mudam o lance. */
function normalizeSan(san: string): string {
    return san
        .replace(/\s*e\.p\./, "")
        .replace(/[+#!?]/g, "")
        .trim();
}

function parseHeaders(lines: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of lines) {
        const match = line.match(/^\[(\w+)\s+"([^"]*)"\]$/);
        if (match) out[match[1]] = match[2];
    }
    return out;
}

function accept(headers: Record<string, string>): boolean {
    const white = Number(headers.WhiteElo);
    const black = Number(headers.BlackElo);
    if (!(white >= MIN_ELO && black >= MIN_ELO)) return false;

    if (headers.Termination && headers.Termination !== "Normal") return false;

    const base = Number((headers.TimeControl ?? "").split("+")[0]);
    if (base && base < MIN_BASE_SECONDS) return false;

    return RESULT_POINTS[headers.Result] !== undefined;
}

/** Extrai os lances SAN do movetext. */
function sanMoves(movetext: string): string[] {
    let text = movetext
        .replace(/\{[^}]*\}/g, " ") // comentarios { ... }
        .replace(/;[^\n]*/g, " "); // comentarios de linha

    // Variantes podem aninhar: remove de dentro para fora.
    let previous: string;
    do {
        previous = text;
        text = text.replace(/\([^()]*\)/g, " ");
    } while (text !== previous);

    return text
        .replace(/\$\d+/g, " ") // NAGs
        .replace(/\d+\.(\.\.)?/g, " ") // numeros de lance
        .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, " ") // resultado
        .split(/\s+/)
        .filter(Boolean);
}

function processGame(headerLines: string[], moveLines: string[]) {
    seen++;

    const headers = parseHeaders(headerLines);
    if (!accept(headers)) return;

    const all = sanMoves(moveLines.join(" "));
    if (all.length < MIN_PLIES_IN_GAME) return;

    accepted++;

    const points = RESULT_POINTS[headers.Result];
    const board = new Board();
    const controller = new MovementController(board);

    try {
        for (const raw of all.slice(0, MAX_PLIES)) {
            const key = board.hash.toString();
            const mover = board.turn;

            // Executa antes de contar: lance irreproduzivel nao suja o livro.
            controller.executeMovement(raw);

            const moves = book.get(key) ?? new Map<string, Entry>();
            if (!book.has(key)) book.set(key, moves);

            const san = normalizeSan(raw);
            const entry = moves.get(san) ?? { weight: 0, games: 0 };
            entry.weight += points[mover === "white" ? 0 : 1];
            entry.games += 1;
            moves.set(san, entry);
        }
        replayed++;
    } catch {
        failed++;
    }
}

async function main() {
    const reader = createInterface({
        input: createReadStream(PGN_FILE),
        crlfDelay: Infinity,
    });

    let headerLines: string[] = [];
    let moveLines: string[] = [];

    for await (const line of reader) {
        const text = line.trim();
        if (!text) continue;

        if (text.startsWith("[")) {
            // Cabecalho depois de movetext significa que a partida anterior acabou.
            if (moveLines.length) {
                processGame(headerLines, moveLines);
                headerLines = [];
                moveLines = [];
                if (seen % 20000 === 0) {
                    console.log(
                        `  ${seen} lidas | ${accepted} aceitas | ${book.size} posicoes`,
                    );
                }
                if (seen >= MAX_GAMES) break;
            }
            headerLines.push(text);
        } else {
            moveLines.push(text);
        }
    }

    if (moveLines.length && seen < MAX_GAMES) {
        processGame(headerLines, moveLines);
    }
    reader.close();

    // Poda: so entradas com amostra suficiente e que nao perderam sempre.
    const output: Record<string, Record<string, number>> = {};
    let kept = 0;

    for (const [key, moves] of book) {
        const surviving: Record<string, number> = {};
        for (const [san, entry] of moves) {
            if (entry.games >= MIN_GAMES && entry.weight > 0) {
                surviving[san] = entry.weight;
                kept++;
            }
        }
        if (Object.keys(surviving).length) output[key] = surviving;
    }

    // Uma posicao por linha: indentar de verdade cresceria 6% e daria 40 mil
    // linhas, enquanto minificar deixa o arquivo numa linha so, impossivel de
    // abrir. Assim custa 0,4% e da para navegar e usar grep.
    const lines = Object.entries(output).map(
        ([key, moves]) => `${JSON.stringify(key)}:${JSON.stringify(moves)}`,
    );
    writeFileSync(OUT_FILE, `{\n${lines.join(",\n")}\n}\n`);

    console.log(`\npartidas lidas      : ${seen}`);
    console.log(`aceitas pelo filtro : ${accepted}`);
    console.log(`reproduzidas ok     : ${replayed}`);
    console.log(`falharam no replay  : ${failed}`);
    console.log(`posicoes brutas     : ${book.size}`);
    console.log(`posicoes no livro   : ${Object.keys(output).length}`);
    console.log(`lances no livro     : ${kept}`);
    console.log(`arquivo             : ${OUT_FILE}`);
}

main();

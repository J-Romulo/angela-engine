import { Board } from "../core/board/Board";
import { prepareBoardFromPosition } from "../core/fen";
import { parseLan, toLan } from "../core/lan";
import { MovementController } from "../core/MovementController";
import { OpeningBook } from "../core/OpeningBook";
import {
    MATE,
    MATE_THRESHOLD,
    SearchController,
} from "../core/SearchController";

const ENGINE_NAME = "Angela 1.0";
const ENGINE_AUTHOR = "J-Romulo";

/** Lances restantes assumidos quando a GUI nao manda `movestogo`. */
const ASSUMED_MOVES_TO_GO = 30;

/** Colchao que fica de fora do calculo: o que impede morte por espiga. */
const CLOCK_RESERVE_MS = 5000;

/** Teto por lance: com relogio baixo, forca o gasto abaixo do incremento. */
const MAX_CLOCK_FRACTION = 0.15;

/** Latencia por lance que a busca nao enxerga: envio, agendamento, escrita. */
const OVERHEAD_MS = 50;

const TIME_SAFETY_MS = 200;
const MIN_BUDGET_MS = 50;
const DEFAULT_BUDGET_MS = 3000;

/** Entradas da tabela por MB pedido na opcao Hash. */
const ENTRIES_PER_MB = 8192;

/**
 * O tempo rende mais tarde: com o tabuleiro cheio a iteracao seguinte custa de
 * duas a quatro vezes a anterior, e a avaliacao tem pouco a dizer sobre posicao
 * quieta. Esvaziado, o crescimento cai para perto de 1,3x e cada lance decide
 * material.
 */
const EARLY_LAST_MOVE = 10;
const MIDDLE_LAST_MOVE = 30;
const MIDDLE_FACTOR = 1.2;
const LATE_FACTOR = 1.5;

export class UciController {
    private board = new Board();
    private movements = new MovementController(this.board);

    /** Desligado por padrao: em teste de forca o livro mascara a busca. */
    private useOwnBook = false;

    constructor(private readonly write: (line: string) => void) {}

    handle(line: string): boolean {
        const [command, ...args] = line.trim().split(/\s+/);

        switch (command) {
            case "uci":
                this.identify();
                break;
            case "isready":
                this.write("readyok");
                break;
            case "ucinewgame":
                this.newGame();
                break;
            case "setoption":
                this.setOption(args);
                break;
            case "position":
                this.setPosition(args);
                break;
            case "go":
                this.go(args);
                break;
            case "quit":
                return false;
            default:
                // O protocolo manda ignorar o que nao se reconhece.
                break;
        }

        return true;
    }

    private identify() {
        this.write(`id name ${ENGINE_NAME}`);
        this.write(`id author ${ENGINE_AUTHOR}`);
        this.write("option name Hash type spin default 128 min 1 max 1024");
        this.write("option name OwnBook type check default false");
        this.write("uciok");
    }

    private newGame() {
        SearchController.clearTable();
        this.board = new Board();
        this.movements = new MovementController(this.board);
    }

    private setOption(args: string[]) {
        const nameAt = args.indexOf("name");
        const valueAt = args.indexOf("value");
        if (nameAt < 0 || valueAt < 0) return;

        const name = args
            .slice(nameAt + 1, valueAt)
            .join(" ")
            .toLowerCase();
        const value = args.slice(valueAt + 1).join(" ");

        if (name === "ownbook") {
            this.useOwnBook = value.trim().toLowerCase() === "true";
            return;
        }

        if (name === "hash") {
            const megabytes = Number(value);
            if (Number.isFinite(megabytes) && megabytes > 0) {
                SearchController.maxTableEntries = Math.floor(
                    megabytes * ENTRIES_PER_MB,
                );
            }
        }
    }

    private setPosition(args: string[]) {
        const movesAt = args.indexOf("moves");
        const setup = movesAt < 0 ? args : args.slice(0, movesAt);

        if (setup[0] === "startpos") {
            this.board = new Board();
        } else if (setup[0] === "fen") {
            this.board = prepareBoardFromPosition(setup.slice(1).join(" "));
        } else {
            return;
        }

        this.movements = new MovementController(this.board);
        if (movesAt < 0) return;

        // Lance a lance para reconstruir o historico de repeticao.
        for (const lan of args.slice(movesAt + 1)) {
            const parsed = parseLan(this.board, lan);
            if (!parsed) return;

            this.movements.applyMovement(parsed.piece, parsed.movement);
        }
    }

    private go(args: string[]) {
        if (this.playBookMove()) return;

        const tokens = readTokens(args);

        const previousDepth = SearchController.maxDepth;
        if (tokens.depth) SearchController.maxDepth = tokens.depth;

        const budget = tokens.depth
            ? Infinity
            : this.budgetFor(tokens, this.board.turn);

        const result = SearchController.search(
            this.board,
            this.board.turn,
            budget,
            (iteration, depth, elapsedMs) => {
                if (!iteration.piece || !iteration.move) return;

                const { nodes, quiescenceNodes } = SearchController.stats;
                const total = nodes + quiescenceNodes;
                const nps =
                    elapsedMs > 0 ? Math.round((total * 1000) / elapsedMs) : 0;

                this.write(
                    `info depth ${depth} score ${formatScore(iteration.evaluation)}` +
                        ` nodes ${total} nps ${nps} time ${elapsedMs}` +
                        ` pv ${toLan(iteration.piece, iteration.move)}`,
                );
            },
        );

        SearchController.maxDepth = previousDepth;

        this.write(
            result.piece && result.move
                ? `bestmove ${toLan(result.piece, result.move)}`
                : "bestmove 0000",
        );
    }

    /** Devolve true quando o lance saiu do livro e nao ha o que buscar. */
    private playBookMove(): boolean {
        if (!this.useOwnBook) return false;

        const san = OpeningBook.pick(this.board);
        if (!san) return false;

        try {
            const resolved = this.movements.resolveSan(san);
            if (!resolved) return false;

            this.write("info string book move");
            this.write(`bestmove ${toLan(resolved.piece, resolved.movement)}`);

            return true;
        } catch {
            // Entrada estranha no livro nao pode derrubar a engine.
            return false;
        }
    }

    /** `board.round` conta meios-lances, comecando em 1. */
    private phaseFactor(): number {
        const move = Math.ceil(this.board.round / 2);

        if (move <= EARLY_LAST_MOVE) return 1;

        return move <= MIDDLE_LAST_MOVE ? MIDDLE_FACTOR : LATE_FACTOR;
    }

    private budgetFor(
        tokens: ReturnType<typeof readTokens>,
        turn: "black" | "white",
    ): number {
        // A busca so olha o relogio a cada mil nos e passa do prazo: o desconto
        // mantem o lance dentro do `movetime` pedido.
        if (tokens.movetime !== undefined) {
            return Math.max(MIN_BUDGET_MS, tokens.movetime - OVERHEAD_MS);
        }

        const remaining = turn === "white" ? tokens.wtime : tokens.btime;
        if (remaining === undefined) return DEFAULT_BUDGET_MS;

        const increment = (turn === "white" ? tokens.winc : tokens.binc) ?? 0;
        const movesToGo = tokens.movestogo ?? ASSUMED_MOVES_TO_GO;

        const usable = Math.max(0, remaining - CLOCK_RESERVE_MS);
        const budget =
            (usable / movesToGo + increment * 0.8) * this.phaseFactor() -
            OVERHEAD_MS;

        return Math.max(
            MIN_BUDGET_MS,
            Math.min(
                budget,
                remaining * MAX_CLOCK_FRACTION,
                remaining - TIME_SAFETY_MS,
            ),
        );
    }
}

type GoTokens = Partial<
    Record<
        | "wtime"
        | "btime"
        | "winc"
        | "binc"
        | "movestogo"
        | "movetime"
        | "depth",
        number
    >
>;

function readTokens(args: string[]): GoTokens {
    const tokens: GoTokens = {};

    for (let i = 0; i < args.length; i += 1) {
        const value = Number(args[i + 1]);
        if (!Number.isFinite(value)) continue;

        switch (args[i]) {
            case "wtime":
            case "btime":
            case "winc":
            case "binc":
            case "movestogo":
            case "movetime":
            case "depth":
                tokens[args[i] as keyof GoTokens] = value;
                break;
            default:
                break;
        }
    }

    return tokens;
}

/** Centipeoes, ou distancia do mate em lances, com sinal. */
function formatScore(evaluation: number): string {
    if (Math.abs(evaluation) <= MATE_THRESHOLD) {
        return `cp ${Math.round(evaluation)}`;
    }

    const plies = MATE - Math.abs(evaluation);
    const moves = Math.ceil(plies / 2);

    return `mate ${evaluation > 0 ? moves : -moves}`;
}

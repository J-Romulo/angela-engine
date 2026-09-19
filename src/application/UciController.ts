import { Board } from "../core/chess/board/Board";
import { prepareBoardFromPosition } from "../core/chess/notation/Fen";
import { parseLan, toLan } from "../core/chess/notation/Lan";
import { MovementController } from "../core/chess/Movement";
import { chooseMove } from "../core/engine/MoveChooser";
import { SearchController } from "../core/engine/Search";
import { budgetForClock, budgetForFixedTime } from "../core/engine/TimeBudget";
import { UciView } from "../presentation/UciView";

const ENGINE_NAME = "Angela 1.0";
const ENGINE_AUTHOR = "J-Romulo";

const ENTRIES_PER_MB = 8192;

export class UciController {
    private board = new Board();
    private movements = new MovementController(this.board);

    private useOwnBook = false;

    constructor(private readonly view: UciView) {}

    handle(line: string): boolean {
        const [command, ...args] = line.trim().split(/\s+/);

        switch (command) {
            case "uci":
                this.identify();
                break;
            case "isready":
                this.view.readyok();
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
                break;
        }

        return true;
    }

    private identify() {
        this.view.identify(ENGINE_NAME, ENGINE_AUTHOR);
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

        for (const lan of args.slice(movesAt + 1)) {
            const parsed = parseLan(this.board, lan);
            if (!parsed) return;

            this.movements.applyMovement(parsed.piece, parsed.movement);
        }
    }

    private go(args: string[]) {
        const tokens = readTokens(args);

        const chosen = chooseMove(this.board, this.movements, {
            budgetMs: tokens.depth
                ? Infinity
                : this.budgetFor(tokens, this.board.turn),
            maxDepth: tokens.depth,
            useBook: this.useOwnBook,
            onIteration: (iteration, depth, elapsedMs) => {
                if (!iteration.piece || !iteration.move) return;

                const { nodes, quiescenceNodes } = SearchController.stats;

                this.view.info({
                    depth,
                    evaluation: iteration.evaluation,
                    nodes: nodes + quiescenceNodes,
                    elapsedMs,
                    pv: toLan(iteration.piece, iteration.move),
                });
            },
        });

        if (chosen?.fromBook) this.view.infoString("book move");

        this.view.bestmove(
            chosen ? toLan(chosen.piece, chosen.movement) : null,
        );
    }

    private budgetFor(tokens: GoTokens, turn: "black" | "white"): number {
        if (tokens.movetime !== undefined) {
            return budgetForFixedTime(tokens.movetime);
        }

        const remaining = turn === "white" ? tokens.wtime : tokens.btime;
        if (remaining === undefined) return Infinity;

        return budgetForClock({
            remaining,
            increment: turn === "white" ? tokens.winc : tokens.binc,
            movesToGo: tokens.movestogo,
            moveNumber: Math.ceil(this.board.round / 2),
        });
    }
}

const GO_TOKENS = [
    "wtime",
    "btime",
    "winc",
    "binc",
    "movestogo",
    "movetime",
    "depth",
] as const;

type GoToken = (typeof GO_TOKENS)[number];
type GoTokens = Partial<Record<GoToken, number>>;

function isGoToken(word: string): word is GoToken {
    return (GO_TOKENS as readonly string[]).includes(word);
}

function readTokens(args: string[]): GoTokens {
    const tokens: GoTokens = {};

    for (let i = 0; i < args.length; i += 1) {
        const name = args[i];
        if (!isGoToken(name)) continue;

        const value = Number(args[i + 1]);
        if (Number.isFinite(value)) tokens[name] = value;
    }

    return tokens;
}

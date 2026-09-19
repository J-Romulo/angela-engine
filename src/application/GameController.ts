import { Board } from "../core/chess/board/Board";
import { MovementController } from "../core/chess/Movement";
import { SearchController } from "../core/engine/Search";
import { chooseMove } from "../core/engine/MoveChooser";
import { GameView } from "./interfaces/GameView";

const DEFAULT_SECONDS_PER_MOVE = 3;

export class GameController {
    private board: Board;
    private moveController: MovementController;

    constructor(private readonly view: GameView) {
        this.board = new Board();
        this.moveController = new MovementController(this.board);
    }

    start() {
        this.showMainMenu();
    }

    showMainMenu() {
        while (true) {
            this.view.showMainMenu();

            const choice = this.view.ask("Choose an option (1-3): ");

            switch (choice.trim()) {
                case "1":
                    this.playVsComputer();
                    break;
                case "2":
                    this.playMultiplayer();
                    break;
                case "3":
                    this.view.showGoodbye();
                    return;
                default:
                    this.view.showInvalidOption();
            }
        }
    }

    playVsComputer() {
        this.view.showVsComputerIntro();

        const colorChoice = this.view.ask("Play as (w)hite or (b)lack? [w]: ");
        const playerColor =
            colorChoice.trim().toLowerCase() === "b" ? "black" : "white";
        const computerColor = playerColor === "white" ? "black" : "white";

        const seconds = this.askSecondsPerMove();

        this.view.showSetup(playerColor, computerColor, seconds);

        if (!this.confirmStart()) return;

        this.newGame();
        this.gameLoop(computerColor, seconds * 1000);
    }

    playMultiplayer() {
        this.view.showMultiplayerIntro();

        if (!this.confirmStart()) return;

        this.newGame();
        this.gameLoop();
    }

    private askSecondsPerMove(): number {
        const answer = Number(
            this.view
                .ask(`Seconds per move [${DEFAULT_SECONDS_PER_MOVE}]: `)
                .trim(),
        );

        return Number.isFinite(answer) && answer > 0
            ? answer
            : DEFAULT_SECONDS_PER_MOVE;
    }

    private confirmStart(): boolean {
        return this.view.ask("Start game? (y/n): ").toLowerCase() === "y";
    }

    gameLoop(computerColor?: "white" | "black", timeLimitMs = Infinity) {
        let matchFinished = false;
        while (!matchFinished) {
            this.view.showBoard(this.board);

            if (this.board.turn === computerColor) {
                matchFinished = this.playComputerMove(
                    computerColor,
                    timeLimitMs,
                );
                if (matchFinished) {
                    this.view.showBoard(this.board);
                }
                continue;
            }

            const move = this.view.ask(`${this.board.turn} to move: `);

            try {
                const status = this.moveController.executeMovement(move);
                this.view.showGameEnd(status, this.board.turn);

                matchFinished = status !== "ongoing";
                if (matchFinished) {
                    this.view.showBoard(this.board);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                this.view.error(error.message);
            }
        }

        this.view.pause("\nPress Enter to return to the menu...");
    }

    playComputerMove(
        computerColor: "white" | "black",
        timeLimitMs = Infinity,
    ): boolean {
        const startedAt = Date.now();
        const chosen = chooseMove(this.board, this.moveController, {
            budgetMs: timeLimitMs,
            useBook: true,
            onSearchStart: () => this.view.showThinking(computerColor),
        });
        const elapsedMs = Date.now() - startedAt;

        if (!chosen) {
            this.view.showNoLegalMoves(computerColor);
            return true;
        }

        const from = chosen.piece.position;
        const nextPosition = this.moveController.applyMovement(
            chosen.piece,
            chosen.movement,
            chosen.promotionSymbol,
        );

        if (chosen.fromBook) {
            this.view.showBookMove(computerColor, chosen.san);
        } else {
            const { depth, nodes, quiescenceNodes } = SearchController.stats;

            this.view.showComputerMove({
                piece: chosen.piece.name,
                from,
                to: chosen.movement,
                moveType: chosen.movement.type,
                evaluation: chosen.evaluation,
                depth,
                nodes: nodes + quiescenceNodes,
                elapsedMs,
            });
        }
        this.view.pause();

        const status = this.moveController.resolveGameEnd(nextPosition);
        this.view.showGameEnd(status, this.board.turn);

        return status !== "ongoing";
    }

    newGame() {
        SearchController.clearTable();
        this.board = new Board();
        this.moveController = new MovementController(this.board);
    }
}

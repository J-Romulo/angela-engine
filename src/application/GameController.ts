import { Board } from "../core/board/Board";
import promptSync from "prompt-sync";
import { MovementController } from "../core/MovementController";
import { SearchController } from "../core/SearchController";
import { Position } from "../core/pieces/Piece";

const squareName = (position: Position) =>
    `${"abcdefgh"[position.column]}${position.row + 1}`;

// TODO Draw by repetition, 50 moves without pawn movement or capture, insufficient material
export class GameController {
    prompt: promptSync.Prompt;
    board: Board;
    moveController: MovementController;

    constructor() {
        this.prompt = promptSync({ sigint: true });
        this.board = new Board();
        this.moveController = new MovementController(this.board);
    }

    start() {
        this.showMainMenu();
    }

    showMainMenu() {
        while (true) {
            console.clear();
            this.displayLogo();
            console.log("=".repeat(50));
            console.log("                    MAIN MENU");
            console.log("=".repeat(50));
            console.log();
            console.log("1. Play vs Computer");
            console.log("2. Multiplayer (2 Players)");
            console.log("3. Exit");
            console.log();

            const choice = this.prompt("Choose an option (1-3): ");

            switch (choice.trim()) {
                case "1":
                    this.playVsComputer();
                    break;
                case "2":
                    this.playMultiplayer();
                    break;
                case "3":
                    console.log("Thanks for playing! Goodbye!");
                    return;
                default:
                    console.log("Invalid option. Please choose 1, 2, or 3.");
                    this.prompt("Press Enter to continue...");
            }
        }
    }

    displayLogo() {
        console.log();
        console.log("                 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜");
        console.log("                 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟");
        console.log("                 . . . . . . . .");
        console.log("                 . . . . . . . .");
        console.log("                 . . . . . . . .");
        console.log("                 . . . . . . . .");
        console.log("                 ♙ ♙ ♙ ♙ ♙ ♙ ♙ ♙");
        console.log("                 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖");
        console.log();
        console.log("                 TYPESCRIPT CHESS");
        console.log();
    }

    playVsComputer() {
        console.clear();
        console.log("=".repeat(50));
        console.log("                    PLAY VS COMPUTER");
        console.log("=".repeat(50));
        console.log();
        console.log("The computer searches one move ahead and plays the move");
        console.log("with the best material evaluation.");
        console.log();

        const colorChoice = this.prompt("Play as (w)hite or (b)lack? [w]: ");
        const playerColor =
            colorChoice.trim().toLowerCase() === "b" ? "black" : "white";
        const computerColor = playerColor === "white" ? "black" : "white";

        console.log();
        console.log(`You are ${playerColor}. Computer is ${computerColor}.`);
        console.log();

        const confirm = this.prompt("Start game? (y/n): ");
        if (confirm.toLowerCase() === "y") {
            this.newGame();
            this.gameLoop(computerColor);
        }
    }

    playMultiplayer() {
        console.clear();
        console.log("=".repeat(50));
        console.log("                    MULTIPLAYER MODE");
        console.log("=".repeat(50));
        console.log();
        console.log("Two players will take turns on the same computer.");
        console.log("White moves first, then Black alternates.");
        console.log();

        const confirm = this.prompt("Start game? (y/n): ");
        if (confirm.toLowerCase() === "y") {
            this.newGame();
            this.gameLoop();
        }
    }

    gameLoop(computerColor?: "white" | "black") {
        let matchFinished = false;
        while (!matchFinished) {
            this.printBoard();

            if (this.board.turn === computerColor) {
                matchFinished = this.playComputerMove(computerColor);
                if (matchFinished) {
                    this.printBoard();
                }
                continue;
            }

            const whiteMove = this.prompt(`${this.board.turn} to move: `);

            try {
                matchFinished = this.moveController.executeMovement(whiteMove);
                if (matchFinished) {
                    this.printBoard();
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                console.error(error.message);
            }
        }
    }

    /** Runs the search for the computer's side and plays its choice. */
    playComputerMove(computerColor: "white" | "black"): boolean {
        console.log(`\n${computerColor} (computer) is thinking...`);

        const startedAt = Date.now();
        const { piece, move, evaluation } = SearchController.search(
            this.board,
            computerColor,
        );
        const elapsed = Date.now() - startedAt;

        if (!piece || !move) {
            console.log(`${computerColor} has no legal moves. Game over.`);
            return true;
        }

        const from = squareName(piece.position);
        const to = squareName(move);
        const label = `${piece.name}${from}-${to}`;

        this.moveController.applyMovement(piece, move);

        console.log(
            `Computer plays ${label} (${move.type}, eval ${evaluation.toFixed(2)}, ${elapsed}ms)`,
        );
        this.prompt("Press Enter to continue...");

        return this.moveController.reportGameEnd(move);
    }

    newGame() {
        this.board = new Board();
        this.moveController = new MovementController(this.board);
    }

    printBoard() {
        // Códigos de cores ANSI
        const colors = {
            reset: "\x1b[0m",
            // Cores de fundo
            bgBlack: "\x1b[40m",
            bgWhite: "\x1b[47m",
            // Cores de texto
            black: "\x1b[30m",
            white: "\x1b[37m",
            brightWhite: "\x1b[97m",
            // Texto em negrito
            bold: "\x1b[1m",
        };

        const pieceSymbols = {
            King: { white: "♔", black: "♚" },
            Queen: { white: "♕", black: "♛" },
            Rook: { white: "♖", black: "♜" },
            Bishop: { white: "♗", black: "♝" },
            Knight: { white: "♘", black: "♞" },
            Pawn: { white: "♙", black: "♟" },
        };

        console.log("   a   b   c   d   e   f   g   h");
        console.log(" ┌───┬───┬───┬───┬───┬───┬───┬───┐");

        // Imprime cada linha
        for (let row = 7; row >= 0; row--) {
            // Imprime o número da linha
            process.stdout.write(`${row + 1}│`);

            for (let col = 0; col < 8; col++) {
                const square = this.board.squares[row][col];
                const bgColor =
                    square.color === "black" ? colors.bgBlack : colors.bgWhite;
                const textColor =
                    square.piece?.color === "white"
                        ? colors.brightWhite
                        : colors.black;

                // Obtém o símbolo da peça
                let symbol = " ";
                if (square.piece) {
                    // Extrai o tipo da peça do nome do construtor
                    const pieceType = square.piece.constructor
                        .name as keyof typeof pieceSymbols;
                    symbol = pieceSymbols[pieceType][square.piece.color];
                }

                // Imprime a casa com cores apropriadas e mais espaço
                process.stdout.write(
                    `${bgColor}${textColor} ${symbol} ${colors.reset}│`,
                );
            }

            // Imprime o número da linha novamente no lado direito
            console.log(` ${row + 1}`);

            if (row > 0) {
                console.log(" ├───┼───┼───┼───┼───┼───┼───┼───┤");
            }
        }

        console.log(" └───┴───┴───┴───┴───┴───┴───┴───┘");
        console.log("   a   b   c   d   e   f   g   h");

        console.log(`\nRound: ${this.board.round}, Turn: ${this.board.turn}`);
    }
}

import promptSync from "prompt-sync";
import {
    ComputerMoveReport,
    GameView,
} from "../application/interfaces/GameView";
import { Board } from "../core/chess/board/Board";
import { GameStatus } from "../core/chess/Movement";
import { MATE, MATE_THRESHOLD } from "../core/engine/Search";
import { Position } from "../core/chess/pieces/Piece";

const COLORS = {
    reset: "\x1b[0m",
    bgBlack: "\x1b[40m",
    bgWhite: "\x1b[47m",
    black: "\x1b[30m",
    brightWhite: "\x1b[97m",
};

const PIECE_SYMBOLS = {
    King: { white: "♔", black: "♚" },
    Queen: { white: "♕", black: "♛" },
    Rook: { white: "♖", black: "♜" },
    Bishop: { white: "♗", black: "♝" },
    Knight: { white: "♘", black: "♞" },
    Pawn: { white: "♙", black: "♟" },
};

const RULE = "=".repeat(50);
const INDENT = " ".repeat(20);

const squareName = (position: Position) =>
    `${"abcdefgh"[position.column]}${position.row + 1}`;

const formatEvaluation = (score: number) => {
    if (Math.abs(score) <= MATE_THRESHOLD) return (score / 100).toFixed(2);

    const moves = Math.ceil((MATE - Math.abs(score)) / 2);
    return `${score > 0 ? "" : "-"}M${moves}`;
};

/** Toda a entrada e saida do terminal. Nenhuma regra de jogo mora aqui. */
export class TerminalView implements GameView {
    private readonly prompt: promptSync.Prompt;

    constructor() {
        this.prompt = promptSync({ sigint: true });
    }

    ask(question: string): string {
        return this.prompt(question);
    }

    pause(message = "Press Enter to continue...") {
        this.prompt(message);
    }

    clear() {
        console.clear();
    }

    error(message: string) {
        console.error(message);
    }

    private heading(title: string) {
        console.log(RULE);
        console.log(`${INDENT}${title}`);
        console.log(RULE);
        console.log();
    }

    showMainMenu() {
        this.clear();
        this.showLogo();
        this.heading("MAIN MENU");
        console.log("1. Play vs Computer");
        console.log("2. Multiplayer (2 Players)");
        console.log("3. Exit");
        console.log();
    }

    showLogo() {
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

    showInvalidOption() {
        console.log("Invalid option. Please choose 1, 2, or 3.");
        this.pause();
    }

    showGoodbye() {
        console.log("Thanks for playing! Goodbye!");
    }

    showVsComputerIntro() {
        this.clear();
        this.heading("PLAY VS COMPUTER");
        console.log("The computer deepens its search until the time budget");
        console.log("runs out, then plays the best move it found.");
        console.log();
    }

    showMultiplayerIntro() {
        this.clear();
        this.heading("MULTIPLAYER MODE");
        console.log("Two players will take turns on the same computer.");
        console.log("White moves first, then Black alternates.");
        console.log();
    }

    showSetup(
        playerColor: "white" | "black",
        computerColor: "white" | "black",
        seconds: number,
    ) {
        console.log();
        console.log(`You are ${playerColor}. Computer is ${computerColor}.`);
        console.log(`Computer thinks for up to ${seconds}s per move.`);
        console.log();
    }

    showThinking(color: "white" | "black") {
        console.log(`\n${color} (computer) is thinking...`);
    }

    showBookMove(color: "white" | "black", san: string) {
        console.log(`\n${color} plays ${san} (opening book)`);
    }

    showNoLegalMoves(color: "white" | "black") {
        console.log(`${color} has no legal moves. Game over.`);
    }

    /** `turn` ja virou para o lado que recebeu o lance. */
    showGameEnd(status: GameStatus, turn: "white" | "black") {
        switch (status) {
            case "checkmate":
                console.log(
                    "Checkmate! Game over. " +
                        (turn === "white" ? "Black" : "White") +
                        " wins!",
                );
                break;
            case "stalemate":
                console.log("Stalemate! Game over. It's a draw.");
                break;
            case "insufficient_material":
                console.log("Draw by insufficient material! Game over.");
                break;
            case "fifty_moves":
                console.log("Draw by the fifty-move rule! Game over.");
                break;
            case "threefold":
                console.log("Draw by threefold repetition! Game over.");
                break;
            case "ongoing":
                break;
        }
    }

    showComputerMove(report: ComputerMoveReport) {
        const from = squareName(report.from);
        const to = squareName(report.to);

        console.log(
            `Computer plays ${report.piece}${from}-${to} (${report.moveType},` +
                ` eval ${formatEvaluation(report.evaluation)},` +
                ` depth ${report.depth}, ${report.nodes} nodes,` +
                ` ${report.elapsedMs}ms)`,
        );
    }

    showBoard(board: Board) {
        console.log("   a   b   c   d   e   f   g   h");
        console.log(" ┌───┬───┬───┬───┬───┬───┬───┬───┐");

        for (let row = 7; row >= 0; row--) {
            process.stdout.write(`${row + 1}│`);

            for (let col = 0; col < 8; col++) {
                const square = board.squares[row][col];
                const bgColor =
                    square.color === "black" ? COLORS.bgBlack : COLORS.bgWhite;
                const textColor =
                    square.piece?.color === "white"
                        ? COLORS.brightWhite
                        : COLORS.black;

                let symbol = " ";
                if (square.piece) {
                    const pieceType = square.piece.constructor
                        .name as keyof typeof PIECE_SYMBOLS;
                    symbol = PIECE_SYMBOLS[pieceType][square.piece.color];
                }

                process.stdout.write(
                    `${bgColor}${textColor} ${symbol} ${COLORS.reset}│`,
                );
            }

            console.log(` ${row + 1}`);

            if (row > 0) {
                console.log(" ├───┼───┼───┼───┼───┼───┼───┼───┤");
            }
        }

        console.log(" └───┴───┴───┴───┴───┴───┴───┴───┘");
        console.log("   a   b   c   d   e   f   g   h");

        console.log(`\nRound: ${board.round}, Turn: ${board.turn}`);
    }
}

import { Board } from "../../core/chess/board/Board";
import { GameStatus } from "../../core/chess/Movement";
import { Position } from "../../core/chess/pieces/Piece";

export interface ComputerMoveReport {
    piece: string;
    from: Position;
    to: Position;
    moveType: string;
    evaluation: number;
    depth: number;
    nodes: number;
    elapsedMs: number;
}

export interface GameView {
    ask(question: string): string;
    pause(message?: string): void;
    error(message: string): void;

    showMainMenu(): void;
    showInvalidOption(): void;
    showGoodbye(): void;

    showVsComputerIntro(): void;
    showMultiplayerIntro(): void;
    showSetup(
        playerColor: "white" | "black",
        computerColor: "white" | "black",
        seconds: number,
    ): void;

    showBoard(board: Board): void;
    showThinking(color: "white" | "black"): void;
    showBookMove(color: "white" | "black", san: string): void;
    showComputerMove(report: ComputerMoveReport): void;
    showNoLegalMoves(color: "white" | "black"): void;
    showGameEnd(status: GameStatus, turn: "white" | "black"): void;
}

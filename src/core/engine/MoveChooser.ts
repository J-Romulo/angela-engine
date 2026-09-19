import { Board } from "../chess/board/Board";
import { MovementController } from "../chess/Movement";
import { OpeningBook } from "./OpeningBook";
import { Movement, Piece } from "../chess/pieces/Piece";
import { SearchController, SearchResult } from "./Search";

interface ChosenMoveBase {
    piece: Piece;
    movement: Movement;
    promotionSymbol?: string;
}

export type ChosenMove =
    | (ChosenMoveBase & { fromBook: true; san: string })
    | (ChosenMoveBase & { fromBook: false; evaluation: number });

export interface ChooseMoveOptions {
    budgetMs?: number;
    useBook?: boolean;
    maxDepth?: number;
    onSearchStart?: () => void;
    onIteration?: (
        result: SearchResult,
        depth: number,
        elapsedMs: number,
    ) => void;
}

export function chooseMove(
    board: Board,
    movements: MovementController,
    options: ChooseMoveOptions = {},
): ChosenMove | null {
    if (options.useBook) {
        const san = OpeningBook.pick(board);

        if (san) {
            try {
                const resolved = movements.resolveSan(san);
                if (resolved) return { ...resolved, san, fromBook: true };
            } catch {
                // Entrada estranha no livro cai na busca; nada foi aplicado.
            }
        }
    }

    options.onSearchStart?.();

    const previousDepth = SearchController.maxDepth;
    if (options.maxDepth) SearchController.maxDepth = options.maxDepth;

    try {
        const { piece, move, evaluation } = SearchController.search(
            board,
            board.turn,
            options.budgetMs ?? Infinity,
            options.onIteration,
        );

        if (!piece || !move) return null;

        return { piece, movement: move, evaluation, fromBook: false };
    } finally {
        SearchController.maxDepth = previousDepth;
    }
}

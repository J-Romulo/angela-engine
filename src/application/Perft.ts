import { Board } from "../core/chess/board/Board";
import { prepareBoardFromPosition } from "../core/chess/notation/Fen";
import { MovementController } from "../core/chess/Movement";

export function perft(depth: number, position: string): number {
    return countNodes(prepareBoardFromPosition(position), depth);
}

function countNodes(board: Board, depth: number): number {
    if (depth === 0) return 1;

    const allValidMoves = board
        .getPieces(null, board.turn, false)
        .flatMap((piece) =>
            (board.movementsOf(piece) ?? []).map((movement) => ({
                piece,
                movement,
            })),
        );

    let nodes = 0;
    const controller = new MovementController(board);

    for (const { piece, movement } of allValidMoves) {
        const hashBefore = board.hash;
        const clockBefore = board.halfmoveClock;
        const historyBefore = board.history.length;
        const undo = controller.makeMovement(piece, movement);

        nodes += countNodes(board, depth - 1);

        controller.unmakeMovement(undo);

        if (board.history.length !== historyBefore) {
            throw new Error(
                `unmake nao restaurou o historico: ${historyBefore} -> ${board.history.length}`,
            );
        }

        if (board.halfmoveClock !== clockBefore) {
            throw new Error(
                `unmake nao restaurou o relogio: ${clockBefore} -> ${board.halfmoveClock}`,
            );
        }

        if (board.hash !== hashBefore) {
            throw new Error(
                `unmake nao restaurou o hash apos ${piece.name || "P"}` +
                    `${piece.position.column}${piece.position.row}` +
                    `-${movement.column}${movement.row} (${movement.type})`,
            );
        }
    }

    return nodes;
}

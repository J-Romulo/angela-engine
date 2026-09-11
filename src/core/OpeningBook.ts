import { readFileSync } from "fs";
import { join } from "path";
import { Board } from "./board/Board";

type Book = Record<string, Record<string, number>>;

const BOOK_PATH = join(__dirname, "opening-book.json");

export class OpeningBook {
    private static book: Book | null = null;

    private static load(): Book {
        if (this.book) return this.book;

        try {
            this.book = JSON.parse(readFileSync(BOOK_PATH, "utf8")) as Book;
        } catch {
            this.book = {};
        }

        return this.book;
    }

    static pick(board: Board): string | null {
        const entries = this.load()[board.hash.toString()];
        if (!entries) return null;

        const moves = Object.entries(entries);
        const total = moves.reduce((sum, [, weight]) => sum + weight, 0);
        if (total <= 0) return null;

        let roll = Math.random() * total;
        for (const [san, weight] of moves) {
            roll -= weight;
            if (roll <= 0) return san;
        }

        return moves[moves.length - 1][0];
    }
}

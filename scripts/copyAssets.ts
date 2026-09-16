import { copyFileSync, mkdirSync } from "fs";
import { dirname, join, relative } from "path";

// tsc nao copia o que nao e TypeScript, e sem o livro o OpeningBook cai no
// catch e a engine joga sem livro sem avisar.
const from = join(__dirname, "..", "src", "core", "opening-book.json");
const to = join(__dirname, "..", "dist", "core", "opening-book.json");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);

console.log(`livro copiado para ${relative(process.cwd(), to)}`);

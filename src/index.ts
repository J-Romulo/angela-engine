import { createInterface } from "readline";
import { GameController } from "./application/GameController";
import { UciController } from "./application/UciController";

function startUci() {
    const controller = new UciController((line) =>
        process.stdout.write(`${line}\n`),
    );

    const input = createInterface({ input: process.stdin });

    input.on("line", (line) => {
        if (!controller.handle(line)) {
            input.close();
        }
    });
}

// Stdin sem terminal e como uma GUI de xadrez chama a engine.
if (process.argv.includes("--uci") || !process.stdin.isTTY) {
    startUci();
} else {
    new GameController().start();
}

import { createInterface } from "readline";
import { UciController } from "./application/UciController";

function startUci() {
    const controller = new UciController((line) =>
        process.stdout.write(`${line}\n`),
    );

    const input = createInterface({ input: process.stdin });

    input.on("line", (line) => {
        if (!controller.handle(line)) {
            input.close();
            // Fechar a readline nao solta o handle do stdin: com a GUI segurando
            // a ponta de escrita do pipe o EOF nunca chega, e sem EOF o processo
            // sobrevive ao `quit`. O unref tira o stdin do event loop.
            process.stdin.unref();
        }
    });
}

/** Sob demanda: o menu depende de prompt-sync, que o modo UCI nao precisa. */
async function startCli() {
    const { GameController } = await import("./application/GameController");
    new GameController().start();
}

// Stdin sem terminal e como uma GUI de xadrez chama a engine.
if (process.argv.includes("--uci") || !process.stdin.isTTY) {
    startUci();
} else {
    void startCli();
}

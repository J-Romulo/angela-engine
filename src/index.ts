import { createInterface } from "readline";
import { UciController } from "./application/UciController";
import { UciView } from "./presentation/UciView";

function startUci() {
    const view = new UciView((line) => process.stdout.write(`${line}\n`));
    const controller = new UciController(view);

    const input = createInterface({ input: process.stdin });

    input.on("line", (line) => {
        if (!controller.handle(line)) {
            input.close();
            process.stdin.unref();
        }
    });
}

async function startCli() {
    const { GameController } = await import("./application/GameController");
    const { TerminalView } = await import("./presentation/TerminalView");

    new GameController(new TerminalView()).start();
}

if (process.argv.includes("--uci") || !process.stdin.isTTY) {
    startUci();
} else {
    void startCli();
}

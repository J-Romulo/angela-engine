import { MATE, MATE_THRESHOLD } from "../core/engine/Search";

function formatScore(evaluation: number): string {
    if (Math.abs(evaluation) <= MATE_THRESHOLD) {
        return `cp ${Math.round(evaluation)}`;
    }

    const plies = MATE - Math.abs(evaluation);
    const moves = Math.ceil(plies / 2);

    return `mate ${evaluation > 0 ? moves : -moves}`;
}

export interface IterationReport {
    depth: number;
    evaluation: number;
    nodes: number;
    elapsedMs: number;
    pv: string;
}

export class UciView {
    constructor(private readonly write: (line: string) => void) {}

    identify(name: string, author: string) {
        this.write(`id name ${name}`);
        this.write(`id author ${author}`);
        this.write("option name Hash type spin default 128 min 1 max 1024");
        this.write("option name OwnBook type check default false");
        this.write("uciok");
    }

    readyok() {
        this.write("readyok");
    }

    infoString(text: string) {
        this.write(`info string ${text}`);
    }

    info({ depth, evaluation, nodes, elapsedMs, pv }: IterationReport) {
        const nps = elapsedMs > 0 ? Math.round((nodes * 1000) / elapsedMs) : 0;

        this.write(
            `info depth ${depth} score ${formatScore(evaluation)}` +
                ` nodes ${nodes} nps ${nps} time ${elapsedMs}` +
                ` pv ${pv}`,
        );
    }

    bestmove(lan: string | null) {
        this.write(`bestmove ${lan ?? "0000"}`);
    }
}

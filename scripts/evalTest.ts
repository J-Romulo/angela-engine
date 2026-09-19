import { EvaluationController } from "../src/core/engine/Evaluation";
import { prepareBoardFromPosition } from "../src/core/chess/notation/Fen";

const evaluate = (fen: string, turn: "black" | "white" = "white") =>
    EvaluationController.evaluatePosition(prepareBoardFromPosition(fen), turn);

let failed = 0;

function check(name: string, ok: boolean, detail: string) {
    if (!ok) failed++;
    console.log(`${ok ? "OK    " : "FALHOU"}  ${name.padEnd(38)} ${detail}`);
}

/**
 * Espelha a posicao na vertical e troca as cores: a mesma posicao vista do
 * outro lado tem que valer o mesmo, ou algum termo tem vies de cor.
 */
function mirror(fen: string): string {
    const [placement, turn, ...rest] = fen.split(" ");

    const ranks = placement
        .split("/")
        .reverse()
        .map((rank) =>
            rank.replace(/[a-zA-Z]/g, (letter) =>
                letter === letter.toUpperCase()
                    ? letter.toLowerCase()
                    : letter.toUpperCase(),
            ),
        );

    const flipped = turn === "w" ? "b" : "w";

    // Roque e en passant nao entram na avaliacao; espelhar so o essencial.
    return [ranks.join("/"), flipped, ...rest].join(" ");
}

const POSITIONS: [string, string][] = [
    ["inicial", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    [
        "kiwipete",
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    ],
    [
        "meio-jogo",
        "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    ],
    ["final de peoes", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"],
];

/** A avaliacao e do lado a mover: virar o lado tem que virar o sinal. */
function perspectiveSuite() {
    console.log("\n=== PERSPECTIVA ===");

    for (const [name, fen] of POSITIONS) {
        const white = evaluate(fen, "white");
        const black = evaluate(fen, "black");

        check(
            name,
            white === -black,
            `brancas ${String(white).padStart(6)}  pretas ${String(black).padStart(6)}`,
        );
    }
}

/** Posicao espelhada com cores trocadas tem que valer o mesmo. */
function symmetrySuite() {
    console.log("\n=== SIMETRIA DE COR ===");

    for (const [name, fen] of POSITIONS) {
        const direct = evaluate(fen, "white");
        const mirrored = evaluate(mirror(fen), "black");

        check(
            name,
            direct === mirrored,
            `direta ${String(direct).padStart(6)}  espelhada ${String(mirrored).padStart(6)}`,
        );
    }
}

/** Pares de mesmo material e mesma tabela: a diferenca so vem das casas. */
function mobilitySuite() {
    console.log("\n=== MOBILIDADE ===");

    // Peoes brancos em c3/c5 fecham duas diagonais do bispo de d4; em f3/f5
    // nao encostam nele e valem o mesmo na tabela de peao.
    const blocked = evaluate("4k3/8/8/2P5/3B4/2P5/8/4K3 w - - 0 1");
    const free = evaluate("4k3/8/8/5P2/3B4/5P2/8/4K3 w - - 0 1");

    // 13 casas livres contra 7: seis casas a 4 centipeoes cada.
    check(
        "bispo preso por peoes proprios",
        free - blocked === 24,
        `livre ${free}  preso ${blocked}  diferenca ${free - blocked} (esperado 24)`,
    );

    // O peao preto de c7 defende b6, que esta na diagonal do bispo de d4. O de
    // f7 defende e6 e g6, fora dela, e vale o mesmo na tabela.
    const guarded = evaluate("4k3/2p5/8/8/3B4/8/8/4K3 w - - 0 1");
    const open = evaluate("4k3/5p2/8/8/3B4/8/8/4K3 w - - 0 1");

    check(
        "casa defendida por peao nao conta",
        open - guarded === 4,
        `aberta ${open}  guardada ${guarded}  diferenca ${open - guarded} (esperado 4)`,
    );

    // Dama tem peso zero: com ela no lugar do bispo as diagonais fecham do
    // mesmo jeito e a avaliacao nao pode mudar.
    const queenBlocked = evaluate("4k3/8/8/2P5/3Q4/2P5/8/4K3 w - - 0 1");
    const queenFree = evaluate("4k3/8/8/5P2/3Q4/5P2/8/4K3 w - - 0 1");

    check(
        "dama nao entra na contagem",
        queenFree === queenBlocked,
        `livre ${queenFree}  presa ${queenBlocked}`,
    );

    // A tabela ja diz que o centro vale mais; aqui so garante que a mobilidade
    // nao inverte o sinal.
    const corner = evaluate("4k3/8/8/8/8/8/7P/N3K3 w - - 0 1");
    const center = evaluate("4k3/8/8/8/3N4/8/7P/4K3 w - - 0 1");

    check(
        "cavalo no centro vale mais que no canto",
        center > corner,
        `centro ${center}  canto ${corner}`,
    );

    // Torre em coluna aberta contra torre atras do proprio peao, mesma casa e
    // mesmo material: so muda o que ela enxerga.
    const behindPawn = evaluate("4k3/8/8/8/8/8/3P4/3RK3 w - - 0 1");
    const openFile = evaluate("4k3/8/8/8/8/8/4P3/3RK3 w - - 0 1");

    check(
        "torre em coluna aberta vale mais",
        openFile > behindPawn,
        `aberta ${openFile}  atras do peao ${behindPawn}`,
    );
}

/**
 * Os mapas de peao sao reaproveitados entre chamadas: se um ficar sujo, o valor
 * de uma posicao passa a depender da que foi avaliada antes.
 */
function statelessSuite() {
    console.log("\n=== SEM ESTADO ENTRE CHAMADAS ===");

    for (const [name, fen] of POSITIONS) {
        const first = evaluate(fen, "white");

        for (const [, other] of POSITIONS) evaluate(other, "black");

        // Sem limpar, a segunda leitura sai do cache e nao exercita nada.
        EvaluationController.clearCache();

        const again = evaluate(fen, "white");

        check(
            name,
            first === again,
            `antes ${String(first).padStart(6)}  depois ${String(again).padStart(6)}`,
        );
    }
}

/** O cache so pode mudar o custo da avaliacao, nunca o valor. */
function cacheSuite() {
    console.log("\n=== CACHE ===");

    for (const [name, fen] of POSITIONS) {
        EvaluationController.clearCache();
        const cold = evaluate(fen, "white");

        EvaluationController.resetStats();
        const warm = evaluate(fen, "white");
        const { cacheHits, computed } = EvaluationController.stats;

        check(
            name,
            cold === warm && cacheHits === 1 && computed === 0,
            `frio ${String(cold).padStart(6)}  quente ${String(warm).padStart(6)}` +
                `  acertos ${cacheHits}  recalculos ${computed}`,
        );
    }
}

perspectiveSuite();
cacheSuite();
symmetrySuite();
mobilitySuite();
statelessSuite();

console.log(`\n${failed === 0 ? "tudo passou" : `${failed} falharam`}`);
process.exitCode = failed === 0 ? 0 : 1;

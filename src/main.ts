/** Wiring: fixed-timestep loop feeding sim; render decoupled. */
import { DT, type GameState } from "./sim/types";
import { createState, tick } from "./sim/tick";
import { InputSource } from "./input/input";
import { Renderer } from "./render/render";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const hearts = document.getElementById("hearts")!;
const waveLabel = document.getElementById("waveLabel")!;
const timeState = document.getElementById("timeState")!;
const overlay = document.getElementById("overlay")!;
const startBtn = document.getElementById("startBtn")!;
const title = overlay.querySelector("h1")!;
const paras = overlay.querySelectorAll("p");

const renderer = new Renderer(canvas);
const input = new InputSource();
input.attach(canvas);

let state: GameState | null = null;

function start(): void {
  const { w, h } = renderer.size;
  // Daily-seed-ready: swap for a date-derived seed when leaderboards land.
  const seed = (Math.random() * 0xffffffff) >>> 0;
  state = createState(seed, w, h);
  overlay.classList.add("hidden");
  hearts.textContent = "\u2665 \u2665 \u2665";
}

startBtn.addEventListener("pointerdown", start);
overlay.addEventListener("pointerdown", () => {
  if (!state || state.phase === "dead") start();
});

function onGameOver(wave: number): void {
  title.innerHTML = '<span class="hot">FELLED</span>';
  if (paras[0]) paras[0].innerHTML = `You survived to <b>wave ${wave}</b>.<br><br>Stillness is the commitment.`;
  if (paras[1]) paras[1].textContent = "";
  startBtn.textContent = "AGAIN";
  overlay.classList.remove("hidden");
}

let acc = 0;
let lastT = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  let elapsed = (now - lastT) / 1000;
  lastT = now;
  if (elapsed > 0.1) elapsed = 0.1; // tab-away guard

  if (state && state.phase === "playing") {
    acc += elapsed;
    while (acc >= DT) {
      tick(state, input.frame());
      renderer.consume(state.events);
      for (const ev of state.events) {
        if (ev.kind === "waveStarted") waveLabel.textContent = `WAVE ${ev.wave}`;
        if (ev.kind === "playerHit") {
          hearts.textContent = "\u2665 \u2665 \u2665".slice(0, Math.max(0, state.player.hp * 2 - 1));
        }
        if (ev.kind === "gameOver") onGameOver(ev.wave);
      }
      acc -= DT;
    }
    timeState.textContent = state.timeScale < 0.5 ? "F R O Z E N" : "TIME FLOWS";
    (timeState as HTMLElement).style.color = state.timeScale < 0.5 ? "var(--ice)" : "var(--ember)";
  }

  if (state) renderer.draw(state, elapsed);
}
requestAnimationFrame(frame);

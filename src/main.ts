/** Wiring: fixed-timestep loop feeding sim; render decoupled. */
import { DT, type GameState } from "./sim/types";
import { createState, tick } from "./sim/tick";
import { InputSource } from "./input/input";
import { Renderer } from "./render/render";
import { UPGRADE_BY_ID } from "./data/upgrades";
import { initPwa } from "./pwa";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const hearts = document.getElementById("hearts")!;
const waveLabel = document.getElementById("waveLabel")!;
const timeState = document.getElementById("timeState")!;
const overlay = document.getElementById("overlay")!;
const draftEl = document.getElementById("draft")!;
const startBtn = document.getElementById("startBtn")!;
const installBtn = document.getElementById("installBtn") as HTMLElement;
const title = overlay.querySelector("h1")!;
const paras = overlay.querySelectorAll("p");

const renderer = new Renderer(canvas);
const input = new InputSource();
input.attach(canvas);

let state: GameState | null = null;

const draftTitle = draftEl.querySelector("h2")!;

/** Render the offer. Time is stopped in this phase, so there is no clock on it. */
function showDraft(options: readonly string[], taken: readonly string[], remaining: number): void {
  draftEl.replaceChildren(draftTitle);
  // A draft can owe more than one pick, so say how many are left — otherwise the
  // panel reappearing after a tap reads as a bug.
  draftTitle.textContent = remaining > 1 ? `Choose · ${remaining} picks` : "Choose";
  options.forEach((id, i) => {
    const def = UPGRADE_BY_ID[id];
    if (!def) return;
    const held = taken.filter((t) => t === id).length;
    const card = document.createElement("div");
    card.className = "card";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = def.name;
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = def.description;
    card.append(name, desc);
    if (held > 0) {
      const st = document.createElement("div");
      st.className = "stacks";
      st.textContent = `held ${held}/${def.maxStacks}`;
      card.append(st);
    }
    card.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      input.select(i);
      draftEl.classList.add("hidden");
    });
    draftEl.append(card);
  });
  draftEl.classList.remove("hidden");
}

function start(): void {
  const { w, h } = renderer.size;
  // Daily-seed-ready: swap for a date-derived seed when leaderboards land.
  const seed = (Math.random() * 0xffffffff) >>> 0;
  state = createState(seed, w, h);
  renderer.newRun(seed);
  overlay.classList.add("hidden");
  draftEl.classList.add("hidden");
  hearts.textContent = "\u2665 \u2665 \u2665";
}

startBtn.addEventListener("pointerdown", start);
overlay.addEventListener("pointerdown", () => {
  if (!state || state.phase === "dead") start();
});

function onGameOver(wave: number): void {
  draftEl.classList.add("hidden");
  title.innerHTML = '<span class="hot">FELLED</span>';
  if (paras[0]) paras[0].innerHTML = `You survived to <b>wave ${wave}</b>.<br><br>Stillness is the commitment.`;
  if (paras[1]) paras[1].textContent = "";
  startBtn.textContent = "AGAIN";
  overlay.classList.remove("hidden");
}

// PWA shell. A waiting update is only applied when nothing is at stake: before
// the first run, or once the player has backgrounded the app. Reloading mid-run
// would cost them the wave, and no update is worth that.
initPwa({
  onUpdateReady(apply) {
    if (!state) {
      apply();
      return;
    }
    const onHidden = (): void => {
      if (!document.hidden) return;
      document.removeEventListener("visibilitychange", onHidden);
      apply();
    };
    document.addEventListener("visibilitychange", onHidden);
  },
  onInstallAvailable(show) {
    installBtn.hidden = false;
    installBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation(); // the overlay restarts the run on pointerdown
      installBtn.hidden = true;
      void show();
    });
  },
});

let acc = 0;
let lastT = performance.now();

function frame(now: number): void {
  requestAnimationFrame(frame);
  let elapsed = (now - lastT) / 1000;
  lastT = now;
  if (elapsed > 0.1) elapsed = 0.1; // tab-away guard

  if (state && state.phase !== "dead") {
    acc += elapsed;
    while (acc >= DT) {
      tick(state, input.frame());
      renderer.consume(state.events);
      for (const ev of state.events) {
        if (ev.kind === "waveStarted") waveLabel.textContent = `WAVE ${ev.wave}`;
        if (ev.kind === "playerHit" || ev.kind === "upgradeTaken") {
          hearts.textContent = "\u2665 ".repeat(Math.max(0, state.player.hp)).trim();
        }
        if (ev.kind === "draftOffered") showDraft(ev.options, state.taken, ev.remaining);
        if (ev.kind === "gameOver") onGameOver(ev.wave);
      }
      acc -= DT;
    }
    timeState.textContent = state.timeScale < 0.5 ? "F R O Z E N" : "TIME FLOWS";
    (timeState as HTMLElement).style.color = state.timeScale < 0.5 ? "var(--arcane)" : "var(--gold)";
  }

  if (state) renderer.draw(state, elapsed);
}
requestAnimationFrame(frame);

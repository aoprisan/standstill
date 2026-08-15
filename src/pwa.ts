/**
 * PWA shell: service-worker lifecycle and the install prompt.
 *
 * Render-side code by the rules in CLAUDE.md — it never touches sim state, and
 * it is the only place allowed to reload the page. The one gameplay-relevant
 * rule here: an update is never applied while a run is live. The waiting worker
 * sits until `applyUpdate` is called at a safe moment (title screen, death),
 * because swapping the bundle mid-run would cost the player their wave.
 */

const BASE = import.meta.env.BASE_URL;

/** Chrome's install prompt, absent from lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaHooks {
  /**
   * A new build is cached and waiting. Call `apply` when a reload is harmless;
   * ignoring it is fine too — the update lands on the next cold start.
   */
  onUpdateReady?(apply: () => void): void;
  /** The browser offered an install prompt. Call `show` from a user gesture. */
  onInstallAvailable?(show: () => Promise<void>): void;
}

export function initPwa(hooks: PwaHooks = {}): void {
  installPrompt(hooks);

  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    // No worker is built in dev; evict one left by a production visit so it
    // cannot serve a stale shell over the dev server on the same origin.
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${BASE}sw.js`, { scope: BASE })
      .then((reg) => watchForUpdate(reg, hooks))
      .catch(() => {
        /* offline play is a bonus; a failed registration must not break the game */
      });
  });
}

function watchForUpdate(reg: ServiceWorkerRegistration, hooks: PwaHooks): void {
  // Set only when the page itself asks a waiting worker to take over. The other
  // way a controller can change is the first worker claiming an uncontrolled
  // page, which changes nothing on screen and must not reload a run.
  let applying = false;

  const ready = (worker: ServiceWorker): void => {
    hooks.onUpdateReady?.(() => {
      applying = true;
      // The worker calls skipWaiting, then controllerchange reloads us once.
      worker.postMessage("SKIP_WAITING");
    });
  };

  // Already waiting from a previous visit (only possible if we were controlled).
  if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // "installed" with an existing controller means an update, not a first install.
      if (installing.state === "installed" && navigator.serviceWorker.controller) ready(installing);
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!applying || reloading) return;
    reloading = true;
    location.reload();
  });
}

function installPrompt(hooks: PwaHooks): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep our own affordance instead of the mini-infobar
    const event = e as BeforeInstallPromptEvent;
    hooks.onInstallAvailable?.(async () => {
      await event.prompt();
      await event.userChoice;
    });
  });
}

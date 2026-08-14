/**
 * One-thumb drag + keyboard -> one InputFrame per tick.
 * Owns the "am I moving" smoothing (move-heat) so thumb jitter
 * doesn't flicker the freeze state.
 */
import { DT, type InputFrame } from "../sim/types";

const DRAG_AMP = 1.15;
const KEY_SPEED = 4.5;
const MOVE_THRESHOLD = 0.7;
const HEAT_DECAY = 7;

export class InputSource {
  private active = false;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private moveHeat = 0;
  private keys = new Set<string>();

  attach(target: HTMLElement): void {
    target.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.active = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      this.dx += e.clientX - this.lastX;
      this.dy += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const up = () => {
      this.active = false;
      this.dx = 0;
      this.dy = 0;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  /** Drain accumulated input into a frame for exactly one tick. */
  frame(): InputFrame {
    let mx = 0;
    let my = 0;
    if (this.active && (this.dx !== 0 || this.dy !== 0)) {
      mx = this.dx * DRAG_AMP;
      my = this.dy * DRAG_AMP;
      this.dx = 0;
      this.dy = 0;
    }
    const k = this.keys;
    const kx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const ky = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    if (kx || ky) {
      const kl = Math.hypot(kx, ky);
      mx += (kx / kl) * KEY_SPEED;
      my += (ky / kl) * KEY_SPEED;
    }
    const speed = Math.hypot(mx, my);
    this.moveHeat = speed > MOVE_THRESHOLD ? 1 : Math.max(0, this.moveHeat - DT * HEAT_DECAY);
    return { mx, my, moving: this.moveHeat > 0.05 };
  }
}

import { NITRO_DRAIN } from './game.js';
export const HOLD_MS = 150;
export const RAMP_MS = 100;
export const NITRO_SPEED = [10, 28, 42];
// The control owns exactly one pointer. Timing and charge are independent of FPS.
export function createNitroControl({ now, schedule, unschedule, canPlay, charge, spend, speed,
  step, shortTap, released, activeChanged, updated = () => {} }) {
  let held = null;
  let timer;
  function active(value) {
    if (held && held.active !== value) { held.active = value; activeChanged(value, held.direction); }
  }
  function distance(ms, maximum) {
    const t = ms / 1000, ramp = RAMP_MS / 1000;
    const initial = maximum * .35;
    return t <= ramp ? initial * t + (maximum - initial) * t * t / (2 * ramp)
      : (initial + maximum) * ramp / 2 + (t - ramp) * maximum;
  }
  function update(time) {
    if (!held?.active) return;
    if (!canPlay()) { cancel(); return; }
    const dt = Math.max(0, time - held.last);
    // Never deliver a burst of invisible moves after a stalled/backgrounded frame.
    if (dt > 120) { cancel(); return; }
    const available = Math.min(dt, charge() / (NITRO_DRAIN / 1000));
    spend(available < dt ? charge() : available * NITRO_DRAIN / 1000);
    held.elapsed += available;
    held.last = time;
    const target = Math.floor(distance(held.elapsed, speed()) + 1e-9);
    while (held && held.moves < target && canPlay()) {
      held.moves += 1;
      step(held.direction);
    }
    updated();
    if (held && charge() <= 1e-8) { active(false); unschedule(timer); }
  }
  function loop() {
    update(now());
    if (held?.active) timer = schedule(loop, 8);
  }
  function cancel() {
    unschedule(timer);
    active(false);
    held = null;
    updated();
  }
  function press(direction, id) {
    if (held || !canPlay()) return false;
    held = { direction, id, active: false, activated: false, moves: 0, elapsed: 0, last: 0 };
    timer = schedule(() => {
      if (!held || !canPlay()) { cancel(); return; }
      if (charge() <= 0) return;
      held.activated = true;
      held.last = now();
      active(true);
      timer = schedule(loop, 8);
    }, HOLD_MS);
    return true;
  }
  function release(id, canceled = false) {
    if (!held || held.id !== id) return;
    const owner = held;
    if (!canceled) update(now());
    if (held !== owner) return;
    const exactRelease = held.active && charge() > 1e-8;
    const moved = held.moves > 0;
    const activated = held.activated;
    const direction = held.direction;
    cancel();
    if (canceled || !canPlay()) return;
    if (!activated) shortTap(direction);
    else if (moved) released(exactRelease);
  }
  return { press, release, cancel, get active() { return !!held?.active; }, get holding() { return !!held; } };
}

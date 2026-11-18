// The flood: opening a thing grows its colour from the tap point to fill the screen; Back shrinks it toward the tile.
// Built on the browser's view transitions; without them the page simply changes.
import { flushSync } from 'react-dom';

type Point = { x: number; y: number };
let tap: Point = { x: 180, y: 360 };
let origin: Point | null = null;

if (typeof window !== 'undefined') {
  addEventListener('pointerdown', (e: PointerEvent) => { tap = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
}

const DURATION = 550;
const EASE = 'cubic-bezier(.65,0,.2,1)';

/** Waits until the new screen has its data (no `main[aria-busy]`), at most `max` ms, so the flood carries the page. */
function settled(max = 450): Promise<void> {
  const until = performance.now() + max;
  return new Promise((done) => {
    const check = () => (!document.querySelector('main[aria-busy="true"]') || performance.now() > until ? done() : requestAnimationFrame(check));
    requestAnimationFrame(check);
  });
}

function routeChanged(max = 400): Promise<void> {
  return new Promise((done) => {
    const t = setTimeout(done, max);
    addEventListener('popstate', () => { clearTimeout(t); done(); }, { once: true });
  });
}

type VT = { ready: Promise<void>; finished: Promise<void> };
const start = (cb: () => Promise<void>): VT | null => {
  const d = document as Document & { startViewTransition?: (cb: () => Promise<void>) => VT };
  return d.startViewTransition ? d.startViewTransition(cb) : null;
};
const radius = (p: Point) => Math.hypot(Math.max(p.x, innerWidth - p.x), Math.max(p.y, innerHeight - p.y));

/** True while a flood is opening: the new page delays its rise until the colour has filled the screen. */
export const flooding = () => typeof document !== 'undefined' && document.documentElement.dataset.flood === 'open';

/** Moves to a thing's page with the flood. */
export function floodTo(nav: () => void): void {
  const p = { ...tap };
  const root = document.documentElement;
  root.dataset.flood = 'open';
  const t = start(async () => { flushSync(nav); await settled(); });
  if (!t) { nav(); delete root.dataset.flood; return; }
  origin = p;
  t.ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${p.x}px ${p.y}px)`, `circle(${radius(p)}px at ${p.x}px ${p.y}px)`] }, { duration: DURATION, easing: EASE, pseudoElement: '::view-transition-new(root)' });
    root.animate({ opacity: [1, 0.45] }, { duration: DURATION, easing: 'ease-out', fill: 'forwards', pseudoElement: '::view-transition-old(root)' });
  }).catch(() => {});
  t.finished.finally(() => { delete root.dataset.flood; });
}

/** Back from a thing's page: its colour draws back toward the tile it came from. */
export function floodBack(back: () => void): void {
  const p = origin;
  const root = document.documentElement;
  const t = p ? start(async () => { const moved = routeChanged(); back(); await moved; await settled(); }) : null;
  if (!t || !p) { back(); return; }
  root.dataset.flood = 'close';
  origin = null;
  t.ready.then(() => {
    root.animate({ clipPath: [`circle(${radius(p)}px at ${p.x}px ${p.y}px)`, `circle(0px at ${p.x}px ${p.y}px)`] }, { duration: 450, easing: EASE, fill: 'forwards', pseudoElement: '::view-transition-old(root)' });
    root.animate({ opacity: [0.45, 1] }, { duration: 450, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
  t.finished.finally(() => { delete root.dataset.flood; });
}

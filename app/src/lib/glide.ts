/*
 * Rolagem animada até um elemento (ease-in-out, 0,45 a 0,9 s conforme a
 * distância). O navegador anima a rolagem por conta própria só quando manda,
 * e rápido demais para se ver numa lista longa; aqui a duração acompanha a
 * distância. Qualquer gesto do usuário (roda do mouse, toque) interrompe, e
 * quem pede "reduzir movimento" no sistema recebe o salto direto.
 */

let run = 0;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** O ancestral que realmente rola (a área principal no desktop, a janela no celular) */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function glideTo(el: HTMLElement, opts: { offset?: number; onEnd?: () => void } = {}) {
  const parent = scrollParent(el);
  const offset = opts.offset ?? 0;
  const base = parent ? parent.getBoundingClientRect().top : 0;
  const from = parent ? parent.scrollTop : window.scrollY;
  const to = Math.max(0, from + el.getBoundingClientRect().top - base - offset);
  const scroll = (y: number) => (parent ?? window).scrollTo({ top: y, behavior: "instant" });
  const mine = ++run;
  const dist = to - from;

  if (reduced() || Math.abs(dist) < 4) {
    scroll(to);
    opts.onEnd?.();
    return;
  }
  const duration = Math.min(900, Math.max(450, Math.abs(dist) * 0.45));
  const t0 = performance.now();
  const target: EventTarget = parent ?? window;
  const stop = () => {
    run++;
    target.removeEventListener("wheel", stop);
    target.removeEventListener("touchstart", stop);
  };
  target.addEventListener("wheel", stop, { passive: true });
  target.addEventListener("touchstart", stop, { passive: true });
  const step = (now: number) => {
    if (mine !== run) return;
    const p = Math.min(1, (now - t0) / duration);
    scroll(from + dist * ease(p));
    if (p < 1) requestAnimationFrame(step);
    else {
      stop();
      opts.onEnd?.();
    }
  };
  requestAnimationFrame(step);
}

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Motion is an enhancement: without IntersectionObserver or with "reduce motion" everything is shown at once.
export function canAnimate() {
  return typeof window !== 'undefined'
    && 'IntersectionObserver' in window
    && typeof window.matchMedia === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const TYPE_MS = 22;
const PAUSE_MS = 150;

// The not-yet-typed rest stays in the layout (hidden), so the bubble keeps its final size while typing.
// True once the element has been on screen (stays true); always true when motion is off.
export function useSeenOnce(ref, enabled) {
  const [seen, setSeen] = useState(!enabled);
  useEffect(() => {
    if (!enabled || seen) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, enabled, seen]);
  return seen;
}

export function TypedParagraph({ text }) {
  const ref = useRef(null);
  const [animate] = useState(canAnimate);
  const started = useSeenOnce(ref, animate);
  const [count, setCount] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!started || count >= text.length) return undefined;
    const id = setTimeout(() => setCount(count + 1), /[.?!,:—]/.test(text[count - 1] || '') ? PAUSE_MS : TYPE_MS);
    return () => clearTimeout(id);
  }, [started, count, text]);

  const typing = started && count < text.length;
  if (!animate) return <p ref={ref}><span className="landing-typed">{text}</span></p>;
  // Assistive tech gets the whole answer once; every typing change happens inside the aria-hidden layer
  // (the thread is an aria-live region, so per-character updates there would be announced in fragments).
  return <p ref={ref}>
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">
      <span className="landing-typed">{text.slice(0, count)}</span>
      {typing && <span className="landing-caret" />}
      <span className="landing-typed-rest">{text.slice(count)}</span>
    </span>
  </p>;
}

// Blocks below the first screen fade in once; the demo wheel animates only while it is on screen.
export function useLandingMotion(rootRef) {
  useLayoutEffect(() => {
    if (!canAnimate()) return undefined;
    const root = rootRef.current;
    const reveals = [...root.querySelectorAll(':scope > section:not(.landing-hero) > .shell')];
    const live = [...root.querySelectorAll('.landing-chart-visual')];
    const observer = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => {
      if (target.classList.contains('landing-reveal')) {
        if (isIntersecting) { target.classList.add('is-in'); observer.unobserve(target); }
      } else {
        target.classList.toggle('is-live', isIntersecting);
      }
    }), { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(el => { el.classList.add('landing-reveal'); observer.observe(el); });
    live.forEach(el => observer.observe(el));
    return () => {
      observer.disconnect();
      reveals.forEach(el => el.classList.remove('landing-reveal', 'is-in'));
      live.forEach(el => el.classList.remove('is-live'));
    };
  }, [rootRef]);
}

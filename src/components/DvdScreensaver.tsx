import { useEffect, useRef, useState } from "react";
import logoMark from "@/assets/casefunders-mark.jpg";

const IDLE_MS = 120_000;
const SIZE = 80;
const SPEED = 2; // px per frame

export function DvdScreensaver() {
  const [active, setActive] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ x: 0, y: 0, vx: SPEED, vy: SPEED });

  useEffect(() => {
    let activated = false;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        activated = true;
        setActive(true);
      }, IDLE_MS);
    };
    const onInput = () => {
      if (activated) {
        activated = false;
        setActive(false);
      }
      arm();
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    arm();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onInput));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Compute starting position aimed at a perfect corner bounce.
    // Trick: distance from x to right wall must equal distance from y to bottom wall
    // (both axes scaled by equal speed), so we pick coords so dx == dy.
    const w = window.innerWidth - SIZE;
    const h = window.innerHeight - SIZE;
    const d = Math.min(w, h) / 2;
    stateRef.current = {
      x: (w - d) / 2 + (Math.random() * 20 - 10),
      y: (h - d) / 2 + (Math.random() * 20 - 10),
      vx: SPEED,
      vy: SPEED,
    };
    // To guarantee corner-to-corner: ensure x and y have same parity distance to walls.
    // Snap so that remaining distance to each wall is equal.
    const remX = w - stateRef.current.x;
    stateRef.current.y = h - remX < 0 ? 0 : h - remX;
    if (stateRef.current.y < 0) stateRef.current.y = 0;

    const tick = () => {
      const s = stateRef.current;
      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;
      s.x += s.vx;
      s.y += s.vy;
      if (s.x <= 0) { s.x = 0; s.vx = SPEED; }
      else if (s.x >= maxX) { s.x = maxX; s.vx = -SPEED; }
      if (s.y <= 0) { s.y = 0; s.vy = SPEED; }
      else if (s.y >= maxY) { s.y = maxY; s.vy = -SPEED; }
      if (elRef.current) {
        elRef.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={elRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] animate-fade-in"
      style={{ width: SIZE, height: SIZE, willChange: "transform" }}
    >
      <img
        src={logoMark}
        alt=""
        className="h-full w-full rounded-lg object-contain bg-white p-1 shadow-lg"
      />
    </div>
  );
}

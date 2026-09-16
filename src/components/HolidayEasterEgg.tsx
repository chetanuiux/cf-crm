import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Holiday + birthday Easter egg. Renders a handful of themed floating emojis
 * around the screen on specific US holidays, and balloons on the user's birthday.
 * Pointer-events disabled so it never blocks the UI.
 */

type Theme = {
  key: string;
  emojis: string[];
  count: number;
  mode: "float" | "fall"; // float drifts upward; fall drops downward
};

// 4th Thursday of November
function thanksgiving(year: number) {
  const d = new Date(year, 10, 1);
  const offset = (4 - d.getDay() + 7) % 7; // first Thursday
  return new Date(year, 10, 1 + offset + 21);
}

// Last Monday of May
function memorialDay(year: number) {
  const d = new Date(year, 5, 0); // May 31
  const offset = (d.getDay() - 1 + 7) % 7;
  return new Date(year, 4, 31 - offset);
}

// First Monday of September
function laborDay(year: number) {
  const d = new Date(year, 8, 1);
  const offset = (1 - d.getDay() + 7) % 7;
  return new Date(year, 8, 1 + offset);
}

// Second Monday of October
function columbusDay(year: number) {
  const d = new Date(year, 9, 1);
  const offset = (1 - d.getDay() + 7) % 7;
  return new Date(year, 9, 1 + offset + 7);
}

// 3rd Monday of January (MLK), February (Presidents)
function nthMonday(year: number, monthIdx: number, nth: number) {
  const d = new Date(year, monthIdx, 1);
  const offset = (1 - d.getDay() + 7) % 7;
  return new Date(year, monthIdx, 1 + offset + (nth - 1) * 7);
}

function sameMonthDay(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getTheme(today: Date, birthday: Date | null): Theme | null {
  // Birthday wins over everything
  if (birthday && sameMonthDay(today, birthday)) {
    return { key: "birthday", emojis: ["🎈", "🎂", "🎉", "🥳", "🎁"], count: 18, mode: "fall" };
  }

  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // Fixed dates
  if (m === 0 && d === 1) return { key: "new-year", emojis: ["🎉", "🥂", "✨", "🎊"], count: 14, mode: "float" };
  if (m === 1 && d === 14) return { key: "valentines", emojis: ["💖", "💘", "💕", "🌹"], count: 14, mode: "float" };
  if (m === 2 && d === 17) return { key: "st-patricks", emojis: ["🍀", "☘️", "💚"], count: 14, mode: "float" };
  if (m === 3 && d === 1) return { key: "april-fools", emojis: ["🃏", "🎭", "😜"], count: 10, mode: "float" };
  if (m === 4 && d === 5) return { key: "cinco", emojis: ["🌮", "🎉", "🪅"], count: 12, mode: "float" };
  if (m === 6 && d === 4) return { key: "july-4", emojis: ["🎆", "🎇", "🇺🇸", "✨"], count: 16, mode: "float" };
  if (m === 9 && d === 31) return { key: "halloween", emojis: ["👻", "🎃", "🦇", "🕸️"], count: 14, mode: "float" };
  if (m === 10 && d === 11) return { key: "veterans", emojis: ["🇺🇸", "🎖️"], count: 10, mode: "float" };
  if (m === 11 && (d === 24 || d === 25)) return { key: "christmas", emojis: ["🎄", "❄️", "🎁", "⛄"], count: 18, mode: "fall" };
  if (m === 11 && d === 31) return { key: "nye", emojis: ["🎆", "🥂", "✨", "🎊"], count: 16, mode: "float" };

  // Floating dates
  if (sameMonthDay(today, nthMonday(y, 0, 3))) return { key: "mlk", emojis: ["✊", "🕊️", "❤️"], count: 10, mode: "float" };
  if (sameMonthDay(today, nthMonday(y, 1, 3))) return { key: "presidents", emojis: ["🇺🇸", "🎩"], count: 10, mode: "float" };
  if (sameMonthDay(today, memorialDay(y))) return { key: "memorial", emojis: ["🇺🇸", "🌹", "🎖️"], count: 12, mode: "float" };
  if (sameMonthDay(today, laborDay(y))) return { key: "labor", emojis: ["🔨", "👷", "🛠️"], count: 10, mode: "float" };
  if (sameMonthDay(today, columbusDay(y))) return { key: "columbus", emojis: ["🌎", "🪶"], count: 10, mode: "float" };
  if (sameMonthDay(today, thanksgiving(y))) return { key: "thanksgiving", emojis: ["🦃", "🍂", "🥧", "🌽"], count: 14, mode: "float" };

  return null;
}

type Sprite = { id: number; left: number; delay: number; duration: number; size: number; emoji: string };

export function HolidayEasterEgg() {
  const { user } = useAuth();
  const [birthday, setBirthday] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("birthday").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.birthday) {
        // parse YYYY-MM-DD as local date (avoid TZ shift)
        const [yy, mm, dd] = data.birthday.split("-").map(Number);
        setBirthday(new Date(yy, mm - 1, dd));
      }
    });
  }, [user]);

  const theme = useMemo(() => getTheme(new Date(), birthday), [birthday]);

  const sprites = useMemo<Sprite[]>(() => {
    if (!theme) return [];
    return Array.from({ length: theme.count }).map((_, i) => ({
      id: i,
      left: Math.random() * 96 + 2,
      delay: Math.random() * 8,
      duration: 8 + Math.random() * 8,
      size: 24 + Math.random() * 20,
      emoji: theme.emojis[i % theme.emojis.length],
    }));
  }, [theme]);

  if (!theme) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes ee-float-up {
          0% { transform: translateY(110vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translateY(-15vh) rotate(20deg); opacity: 0; }
        }
        @keyframes ee-fall-down {
          0% { transform: translateY(-15vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(-25deg); opacity: 0; }
        }
      `}</style>
      {sprites.map((s) => (
        <span
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: 0,
            fontSize: `${s.size}px`,
            animation: `${theme.mode === "fall" ? "ee-fall-down" : "ee-float-up"} ${s.duration}s linear ${s.delay}s infinite`,
            willChange: "transform, opacity",
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}

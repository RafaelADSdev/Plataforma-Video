"use client";

import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { applyTheme, readStoredTheme, type Theme } from "@/lib/theme";

const durationMs = 560;

function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function revealTheme(event: MouseEvent<HTMLButtonElement>, theme: Theme) {
  const origin = event.currentTarget.getBoundingClientRect();
  const x = origin.left + origin.width / 2;
  const y = origin.top + origin.height / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const root = document.documentElement;

  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    applyTheme(theme);
    return;
  }

  root.classList.add("theme-changing");
  const transition = document.startViewTransition(() => {
    applyTheme(theme);
  });

  try {
    await transition.ready;
    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: durationMs,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    );
    await transition.finished;
  } finally {
    root.classList.remove("theme-changing");
  }
}

export function ThemeToggle() {
  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label="Alternar entre modo claro e escuro"
      title="Alternar tema"
      onClick={(event) => {
        void revealTheme(event, nextTheme(readStoredTheme()));
      }}
    >
      <Moon className="theme-icon-moon" aria-hidden="true" size={18} />
      <Sun className="theme-icon-sun" aria-hidden="true" size={18} />
    </button>
  );
}

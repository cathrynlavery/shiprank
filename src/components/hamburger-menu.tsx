"use client";

import { useEffect, useId, useRef, useState } from "react";

export function HamburgerMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="topline-menu" ref={containerRef}>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div
        id={panelId}
        className="menu-panel"
        data-open={open ? "true" : "false"}
        onClick={(event) => {
          // Close when an interior link is activated. ThemeToggle/sign-in don't
          // navigate, so they keep the menu open.
          if (
            event.target instanceof HTMLElement &&
            event.target.closest("a")
          ) {
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

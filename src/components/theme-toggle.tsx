"use client";

export function ThemeToggle() {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <svg
        className="theme-toggle-icon theme-toggle-moon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20.4 14.6A8.3 8.3 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11Z" />
      </svg>
      <svg
        className="theme-toggle-icon theme-toggle-sun"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
    </button>
  );
}

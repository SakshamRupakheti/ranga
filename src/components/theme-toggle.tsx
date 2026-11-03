"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
const subscribe = (callback: () => void) => {
  window.addEventListener("ranga-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("ranga-theme", callback);
    window.removeEventListener("storage", callback);
  };
};
function snapshot() {
  try {
    return localStorage.getItem("ranga-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <button
      className="icon-button"
      aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={() => {
        try {
          localStorage.setItem(
            "ranga-theme",
            theme === "dark" ? "light" : "dark",
          );
          window.dispatchEvent(new Event("ranga-theme"));
        } catch {
          /* Storage can be disabled by the browser. */
        }
      }}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

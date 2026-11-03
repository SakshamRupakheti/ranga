"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Palette, Settings2, ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="wordmark" href="/">
          Ranga<span className="wordmark-period">.</span>
        </Link>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav>
          {[
            { href: "/projects", icon: FolderOpen, label: "Projects" },
            { href: "/brand", icon: Palette, label: "Brand kit" },
            { href: "/settings", icon: Settings2, label: "Settings" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={path === item.href ? "active" : ""}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ThemeToggle />
          <Link href="/login" className="text-link">
            Ranga account
          </Link>
          <span className="status-dot" /> Local workspace
          <p>
            Saved on this device.
            <br />
            Made by you.
          </p>
          <Link href="/settings">
            About local storage <ArrowUpRight size={13} />
          </Link>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}

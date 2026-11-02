import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ranga | A space to shape your ideas",
  description:
    "An editable graphic design workspace. Compose, refine, and make it yours.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

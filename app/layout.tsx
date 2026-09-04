import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ceylon Capital — Colombo Stock Exchange Portfolio",
  description: "Track your CSE portfolio, calculate averages, and visualise gains.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

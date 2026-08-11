import { Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";

// Archivo carries the voice: a grotesque with enough width variation to set
// headlines tight and heavy without reading as another Inter dashboard.
const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Martian Mono is the instrument face. This console is fundamentally a diff
// reader, so the monospace is not a caption font here — it carries the data.
const mono = Martian_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "SENTINEL — Ecosystem Change Intelligence",
  description:
    "SENTINEL continuously watches the Android security, API, and policy surface — detecting change, triaging risk with a multi-agent pipeline, and turning it into evidence-backed action tickets.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

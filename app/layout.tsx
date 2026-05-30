import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Inter for body — industry benchmark for legibility at small sizes,
// taller x-height than Geist, cleaner numerals. Loaded as a variable font
// so any weight (incl. interpolated 450) renders cleanly.
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Keep Geist Mono for stats / scores / kbd shortcuts.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RIEL.GG — System Activated. Competition Elevated.",
    template: "%s · RIEL.GG",
  },
  description:
    "RIEL.GG is the premium league management platform for the Hoosier Esports Alliance — built for educators, coaches, and players.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

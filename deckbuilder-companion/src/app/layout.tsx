import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { DeckViewPreferencesProvider } from "@/features/deck/DeckViewPreferences";
import { LegalFooter } from "@/features/legal/LegalFooter";
import { AutosaveGate } from "@/features/workspace/AutosaveGate";
import { WorkspaceProvider } from "@/state/WorkspaceProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deckbuilder Companion",
  description:
    "Import an MTGO decklist, build a sideboard plan for every matchup, and export it for the tournament.",
};

/**
 * Root layout.
 *
 * `children` is typed explicitly rather than with Next's generated `LayoutProps`
 * global, so `tsc --noEmit` does not depend on `.next/types` having been built
 * first. That keeps the CI typecheck job independent of the build job.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <WorkspaceProvider>
          <DeckViewPreferencesProvider>
            <SiteHeader />
            <AutosaveGate>
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
            </AutosaveGate>
            <LegalFooter />
          </DeckViewPreferencesProvider>
        </WorkspaceProvider>
      </body>
    </html>
  );
}

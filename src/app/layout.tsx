import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CompScope — Level-aware compensation intelligence",
    template: "%s · CompScope",
  },
  description:
    "Compare compensation across companies, levels, roles and locations. Base, bonus, stock and total — normalized and benchmarked.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#fafaf9] font-sans text-stone-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-stone-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Nav user={user} />
        <main id="main" className="animate-rise">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

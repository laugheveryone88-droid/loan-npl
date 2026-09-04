import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Loan NPL",
    template: "%s | Loan NPL",
  },
  description: "Зээлийн багц болон чанаргүй зээлийн удирдлагын систем.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mn"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className={`${GeistSans.className} min-h-full flex flex-col`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

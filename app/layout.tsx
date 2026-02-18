import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { MigrationBanner } from "@/components/migration-banner";
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
  title: "LogixWeave - Studio 5000 Toolkit",
  description: "Parse, analyze, and document your Studio 5000 PLC projects",
  metadataBase: new URL("https://www.logixweave.com"),
  openGraph: {
    title: "LogixWeave - Studio 5000 Toolkit",
    description: "Parse, analyze, and document your Studio 5000 PLC projects",
    siteName: "LogixWeave",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LogixWeave - Studio 5000 Toolkit",
    description: "Parse, analyze, and document your Studio 5000 PLC projects",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <MigrationBanner />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

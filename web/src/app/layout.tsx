import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relay · Gateway Control Plane",
  description:
    "Operations dashboard for the go-api-gateway relay service. Inspect traffic, " +
    "test routes through the gateway, monitor circuit breaker state, and explore " +
    "Prometheus metrics in real time.",
  keywords: [
    "API Gateway",
    "Go",
    "Relay",
    "Reverse Proxy",
    "JWT",
    "Rate Limiting",
    "Circuit Breaker",
    "Prometheus",
    "OpenTelemetry",
    "Observability",
  ],
  authors: [{ name: "Imronaxl" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

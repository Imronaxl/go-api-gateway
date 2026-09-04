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
  title: "Relay · Панель управления gateway",
  description:
    "Operations-дашборд для сервиса go-api-gateway. Инспекция трафика, " +
    "тестирование маршрутов через gateway, мониторинг состояния circuit breaker " +
    "и просмотр Prometheus-метрик в реальном времени.",
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
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

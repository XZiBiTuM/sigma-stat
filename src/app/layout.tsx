import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sigma Zadrots",
  description: "Удобный дашборд статистики FACEIT хабов. Таблицы лидеров, статистика матчей и профили игроков на русском языке.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  );
}

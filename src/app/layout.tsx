import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#06050a"
};

export const metadata: Metadata = {
  title: "Sigma Zadrots",
  description: "Удобный дашборд статистики FACEIT хабов. Таблицы лидеров, статистика матчей и профили игроков на русском языке.",
  icons: {
    icon: [
      { url: "/sigma-logo.png", type: "image/png" },
      { url: "/favicon.ico" }
    ],
    shortcut: "/sigma-logo.png",
    apple: "/sigma-logo.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function autoReloadOnDeployError(msg) {
                  if (msg && (msg.indexOf('Server Action') !== -1 || msg.indexOf('Loading chunk') !== -1 || msg.indexOf('older or newer deployment') !== -1)) {
                    console.warn('Deployment hash mismatch detected, reloading page...');
                    window.location.reload();
                  }
                }
                window.addEventListener('error', function(e) {
                  autoReloadOnDeployError(e && e.message);
                });
                window.addEventListener('unhandledrejection', function(e) {
                  autoReloadOnDeployError(e && e.reason && e.reason.message);
                });
              })();
            `
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

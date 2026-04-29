import "./globals.css";
import { Providers } from "../components/Providers";
import { Navbar } from "../components/Navbar";

export const metadata = {
  title: "KAZ CHESS",
  description: "KAZ CHESS — play vs Stockfish with timers and history",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <Navbar />
            <div className="flex-1">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

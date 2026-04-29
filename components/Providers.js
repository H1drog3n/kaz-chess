"use client";

import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { LocaleProvider } from "../contexts/LocaleContext";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

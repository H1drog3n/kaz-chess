import { redirect } from "next/navigation";

/** Настройки объединены с профилем: /profile */
export default function SettingsRedirectPage() {
  redirect("/profile");
}

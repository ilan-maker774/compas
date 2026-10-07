import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { db } from "@/server/db";
import { USER_COOKIE } from "@/server/current-user";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Compas", template: "%s · Compas" },
  description:
    "Aide à la décision pour investisseurs particuliers. Constate, calcule, ne recommande jamais.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

async function themePreference() {
  const id = (await cookies()).get(USER_COOKIE)?.value;
  const [user] =
    id && /^[0-9a-f-]{36}$/.test(id)
      ? await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, id))
      : await db.select({ preferences: users.preferences }).from(users).limit(1);
  return user?.preferences.theme ?? "system";
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" data-theme={await themePreference()} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

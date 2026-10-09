// Publiczny adres aplikacji do linków w mailach.
// Lokalny .env ma NEXTAUTH_URL=localhost — taki link nie działa u rodzica, więc wtedy bierzemy produkcję.
const PROD_URL = "https://swh-manager.vercel.app";

export function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return PROD_URL;
  return url.replace(/\/$/, "");
}

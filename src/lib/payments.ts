// Wspólne reguły płatności: dane do przelewu, kod w tytule, termin 15. dnia miesiąca, QR do przelewu.

export const SWH_BANK = {
  // Santander Bank Polska – konto Stowarzyszenia Wybieram Hokej
  account: "56109026880000000160136130",
  accountFormatted: "56 1090 2688 0000 0001 6013 6130",
  recipient: "Stowarzyszenie Wybieram Hokej",
  // Pole „nazwa odbiorcy” w kodzie QR ZBP ma limit 20 znaków
  recipientShort: "Stow Wybieram Hokej",
};

// Dzień miesiąca, do którego płaci się składkę miesięczną
export const MONTHLY_DUE_DAY = 15;

// Unikalny kod płatności do tytułu przelewu, np. "SWH-4F2K9Q".
// Pozwala importowi wyciągu jednoznacznie dopasować wpłatę.
export function paymentReference(paymentId: string): string {
  return `SWH-${paymentId.slice(-6).toUpperCase()}`;
}

export const PAYMENT_REFERENCE_REGEX = /SWH-([A-Z0-9]{6})/i;

// Tytuł przelewu: kod + imię i nazwisko zawodnika (+ nazwa składki, jeśli się zmieści)
export function transferTitle(paymentId: string, playerName: string, feeName?: string): string {
  const base = `${paymentReference(paymentId)} ${playerName}`;
  const full = feeName ? `${base} ${feeName}` : base;
  return full.length <= 32 ? full : base.slice(0, 32);
}

// Najbliższy 15. dzień miesiąca (dziś lub później)
export function nextMonthlyDueDate(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), MONTHLY_DUE_DAY);
  if (d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// Treść kodu QR do przelewu w standardzie ZBP („2D”), czytana przez aplikacje polskich banków:
// NIP|KRAJ|NRB|KWOTA(grosze, 6 cyfr)|NAZWA(≤20)|TYTUŁ(≤32)|||
export function zbpTransferQr(amountPln: number, title: string): string {
  const clean = (s: string, max: number) =>
    s.replace(/\|/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const grosze = Math.round(amountPln * 100);
  const amount = String(Math.min(grosze, 999999)).padStart(6, "0");
  return [
    "",
    "PL",
    SWH_BANK.account,
    amount,
    clean(SWH_BANK.recipientShort, 20),
    clean(title, 32),
    "",
    "",
    "",
  ].join("|");
}

// Ile pełnych dni od terminu (ujemne = przed terminem), liczone po datach kalendarzowych
export function daysFromDue(dueDate: Date, today: Date = new Date()): number {
  const a = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((b - a) / 86400000);
}

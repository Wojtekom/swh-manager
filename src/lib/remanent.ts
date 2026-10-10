// Układ karty remanentu — ten sam co na papierowej karcie (Downloads\SWH_Remanent_Sprzetu_2026).
// Każdy wiersz karty to jeden rekord Equipment: kategoria + nazwa + rozmiar.

export type EquipmentCategoryKey =
  | "HELMET" | "SKATES" | "STICK" | "GLOVES" | "PADS" | "JERSEY" | "PANTS" | "BAG"
  | "GOALIE_GEAR" | "NECK_GUARD" | "TRAINING_AID" | "OTHER";

export interface RemanentCat {
  key: string;
  label: string;
  category: EquipmentCategoryKey;
  name: string; // nazwa rekordu Equipment
  sizes: string[]; // stałe wiersze; puste = rozmiary dopisywane ręcznie
}

export const REMANENT_CATS: RemanentCat[] = [
  { key: "kask", label: "Kaski z kratą", category: "HELMET", name: "Kask z kratą", sizes: ["YTH/XS", "S", "M", "L"] },
  { key: "rekawice", label: "Rękawice", category: "GLOVES", name: "Rękawice", sizes: ['8"', '9"', '10"', '11"', '12"'] },
  { key: "naramienniki", label: "Naramienniki", category: "PADS", name: "Naramienniki", sizes: ["YTH", "JR S", "JR M", "JR L", "SR"] },
  { key: "lokcie", label: "Ochraniacze łokci", category: "PADS", name: "Ochraniacze łokci", sizes: ["YTH", "JR S", "JR M", "JR L", "SR"] },
  { key: "nagolenniki", label: "Nagolenniki", category: "PADS", name: "Nagolenniki", sizes: ['8"', '9"', '10"', '11"', '12"', '13"+'] },
  { key: "spodnie", label: "Spodnie hokejowe", category: "PANTS", name: "Spodnie hokejowe", sizes: ["YTH", "JR S", "JR M", "JR L", "SR"] },
  { key: "kij", label: "Kije", category: "STICK", name: "Kij", sizes: ["YTH", "JR", "INT", "SR"] },
  { key: "lyzwy", label: "Łyżwy", category: "SKATES", name: "Łyżwy", sizes: [] },
  { key: "szyja", label: "Ochraniacze szyi / suspensoria", category: "NECK_GUARD", name: "Ochraniacz szyi", sizes: ["YTH", "JR", "SR"] },
  { key: "zestaw", label: "Zestawy startowe dziecięce (komplet)", category: "OTHER", name: "Zestaw startowy dziecięcy", sizes: ["komplet"] },
  { key: "koszulki", label: "Koszulki / getry", category: "JERSEY", name: "Koszulki / getry", sizes: ["—"] },
  { key: "torby", label: "Torby", category: "BAG", name: "Torba", sizes: ["—"] },
  { key: "br_lyzwy", label: "Bramkarz – łyżwy bramkarskie", category: "GOALIE_GEAR", name: "Łyżwy bramkarskie", sizes: [] },
  { key: "br_parkany", label: "Bramkarz – parkany", category: "GOALIE_GEAR", name: "Parkany bramkarskie", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_lapaczka", label: "Bramkarz – łapaczka (łapawica)", category: "GOALIE_GEAR", name: "Łapaczka bramkarska", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_zbijaczka", label: "Bramkarz – zbijaczka", category: "GOALIE_GEAR", name: "Zbijaczka bramkarska", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_kamizelka", label: "Bramkarz – kamizelka (napierśnik)", category: "GOALIE_GEAR", name: "Kamizelka bramkarska", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_krocze", label: "Bramkarz – ochraniacz krocza", category: "GOALIE_GEAR", name: "Ochraniacz krocza bramkarski", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_szyja", label: "Bramkarz – ochraniacz szyi", category: "GOALIE_GEAR", name: "Ochraniacz szyi bramkarski", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_maska", label: "Bramkarz – maska", category: "GOALIE_GEAR", name: "Maska bramkarska", sizes: ["YTH","JR","INT","SR"] },
  { key: "br_kij", label: "Bramkarz – kij bramkarski", category: "GOALIE_GEAR", name: "Kij bramkarski", sizes: ["YTH","JR","INT","SR"] },
  { key: "krazki", label: "Krążki", category: "TRAINING_AID", name: "Krążki", sizes: ["lód", "in-line"] },
  { key: "pomoce", label: "Pachołki, płotki, drabinki, inne pomoce", category: "TRAINING_AID", name: "Pomoce treningowe", sizes: ["—"] },
];

// Kolumny części 2 (wypożyczone zawodnikom) → kategoria karty
export const REMANENT_LOAN_ITEMS: { key: string; label: string; cat: string }[] = [
  { key: "kask", label: "Kask", cat: "kask" },
  { key: "rekawice", label: "Rękawice", cat: "rekawice" },
  { key: "naramienniki", label: "Naramienniki", cat: "naramienniki" },
  { key: "lokcie", label: "Łokcie", cat: "lokcie" },
  { key: "nagolenniki", label: "Nagolenniki", cat: "nagolenniki" },
  { key: "spodnie", label: "Spodnie", cat: "spodnie" },
  { key: "kij", label: "Kij", cat: "kij" },
  { key: "lyzwy", label: "Łyżwy", cat: "lyzwy" },
  { key: "szyja", label: "Ochr. szyi", cat: "szyja" },
];

// Litery stanu z papierowej karty
export const STAN_TO_CONDITION: Record<string, "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED"> = {
  N: "NEW",
  D: "GOOD",
  "Ś": "FAIR",
  Z: "POOR",
  U: "DAMAGED",
};
export const CONDITION_TO_STAN: Record<string, string> = Object.fromEntries(
  Object.entries(STAN_TO_CONDITION).map(([k, v]) => [v, k])
);

export const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[”″]/g, '"');

export function catByKey(key: string) {
  return REMANENT_CATS.find((c) => c.key === key);
}

// Czy rekord Equipment należy do wiersza karty (kategoria + nazwa; rozmiar osobno)
export function matchesCat(e: { category: string; name: string }, cat: RemanentCat) {
  if (e.category !== cat.category) return false;
  const n = norm(e.name);
  const target = norm(cat.name);
  // kategorie z jednym wierszem w karcie: wystarczy kategoria
  const shared = REMANENT_CATS.filter((c) => c.category === cat.category).length > 1;
  return shared ? n === target : true;
}

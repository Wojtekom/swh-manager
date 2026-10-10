"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  REMANENT_CATS,
  REMANENT_LOAN_ITEMS,
  CONDITION_TO_STAN,
  matchesCat,
  norm,
} from "@/lib/remanent";

interface EqItem {
  id: string;
  name: string;
  category: string;
  size: string | null;
  brand: string | null;
  location: string | null;
  notes: string | null;
  condition: string;
  available: number;
}
interface LoanItem {
  status: string;
  player: { id: string };
  equipment: { name: string; category: string; size: string | null };
}
interface PlayerItem {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  status?: string;
}

type Row = { qty: string; stan: string; brand: string; location: string; notes: string; dirty?: boolean };
type LoanCell = { has: boolean; size: string; dirty?: boolean };
type Brak = { id: string; czego: string; cat: string; rozmiar: string; ile: string; dla: string; zrodlo: string };

const STANY = ["", "N", "D", "Ś", "Z", "U"];
const ZRODLA = ["", "ORLEN", "LOTTO", "Miasto", "sponsor", "giełda", "inne"];
const DRAFT_KEY = "swh-remanent-draft";
const rowKey = (cat: string, size: string) => `${cat}|${size}`;

export function RemanentTab({
  equipment,
  loans,
  players,
  onSaved,
}: {
  equipment: EqItem[];
  loans: LoanItem[];
  players: PlayerItem[];
  onSaved: () => void;
}) {
  const [part, setPart] = useState<"mag" | "wyp" | "bra">("mag");

  // Stan początkowy = to, co już jest w magazynie i w wypożyczeniach
  const initial = useMemo(() => {
    const rows: Record<string, Row> = {};
    const extraSizes: Record<string, string[]> = {};
    for (const e of equipment) {
      const cat = REMANENT_CATS.find((c) => matchesCat(e, c));
      if (!cat) continue;
      const fixed = cat.sizes.find((s) => norm(s) === norm(e.size ?? "—"));
      const size = fixed ?? (e.size || "—");
      if (!fixed) (extraSizes[cat.key] ||= []).push(size);
      rows[rowKey(cat.key, size)] = {
        qty: String(e.available),
        stan: CONDITION_TO_STAN[e.condition] ?? "",
        brand: e.brand ?? "",
        location: e.location ?? "",
        notes: e.notes ?? "",
      };
    }
    const cells: Record<string, LoanCell> = {};
    for (const l of loans) {
      if (l.status !== "ACTIVE" && l.status !== "OVERDUE") continue;
      const cat = REMANENT_CATS.find((c) => matchesCat(l.equipment, c));
      const item = cat && REMANENT_LOAN_ITEMS.find((i) => i.cat === cat.key);
      if (item) cells[`${l.player.id}|${item.key}`] = { has: true, size: l.equipment.size ?? "" };
    }
    return { rows, extraSizes, cells };
  }, [equipment, loans]);

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [extra, setExtra] = useState<Record<string, string[]>>({});
  const [cells, setCells] = useState<Record<string, LoanCell>>({});
  const [braki, setBraki] = useState<Brak[]>([]);
  const [search, setSearch] = useState("");
  const [onlyWith, setOnlyWith] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  // Wczytaj stan z bazy + niezapisany szkic z tego urządzenia
  useEffect(() => {
    let draft: { rows?: Record<string, Row>; extra?: Record<string, string[]>; cells?: Record<string, LoanCell>; braki?: Brak[] } = {};
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    } catch {}
    setRows({ ...initial.rows, ...(draft.rows || {}) });
    const ex: Record<string, string[]> = { ...initial.extraSizes };
    for (const [k, v] of Object.entries(draft.extra || {})) ex[k] = Array.from(new Set([...(ex[k] || []), ...v]));
    setExtra(ex);
    setCells({ ...initial.cells, ...(draft.cells || {}) });
    setBraki(draft.braki || []);
  }, [initial]);

  function persist(next: { rows?: Record<string, Row>; extra?: Record<string, string[]>; cells?: Record<string, LoanCell>; braki?: Brak[] }) {
    try {
      const dirtyRows = Object.fromEntries(Object.entries(next.rows ?? rows).filter(([, r]) => r.dirty));
      const dirtyCells = Object.fromEntries(Object.entries(next.cells ?? cells).filter(([, c]) => c.dirty));
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ rows: dirtyRows, extra: next.extra ?? extra, cells: dirtyCells, braki: next.braki ?? braki })
      );
    } catch {}
  }

  function setRow(key: string, patch: Partial<Row>) {
    const cur = rows[key] ?? { qty: "", stan: "", brand: "", location: "", notes: "" };
    const next = { ...rows, [key]: { ...cur, ...patch, dirty: true } };
    setRows(next);
    persist({ rows: next });
  }
  function setCell(key: string, patch: Partial<LoanCell>) {
    const cur = cells[key] ?? { has: false, size: "" };
    const next = { ...cells, [key]: { ...cur, ...patch, dirty: true } };
    setCells(next);
    persist({ cells: next });
  }
  function addSize(catKey: string) {
    // nowy wiersz z tymczasową nazwą; rozmiar wpisuje się w pierwszym polu
    const label = `nowy ${((extra[catKey] || []).length + 1)}`;
    const next = { ...extra, [catKey]: [...(extra[catKey] || []), label] };
    setExtra(next);
    persist({ extra: next });
  }
  function renameSize(catKey: string, oldSize: string, newSize: string) {
    const list = (extra[catKey] || []).map((s) => (s === oldSize ? newSize : s));
    const nextExtra = { ...extra, [catKey]: list };
    const nextRows = { ...rows };
    if (nextRows[rowKey(catKey, oldSize)]) {
      nextRows[rowKey(catKey, newSize)] = { ...nextRows[rowKey(catKey, oldSize)], dirty: true };
      delete nextRows[rowKey(catKey, oldSize)];
    }
    setExtra(nextExtra);
    setRows(nextRows);
    persist({ extra: nextExtra, rows: nextRows });
  }
  function setBrak(id: string, patch: Partial<Brak>) {
    const next = braki.map((b) => (b.id === id ? { ...b, ...patch } : b));
    setBraki(next);
    persist({ braki: next });
  }

  const activePlayers = players
    .filter((p) => !p.status || p.status === "ACTIVE")
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "pl"));
  const hasGear = (pid: string) => REMANENT_LOAN_ITEMS.some((i) => cells[`${pid}|${i.key}`]?.has);

  const dirtyRows = Object.entries(rows).filter(([k, r]) => r.dirty && r.qty !== "" && !k.split("|")[1].startsWith("nowy "));
  const dirtyCells = Object.entries(cells).filter(([, c]) => c.dirty);
  const filledBraki = braki.filter((b) => b.czego.trim());
  const changes = dirtyRows.length + dirtyCells.length + filledBraki.length;
  const totalMag = Object.values(rows).reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const kidsWithGear = activePlayers.filter((p) => hasGear(p.id)).length;

  async function save() {
    setSaving(true);
    try {
      const body = {
        magazyn: dirtyRows.map(([k, r]) => {
          const [cat, size] = k.split("|");
          return { cat, size, qty: Number(r.qty), stan: r.stan || undefined, brand: r.brand, location: r.location, notes: r.notes };
        }),
        wypozyczenia: dirtyCells.map(([k, c]) => {
          const [playerId, item] = k.split("|");
          const cat = REMANENT_LOAN_ITEMS.find((i) => i.key === item)!.cat;
          return { playerId, cat, has: c.has, size: c.size };
        }),
        braki: filledBraki.map((b) => ({
          czego: b.czego.trim(),
          cat: b.cat || undefined,
          rozmiar: b.rozmiar,
          ile: Math.max(1, Number(b.ile) || 1),
          dla: b.dla,
          zrodlo: b.zrodlo,
        })),
      };
      const res = await fetch("/api/equipment/remanent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Nie udało się zapisać remanentu");
        return;
      }
      toast.success(
        `Zapisano: ${data.rows} pozycji magazynu, ${data.loansCreated} nowych wypożyczeń, ${data.loansReturned} zwrotów, ${data.braki} braków w Zapotrzebowaniu`
      );
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setBraki([]);
      setConfirming(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
        <p className="font-medium flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4" /> Karta remanentu – jak na papierze
        </p>
        <p className="text-muted-foreground">
          Wpisz, ile sztuk <b>leży w magazynie</b>, zaznacz, co <b>dzieci mają z klubu</b>, i dopisz <b>braki</b>. Wpisy
          zapamiętują się na tym urządzeniu; do SWH Managera trafiają po kliknięciu „Zapisz remanent”. Stan: N nowy · D dobry ·
          Ś średni · Z zużyty · U uszkodzony. Kije: L – lewy, P – prawy chwyt.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {([
          ["mag", `1. Magazyn (${totalMag} szt.)`],
          ["wyp", `2. Wypożyczone (${kidsWithGear})`],
          ["bra", `3. Braki (${filledBraki.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPart(k)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              part === k ? "border-sky-500 text-sky-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {part === "mag" && (
        <div className="space-y-3">
          {REMANENT_CATS.map((cat) => {
            const sizes = [...cat.sizes, ...(extra[cat.key] || [])];
            const sum = sizes.reduce((s, sz) => s + (Number(rows[rowKey(cat.key, sz)]?.qty) || 0), 0);
            return (
              <div key={cat.key} className="border rounded-lg overflow-hidden">
                <div className="flex items-baseline justify-between px-3 py-2 bg-muted/40 border-b">
                  <p className="font-semibold text-sm">{cat.label}</p>
                  {sum > 0 && <span className="text-xs text-muted-foreground">{sum} szt.</span>}
                </div>
                {sizes.map((size) => {
                  const k = rowKey(cat.key, size);
                  const r = rows[k] ?? { qty: "", stan: "", brand: "", location: "", notes: "" };
                  const custom = !cat.sizes.includes(size);
                  return (
                    <div key={k} className="px-3 py-2 border-t first:border-t-0 space-y-2">
                      <div className="grid grid-cols-[5.5rem_4.5rem_4.5rem_1fr] gap-2 items-center">
                        {custom ? (
                          <Input
                            id={`sz-${k}`}
                            defaultValue={size.startsWith("nowy ") ? "" : size}
                            placeholder={cat.key.endsWith("lyzwy") ? "np. 30" : "rozmiar"}
                            className="h-9 font-semibold"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== size) renameSize(cat.key, size, v);
                            }}
                          />
                        ) : (
                          <span className={cn("text-sm font-semibold", Number(r.qty) > 0 && "text-sky-700")}>{size}</span>
                        )}
                        <Input
                          id={`q-${k}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="ilość"
                          value={r.qty}
                          onChange={(e) => setRow(k, { qty: e.target.value })}
                          className="h-9 text-center tabular-nums"
                        />
                        <select
                          id={`s-${k}`}
                          aria-label="Stan"
                          value={r.stan}
                          onChange={(e) => setRow(k, { stan: e.target.value })}
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                        >
                          {STANY.map((s) => (
                            <option key={s} value={s}>
                              {s || "stan"}
                            </option>
                          ))}
                        </select>
                        <Input
                          id={`b-${k}`}
                          placeholder="marka / model"
                          value={r.brand}
                          onChange={(e) => setRow(k, { brand: e.target.value })}
                          className="h-9 min-w-0"
                        />
                      </div>
                      {(r.qty !== "" || r.location || r.notes) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id={`l-${k}`}
                            placeholder="gdzie leży"
                            value={r.location}
                            onChange={(e) => setRow(k, { location: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <Input
                            id={`n-${k}`}
                            placeholder="uwagi"
                            value={r.notes}
                            onChange={(e) => setRow(k, { notes: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  className="w-full text-left text-sm text-sky-700 px-3 py-2 border-t border-dashed hover:bg-accent"
                  onClick={() => addSize(cat.key)}
                >
                  <Plus className="inline h-3.5 w-3.5 mr-1" />
                  {cat.key.endsWith("lyzwy") ? "Dodaj rozmiar łyżew" : "Dodaj inny rozmiar / model"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {part === "wyp" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Szukaj zawodnika…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <label className="text-sm flex items-center gap-1.5">
              <input type="checkbox" checked={onlyWith} onChange={(e) => setOnlyWith(e.target.checked)} className="h-4 w-4" />
              tylko z wypożyczonym sprzętem
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Zaznacz tylko sprzęt <b>klubowy</b>, który dziecko ma u siebie, i wpisz rozmiar. Sprzętu własnego rodziców nie zaznaczaj.
          </p>
          {activePlayers
            .filter((p) => !search || `${p.lastName} ${p.firstName}`.toLowerCase().includes(search.toLowerCase()))
            .filter((p) => !onlyWith || hasGear(p.id))
            .map((p) => (
              <div key={p.id} className={cn("border rounded-lg p-3 space-y-2", hasGear(p.id) && "border-l-4 border-l-amber-400")}>
                <div className="flex justify-between items-baseline">
                  <p className="font-medium">
                    {p.lastName} {p.firstName}
                  </p>
                  {p.dateOfBirth && <span className="text-xs text-muted-foreground">rocz. {new Date(p.dateOfBirth).getFullYear()}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REMANENT_LOAN_ITEMS.map((it) => {
                    const k = `${p.id}|${it.key}`;
                    const c = cells[k] ?? { has: false, size: "" };
                    return (
                      <label
                        key={it.key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm cursor-pointer select-none",
                          c.has ? "border-sky-600 bg-sky-50 dark:bg-sky-950" : "bg-background"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={c.has}
                          onChange={(e) => setCell(k, { has: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        {it.label}
                        {c.has && (
                          <input
                            id={`r-${k}`}
                            value={c.size}
                            onChange={(e) => setCell(k, { size: e.target.value })}
                            placeholder="rozm."
                            className="w-16 rounded border bg-background px-1.5 py-0.5 text-xs"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {part === "bra" && (
        <div className="space-y-3">
          {braki.length === 0 && (
            <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-3">
              Brak wpisów. Dodaj to, czego brakuje albo trzeba dokupić – po zapisie trafi do zakładki Zapotrzebowanie.
            </p>
          )}
          {braki.map((b) => (
            <div key={b.id} className="border rounded-lg p-3 grid gap-2 sm:grid-cols-[2fr_1fr_5rem]">
              <Input placeholder="Czego brakuje" value={b.czego} onChange={(e) => setBrak(b.id, { czego: e.target.value })} />
              <Input placeholder="Rozmiar" value={b.rozmiar} onChange={(e) => setBrak(b.id, { rozmiar: e.target.value })} />
              <Input placeholder="Ile" inputMode="numeric" value={b.ile} onChange={(e) => setBrak(b.id, { ile: e.target.value })} />
              <div className="sm:col-span-3 grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
                <Input placeholder="Dla kogo / grupa" value={b.dla} onChange={(e) => setBrak(b.id, { dla: e.target.value })} />
                <select
                  aria-label="Rodzaj"
                  value={b.cat}
                  onChange={(e) => setBrak(b.id, { cat: e.target.value })}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">rodzaj?</option>
                  {REMANENT_CATS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Z czego"
                  value={b.zrodlo}
                  onChange={(e) => setBrak(b.id, { zrodlo: e.target.value })}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {ZRODLA.map((z) => (
                    <option key={z} value={z}>
                      {z || "z czego?"}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = braki.filter((x) => x.id !== b.id);
                    setBraki(next);
                    persist({ braki: next });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              const next = [...braki, { id: Date.now().toString(36), czego: "", cat: "", rozmiar: "", ile: "1", dla: "", zrodlo: "" }];
              setBraki(next);
              persist({ braki: next });
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Dodaj brak
          </Button>
        </div>
      )}

      <div className="sticky bottom-0 bg-background border-t pt-3 pb-2 space-y-2">
        {confirming ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm space-y-2">
            <p className="font-medium">Zapisać remanent do SWH Managera?</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{dirtyRows.length} pozycji magazynu (ilość na miejscu)</li>
              <li>{dirtyCells.length} zmian w wypożyczeniach zawodników</li>
              <li>{filledBraki.length} braków → Zapotrzebowanie</li>
            </ul>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Zapisywanie…" : "Tak, zapisz"}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                Wróć
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full sm:w-auto" disabled={changes === 0} onClick={() => setConfirming(true)}>
            <ClipboardCheck className="h-4 w-4 mr-1" /> Zapisz remanent ({changes} zmian)
          </Button>
        )}
      </div>
    </div>
  );
}

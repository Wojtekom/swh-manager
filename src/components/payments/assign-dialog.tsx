"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nextMonthlyDueDate } from "@/lib/payments";

interface Fee {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  groupMembers: { group: { id: string; name: string } }[];
}

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Naliczanie należności wybranym zawodnikom – robi to administrator ręcznie,
// np. składka miesięczna (termin 15. dnia miesiąca) albo obóz/wyjazd dopiero po decyzji, że się odbywa.
export function AssignDialog({
  open,
  onClose,
  fees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  fees: Fee[];
  onSaved: () => void;
}) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [feeId, setFeeId] = useState("");
  const [dueDate, setDueDate] = useState(toInputDate(nextMonthlyDueDate()));
  const [groupId, setGroupId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setDueDate(toInputDate(nextMonthlyDueDate()));
    fetch("/api/players")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PlayerRow[]) => setPlayers(list.filter((p) => p.status === "ACTIVE")))
      .catch(() => toast.error("Nie udało się pobrać zawodników"));
  }, [open]);

  useEffect(() => {
    if (open && !feeId && fees.length) setFeeId(fees[0].id);
  }, [open, fees, feeId]);

  const groups = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => p.groupMembers.forEach((g) => m.set(g.group.id, g.group.name)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pl"));
  }, [players]);

  const visible = players.filter(
    (p) =>
      (groupId === "ALL" || p.groupMembers.some((g) => g.group.id === groupId)) &&
      `${p.lastName} ${p.firstName}`.toLowerCase().includes(search.toLowerCase())
  );

  const fee = fees.find((f) => f.id === feeId);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s);
      visible.forEach((p) => (allVisibleSelected ? n.delete(p.id) : n.add(p.id)));
      return n;
    });

  async function submit() {
    if (!feeId || selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId, playerIds: [...selected], dueDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Błąd zapisu");
      toast.success(data.message || "Naliczono");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nalicz należność</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Składka</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={feeId}
                onChange={(e) => setFeeId(e.target.value)}
              >
                {fees.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} – {f.amount.toFixed(2)} zł
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Termin płatności</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Domyślnie 15. dzień miesiąca. Rodzice dostaną przypomnienie 3 dni przed terminem oraz 3 i 10 dni po
            terminie, jeśli wpłata nie zostanie odnotowana.
          </p>

          <div className="flex gap-2">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="ALL">Wszystkie grupy</option>
              {groups.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <Input placeholder="Szukaj zawodnika..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            <label className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
              Zaznacz widocznych ({visible.length})
            </label>
            {visible.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                {p.lastName} {p.firstName}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Wybrano: {selected.size}
              {fee ? ` · razem ${(fee.amount * selected.size).toFixed(2)} zł` : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button onClick={submit} disabled={saving || !feeId || selected.size === 0}>
                {saving ? "Zapisuję..." : "Nalicz"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

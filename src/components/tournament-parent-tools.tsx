"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Mode = "all" | "pending";

interface Preview {
  documents: string[];
  recipients: { player: string; status: string; consentReceived: boolean; parents: string[] }[];
  withoutParent: string[];
}

// Wysyłka dokumentów turnieju mailem do rodziców (z podglądem przed wysłaniem)
export function SendDocumentsDialog({
  tournamentId,
  onClose,
  onSent,
}: {
  tournamentId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/send-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, dryRun: true }),
    })
      .then((r) => r.json())
      .then((d) => !cancelled && setPreview(d))
      .catch(() => toast.error("Błąd podglądu"));
    return () => {
      cancelled = true;
    };
  }, [tournamentId, mode]);

  const parentCount = preview?.recipients.reduce((n, r) => n + r.parents.length, 0) ?? 0;

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/send-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Błąd wysyłki");
        return;
      }
      toast.success(`Wysłano ${data.sent} maili do rodziców`);
      if (data.failed?.length) toast.error(`Nie doszło do: ${data.failed.join(", ")}`);
      onSent();
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Wyślij dokumenty rodzicom
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {([
            ["all", "Wszystkim powołanym", "pierwsza wysyłka"],
            ["pending", "Tylko brakujące", "przypomnienie: bez odpowiedzi lub bez zgody"],
          ] as const).map(([m, label, hint]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "border rounded-lg p-2.5 text-left text-sm",
                mode === m ? "border-sky-500 bg-sky-50" : "hover:bg-accent"
              )}
            >
              <div className="font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </button>
          ))}
        </div>

        {!preview ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Ładowanie…</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <strong>Załączniki:</strong>{" "}
              {preview.documents.length ? preview.documents.join(", ") : "brak (mail bez załączników)"}
            </p>
            <div>
              <p className="font-medium mb-1">Mail dostanie {parentCount} rodziców:</p>
              <ul className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-2">
                {preview.recipients.length === 0 && (
                  <li className="text-muted-foreground">Nikt – wszyscy mają odpowiedź i zgodę.</li>
                )}
                {preview.recipients.map((r) => (
                  <li key={r.player}>
                    <span className="font-medium">{r.player}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      – {r.status === "CALLED" ? "bez odpowiedzi" : "potwierdził"}
                      {r.consentReceived ? ", zgoda jest" : ", brak zgody"}
                    </span>
                    <div className="text-xs text-muted-foreground">{r.parents.join(", ")}</div>
                  </li>
                ))}
              </ul>
            </div>
            {preview.withoutParent.length > 0 && (
              <p className="text-amber-700 bg-amber-50 rounded-md p-2">
                ⚠️ Bez konta rodzica (mail nie pójdzie): {preview.withoutParent.join(", ")}. Połącz
                rodzica w zakładce Powołania albo przekaż dokumenty osobiście.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={send} disabled={sending || !preview || parentCount === 0}>
            {sending ? "Wysyłanie…" : `Wyślij (${parentCount})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ParentOption {
  id: string;
  name: string;
  email: string;
  children: string[];
}

// Połączenie konta rodzica z zawodnikiem
export function LinkParentDialog({
  playerId,
  playerName,
  onClose,
  onLinked,
}: {
  playerId: string;
  playerName: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [linked, setLinked] = useState<{ id: string; name: string; email: string }[]>([]);
  const [candidates, setCandidates] = useState<ParentOption[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/players/${playerId}/parents`);
    if (res.ok) {
      const d = await res.json();
      setLinked(d.linked);
      setCandidates(d.candidates);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function link(parentId: string) {
    setBusy(true);
    const res = await fetch(`/api/players/${playerId}/parents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Połączono – rodzic widzi teraz dziecko w aplikacji");
      load();
      onLinked();
    } else toast.error("Błąd zapisu");
  }

  async function unlink(parentId: string) {
    const res = await fetch(`/api/players/${playerId}/parents?parentId=${parentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      load();
      onLinked();
    } else toast.error("Błąd zapisu");
  }

  const q = search.trim().toLowerCase();
  const linkedIds = new Set(linked.map((l) => l.id));
  const filtered = candidates
    .filter((c) => !linkedIds.has(c.id))
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Rodzic: {playerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-sm font-medium">Połączeni rodzice</p>
          {linked.length === 0 ? (
            <p className="text-sm text-amber-700">Brak – rodzic nie widzi dziecka w aplikacji.</p>
          ) : (
            linked.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                <span>
                  {l.name} <span className="text-muted-foreground">({l.email})</span>
                </span>
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => unlink(l.id)}>
                  <X className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Dodaj z kont rodziców</p>
          <Input
            placeholder="Szukaj po nazwisku lub mailu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="max-h-64 overflow-y-auto space-y-1">
            {filtered.slice(0, 50).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.email}
                    {c.children.length > 0 ? ` · dzieci: ${c.children.join(", ")}` : " · bez dziecka"}
                  </div>
                </div>
                <Button size="sm" className="ml-auto" disabled={busy} onClick={() => link(c.id)}>
                  Połącz
                </Button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Brak konta? Załóż je w „Zaproszenia rodziców”, potem wróć tutaj.
              </li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

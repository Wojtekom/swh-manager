"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { HandHeart, Printer, Check, Trash2, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAgreementSections,
  CHILD_DECLARATION,
  PARENT_CONSENT,
  VOLUNTEER_STATUS_LABEL,
  VOLUNTEER_EVENT_TYPES,
  fmtDate,
  fmtDateTime,
} from "@/lib/volunteer-agreement";

interface Hour {
  id: string;
  date: string;
  eventType: string;
  tasks: string;
  timeFrom: string | null;
  timeTo: string | null;
  hours: number;
  coachName: string;
}
interface Agreement {
  id: string;
  number: string;
  status: string;
  periodFrom: string;
  periodTo: string;
  maxHours: number | null;
  school: string | null;
  childSignature: string | null;
  childAcceptedAt: string | null;
  parentSignature: string | null;
  parentAcceptedAt: string | null;
  boardApprovedAt: string | null;
  boardApprovedBy: string | null;
  player: { id: string; firstName: string; lastName: string; dateOfBirth: string };
  hours: Hour[];
}
interface PlayerOpt {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  status: string;
  parents: { parent: { name: string } }[];
}

const STATUS_COLOR: Record<string, string> = {
  SENT: "bg-amber-100 text-amber-800",
  PARENT_SIGNED: "bg-sky-100 text-sky-800",
  ACTIVE: "bg-green-100 text-green-800",
  ENDED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function ageYears(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

const sumHours = (a: Agreement) => a.hours.reduce((s, h) => s + h.hours, 0);

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status] ?? ""}`}>
      {VOLUNTEER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function AgreementText({ a }: { a: Agreement }) {
  const sections = buildAgreementSections({
    number: a.number,
    playerName: `${a.player.firstName} ${a.player.lastName}`,
    playerBirth: a.player.dateOfBirth,
    periodFrom: a.periodFrom,
    periodTo: a.periodTo,
    maxHours: a.maxHours,
  });
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      <h3 className="text-center font-bold text-slate-900">
        POROZUMIENIE O WYKONYWANIU ŚWIADCZEŃ WOLONTARIUSZA nr {a.number}
      </h3>
      {sections.map((s) => (
        <div key={s.title}>
          <p className="font-semibold text-slate-900">{s.title}</p>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-1">{p}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function HoursTable({ a, canEdit, onDelete }: { a: Agreement; canEdit: boolean; onDelete?: (h: Hour) => void }) {
  if (a.hours.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak wpisów w ewidencji godzin.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2">Data</th>
            <th className="py-1 pr-2">Wydarzenie</th>
            <th className="py-1 pr-2">Zadania</th>
            <th className="py-1 pr-2">Godz.</th>
            <th className="py-1 pr-2">Trener</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {a.hours.map((h) => (
            <tr key={h.id} className="border-b last:border-0 align-top">
              <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(h.date)}</td>
              <td className="py-1 pr-2">{h.eventType}</td>
              <td className="py-1 pr-2">{h.tasks}</td>
              <td className="py-1 pr-2 whitespace-nowrap">
                {h.hours}
                {h.timeFrom && h.timeTo ? <span className="text-xs text-muted-foreground"> ({h.timeFrom}–{h.timeTo})</span> : null}
              </td>
              <td className="py-1 pr-2">{h.coachName}</td>
              {canEdit && (
                <td className="py-1">
                  <button type="button" onClick={() => onDelete?.(h)} className="text-red-500 hover:text-red-700" title="Usuń wpis">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="pt-2 text-right font-semibold">Razem godzin:</td>
            <td className="pt-2 font-bold">{sumHours(a)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Widok rodzica / zawodnika ----------------

function SignForm({ a, onSigned }: { a: Agreement; onSigned: () => void }) {
  const [school, setSchool] = useState("");
  const [childSignature, setChildSignature] = useState("");
  const [parentSignature, setParentSignature] = useState("");
  const [childAccepted, setChildAccepted] = useState(false);
  const [parentAccepted, setParentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = school.trim().length >= 2 && childSignature.trim().length >= 3 && parentSignature.trim().length >= 3 && childAccepted && parentAccepted;

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/volunteer/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", school, childSignature, parentSignature, childAccepted, parentAccepted }),
      });
      if (res.ok) {
        toast.success("Porozumienie podpisane. Dziękujemy!");
        onSigned();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(typeof d.error === "string" ? d.error : "Nie udało się zapisać podpisu");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div>
        <Label htmlFor={`school-${a.id}`}>Szkoła i klasa dziecka</Label>
        <Input id={`school-${a.id}`} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="np. SP nr 12 w Siedlcach, kl. 7b" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Oświadczenie wolontariusza (wypełnia dziecko)</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={childAccepted} onChange={(e) => setChildAccepted(e.target.checked)} />
          <span>{CHILD_DECLARATION}</span>
        </label>
        <Input value={childSignature} onChange={(e) => setChildSignature(e.target.value)} placeholder="Imię i nazwisko dziecka (podpis)" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Zgoda rodzica / opiekuna prawnego</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={parentAccepted} onChange={(e) => setParentAccepted(e.target.checked)} />
          <span>{PARENT_CONSENT}</span>
        </label>
        <Input value={parentSignature} onChange={(e) => setParentSignature(e.target.value)} placeholder="Imię i nazwisko rodzica (podpis)" />
      </div>
      <Button onClick={submit} disabled={!ok || busy} className="w-full sm:w-auto">
        <Check className="mr-2 h-4 w-4" />
        {busy ? "Zapisywanie…" : "Podpisuję porozumienie"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Wpisanie imienia i nazwiska oraz zaznaczenie pól jest podpisem elektronicznym w aplikacji. Na życzenie wydamy porozumienie także na papierze.
      </p>
    </div>
  );
}

function FamilyView({ list, reload }: { list: Agreement[]; reload: () => void }) {
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nie ma porozumień wolontariackich dla Twojego dziecka. Starsi zawodnicy (od 13 lat) mogą pomagać przy zajęciach młodszych dzieci i turniejach – zaświadczenie o wolontariacie przydaje się w szkole. Chętnych prosimy o wiadomość do trenera.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {list.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{a.player.firstName} {a.player.lastName}</p>
                <p className="text-xs text-muted-foreground">
                  Porozumienie nr {a.number} · {fmtDate(a.periodFrom)} – {fmtDate(a.periodTo)}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border bg-white p-4">
              <AgreementText a={a} />
            </div>

            {a.status === "SENT" ? (
              <SignForm a={a} onSigned={reload} />
            ) : (
              <div className="space-y-1 text-sm">
                {a.parentAcceptedAt && (
                  <p>Podpisano: {a.childSignature} (wolontariusz) i {a.parentSignature} (rodzic), {fmtDateTime(a.parentAcceptedAt)}</p>
                )}
                {a.boardApprovedAt && <p>Zatwierdzone przez zarząd: {fmtDateTime(a.boardApprovedAt)}</p>}
              </div>
            )}

            {(a.status === "ACTIVE" || a.status === "ENDED") && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Ewidencja godzin</p>
                <HoursTable a={a} canEdit={false} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(`/druk/wolontariat/${a.id}?typ=porozumienie`, "_blank")}>
                <Printer className="mr-2 h-4 w-4" /> Porozumienie (PDF/druk)
              </Button>
              {(a.status === "ACTIVE" || a.status === "ENDED") && a.hours.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => window.open(`/druk/wolontariat/${a.id}?typ=zaswiadczenie`, "_blank")}>
                  <FileText className="mr-2 h-4 w-4" /> Zaświadczenie
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Widok administratora / trenera ----------------

function AddHourForm({ a, onAdded }: { a: Agreement; onAdded: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState<string>("trening");
  const [tasks, setTasks] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [hours, setHours] = useState("1.5");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const h = parseFloat(hours.replace(",", "."));
    if (!tasks.trim() || !(h > 0)) {
      toast.error("Uzupełnij zadania i liczbę godzin");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/volunteer/${a.id}/hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, eventType, tasks, timeFrom, timeTo, hours: h }),
      });
      if (res.ok) {
        toast.success("Dodano wpis");
        setTasks("");
        onAdded();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(typeof d.error === "string" ? d.error : "Błąd zapisu");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 sm:grid-cols-6">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:col-span-2" />
      <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="h-9 rounded-md border bg-white px-2 text-sm sm:col-span-2">
        {VOLUNTEER_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="godz." className="sm:col-span-2" />
      <Input value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} placeholder="od (np. 8:00)" className="sm:col-span-1" />
      <Input value={timeTo} onChange={(e) => setTimeTo(e.target.value)} placeholder="do (np. 9:30)" className="sm:col-span-1" />
      <Input value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder="Zadania (np. pomoc najmłodszym na lodzie, stacje)" className="sm:col-span-3" />
      <Button size="sm" onClick={submit} disabled={busy} className="sm:col-span-1">
        <Plus className="mr-1 h-4 w-4" /> Dodaj
      </Button>
    </div>
  );
}

function NewAgreementForm({ onCreated }: { onCreated: () => void }) {
  const [players, setPlayers] = useState<PlayerOpt[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("2027-01-01");
  const [periodTo, setPeriodTo] = useState("2027-06-30");
  const [maxHours, setMaxHours] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d: PlayerOpt[]) => setPlayers(Array.isArray(d) ? d.filter((p) => p.status === "ACTIVE") : []))
      .catch(() => {});
  }, []);

  const sorted = useMemo(
    () => [...players].sort((x, y) => new Date(x.dateOfBirth).getTime() - new Date(y.dateOfBirth).getTime()),
    [players]
  );
  const selected = players.find((p) => p.id === playerId);

  async function submit() {
    if (!playerId) { toast.error("Wybierz zawodnika"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, periodFrom, periodTo, maxHours: maxHours ? parseInt(maxHours, 10) : null }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Utworzono porozumienie nr ${d.number}. Powiadomieni rodzice: ${d.notifiedParents}`);
        setPlayerId("");
        onCreated();
      } else {
        toast.error(typeof d.error === "string" ? d.error : "Błąd zapisu");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="font-semibold">Nowe porozumienie (wyśle się do rodzica do podpisu)</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <Label>Zawodnik (od najstarszych)</Label>
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="h-9 w-full rounded-md border bg-white px-2 text-sm">
              <option value="">— wybierz —</option>
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName} · {ageYears(p.dateOfBirth)} lat{p.parents.length === 0 ? " · brak rodzica w aplikacji" : ""}
                </option>
              ))}
            </select>
            {selected && ageYears(selected.dateOfBirth) < 13 && (
              <p className="mt-1 text-xs text-amber-700">Zawodnik ma mniej niż 13 lat – w praktyce wolontariat zaczyna się od 13 lat.</p>
            )}
            {selected && selected.parents.length === 0 && (
              <p className="mt-1 text-xs text-red-600">Zawodnik nie ma połączonego rodzica – nikt nie podpisze porozumienia w aplikacji.</p>
            )}
          </div>
          <div>
            <Label>Od</Label>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div>
            <Label>Do</Label>
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <div>
            <Label>Limit godzin (opcjonalnie)</Label>
            <Input value={maxHours} onChange={(e) => setMaxHours(e.target.value.replace(/\D/g, ""))} placeholder="np. 40" />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} disabled={busy || !playerId} className="w-full">
              <Plus className="mr-1 h-4 w-4" /> Wyślij do podpisu
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffView({ list, reload, isAdmin }: { list: Agreement[]; reload: () => void; isAdmin: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  async function act(a: Agreement, action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const res = await fetch(`/api/volunteer/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success("Zapisano"); reload(); }
    else toast.error(typeof d.error === "string" ? d.error : "Błąd");
  }
  async function remove(a: Agreement) {
    if (!window.confirm(`Usunąć niepodpisane porozumienie nr ${a.number}?`)) return;
    const res = await fetch(`/api/volunteer/${a.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success("Usunięto"); reload(); }
    else toast.error(typeof d.error === "string" ? d.error : "Błąd");
  }
  async function deleteHour(a: Agreement, h: Hour) {
    if (!window.confirm(`Usunąć wpis z ${fmtDate(h.date)} (${h.hours} h)?`)) return;
    const res = await fetch(`/api/volunteer/${a.id}/hours?hourId=${h.id}`, { method: "DELETE" });
    if (res.ok) reload(); else toast.error("Błąd");
  }

  return (
    <div className="space-y-6">
      {isAdmin && <NewAgreementForm onCreated={reload} />}
      {list.length === 0 && <p className="text-sm text-muted-foreground">Brak porozumień.</p>}
      {list.map((a) => {
        const open = openId === a.id;
        return (
          <Card key={a.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left" onClick={() => setOpenId(open ? null : a.id)}>
                  <p className="font-semibold">{a.player.lastName} {a.player.firstName}</p>
                  <p className="text-xs text-muted-foreground">
                    nr {a.number} · {fmtDate(a.periodFrom)} – {fmtDate(a.periodTo)} · {sumHours(a)} h{a.maxHours ? ` / limit ${a.maxHours} h` : ""}
                  </p>
                </button>
                <StatusBadge status={a.status} />
              </div>

              {a.parentAcceptedAt && (
                <p className="text-xs text-muted-foreground">
                  Podpis: {a.childSignature} + {a.parentSignature} ({fmtDateTime(a.parentAcceptedAt)}) · szkoła: {a.school}
                  {a.boardApprovedAt ? ` · zatwierdził: ${a.boardApprovedBy} (${fmtDateTime(a.boardApprovedAt)})` : ""}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {isAdmin && a.status === "PARENT_SIGNED" && (
                  <Button size="sm" onClick={() => act(a, "approve", "Zatwierdzić porozumienie w imieniu zarządu SWH?")}>
                    <Check className="mr-1 h-4 w-4" /> Zatwierdź (zarząd)
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => window.open(`/druk/wolontariat/${a.id}?typ=porozumienie`, "_blank")}>
                  <Printer className="mr-1 h-4 w-4" /> Porozumienie
                </Button>
                {(a.status === "ACTIVE" || a.status === "ENDED") && (
                  <Button size="sm" variant="outline" onClick={() => window.open(`/druk/wolontariat/${a.id}?typ=zaswiadczenie`, "_blank")}>
                    <FileText className="mr-1 h-4 w-4" /> Zaświadczenie
                  </Button>
                )}
                {isAdmin && a.status === "ACTIVE" && (
                  <Button size="sm" variant="outline" onClick={() => act(a, "end", "Zakończyć porozumienie?")}>Zakończ</Button>
                )}
                {isAdmin && a.status === "SENT" && (
                  <Button size="sm" variant="outline" onClick={() => remove(a)}>Usuń</Button>
                )}
                {isAdmin && (a.status === "PARENT_SIGNED" || a.status === "ACTIVE") && (
                  <Button size="sm" variant="outline" onClick={() => act(a, "cancel", "Anulować porozumienie?")}>Anuluj</Button>
                )}
              </div>

              {open && (
                <div className="space-y-3 pt-2">
                  {a.status === "ACTIVE" && <AddHourForm a={a} onAdded={reload} />}
                  <HoursTable a={a} canEdit={a.status === "ACTIVE"} onDelete={(h) => deleteHour(a, h)} />
                </div>
              )}
              {!open && a.status === "ACTIVE" && (
                <button type="button" className="text-xs text-sky-700 underline" onClick={() => setOpenId(a.id)}>
                  Ewidencja godzin / dodaj wpis
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function WolontariatPage() {
  const { data: session, status } = useSession();
  const [list, setList] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const role = session?.user?.role;

  const load = useCallback(() => {
    fetch("/api/volunteer")
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Nie udało się pobrać porozumień"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const isStaff = role === "ADMIN" || role === "COACH";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <HandHeart className="h-8 w-8 text-sky-500" />
        <div>
          <h1 className="text-2xl font-bold">Wolontariat zawodników</h1>
          <p className="text-sm text-muted-foreground">
            Starsi zawodnicy pomagają przy zajęciach młodszych dzieci i turniejach SWH. Godziny są zapisywane, a na koniec SWH wydaje zaświadczenie do szkoły.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Wczytywanie…</p>
      ) : isStaff ? (
        <StaffView list={list} reload={load} isAdmin={role === "ADMIN"} />
      ) : (
        <FamilyView list={list} reload={load} />
      )}
    </div>
  );
}

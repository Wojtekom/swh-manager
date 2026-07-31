"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Printer,
  Users,
  Pencil,
  Check,
  X,
  CalendarDays,
  MapPin,
  Clock,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface DrillRef {
  name: string;
  category: string;
  duration: number | null;
  notes: string | null;
}

interface ScheduleEntry {
  id?: string;
  date: string;
  dateFormatted: string;
  dayName: string;
  title: string;
  topic?: string | null;
  objectives: string | null;
  duration: number;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  drills: DrillRef[];
}

interface PlayerEntry {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  category: string;
  attendance: Record<string, boolean>;
  totalPresent: number;
  totalSessions: number;
  percentPresent: number;
}

interface DiaryData {
  program: string;
  projectPeriod: string;
  group: {
    id?: string;
    name: string;
    category: string;
    coach: string | null;
  } | null;
  participantCount: number;
  sessionCount: number;
  players: PlayerEntry[];
  schedule: ScheduleEntry[];
}

// ============================================================
// MAIN (wrapped in Suspense — useSearchParams wymaga tego w Next.js 16)
// ============================================================

export default function DziennikSWDPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
          Ładowanie dziennika...
        </div>
      }
    >
      <DziennikSWDContent />
    </Suspense>
  );
}

function DziennikSWDContent() {
  const searchParams = useSearchParams();
  const urlGroup = searchParams.get("group");
  const urlSession = searchParams.get("session");

  const [data, setData] = useState<DiaryData | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"frekwencja" | "terminarz">("terminarz");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Pobieranie listy grup — domyślnie wybiera grupę SWD, jeśli istnieje
  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.groups || [];
        setGroups(list);
        if (urlGroup && list.some((g: { id: string }) => g.id === urlGroup)) {
          setSelectedGroup(urlGroup);
        } else {
          const swdGroup = list.find((g: { name: string }) => g.name.toLowerCase().includes("swd"));
          if (swdGroup) setSelectedGroup(swdGroup.id);
          else if (list.length > 0) setSelectedGroup(list[0].id);
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDiary = useCallback(async () => {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dziennik-swd?groupId=${selectedGroup}`);
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error(err);
      toast.error("Błąd pobierania dziennika");
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchDiary();
  }, [fetchDiary]);

  useEffect(() => {
    if (!data || !urlSession) return;
    if (activeTab !== "terminarz") setActiveTab("terminarz");
    const t = setTimeout(() => {
      const el = document.getElementById(`session-${urlSession}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-offset-2", "ring-teal-400");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-offset-2", "ring-teal-400");
        }, 2500);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [data, urlSession, activeTab]);

  const exportCSV = () => {
    if (!data) return;
    const dates = data.schedule.map((s) => s.dateFormatted);
    const header = ["Lp.", "Nazwisko i imię", "Rocznik", ...dates, "Obecności", "%"].join(";");
    const rows = data.players.map((p, i) => {
      const dateVals = data.schedule.map((s) => {
        const dateKey = s.date.split("T")[0];
        const att = p.attendance[dateKey];
        return att === true ? "✓" : att === false ? "N" : "";
      });
      return [
        i + 1,
        `${p.lastName} ${p.firstName}`,
        p.dateOfBirth.slice(0, 4),
        ...dateVals,
        p.totalPresent,
        p.percentPresent + "%",
      ].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dziennik_swd_${data.group?.name || "swh"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (s: ScheduleEntry) => {
    if (!s.id) {
      toast.error("Brak ID sesji");
      return;
    }
    setEditingId(s.id);
    setEditValue(s.topic || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: editValue.trim() || null }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Błąd zapisu");
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              schedule: prev.schedule.map((s) =>
                s.id === editingId ? { ...s, topic: editValue.trim() || null } : s
              ),
            }
          : prev
      );
      toast.success("Zapisano temat dnia");
      cancelEdit();
    } catch (err) {
      console.error(err);
      toast.error("Nie zapisano. Sprawdź endpoint /api/sessions/[id].");
    } finally {
      setSaving(false);
    }
  };

  const handleEditKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        Ładowanie dziennika...
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-teal-500" />
          Dziennik Zajęć SWD
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Program „Sport Wszystkich Dzieci" (MSiT) • {data?.projectPeriod || "2026"}
        </p>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          <button
            onClick={() => setActiveTab("terminarz")}
            className={`px-4 py-1.5 text-sm font-medium transition ${
              activeTab === "terminarz"
                ? "bg-teal-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Terminarz zajęć
          </button>
          <button
            onClick={() => setActiveTab("frekwencja")}
            className={`px-4 py-1.5 text-sm font-medium transition ${
              activeTab === "frekwencja"
                ? "bg-teal-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Frekwencja
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          <Link
            href="/dashboard/calendar"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
            title="Otwórz kalendarz"
          >
            <CalendarDays className="h-4 w-4" /> Kalendarz
          </Link>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <Printer className="h-4 w-4" /> Drukuj
          </button>
        </div>
      </div>

      {/* INFO GRUPY */}
      {data?.group && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-sm text-teal-800 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <strong>Grupa:</strong> {data.group.name}
          </span>
          <span>
            <strong>Trener:</strong> {data.group.coach || "—"}
          </span>
          <span>
            <strong>Uczestników:</strong> {data.participantCount}
          </span>
          <span>
            <strong>Zajęć:</strong> {data.sessionCount}
          </span>
        </div>
      )}

      {/* TERMINARZ ZAJĘĆ */}
      {activeTab === "terminarz" && data && (
        <div className="space-y-3 print:space-y-2">
          {data.schedule.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Brak sesji z przypisanymi datami.
            </div>
          ) : (
            data.schedule.map((s, idx) => {
              const titleToShow = s.topic || s.title;
              const isEditing = editingId === s.id && s.id;
              const dateISO = s.date.split("T")[0];

              return (
                <div
                  key={s.id || idx}
                  id={s.id ? `session-${s.id}` : undefined}
                  className="bg-white rounded-lg border border-slate-200 border-l-4 border-l-teal-500 p-4 print:p-2 print:text-xs transition-all"
                >
                  {/* Górny pasek meta */}
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                        Zajęcia {idx + 1}
                      </span>
                      <Link
                        href={`/dashboard/calendar?date=${dateISO}`}
                        className="text-xs text-slate-500 hover:text-teal-600 hover:underline inline-flex items-center gap-1"
                        title="Pokaż w kalendarzu"
                      >
                        <CalendarDays className="h-3 w-3" />
                        {s.dayName} {s.dateFormatted}
                      </Link>
                      {s.startTime && (
                        <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.startTime}–{s.endTime}
                        </span>
                      )}
                      {s.location && (
                        <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {s.location}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{s.duration} min</span>
                    </div>
                  </div>

                  {/* Temat dnia — edytowalny */}
                  {isEditing ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKey}
                        maxLength={80}
                        placeholder="Temat dnia"
                        className="flex-1 text-sm font-semibold text-slate-900 border border-teal-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-200"
                      />
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="p-1.5 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50"
                        title="Zapisz (Enter)"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 disabled:opacity-50"
                        title="Anuluj (Esc)"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group/title flex items-baseline gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900">{titleToShow}</h3>
                      <button
                        onClick={() => startEdit(s)}
                        className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-teal-600"
                        title="Edytuj temat dnia"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Opis celów / struktura sesji */}
                  {s.objectives && (
                    <p className="text-xs text-slate-500 mt-1">{s.objectives}</p>
                  )}

                  {/* Bloki ćwiczeń (drille) z czasem trwania */}
                  {s.drills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.drills.map((d, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200"
                          title={d.notes || undefined}
                        >
                          {d.name}
                          {d.duration ? ` (${d.duration} min)` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FREKWENCJA */}
      {activeTab === "frekwencja" && data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider">
                <th className="px-2 py-2 text-left sticky left-0 bg-slate-50/80 z-10">Lp.</th>
                <th className="px-2 py-2 text-left sticky left-[30px] bg-slate-50/80 z-10 min-w-[150px]">
                  Nazwisko i imię
                </th>
                {data.schedule.map((s, i) => (
                  <th
                    key={i}
                    className="px-1 py-2 text-center min-w-[36px]"
                    title={`${s.topic || s.title}${s.location ? " • " + s.location : ""}`}
                  >
                    <div className="transform -rotate-45 origin-center text-[10px] whitespace-nowrap">
                      {s.dateFormatted.slice(0, 5)}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Σ</th>
                <th className="px-2 py-2 text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p, idx) => (
                <tr key={p.id} className={idx > 0 ? "border-t border-slate-50" : ""}>
                  <td className="px-2 py-1.5 text-slate-400 sticky left-0 bg-white z-10">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-slate-900 sticky left-[30px] bg-white z-10">
                    {p.lastName} {p.firstName}
                  </td>
                  {data.schedule.map((s, i) => {
                    const dateKey = s.date.split("T")[0];
                    const att = p.attendance[dateKey];
                    return (
                      <td key={i} className="px-1 py-1.5 text-center">
                        {att === true ? (
                          <span className="text-emerald-600 font-bold">✓</span>
                        ) : att === false ? (
                          <span className="text-red-400">N</span>
                        ) : (
                          <span className="text-slate-200">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-semibold text-slate-700">
                    {p.totalPresent}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-center font-semibold ${
                      p.percentPresent >= 80
                        ? "text-emerald-600"
                        : p.percentPresent >= 50
                        ? "text-amber-600"
                        : "text-red-500"
                    }`}
                  >
                    {p.percentPresent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.players.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              Brak zawodników w wybranej grupie.
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-400 text-center print:mt-2">
        Dziennik zajęć — Program „Sport Wszystkich Dzieci 2026" (Ministerstwo Sportu i Turystyki)
        <br />
        Stowarzyszenie Wybieram Hokej • Siedlce • Grupa: {data?.group?.name || "—"}
      </div>
    </div>
  );
}

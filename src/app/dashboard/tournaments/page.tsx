"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Trophy,
  Plus,
  MapPin,
  Calendar,
  Users,
  Trash2,
  ChevronRight,
  Swords,
  UserCheck,
  UserX,
  AlertTriangle,
  X,
  FileText,
  Upload,
  Mail,
  Paperclip,
} from "lucide-react";
import { SendDocumentsDialog, LinkParentDialog } from "@/components/tournament-parent-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCategoryLabel, ALL_CATEGORIES } from "@/lib/category-labels";

interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string | null;
  category: string;
  description: string | null;
  status: string;
  group: { id: string; name: string } | null;
  groupId: string | null;
  createdBy: { id: string; name: string };
  transportFee: number | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  parentDeadline: string | null;
  _count: { matches: number; callups: number };
}

interface TournamentMatch {
  id: string;
  opponent: string;
  isHome: boolean;
  ourScore: number | null;
  opponentScore: number | null;
  matchDate: string;
  notes: string | null;
}

interface Callup {
  id: string;
  status: string;
  transportChoice: string;
  notes: string | null;
  respondedAt: string | null;
  consentReceivedAt: string | null;
  consentFile: { name: string; createdAt: string } | null;
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    jerseyNum: number | null;
    category: string;
    parents: { parent: { name: string; email: string; active: boolean } }[];
  };
}

interface TournamentDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
  category: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  jerseyNum: number | null;
  category: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PLANNED: { label: "Zaplanowany", color: "bg-sky-100 text-sky-700" },
  IN_PROGRESS: { label: "W trakcie", color: "bg-green-100 text-green-700" },
  COMPLETED: { label: "Zakończony", color: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Odwołany", color: "bg-red-100 text-red-700" },
};

const CALLUP_STATUS: Record<string, { label: string; icon: typeof UserCheck; color: string }> = {
  CALLED: { label: "Powołany", icon: Users, color: "text-blue-600" },
  CONFIRMED: { label: "Potwierdził", icon: UserCheck, color: "text-green-600" },
  DECLINED: { label: "Odmówił", icon: UserX, color: "text-red-600" },
  INJURED: { label: "Kontuzja", icon: AlertTriangle, color: "text-orange-600" },
};

const TRANSPORT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  UNDECIDED: { label: "Oczekuje", emoji: "❓", color: "bg-slate-100 text-slate-600" },
  BUS: { label: "Autokar", emoji: "🚌", color: "bg-blue-100 text-blue-700" },
  OWN: { label: "Własny", emoji: "🚗", color: "bg-amber-100 text-amber-700" },
  NONE: { label: "Nie jedzie", emoji: "✖", color: "bg-red-100 text-red-700" },
};

// CATEGORIES — używamy ALL_CATEGORIES z @/lib/category-labels

export default function TournamentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdminOrCoach = session?.user?.role === "ADMIN" || session?.user?.role === "COACH";

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const fetchData = useCallback(async () => {
    try {
      const [tRes, gRes] = await Promise.all([
        fetch("/api/tournaments"),
        fetch("/api/groups"),
      ]);
      if (tRes.ok) setTournaments(await tRes.json());
      if (gRes.ok) {
        const data = await gRes.json();
        setGroups(data.map((g: Group) => ({ id: g.id, name: g.name, category: g.category })));
      }
    } catch {
      toast.error("Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated") fetchData();
  }, [authStatus, router, fetchData]);

  const filtered = tournaments.filter((t) => {
    if (filterCategory !== "ALL" && t.category !== filterCategory) return false;
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm("Usunąć turniej?")) return;
    const res = await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Usunięto"); fetchData(); }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Status zmieniony"); fetchData(); }
  }

  return (
    <div className="space-y-6 -mx-4 sm:-mx-6 -my-4 sm:-my-6 px-4 sm:px-6 py-4 sm:py-6 bg-ice min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-section icon-section-trophy">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">Turnieje</h1>
            <p className="text-sm text-slate-600">{tournaments.length} turniejów</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Wszystkie</SelectItem>
              {ALL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{getCategoryLabel(c, true)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Wszystkie</SelectItem>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdminOrCoach && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nowy turniej
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-500 py-8">Ładowanie...</p>
      ) : filtered.length === 0 ? (
        <div className="card-rink rounded-2xl py-12 text-center">
          <Trophy className="h-12 w-12 text-sky-300 mx-auto mb-4" />
          <p className="text-slate-600">Brak turniejów.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => {
            const statusInfo = STATUS_MAP[t.status] || STATUS_MAP.PLANNED;
            return (
              <div key={t.id} className="card-rink rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                        {getCategoryLabel(t.category)}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900 leading-tight">{t.name}</h3>
                  </div>
                  {isAdminOrCoach && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5 text-sm text-slate-700 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>{t.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span>
                      {new Date(t.startDate).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
                      {t.endDate && ` – ${new Date(t.endDate).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm pt-1">
                    <span className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-slate-500" />
                      <strong>{t._count.matches}</strong> {t._count.matches === 1 ? "mecz" : "meczy"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      <strong>{t._count.callups}</strong> powołanych
                    </span>
                  </div>
                </div>

                {isAdminOrCoach && (
                  <div className="flex items-center gap-2 pt-1">
                    <Select
                      value={t.status}
                      onValueChange={(v) => v && handleStatusChange(t.id, v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => setDetailId(t.id)}
                      >
                        Szczegóły <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  )}

                  {!isAdminOrCoach && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailId(t.id)}
                    >
                      Szczegóły <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
              </div>
            );
          })}
        </div>
      )}

      <CreateTournamentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        groups={groups}
        onSaved={fetchData}
      />

      {detailId && (
        <TournamentDetailDialog
          tournamentId={detailId}
          onClose={() => setDetailId(null)}
          isAdminOrCoach={isAdminOrCoach}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}

// ==================== Dialog tworzenia turnieju ====================

function CreateTournamentDialog({
  open, onClose, groups, onSaved,
}: {
  open: boolean; onClose: () => void; groups: Group[]; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", location: "", startDate: "", endDate: "",
    category: "U12", description: "", groupId: "",
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setForm({ name: "", location: "", startDate: "", endDate: "", category: "U12", description: "", groupId: "" });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        endDate: form.endDate || null,
        groupId: form.groupId || null,
      }),
    });
    if (res.ok) {
      toast.success("Turniej utworzony");
      onSaved();
      onClose();
    } else {
      toast.error("Błąd tworzenia");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nowy turniej</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Turniej Mikołajkowy" required />
          </div>
          <div className="space-y-1">
            <Label>Lokalizacja</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="np. Lodowisko Siedlce" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data rozpoczęcia</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Data zakończenia</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kategoria</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{getCategoryLabel(c, true)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Grupa</Label>
              <Select value={form.groupId || "NONE"} onValueChange={(v) => v && setForm({ ...form, groupId: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Brak</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Opis (opcjonalnie)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={loading}>
              <Trophy className="h-4 w-4 mr-1" />
              {loading ? "Tworzenie..." : "Utwórz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Dialog szczegółów turnieju ====================

function TournamentDetailDialog({
  tournamentId, onClose, isAdminOrCoach, onUpdated,
}: {
  tournamentId: string; onClose: () => void; isAdminOrCoach: boolean; onUpdated: () => void;
}) {
  const [tournament, setTournament] = useState<(Tournament & { matches: TournamentMatch[]; callups: Callup[]; documents: TournamentDocument[] }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<"matches" | "callups">("matches");
  const [matchForm, setMatchForm] = useState({ opponent: "", isHome: true, matchDate: "", notes: "" });
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [addingCallups, setAddingCallups] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [linkPlayer, setLinkPlayer] = useState<{ id: string; name: string } | null>(null);

  const fetchTournament = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}`);
    if (res.ok) setTournament(await res.json());
  }, [tournamentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournament();
    fetch("/api/players").then((r) => r.json()).then(setPlayers).catch(() => {});
  }, [fetchTournament]);

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchForm),
    });
    if (res.ok) {
      toast.success("Mecz dodany");
      setMatchForm({ opponent: "", isHome: true, matchDate: "", notes: "" });
      fetchTournament();
      onUpdated();
    }
  }

  async function updateScore(matchId: string, ourScore: number, opponentScore: number) {
    await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, ourScore, opponentScore }),
    });
    fetchTournament();
    onUpdated();
  }

  async function addCallups() {
    if (selectedPlayers.length === 0) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/callups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: selectedPlayers }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Powołano ${data.created} zawodników${data.skipped ? ` (pominięto ${data.skipped} już powołanych)` : ""}. Powiadomienia rozesłane.`);
      setSelectedPlayers([]);
      setAddingCallups(false);
      fetchTournament();
      onUpdated();
    } else {
      toast.error("Błąd przy dodawaniu powołań");
    }
  }

  async function callupWholeGroup() {
    if (!tournament?.groupId) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/callups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: tournament.groupId }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Powołano ${data.created} zawodników z grupy. ${data.skipped ? `(pominięto ${data.skipped} już powołanych)` : ""}`);
      fetchTournament();
      onUpdated();
    } else {
      toast.error("Błąd przy powoływaniu grupy");
    }
  }

  async function saveTournamentDetails(updates: Partial<Tournament>) {
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      toast.success("Zapisano");
      fetchTournament();
      onUpdated();
    } else {
      toast.error("Błąd zapisu");
    }
  }

  async function updateCallupStatus(callupId: string, status: string) {
    await fetch(`/api/tournaments/${tournamentId}/callups`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callupId, status }),
    });
    fetchTournament();
  }

  async function toggleConsent(callupId: string, consentReceived: boolean) {
    const res = await fetch(`/api/tournaments/${tournamentId}/callups`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callupId, consentReceived }),
    });
    if (!res.ok) toast.error("Błąd zapisu");
    fetchTournament();
  }

  async function uploadDocument(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Plik większy niż 4 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tournaments/${tournamentId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        toast.success("Dokument dodany – rodzice powołanych dzieci mogą go pobrać");
        fetchTournament();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Błąd wgrywania");
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(docId: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/documents/${docId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchTournament();
    else toast.error("Błąd usuwania");
  }

  async function removeCallup(callupId: string) {
    await fetch(`/api/tournaments/${tournamentId}/callups?callupId=${callupId}`, {
      method: "DELETE",
    });
    fetchTournament();
    onUpdated();
  }

  if (!tournament) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent><p className="text-center py-8 text-muted-foreground">Ładowanie...</p></DialogContent>
      </Dialog>
    );
  }

  const calledPlayerIds = tournament.callups.map((c) => c.player.id);
  const availablePlayers = players
    .filter((p) => !calledPlayerIds.includes(p.id))
    .filter((p) => {
      if (!playerSearch.trim()) return true;
      const q = playerSearch.toLowerCase();
      return (
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Najpierw zawodnicy z kategorii turnieju, potem reszta
      const aMatch = a.category === tournament.category ? 0 : 1;
      const bMatch = b.category === tournament.category ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.lastName.localeCompare(b.lastName, "pl");
    });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {tournament.name}
            <Badge variant="outline" className="ml-1">{getCategoryLabel(tournament.category)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {tournament.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(tournament.startDate).toLocaleDateString("pl-PL")}
            {tournament.endDate && ` – ${new Date(tournament.endDate).toLocaleDateString("pl-PL")}`}
          </span>
        </div>

        {tournament.description && (
          <p className="text-sm text-muted-foreground mb-4">{tournament.description}</p>
        )}

        {/* Detale wyjazdu — edytowalne dla admina/trenera */}
        {isAdminOrCoach && (
          <TournamentLogistics
            tournament={tournament}
            onSave={saveTournamentDetails}
          />
        )}

        {/* Dokumenty dla rodziców powołanych dzieci (np. zgoda do wydruku) */}
        {isAdminOrCoach && (
          <div className="border rounded-lg p-3 mb-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Dokumenty dla rodziców
              </p>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs"
                disabled={tournament.callups.length === 0}
                onClick={() => setSendOpen(true)}
              >
                <Mail className="h-3.5 w-3.5 mr-1" /> Wyślij rodzicom
              </Button>
              <label className={cn("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border cursor-pointer hover:bg-accent", uploading && "opacity-50 pointer-events-none")}>
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Wgrywanie..." : "Dodaj plik"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDocument(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {tournament.documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Brak dokumentów. Dodaj np. zgodę rodzica (PDF) – rodzice powołanych dzieci pobiorą ją w zakładce Wyjazdy.
              </p>
            ) : (
              <ul className="space-y-1">
                {tournament.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <a
                      href={`/api/tournaments/${tournamentId}/documents/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 hover:underline truncate"
                    >
                      {d.name}
                    </a>
                    <span className="text-xs text-muted-foreground">{Math.ceil(d.size / 1024)} KB</span>
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => removeDocument(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-4">
          <button
            onClick={() => setTab("matches")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "matches" ? "border-sky-500 text-sky-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Mecze ({tournament.matches.length})
          </button>
          <button
            onClick={() => setTab("callups")}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "callups" ? "border-sky-500 text-sky-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Powołania ({tournament.callups.length})
          </button>
        </div>

        {/* Mecze */}
        {tab === "matches" && (
          <div className="space-y-4">
            {tournament.matches.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Brak meczy</p>
            ) : (
              <div className="space-y-2">
                {tournament.matches.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {m.isHome ? "SWH Siedlce" : m.opponent} vs {m.isHome ? m.opponent : "SWH Siedlce"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.matchDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {m.ourScore !== null && m.opponentScore !== null ? (
                      <div className="text-lg font-bold">
                        <span className={m.ourScore > m.opponentScore ? "text-green-600" : m.ourScore < m.opponentScore ? "text-red-600" : ""}>
                          {m.ourScore}
                        </span>
                        <span className="text-muted-foreground mx-1">:</span>
                        <span>{m.opponentScore}</span>
                      </div>
                    ) : isAdminOrCoach ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          className="w-14 h-8 text-center"
                          placeholder="—"
                          onBlur={(e) => {
                            const our = parseInt(e.target.value);
                            const oppInput = e.target.parentElement?.querySelector<HTMLInputElement>('input:last-of-type');
                            const opp = oppInput ? parseInt(oppInput.value) : NaN;
                            if (!isNaN(our) && !isNaN(opp)) updateScore(m.id, our, opp);
                          }}
                        />
                        <span className="text-muted-foreground">:</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-14 h-8 text-center"
                          placeholder="—"
                          onBlur={(e) => {
                            const opp = parseInt(e.target.value);
                            const ourInput = e.target.parentElement?.querySelector<HTMLInputElement>('input:first-of-type');
                            const our = ourInput ? parseInt(ourInput.value) : NaN;
                            if (!isNaN(our) && !isNaN(opp)) updateScore(m.id, our, opp);
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">— : —</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdminOrCoach && (
              <form onSubmit={addMatch} className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Dodaj mecz</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={matchForm.opponent}
                    onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })}
                    placeholder="Przeciwnik"
                    required
                  />
                  <Input
                    type="datetime-local"
                    value={matchForm.matchDate}
                    onChange={(e) => setMatchForm({ ...matchForm, matchDate: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={matchForm.isHome}
                      onChange={(e) => setMatchForm({ ...matchForm, isHome: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Mecz u siebie
                  </label>
                  <Button type="submit" size="sm" className="ml-auto">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj mecz
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Powołania */}
        {tab === "callups" && (
          <div className="space-y-4">
            {tournament.callups.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Brak powołań</p>
            ) : (
              <div className="space-y-2">
                {tournament.callups.map((c) => {
                  const st = CALLUP_STATUS[c.status] || CALLUP_STATUS.CALLED;
                  const tr = TRANSPORT_LABELS[c.transportChoice] || TRANSPORT_LABELS.UNDECIDED;
                  const Icon = st.icon;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {c.player.jerseyNum && <span className="text-muted-foreground mr-1">#{c.player.jerseyNum}</span>}
                          {c.player.firstName} {c.player.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          {c.player.position || "Brak pozycji"}
                          {c.transportChoice !== "UNDECIDED" && (
                            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", tr.color)}>
                              {tr.emoji} {tr.label}
                            </span>
                          )}
                          {c.notes && <span className="italic text-muted-foreground/70">{`„${c.notes}"`}</span>}
                        </p>
                        {isAdminOrCoach && (
                          <p className="text-xs flex items-center gap-2 mt-0.5">
                            {c.player.parents.some((pp) => pp.parent.active) ? (
                              <span className="text-muted-foreground truncate">
                                Rodzic: {c.player.parents.filter((pp) => pp.parent.active).map((pp) => pp.parent.name).join(", ")}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium">⚠️ brak konta rodzica</span>
                            )}
                            <button
                              className="text-sky-700 hover:underline"
                              onClick={() => setLinkPlayer({ id: c.player.id, name: `${c.player.firstName} ${c.player.lastName}` })}
                            >
                              {c.player.parents.length ? "zmień" : "połącz"}
                            </button>
                            {c.consentFile && (
                              <a
                                href={`/api/callups/${c.id}/consent-file`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline"
                              >
                                <Paperclip className="h-3 w-3" /> zgoda od rodzica
                              </a>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdminOrCoach && (
                          <label
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-medium px-1.5 py-1 rounded cursor-pointer",
                              c.consentReceivedAt ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground"
                            )}
                            title="Podpisana zgoda rodzica dostarczona"
                          >
                            <input
                              type="checkbox"
                              checked={!!c.consentReceivedAt}
                              onChange={(e) => toggleConsent(c.id, e.target.checked)}
                              className="h-3.5 w-3.5"
                            />
                            Zgoda
                          </label>
                        )}
                        {isAdminOrCoach ? (
                          <Select
                            value={c.status}
                            onValueChange={(v) => v && updateCallupStatus(c.id, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CALLUP_STATUS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`flex items-center gap-1 text-xs font-medium ${st.color}`}>
                            <Icon className="h-3.5 w-3.5" /> {st.label}
                          </span>
                        )}
                        {isAdminOrCoach && (
                          <Button variant="ghost" size="sm" onClick={() => removeCallup(c.id)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Podsumowanie */}
            {tournament.callups.length > 0 && (
              <div className="flex gap-3 text-xs text-muted-foreground border-t pt-3">
                <span className="text-green-600">{tournament.callups.filter((c) => c.status === "CONFIRMED").length} potwierdzonych</span>
                <span className="text-blue-600">{tournament.callups.filter((c) => c.status === "CALLED").length} oczekujących</span>
                <span className="text-red-600">{tournament.callups.filter((c) => c.status === "DECLINED").length} odmówiło</span>
                <span className="text-orange-600">{tournament.callups.filter((c) => c.status === "INJURED").length} kontuzjowanych</span>
                <span className="text-emerald-700 ml-auto">
                  zgody: {tournament.callups.filter((c) => c.consentReceivedAt).length}/{tournament.callups.filter((c) => c.status === "CONFIRMED").length} potwierdzonych
                </span>
              </div>
            )}

            {isAdminOrCoach && !addingCallups && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddingCallups(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj powołania
                </Button>
                {tournament.groupId && (
                  <Button size="sm" variant="outline" onClick={callupWholeGroup}>
                    <Users className="h-3.5 w-3.5 mr-1" /> Powołaj całą grupę
                  </Button>
                )}
              </div>
            )}

            {isAdminOrCoach && addingCallups && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Powołaj zawodników
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      (turniej: {getCategoryLabel(tournament.category)})
                    </span>
                  </p>
                  {selectedPlayers.length > 0 && (
                    <span className="text-xs font-semibold text-sky-700">
                      Zaznaczonych: {selectedPlayers.length}
                    </span>
                  )}
                </div>
                <Input
                  placeholder="🔍 Szukaj zawodnika po imieniu lub nazwisku..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="h-9 text-sm"
                />
                {availablePlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {playerSearch.trim()
                      ? "Brak zawodników pasujących do wyszukiwania"
                      : "Wszyscy zawodnicy są już powołani"}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
                    {availablePlayers.map((p) => {
                      const isMainCategory = p.category === tournament.category;
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 hover:bg-accent rounded-md cursor-pointer text-sm",
                            !isMainCategory && "opacity-90"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlayers.includes(p.id)}
                            onChange={(e) =>
                              setSelectedPlayers((prev) =>
                                e.target.checked
                                  ? [...prev, p.id]
                                  : prev.filter((x) => x !== p.id)
                              )
                            }
                            className="h-4 w-4"
                          />
                          {p.jerseyNum && (
                            <span className="text-muted-foreground">#{p.jerseyNum}</span>
                          )}
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto",
                              isMainCategory
                                ? "bg-sky-100 text-sky-700"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            {getCategoryLabel(p.category)}
                          </span>
                          {p.position && (
                            <span className="text-xs text-muted-foreground">{p.position}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingCallups(false);
                      setSelectedPlayers([]);
                      setPlayerSearch("");
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button
                    size="sm"
                    onClick={addCallups}
                    disabled={selectedPlayers.length === 0}
                  >
                    Powołaj ({selectedPlayers.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {sendOpen && (
          <SendDocumentsDialog
            tournamentId={tournamentId}
            onClose={() => setSendOpen(false)}
            onSent={fetchTournament}
          />
        )}
        {linkPlayer && (
          <LinkParentDialog
            playerId={linkPlayer.id}
            playerName={linkPlayer.name}
            onClose={() => setLinkPlayer(null)}
            onLinked={fetchTournament}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ Komponent: Detale logistyczne wyjazdu (opłata, zbiórka, deadline) ============
function TournamentLogistics({
  tournament,
  onSave,
}: {
  tournament: Tournament;
  onSave: (updates: Partial<Tournament>) => Promise<void>;
}) {
  const [transportFee, setTransportFee] = useState<string>(
    tournament.transportFee?.toString() ?? ""
  );
  const [meetingTime, setMeetingTime] = useState<string>(
    tournament.meetingTime ? tournament.meetingTime.slice(0, 16) : ""
  );
  const [meetingLocation, setMeetingLocation] = useState<string>(
    tournament.meetingLocation ?? ""
  );
  const [parentDeadline, setParentDeadline] = useState<string>(
    tournament.parentDeadline ? tournament.parentDeadline.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    transportFee !== (tournament.transportFee?.toString() ?? "") ||
    meetingTime !== (tournament.meetingTime?.slice(0, 16) ?? "") ||
    meetingLocation !== (tournament.meetingLocation ?? "") ||
    parentDeadline !== (tournament.parentDeadline?.slice(0, 16) ?? "");

  async function handleSave() {
    setSaving(true);
    await onSave({
      transportFee: transportFee ? parseFloat(transportFee) : null,
      meetingTime: meetingTime ? new Date(meetingTime).toISOString() : null,
      meetingLocation: meetingLocation || null,
      parentDeadline: parentDeadline ? new Date(parentDeadline).toISOString() : null,
    } as Partial<Tournament>);
    setSaving(false);
  }

  return (
    <div className="border rounded-lg p-3 mb-4 bg-slate-50/50">
      <p className="text-xs font-semibold text-muted-foreground mb-2">DETALE WYJAZDU (dla rodziców)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Opłata transportowa (zł)</Label>
          <Input
            type="number"
            min="0"
            step="10"
            placeholder="np. 150 (puste = brak autokaru)"
            value={transportFee}
            onChange={(e) => setTransportFee(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Deadline odpowiedzi rodziców</Label>
          <Input
            type="datetime-local"
            value={parentDeadline}
            onChange={(e) => setParentDeadline(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Godzina zbiórki</Label>
          <Input
            type="datetime-local"
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Miejsce zbiórki</Label>
          <Input
            type="text"
            placeholder="np. Parking Nowe Kino"
            value={meetingLocation}
            onChange={(e) => setMeetingLocation(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      {dirty && (
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz detale"}
          </Button>
        </div>
      )}
    </div>
  );
}

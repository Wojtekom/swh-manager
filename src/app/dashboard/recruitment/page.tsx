"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Search, Eye, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Recruitment {
  id: string;
  childFirstName: string;
  childLastName: string;
  childBirthDate: string;
  category: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  experience: string | null;
  healthNotes: string | null;
  howFound: string | null;
  message: string | null;
  consentHealth: boolean;
  consentImage: boolean;
  consentTravel: boolean;
  consentGoodPractice: boolean;
  consentData: boolean;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
}

interface AcceptResult {
  playerName: string;
  playerCreated: boolean;
  parentCreated: boolean;
  parentEmail: string;
  emailSent: boolean;
  tempPassword?: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NEW: { label: "Nowe", variant: "default" },
  CONTACTED: { label: "Skontaktowano", variant: "secondary" },
  ACCEPTED: { label: "Przyjęte", variant: "outline" },
  REJECTED: { label: "Odrzucone", variant: "destructive" },
};

export default function RecruitmentAdminPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Recruitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [detailItem, setDetailItem] = useState<Recruitment | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sendInvite, setSendInvite] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<AcceptResult | null>(null);
  const isAdmin = session?.user?.role === "ADMIN";

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        const data: Group[] = await res.json();
        setGroups(data.map((g) => ({ id: g.id, name: g.name })));
      }
    } catch {
      // brak grup nie blokuje przyjęcia
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/recruitment");
      if (res.ok) setItems(await res.json());
    } catch {
      toast.error("Błąd pobierania zgłoszeń");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated") {
      fetchItems();
      fetchGroups();
    }
  }, [authStatus, router, fetchItems, fetchGroups]);

  const filtered = items.filter((r) => {
    const matchSearch = `${r.childFirstName} ${r.childLastName} ${r.parentName}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchCat = filterCategory === "ALL" || r.category === filterCategory;
    const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  function openDetail(item: Recruitment) {
    setDetailItem(item);
    setEditNotes(item.adminNotes || "");
    setEditStatus(item.status);
    setSelectedGroups([]);
    setSendInvite(true);
  }

  function toggleGroup(id: string) {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  // Przyjęcie: zawodnik + grupy + konto rodzica + powiązanie + zaproszenie
  async function acceptRecruitment(item: Recruitment) {
    setAccepting(true);
    try {
      const res = await fetch(`/api/recruitment/${item.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds: selectedGroups, sendInvite }),
      });
      if (!res.ok) {
        toast.error("Nie udało się przyjąć zgłoszenia");
        return false;
      }
      const data = await res.json();
      setAcceptResult({
        playerName: `${item.childFirstName.trim()} ${item.childLastName.trim()}`,
        playerCreated: data.playerCreated,
        parentCreated: data.parentCreated,
        parentEmail: data.parentEmail,
        emailSent: data.emailSent,
        tempPassword: data.tempPassword,
      });
      return true;
    } finally {
      setAccepting(false);
    }
  }

  async function saveChanges() {
    if (!detailItem) return;
    const isNewAccept = isAdmin && editStatus === "ACCEPTED" && detailItem.status !== "ACCEPTED";
    const res = await fetch(`/api/recruitment/${detailItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // status ACCEPTED ustawia endpoint przyjęcia — tu zapisujemy wtedy tylko notatki
      body: JSON.stringify(
        isNewAccept ? { adminNotes: editNotes } : { status: editStatus, adminNotes: editNotes }
      ),
    });
    if (!res.ok) {
      toast.error("Błąd zapisu");
      return;
    }
    if (isNewAccept && !(await acceptRecruitment(detailItem))) {
      fetchItems();
      return;
    }
    toast.success("Zaktualizowano");
    fetchItems();
    setDetailItem(null);
  }

  // Dla zgłoszeń przyjętych wcześniej (przed automatem) — uzupełnia zawodnika i konto rodzica
  async function completeAccepted() {
    if (!detailItem) return;
    if (await acceptRecruitment(detailItem)) {
      fetchItems();
      setDetailItem(null);
    }
  }

  function copyEmbedCode() {
    const code = `<iframe src="${window.location.origin}/nabor/embed" width="100%" height="900" frameborder="0" style="border:none; border-radius:12px;"></iframe>`;
    navigator.clipboard.writeText(code);
    toast.success("Kod osadzenia skopiowany!");
  }

  const countByStatus = (s: string) => items.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nabór</h1>
          <p className="text-muted-foreground">
            {items.length} zgłoszeń ({countByStatus("NEW")} nowych)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyEmbedCode}>
            <Copy className="h-4 w-4 mr-1" />
            Kod iframe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/nabor", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Podgląd formularza
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["NEW", "CONTACTED", "ACCEPTED", "REJECTED"] as const).map((s) => {
          const st = STATUS_MAP[s];
          return (
            <Card key={s}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{countByStatus(s)}</p>
                <Badge variant={st.variant} className="mt-1">{st.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Grupa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie</SelectItem>
                {["U8", "U10", "U12", "U14", "U16", "U18", "SENIOR"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Brak zgłoszeń.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Zawodnik</TableHead>
                    <TableHead>Grupa</TableHead>
                    <TableHead>Rodzic</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = STATUS_MAP[r.status] || STATUS_MAP.NEW;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString("pl-PL")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.childLastName} {r.childFirstName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.category}</Badge>
                        </TableCell>
                        <TableCell>{r.parentName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <a href={`tel:${r.parentPhone}`} className="text-blue-600 hover:underline">
                            {r.parentPhone}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openDetail(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailItem?.childLastName} {detailItem?.childFirstName} — {detailItem?.category}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Data urodzenia</p>
                  <p className="font-medium">
                    {new Date(detailItem.childBirthDate).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Doświadczenie</p>
                  <p className="font-medium">{detailItem.experience || "—"}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="font-semibold mb-2">Rodzic / opiekun</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Imię i nazwisko</p>
                    <p className="font-medium">{detailItem.parentName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefon</p>
                    <p className="font-medium">
                      <a href={`tel:${detailItem.parentPhone}`} className="text-blue-600">
                        {detailItem.parentPhone}
                      </a>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">
                      <a href={`mailto:${detailItem.parentEmail}`} className="text-blue-600">
                        {detailItem.parentEmail}
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {detailItem.healthNotes && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground">Uwagi zdrowotne</p>
                  <p>{detailItem.healthNotes}</p>
                </div>
              )}

              {detailItem.message && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground">Wiadomość</p>
                  <p>{detailItem.message}</p>
                </div>
              )}

              <div className="border-t pt-3">
                <p className="font-semibold mb-2">Zgody</p>
                <div className="space-y-1">
                  <ConsentRow label="Stan zdrowia" ok={detailItem.consentHealth} />
                  <ConsentRow label="Wizerunek" ok={detailItem.consentImage} />
                  <ConsentRow label="Mecze/turnieje wyjazdowe" ok={detailItem.consentTravel} />
                  <ConsentRow label="Regulamin / dobre praktyki" ok={detailItem.consentGoodPractice} />
                  <ConsentRow label="Dane osobowe (RODO)" ok={detailItem.consentData} />
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && editStatus === "ACCEPTED" && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-3">
                    <p className="font-semibold text-sky-900">
                      {detailItem.status === "ACCEPTED"
                        ? "Uzupełnij przyjęcie"
                        : "Przyjęcie do klubu"}
                    </p>
                    <p className="text-xs text-sky-900/80">
                      Dziecko zostanie dodane do zawodników, rodzic dostanie konto
                      (e-mail z formularza) i zostanie połączony z dzieckiem. Zgody z
                      formularza trafią na konto rodzica. Jeśli zawodnik lub konto już
                      istnieją — zostaną użyte, nic się nie zdubluje.
                    </p>
                    <div className="space-y-1">
                      <Label>Dopisz do grup</Label>
                      {groups.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Brak grup</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {groups.map((g) => (
                            <label key={g.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedGroups.includes(g.id)}
                                onChange={() => toggleGroup(g.id)}
                              />
                              {g.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sendInvite}
                        onChange={(e) => setSendInvite(e.target.checked)}
                      />
                      Wyślij rodzicowi e-mail z danymi logowania
                    </label>
                    {detailItem.status === "ACCEPTED" && (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={accepting}
                        onClick={completeAccepted}
                      >
                        {accepting ? "Przetwarzanie..." : "Utwórz zawodnika i konto rodzica"}
                      </Button>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Notatki administracyjne</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notatki wewnętrzne..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDetailItem(null)}>
                    Zamknij
                  </Button>
                  <Button onClick={saveChanges} disabled={accepting}>
                    {accepting
                      ? "Przetwarzanie..."
                      : isAdmin && editStatus === "ACCEPTED" && detailItem.status !== "ACCEPTED"
                        ? "Przyjmij i utwórz konto"
                        : "Zapisz zmiany"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wynik przyjęcia */}
      <Dialog open={!!acceptResult} onOpenChange={() => setAcceptResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Przyjęto: {acceptResult?.playerName}</DialogTitle>
          </DialogHeader>
          {acceptResult && (
            <div className="space-y-2 text-sm">
              <ConsentRow
                label={acceptResult.playerCreated ? "Dodano do zawodników" : "Zawodnik był już w bazie"}
                ok
              />
              <ConsentRow
                label={
                  acceptResult.parentCreated
                    ? `Założono konto rodzica (${acceptResult.parentEmail})`
                    : `Konto rodzica już istniało (${acceptResult.parentEmail})`
                }
                ok
              />
              <ConsentRow label="Rodzic połączony z dzieckiem" ok />
              {acceptResult.parentCreated && (
                <ConsentRow
                  label={acceptResult.emailSent ? "Wysłano e-mail z danymi logowania" : "E-mail nie został wysłany"}
                  ok={acceptResult.emailSent}
                />
              )}
              {acceptResult.tempPassword && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="font-semibold">Przekaż rodzicowi dane logowania:</p>
                  <p>Login: <strong>{acceptResult.parentEmail}</strong></p>
                  <p>Hasło tymczasowe: <strong>{acceptResult.tempPassword}</strong></p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={() => setAcceptResult(null)}>OK</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsentRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? "text-green-600" : "text-red-500"}>
        {ok ? "\u2713" : "\u2717"}
      </span>
      <span>{label}</span>
    </div>
  );
}

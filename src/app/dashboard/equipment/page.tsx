"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Trash2,
  ArrowRightLeft,
  Undo2,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RemanentTab } from "./remanent-tab";

interface ActiveLoan {
  id: string;
  player: { id: string; firstName: string; lastName: string };
  quantity: number;
}

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  serialNum: string | null;
  condition: string;
  quantity: number;
  available: number;
  location: string | null;
  purchasePrice: number | null;
  notes: string | null;
  loans: ActiveLoan[];
  _count: { loans: number };
}

interface Loan {
  id: string;
  quantity: number;
  loanDate: string;
  dueDate: string | null;
  returnDate: string | null;
  status: string;
  notes: string | null;
  equipment: { id: string; name: string; category: string; size: string | null };
  player: { id: string; firstName: string; lastName: string };
  issuedBy: { id: string; name: string };
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
  dateOfBirth?: string | null;
  status?: string;
}

const CATEGORY_MAP: Record<string, string> = {
  HELMET: "Kask",
  SKATES: "Łyżwy",
  ROLLER_SKATES: "Łyżworolki",
  STICK: "Kij",
  GLOVES: "Rękawice",
  PADS: "Ochraniacze",
  JERSEY: "Koszulka",
  PANTS: "Spodnie",
  BAG: "Torba",
  GOALIE_GEAR: "Sprzęt bramkarski",
  NECK_GUARD: "Ochraniacz szyi",
  MOUTHGUARD: "Ochraniacz na zęby",
  TRAINING_AID: "Pomoc treningowa",
  ACCESSORY: "Akcesorium",
  OTHER: "Inne",
};

const CONDITION_MAP: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nowy", color: "text-green-600" },
  GOOD: { label: "Dobry", color: "text-blue-600" },
  FAIR: { label: "Przeciętny", color: "text-yellow-600" },
  POOR: { label: "Słaby", color: "text-orange-600" },
  DAMAGED: { label: "Uszkodzony", color: "text-red-600" },
  RETIRED: { label: "Wycofany", color: "text-gray-500" },
};

const LOAN_STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Wypożyczony", color: "bg-blue-100 text-blue-700" },
  RETURNED: { label: "Zwrócony", color: "bg-green-100 text-green-700" },
  OVERDUE: { label: "Po terminie", color: "bg-red-100 text-red-700" },
  LOST: { label: "Zgubiony", color: "bg-gray-100 text-gray-700" },
};

const CATEGORIES = Object.keys(CATEGORY_MAP);
const CONDITIONS = Object.keys(CONDITION_MAP);

export default function EquipmentPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdminOrCoach = session?.user?.role === "ADMIN" || session?.user?.role === "COACH";

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inventory" | "loans" | "history" | "remanent">("inventory");
  const [createOpen, setCreateOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [eRes, lRes, pRes] = await Promise.all([
        fetch("/api/equipment"),
        fetch("/api/equipment/loans?status=ALL"),
        fetch("/api/players"),
      ]);
      if (eRes.ok) setEquipment(await eRes.json());
      if (lRes.ok) setLoans(await lRes.json());
      if (pRes.ok) setPlayers(await pRes.json());
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

  const filteredEquipment = equipment.filter((e) => {
    if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || (e.brand || "").toLowerCase().includes(q) || (e.size || "").toLowerCase().includes(q);
    }
    return true;
  });

  const activeLoans = loans.filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE");
  const returnedLoans = loans.filter((l) => l.status === "RETURNED" || l.status === "LOST");
  const overdueCount = loans.filter((l) => l.status === "OVERDUE").length;
  const totalItems = equipment.reduce((sum, e) => sum + e.quantity, 0);
  const totalAvailable = equipment.reduce((sum, e) => sum + e.available, 0);
  const totalValue = equipment.reduce((sum, e) => sum + (e.purchasePrice || 0) * e.quantity, 0);

  async function handleDelete(id: string) {
    if (!confirm("Usunąć sprzęt?")) return;
    const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Usunięto"); fetchData(); }
  }

  async function handleReturn(loanId: string) {
    const res = await fetch(`/api/equipment/loans/${loanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RETURNED" }),
    });
    if (res.ok) { toast.success("Zwrócono"); fetchData(); }
  }

  async function handleMarkLost(loanId: string) {
    if (!confirm("Oznacz jako zgubiony?")) return;
    const res = await fetch(`/api/equipment/loans/${loanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LOST" }),
    });
    if (res.ok) { toast.success("Oznaczono"); fetchData(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sprzęt i magazyn</h1>
          <p className="text-muted-foreground">{totalItems} przedmiotów w magazynie</p>
        </div>
        {isAdminOrCoach && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLoanOpen(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-1" /> Wypożycz
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Dodaj sprzęt
            </Button>
          </div>
        )}
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-xs text-muted-foreground">Łącznie</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
            <p className="text-xs text-muted-foreground">Dostępnych</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-sky-600">{activeLoans.length}</p>
            <p className="text-xs text-muted-foreground">Wypożyczonych</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>{overdueCount}</p>
            <p className="text-xs text-muted-foreground">Po terminie</p>
          </CardContent>
        </Card>
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 border-b">
        {[
          { key: "inventory", label: `Magazyn (${equipment.length})` },
          { key: "loans", label: `Wypożyczenia (${activeLoans.length})` },
          { key: "history", label: `Historia (${returnedLoans.length})` },
          ...(isAdminOrCoach ? [{ key: "remanent", label: "Remanent" }] : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-sky-500 text-sky-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "remanent" && isAdminOrCoach && (
        <RemanentTab equipment={equipment} loans={loans} players={players} onSaved={fetchData} />
      )}

      {/* MAGAZYN */}
      {tab === "inventory" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Szukaj..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_MAP[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
          ) : filteredEquipment.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Brak sprzętu w magazynie.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Nazwa</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Kategoria</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Rozmiar</th>
                    <th className="text-left px-4 py-2.5 font-medium">Stan</th>
                    <th className="text-center px-4 py-2.5 font-medium">Dostępne</th>
                    {isAdminOrCoach && <th className="text-right px-4 py-2.5 font-medium w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipment.map((item) => {
                    const cond = CONDITION_MAP[item.condition] || CONDITION_MAP.GOOD;
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.brand && `${item.brand} `}{item.model || ""}
                            {item.location && ` · ${item.location}`}
                          </p>
                          {item.loans.length > 0 && (
                            <p className="text-xs text-sky-600 mt-0.5">
                              Wypoż: {item.loans.map((l) => `${l.player.firstName} ${l.player.lastName}`).join(", ")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <Badge variant="outline">{CATEGORY_MAP[item.category] || item.category}</Badge>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">{item.size || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium ${cond.color}`}>{cond.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={item.available === 0 ? "text-red-600 font-medium" : ""}>
                            {item.available}/{item.quantity}
                          </span>
                        </td>
                        {isAdminOrCoach && (
                          <td className="px-4 py-2.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalValue > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Wartość magazynu: {totalValue.toLocaleString("pl-PL")} PLN
            </p>
          )}
        </div>
      )}

      {/* WYPOŻYCZENIA AKTYWNE */}
      {tab === "loans" && (
        <div className="space-y-3">
          {activeLoans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Brak aktywnych wypożyczeń.</p>
              </CardContent>
            </Card>
          ) : (
            activeLoans.map((loan) => {
              const st = LOAN_STATUS_MAP[loan.status] || LOAN_STATUS_MAP.ACTIVE;
              const isOverdue = loan.dueDate && new Date(loan.dueDate) < new Date() && loan.status === "ACTIVE";
              return (
                <div key={loan.id} className={cn("flex items-center gap-3 p-3 border rounded-lg", isOverdue && "border-red-300 bg-red-50 dark:bg-red-950/20")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {loan.equipment.name}
                      {loan.equipment.size && <span className="text-muted-foreground ml-1">({loan.equipment.size})</span>}
                      {loan.quantity > 1 && <span className="text-muted-foreground ml-1">x{loan.quantity}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {loan.player.firstName} {loan.player.lastName}
                      {" · "}od {new Date(loan.loanDate).toLocaleDateString("pl-PL")}
                      {loan.dueDate && ` · do ${new Date(loan.dueDate).toLocaleDateString("pl-PL")}`}
                    </p>
                    {isOverdue && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" /> Po terminie zwrotu!
                      </p>
                    )}
                  </div>
                  {isAdminOrCoach && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleReturn(loan.id)}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Zwrot
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleMarkLost(loan.id)}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* HISTORIA */}
      {tab === "history" && (
        <div className="space-y-2">
          {returnedLoans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Brak historii.</p>
          ) : (
            returnedLoans.map((loan) => {
              const st = LOAN_STATUS_MAP[loan.status] || LOAN_STATUS_MAP.RETURNED;
              return (
                <div key={loan.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {loan.equipment.name}
                      {loan.equipment.size && <span className="text-muted-foreground ml-1">({loan.equipment.size})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {loan.player.firstName} {loan.player.lastName}
                      {" · "}{new Date(loan.loanDate).toLocaleDateString("pl-PL")}
                      {loan.returnDate && ` → ${new Date(loan.returnDate).toLocaleDateString("pl-PL")}`}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      <CreateEquipmentDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={fetchData} />
      <LoanDialog open={loanOpen} onClose={() => setLoanOpen(false)} equipment={equipment} players={players} onSaved={fetchData} />
    </div>
  );
}

// ==================== Dialog dodawania sprzętu ====================

function CreateEquipmentDialog({
  open, onClose, onSaved,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "HELMET", brand: "", model: "", size: "",
    serialNum: "", condition: "NEW", quantity: 1, location: "",
    purchasePrice: "", notes: "",
  });

  useEffect(() => {
    if (open) setForm({
      name: "", category: "HELMET", brand: "", model: "", size: "",
      serialNum: "", condition: "NEW", quantity: 1, location: "",
      purchasePrice: "", notes: "",
    });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      }),
    });
    if (res.ok) { toast.success("Dodano"); onSaved(); onClose(); }
    else toast.error("Błąd");
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj sprzęt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Kask Bauer Re-Akt 85" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kategoria</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_MAP[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Stan</Label>
              <Select value={form.condition} onValueChange={(v) => v && setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{CONDITION_MAP[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Marka</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Bauer" />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Re-Akt 85" />
            </div>
            <div className="space-y-1">
              <Label>Rozmiar</Label>
              <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="M" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Ilość</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Cena (PLN)</Label>
              <Input type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="—" />
            </div>
            <div className="space-y-1">
              <Label>Lokalizacja</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Szafa A" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Uwagi</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={loading}>
              <Package className="h-4 w-4 mr-1" /> {loading ? "Dodawanie..." : "Dodaj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Dialog wypożyczenia ====================

function LoanDialog({
  open, onClose, equipment, players, onSaved,
}: {
  open: boolean; onClose: () => void; equipment: EquipmentItem[]; players: Player[]; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ equipmentId: "", playerId: "", quantity: 1, dueDate: "", notes: "" });
  const [eqSearch, setEqSearch] = useState("");
  const [plSearch, setPlSearch] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ equipmentId: "", playerId: "", quantity: 1, dueDate: "", notes: "" });
      setEqSearch("");
      setPlSearch("");
    }
  }, [open]);

  const availableEquipment = equipment.filter((e) => e.available > 0 && e.condition !== "RETIRED");
  const filteredEq = availableEquipment.filter((e) =>
    e.name.toLowerCase().includes(eqSearch.toLowerCase()) ||
    (CATEGORY_MAP[e.category] || "").toLowerCase().includes(eqSearch.toLowerCase())
  );
  const filteredPl = players.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(plSearch.toLowerCase())
  );

  const selectedEq = equipment.find((e) => e.id === form.equipmentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipmentId || !form.playerId) { toast.error("Wybierz sprzęt i zawodnika"); return; }
    setLoading(true);
    const res = await fetch("/api/equipment/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity),
        dueDate: form.dueDate || null,
      }),
    });
    if (res.ok) { toast.success("Wypożyczono"); onSaved(); onClose(); }
    else {
      const data = await res.json();
      toast.error(data.error || "Błąd");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nowe wypożyczenie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sprzęt */}
          <div className="space-y-1">
            <Label>Sprzęt</Label>
            {form.equipmentId ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedEq?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEq && CATEGORY_MAP[selectedEq.category]} · Dostępne: {selectedEq?.available}
                    {selectedEq?.size && ` · ${selectedEq.size}`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, equipmentId: "" })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <Input placeholder="Szukaj sprzętu..." value={eqSearch} onChange={(e) => setEqSearch(e.target.value)} />
                <div className="max-h-36 overflow-y-auto border rounded-lg mt-1">
                  {filteredEq.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setForm({ ...form, equipmentId: e.id, quantity: 1 })}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {CATEGORY_MAP[e.category]} · {e.available} szt.{e.size && ` · ${e.size}`}
                      </span>
                    </button>
                  ))}
                  {filteredEq.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Brak</p>}
                </div>
              </>
            )}
          </div>

          {/* Zawodnik */}
          <div className="space-y-1">
            <Label>Zawodnik</Label>
            {form.playerId ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg">
                <p className="text-sm font-medium flex-1">
                  {players.find((p) => p.id === form.playerId)?.firstName}{" "}
                  {players.find((p) => p.id === form.playerId)?.lastName}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, playerId: "" })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <Input placeholder="Szukaj zawodnika..." value={plSearch} onChange={(e) => setPlSearch(e.target.value)} />
                <div className="max-h-36 overflow-y-auto border rounded-lg mt-1">
                  {filteredPl.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, playerId: p.id })}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                    >
                      {p.firstName} {p.lastName}
                      <span className="text-xs text-muted-foreground ml-2">{p.category}</span>
                    </button>
                  ))}
                  {filteredPl.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Brak</p>}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Ilość</Label>
              <Input type="number" min={1} max={selectedEq?.available || 1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Termin zwrotu</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Uwagi</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcjonalnie" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={loading || !form.equipmentId || !form.playerId}>
              <ArrowRightLeft className="h-4 w-4 mr-1" /> {loading ? "Wypożyczanie..." : "Wypożycz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Search,
  Settings2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TransferInfo } from "@/components/payments/transfer-info";
import { paymentReference } from "@/lib/payments";
import { AssignDialog } from "@/components/payments/assign-dialog";

interface Fee {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  active: boolean;
}

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  paidAmount: number | null;
  status: string;
  notes: string | null;
  player: { id: string; firstName: string; lastName: string; category: string };
  fee: { id: string; name: string; frequency: string };
}

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: "Miesięczna",
  QUARTERLY: "Kwartalna",
  YEARLY: "Roczna",
  ONE_TIME: "Jednorazowa",
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  PENDING: { label: "Oczekuje", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  PAID: { label: "Opłacone", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  PARTIAL: { label: "Częściowe", variant: "outline", icon: <DollarSign className="h-3 w-3" /> },
  OVERDUE: { label: "Zaległe", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function PaymentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";

  const [tab, setTab] = useState<"payments" | "fees">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Dialogs
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, fRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/fees"),
      ]);
      if (pRes.ok) setPayments(await pRes.json());
      if (fRes.ok) setFees(await fRes.json());
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

  const filteredPayments = payments.filter((p) => {
    const matchSearch = `${p.player.lastName} ${p.player.firstName} ${p.fee.name}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalDue = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + (p.paidAmount || p.amount), 0);
  const totalOverdue = payments
    .filter((p) => p.status === "OVERDUE" || p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);

  // Rodzic: należności do zapłacenia (z danymi do przelewu i kodem QR)
  const toPay = payments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE" || p.status === "PARTIAL")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Składki i płatności</h1>
          <p className="text-muted-foreground">{payments.length} płatności</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nalicz należność
            </Button>
            <Button
              variant={tab === "payments" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("payments")}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Płatności
            </Button>
            <Button
              variant={tab === "fees" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("fees")}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Definicje składek
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Naliczone</p>
                <p className="text-2xl font-bold">{totalDue.toFixed(2)} zł</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Opłacone</p>
                <p className="text-2xl font-bold text-green-600">{totalPaid.toFixed(2)} zł</p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Do zapłaty</p>
                <p className="text-2xl font-bold text-red-600">{totalOverdue.toFixed(2)} zł</p>
              </div>
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rodzic: jak zapłacić */}
      {!isAdmin && !loading && toPay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Do zapłaty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {toPay.map((p) => {
              const left = p.amount - (p.paidAmount || 0);
              const st = STATUS_MAP[p.status] || STATUS_MAP.PENDING;
              return (
                <div key={p.id} className="space-y-3 border-b pb-6 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {p.player.firstName} {p.player.lastName} – {p.fee.name}
                    </span>
                    <Badge variant={st.variant} className="gap-1">
                      {st.icon}
                      {st.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      termin: {new Date(p.dueDate).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  <TransferInfo
                    paymentId={p.id}
                    playerName={`${p.player.firstName} ${p.player.lastName}`}
                    amount={left}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Payments Tab */}
      {tab === "payments" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj zawodnika lub składki..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
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
            ) : filteredPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {payments.length === 0
                  ? "Brak płatności. Zdefiniuj składki i nalicz je zawodnikom."
                  : "Brak wyników dla podanych filtrów."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zawodnik</TableHead>
                      <TableHead>Kategoria</TableHead>
                      <TableHead>Składka</TableHead>
                      <TableHead>Kwota</TableHead>
                      <TableHead>Termin</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const st = STATUS_MAP[p.status] || STATUS_MAP.PENDING;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.player.lastName} {p.player.firstName}
                            {isAdmin && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                {paymentReference(p.id)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.player.category}</Badge>
                          </TableCell>
                          <TableCell>{p.fee.name}</TableCell>
                          <TableCell className="font-medium">{p.amount.toFixed(2)} zł</TableCell>
                          <TableCell className="text-sm">
                            {new Date(p.dueDate).toLocaleDateString("pl-PL")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="gap-1">
                              {st.icon}
                              {st.label}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingPayment(p);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fees Tab */}
      {tab === "fees" && isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Definicje składek</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingFee(null);
                setFeeDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nowa składka
            </Button>
          </CardHeader>
          <CardContent>
            {fees.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Brak zdefiniowanych składek. Dodaj pierwszą!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>Kwota</TableHead>
                      <TableHead>Częstotliwość</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell>{f.amount.toFixed(2)} zł</TableCell>
                        <TableCell>{FREQ_LABELS[f.frequency] || f.frequency}</TableCell>
                        <TableCell>
                          <Badge variant={f.active ? "default" : "secondary"}>
                            {f.active ? "Aktywna" : "Nieaktywna"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingFee(f);
                              setFeeDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (!confirm("Usunąć tę składkę?")) return;
                              const res = await fetch(`/api/fees/${f.id}`, { method: "DELETE" });
                              if (res.ok) {
                                toast.success("Usunięto");
                                fetchData();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fee Dialog */}
      <FeeDialog
        open={feeDialogOpen}
        onClose={() => setFeeDialogOpen(false)}
        fee={editingFee}
        onSaved={fetchData}
      />

      {/* Naliczanie należności wybranym zawodnikom */}
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        fees={fees.filter((f) => f.active)}
        onSaved={fetchData}
      />

      {/* Payment Status Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        payment={editingPayment}
        onSaved={fetchData}
      />
    </div>
  );
}

// --- Fee Dialog ---
function FeeDialog({
  open,
  onClose,
  fee,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  fee: Fee | null;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "MONTHLY",
  });

  useEffect(() => {
    if (fee) {
      setForm({
        name: fee.name,
        amount: fee.amount.toString(),
        frequency: fee.frequency,
      });
    } else {
      setForm({ name: "", amount: "", frequency: "MONTHLY" });
    }
  }, [fee, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body = {
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
    };

    const url = fee ? `/api/fees/${fee.id}` : "/api/fees";
    const method = fee ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(fee ? "Zaktualizowano" : "Dodano składkę");
      onSaved();
      onClose();
    } else {
      toast.error("Błąd zapisu");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{fee ? "Edytuj składkę" : "Nowa składka"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="np. Składka miesięczna"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Kwota (zł)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="np. 200"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Częstotliwość</Label>
            <Select value={form.frequency} onValueChange={(v) => v && setForm({ ...form, frequency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQ_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Zapisywanie..." : fee ? "Zapisz" : "Dodaj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Payment Status Dialog ---
function PaymentDialog({
  open,
  onClose,
  payment,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("PENDING");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (payment) {
      setStatus(payment.status);
      setPaidAmount(payment.paidAmount?.toString() || payment.amount.toString());
      setNotes(payment.notes || "");
    }
  }, [payment, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setLoading(true);

    const body: Record<string, unknown> = { status, notes };
    if (status === "PAID" || status === "PARTIAL") {
      body.paidAmount = parseFloat(paidAmount);
      body.paidDate = new Date().toISOString();
    }

    const res = await fetch(`/api/payments/${payment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success("Zaktualizowano");
      onSaved();
      onClose();
    } else {
      toast.error("Błąd zapisu");
    }
    setLoading(false);
  }

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {payment.player.lastName} {payment.player.firstName} — {payment.fee.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm">
            <p>Kwota: <strong>{payment.amount.toFixed(2)} zł</strong></p>
            <p>Termin: <strong>{new Date(payment.dueDate).toLocaleDateString("pl-PL")}</strong></p>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
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
          {(status === "PAID" || status === "PARTIAL") && (
            <div className="space-y-1">
              <Label>Wpłacona kwota (zł)</Label>
              <Input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Notatki</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcjonalne"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Plus, Pencil, Trash2, Phone, Mail, Award, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Coach {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  active: boolean;
  coach: {
    specialization: string | null;
    licenseNum: string | null;
    trainingGroups: { id: string; name: string; category: string }[];
  } | null;
}

export default function KadraPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);

  const fetchCoaches = useCallback(async () => {
    try {
      const res = await fetch("/api/coaches");
      if (res.ok) setCoaches(await res.json());
      else toast.error("Błąd pobierania kadry");
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated") fetchCoaches();
  }, [authStatus, router, fetchCoaches]);

  async function handleDeactivate(c: Coach) {
    if (!confirm(`Dezaktywować konto trenera ${c.name}?`)) return;
    const res = await fetch(`/api/users/${c.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Dezaktywowano"); fetchCoaches(); }
    else toast.error("Błąd");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kadra szkoleniowa klubu</h1>
          <p className="text-muted-foreground">{coaches.length} trenerów</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj trenera
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
      ) : coaches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Brak trenerów w systemie. Dodaj pierwszego.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coaches.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Aktywny" : "Nieaktywny"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {c.coach?.specialization && (
                  <p className="text-sm flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    {c.coach.specialization}
                  </p>
                )}
                {c.coach?.licenseNum && (
                  <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                    <Award className="h-3.5 w-3.5" />
                    {c.coach.licenseNum}
                  </p>
                )}
                <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </p>
                {c.phone && (
                  <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </p>
                )}
                {c.coach && c.coach.trainingGroups.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <UsersRound className="h-3.5 w-3.5" /> Grupy:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {c.coach.trainingGroups.map((g) => (
                        <Badge key={g.id} variant="outline">{g.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-1 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(c)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CoachDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        coach={editing}
        onSaved={fetchCoaches}
      />
    </div>
  );
}

function CoachDialog({
  open, onClose, coach, onSaved,
}: {
  open: boolean; onClose: () => void; coach: Coach | null; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", specialization: "", licenseNum: "", password: "",
  });

  useEffect(() => {
    if (coach) {
      setForm({
        name: coach.name,
        email: coach.email,
        phone: coach.phone || "",
        specialization: coach.coach?.specialization || "",
        licenseNum: coach.coach?.licenseNum || "",
        password: "",
      });
    } else {
      setForm({ name: "", email: "", phone: "", specialization: "", licenseNum: "", password: "" });
    }
  }, [coach, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (coach) {
        const body: Record<string, unknown> = {
          name: form.name,
          phone: form.phone,
          role: "COACH",
          specialization: form.specialization,
          licenseNum: form.licenseNum,
        };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/users/${coach.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) { toast.success("Zaktualizowano"); onSaved(); onClose(); }
        else { const d = await res.json(); toast.error(d.error?.toString() || "Błąd zapisu"); }
      } else {
        if (!form.password || form.password.length < 6) {
          toast.error("Hasło jest wymagane (min. 6 znaków)");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/coaches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) { toast.success("Trener dodany"); onSaved(); onClose(); }
        else { const d = await res.json(); toast.error(d.error?.toString() || "Błąd dodawania"); }
      }
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{coach ? "Edytuj trenera" : "Nowy trener"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Imię i nazwisko</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Adam Dudek" required />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="adam@example.com"
              disabled={!!coach}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+48 123 456 789" />
          </div>
          <div className="space-y-1">
            <Label>Specjalizacja</Label>
            <Input
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="np. przygotowanie motoryczne"
            />
          </div>
          <div className="space-y-1">
            <Label>Numer licencji trenerskiej</Label>
            <Input
              value={form.licenseNum}
              onChange={(e) => setForm({ ...form, licenseNum: e.target.value })}
              placeholder="np. PZHL/2026/123"
            />
          </div>
          <div className="space-y-1">
            <Label>{coach ? "Nowe hasło (pozostaw puste aby nie zmieniać)" : "Hasło"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={coach ? "Bez zmian" : "Min. 6 znaków"}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Zapisywanie..." : coach ? "Zapisz" : "Dodaj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

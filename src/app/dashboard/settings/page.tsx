"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Settings,
  Users,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Save,
  Shield,
  ShieldCheck,
  User as UserIcon,
  GraduationCap,
  MailPlus,
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

interface UserData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  active: boolean;
  createdAt: string;
  coach?: { specialization: string | null; licenseNum: string | null } | null;
}

const ROLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Shield }> = {
  ADMIN:  { label: "Admin",  variant: "destructive", icon: ShieldCheck },
  COACH:  { label: "Trener", variant: "default",     icon: GraduationCap },
  PARENT: { label: "Rodzic", variant: "secondary",   icon: UserIcon },
  PLAYER: { label: "Zawodnik", variant: "outline",   icon: UserIcon },
};

export default function SettingsPage() {
  const { data: session } = useSession();

  // --- Profil ---
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // --- Zmiana hasla ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // --- Uzytkownicy ---
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  // --- Formularz nowego/edycji uzytkownika ---
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("PARENT");
  const [formPassword, setFormPassword] = useState("");
  const [formSpecialization, setFormSpecialization] = useState("");
  const [formLicenseNum, setFormLicenseNum] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // --- Aktywacja zaimportowanych rodzicow ---
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  // Zaladuj profil
  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/users/${session.user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.name) setProfileName(data.name);
          if (data.phone) setProfilePhone(data.phone);
        })
        .catch(() => {});
    }
  }, [session?.user?.id]);

  // Zaladuj uzytkownikow (admin)
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      toast.error("Blad ladowania uzytkownikow");
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Liczba zaimportowanych rodzicow czekajacych na aktywacje ---
  const fetchPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/invitations/activate-imported");
      if (res.ok) {
        const data = await res.json();
        setPendingCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // cicho - nie przeszkadza w uzyciu strony
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  // --- Masowa aktywacja kont zaimportowanych rodzicow ---
  const handleActivateAll = async () => {
    if (!isAdmin) return;
    if (!pendingCount || pendingCount === 0) {
      toast.info("Brak kont do aktywacji");
      return;
    }
    const ok = window.confirm(
      `Wyslac email aktywacyjny do ${pendingCount} rodzicow?\n\n` +
        `Kazdy otrzyma link do ustawienia wlasnego hasla. Link jest wazny 14 dni.`
    );
    if (!ok) return;
    setActivating(true);
    try {
      const res = await fetch("/api/invitations/activate-imported", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Wyslano ${data.sent} z ${data.total} zaproszen` +
            (data.failed > 0 ? ` (${data.failed} bledow - sprawdz logi)` : "")
        );
        fetchPendingCount();
      } else {
        toast.error(data.error || "Blad wysylki");
      }
    } catch {
      toast.error("Blad polaczenia z serwerem");
    } finally {
      setActivating(false);
    }
  };

  // --- Zapis profilu ---
  const handleProfileSave = async () => {
    if (!session?.user?.id) return;
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, phone: profilePhone }),
      });
      if (res.ok) {
        toast.success("Profil zapisany");
      } else {
        toast.error("Blad zapisu profilu");
      }
    } catch {
      toast.error("Blad polaczenia");
    } finally {
      setProfileSaving(false);
    }
  };

  // --- Zmiana hasla ---
  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("Haslo musi miec min. 6 znakow");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Hasla nie sa identyczne");
      return;
    }
    if (!session?.user?.id) return;
    setPasswordSaving(true);
    try {
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        toast.success("Haslo zmienione");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error("Blad zmiany hasla");
      }
    } catch {
      toast.error("Blad polaczenia");
    } finally {
      setPasswordSaving(false);
    }
  };

  // --- Dodaj/edytuj uzytkownika ---
  const openNewUserDialog = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("PARENT");
    setFormPassword("");
    setFormSpecialization("");
    setFormLicenseNum("");
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: UserData) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPhone(user.phone || "");
    setFormRole(user.role);
    setFormPassword("");
    setFormSpecialization(user.coach?.specialization || "");
    setFormLicenseNum(user.coach?.licenseNum || "");
    setUserDialogOpen(true);
  };

  const handleUserSave = async () => {
    setFormSaving(true);
    try {
      if (editingUser) {
        // Edycja
        const body: Record<string, unknown> = {
          name: formName,
          phone: formPhone,
          role: formRole,
        };
        if (formPassword) body.password = formPassword;
        if (formRole === "COACH") {
          body.specialization = formSpecialization;
          body.licenseNum = formLicenseNum;
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast.success("Uzytkownik zaktualizowany");
          setUserDialogOpen(false);
          fetchUsers();
        } else {
          const data = await res.json();
          toast.error(data.error?.toString() || "Blad edycji");
        }
      } else {
        // Nowy
        if (!formPassword || formPassword.length < 6) {
          toast.error("Haslo jest wymagane (min. 6 znakow)");
          setFormSaving(false);
          return;
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            phone: formPhone,
            role: formRole,
            password: formPassword,
            ...(formRole === "COACH" && {
              specialization: formSpecialization,
              licenseNum: formLicenseNum,
            }),
          }),
        });
        if (res.ok) {
          toast.success("Uzytkownik dodany");
          setUserDialogOpen(false);
          fetchUsers();
        } else {
          const data = await res.json();
          toast.error(data.error?.toString() || "Blad dodawania");
        }
      }
    } catch {
      toast.error("Blad polaczenia");
    } finally {
      setFormSaving(false);
    }
  };

  // --- Dezaktywacja uzytkownika ---
  const handleDeactivateUser = async (user: UserData) => {
    if (!confirm(`Dezaktywowac konto ${user.name} (${user.email})?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Konto dezaktywowane");
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error?.toString() || "Blad dezaktywacji");
      }
    } catch {
      toast.error("Blad polaczenia");
    }
  };

  // --- Reaktywacja uzytkownika ---
  const handleReactivateUser = async (user: UserData) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (res.ok) {
        toast.success("Konto reaktywowane");
        fetchUsers();
      } else {
        toast.error("Blad reaktywacji");
      }
    } catch {
      toast.error("Blad polaczenia");
    }
  };

  // --- Reset hasla uzytkownika ---
  const handleResetPassword = async () => {
    if (!resetPasswordUserId || resetPassword.length < 6) {
      toast.error("Haslo musi miec min. 6 znakow");
      return;
    }
    try {
      const res = await fetch(`/api/users/${resetPasswordUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (res.ok) {
        toast.success("Haslo zresetowane");
        setResetPasswordUserId(null);
        setResetPassword("");
      } else {
        toast.error("Blad resetu hasla");
      }
    } catch {
      toast.error("Blad polaczenia");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ustawienia</h1>

      {/* === PROFIL === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Moj profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={session?.user?.email || ""} disabled />
            </div>
            <div>
              <Label>Rola</Label>
              <Input value={ROLES[session?.user?.role || ""]?.label || session?.user?.role || ""} disabled />
            </div>
            <div>
              <Label>Imie i nazwisko</Label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="+48 123 456 789"
              />
            </div>
          </div>
          <Button onClick={handleProfileSave} disabled={profileSaving}>
            <Save className="h-4 w-4 mr-2" />
            {profileSaving ? "Zapisywanie..." : "Zapisz profil"}
          </Button>
        </CardContent>
      </Card>

      {/* === ZMIANA HASLA === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Zmiana hasla
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nowe haslo</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 znakow"
              />
            </div>
            <div>
              <Label>Powtorz haslo</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Powtorz nowe haslo"
              />
            </div>
          </div>
          <Button onClick={handlePasswordChange} disabled={passwordSaving} variant="outline">
            <KeyRound className="h-4 w-4 mr-2" />
            {passwordSaving ? "Zmieniam..." : "Zmien haslo"}
          </Button>
        </CardContent>
      </Card>

      {/* === ZARZADZANIE UZYTKOWNIKAMI (ADMIN) === */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Uzytkownicy ({users.length})
              </CardTitle>
              <div className="flex gap-2">
                {pendingCount !== null && pendingCount > 0 && (
                  <Button
                    onClick={handleActivateAll}
                    size="sm"
                    variant="outline"
                    disabled={activating}
                    title="Wyslij email aktywacyjny do rodzicow zaimportowanych z pliku (ktorzy nie maja jeszcze ustawionego hasla)"
                  >
                    <MailPlus className="h-4 w-4 mr-2" />
                    {activating
                      ? "Wysylanie..."
                      : `Aktywuj zaimportowanych (${pendingCount})`}
                  </Button>
                )}
                <Button onClick={openNewUserDialog} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj uzytkownika
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Ladowanie...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imie</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Rola</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={ROLES[user.role]?.variant || "secondary"}>
                            {ROLES[user.role]?.label || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.active ? (
                            <Badge variant="default">Aktywny</Badge>
                          ) : (
                            <Badge variant="outline">Nieaktywny</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditUserDialog(user)}
                            title="Edytuj"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setResetPasswordUserId(user.id);
                              setResetPassword("");
                            }}
                            title="Reset hasla"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {user.active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivateUser(user)}
                              title="Dezaktywuj"
                              disabled={user.id === session?.user?.id}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReactivateUser(user)}
                              title="Reaktywuj"
                            >
                              <Shield className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
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

      {/* === DIALOG: DODAJ/EDYTUJ UZYTKOWNIKA === */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edytuj uzytkownika" : "Nowy uzytkownik"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Imie i nazwisko</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="jan@example.com"
                disabled={!!editingUser}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+48 123 456 789"
              />
            </div>
            <div>
              <Label>Rola</Label>
              <Select value={formRole} onValueChange={(v) => v && setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="COACH">Trener</SelectItem>
                  <SelectItem value="PARENT">Rodzic</SelectItem>
                  <SelectItem value="PLAYER">Zawodnik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formRole === "COACH" && (
              <>
                <div>
                  <Label>Specjalizacja</Label>
                  <Input
                    value={formSpecialization}
                    onChange={(e) => setFormSpecialization(e.target.value)}
                    placeholder="np. przygotowanie motoryczne"
                  />
                </div>
                <div>
                  <Label>Numer licencji trenerskiej</Label>
                  <Input
                    value={formLicenseNum}
                    onChange={(e) => setFormLicenseNum(e.target.value)}
                    placeholder="np. PZHL/2026/123"
                  />
                </div>
              </>
            )}
            <div>
              <Label>{editingUser ? "Nowe haslo (pozostaw puste aby nie zmieniac)" : "Haslo"}</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={editingUser ? "Bez zmian" : "Min. 6 znakow"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                Anuluj
              </Button>
              <Button onClick={handleUserSave} disabled={formSaving}>
                {formSaving ? "Zapisywanie..." : editingUser ? "Zapisz" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === DIALOG: RESET HASLA === */}
      <Dialog
        open={!!resetPasswordUserId}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordUserId(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset hasla uzytkownika</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ustaw nowe haslo dla: {users.find((u) => u.id === resetPasswordUserId)?.email}
            </p>
            <div>
              <Label>Nowe haslo</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min. 6 znakow"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetPasswordUserId(null)}>
                Anuluj
              </Button>
              <Button onClick={handleResetPassword}>
                <KeyRound className="h-4 w-4 mr-2" />
                Resetuj haslo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

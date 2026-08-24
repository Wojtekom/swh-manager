"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Check, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Group {
  id: string;
  name: string;
  category: string;
  members: { player: { id: string; firstName: string; lastName: string; status: string } }[];
  schedules: { id: string; dayOfWeek: number; startTime: string; endTime: string; location: string }[];
}

interface AttendanceRecord {
  playerId: string;
  present: boolean;
  note?: string;
}

const DAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

export default function AttendancePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        if (data.length > 0) setSelectedGroupId(data[0].id);
      }
    } catch {
      toast.error("Błąd pobierania grup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated") fetchGroups();
  }, [authStatus, router, fetchGroups]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const scheduleOptions = selectedGroup?.schedules || [];
  const players = selectedGroup?.members
    ?.map((m) => m.player)
    .filter((p) => p.status === "ACTIVE")
    .sort((a, b) => a.lastName.localeCompare(b.lastName)) || [];

  // Initialize records when group/schedule changes
  useEffect(() => {
    if (players.length > 0) {
      setRecords(
        players.map((p) => ({
          playerId: p.id,
          present: false,
        }))
      );
    }
  }, [selectedGroupId, selectedScheduleId]);

  // Load existing attendance for selected date/schedule
  useEffect(() => {
    if (!selectedScheduleId || !date) return;
    (async () => {
      try {
        const res = await fetch(`/api/attendance?scheduleId=${selectedScheduleId}&date=${date}`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setRecords((prev) =>
              prev.map((r) => {
                const existing = data.find((d: { player: { id: string }; present: boolean; note?: string }) => d.player.id === r.playerId);
                return existing
                  ? { ...r, present: existing.present, note: existing.note }
                  : r;
              })
            );
          }
        }
      } catch {}
    })();
  }, [selectedScheduleId, date]);

  function togglePresent(playerId: string) {
    setRecords((prev) =>
      prev.map((r) =>
        r.playerId === playerId ? { ...r, present: !r.present } : r
      )
    );
  }

  function markAll(present: boolean) {
    setRecords((prev) => prev.map((r) => ({ ...r, present })));
  }

  async function saveAttendance() {
    if (!selectedScheduleId) {
      toast.error("Wybierz zajęcia");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selectedScheduleId,
          date,
          records,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Zapisano obecność: ${data.present} obecnych, ${data.absent} nieobecnych`
        );
      } else {
        toast.error("Błąd zapisu");
      }
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = records.filter((r) => r.present).length;
  const totalCount = records.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sprawdzanie obecności</h1>
        <p className="text-muted-foreground">Zaznacz obecnych zawodników na zajęciach</p>
      </div>

      {/* Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Grupa</Label>
              <Select
                value={selectedGroupId}
                onValueChange={(v) => {
                  if (!v) return;
                  setSelectedGroupId(v);
                  setSelectedScheduleId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz grupę">
                    {selectedGroup ? `${selectedGroup.name} (${selectedGroup.category})` : "Wybierz grupę"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Zajęcia</Label>
              <Select
                value={selectedScheduleId}
                onValueChange={(v) => v && setSelectedScheduleId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz zajęcia" />
                </SelectTrigger>
                <SelectContent>
                  {scheduleOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime} ({s.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {groups.length === 0
                ? "Brak grup treningowych. Utwórz grupę i dodaj zawodników."
                : "Brak zawodników w tej grupie."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Lista obecności — {presentCount}/{totalCount}
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => markAll(true)}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Wszyscy obecni
              </Button>
              <Button variant="outline" size="sm" onClick={() => markAll(false)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Wyczyść
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {players.map((player) => {
                const record = records.find((r) => r.playerId === player.id);
                const isPresent = record?.present || false;
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePresent(player.id)}
                    className={`flex items-center justify-between w-full rounded-lg border p-3 transition-colors ${
                      isPresent
                        ? "bg-green-50 border-green-300"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium text-sm">
                      {player.lastName} {player.firstName}
                    </span>
                    <Badge variant={isPresent ? "default" : "secondary"}>
                      {isPresent ? "Obecny" : "Nieobecny"}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={saveAttendance} disabled={saving || !selectedScheduleId}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Zapisywanie..." : "Zapisz obecność"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  FileText,
  Download,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatPLN } from "@/lib/camp-signup-helpers";
import { getCategoryLabel } from "@/lib/category-labels";

interface CallupDetail {
  id: string;
  status: string;
  transportChoice: string;
  notes: string | null;
  respondedAt: string | null;
  consentReceivedAt: string | null;
  consentFile: { name: string; createdAt: string } | null;
  tournament: {
    id: string;
    name: string;
    location: string;
    startDate: string;
    endDate: string | null;
    category: string;
    description: string | null;
    transportFee: number | null;
    meetingTime: string | null;
    meetingLocation: string | null;
    parentDeadline: string | null;
    documents: { id: string; name: string; size: number }[];
  };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    category: string;
  };
}

export default function CallupRespondPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const callupId = params?.callupId as string;

  const [callup, setCallup] = useState<CallupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [uploadingConsent, setUploadingConsent] = useState(false);

  const fetchCallup = useCallback(async () => {
    try {
      const res = await fetch("/api/parent/callups");
      if (res.ok) {
        const data = await res.json();
        const cu = (data.callups ?? []).find(
          (c: CallupDetail) => c.id === callupId
        );
        if (cu) {
          setCallup(cu);
          setNotes(cu.notes ?? "");
        } else {
          toast.error("Powołanie nie znalezione");
          router.push("/dashboard/wyjazdy");
        }
      }
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setLoading(false);
    }
  }, [callupId, router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated") fetchCallup();
  }, [authStatus, router, fetchCallup]);

  async function respond(transportChoice: "BUS" | "OWN" | "NONE") {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/parent/callups/${callupId}/respond`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transportChoice, notes: notes || undefined }),
        }
      );
      if (res.ok) {
        if (transportChoice === "NONE") {
          toast.success("Zapisano: dziecko nie jedzie");
        } else {
          toast.success("Zapisano: dziecko jedzie");
        }
        fetchCallup();
      } else {
        toast.error("Błąd zapisu");
      }
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadConsent(original: File) {
    setUploadingConsent(true);
    try {
      const file = await shrinkImage(original);
      if (file.size > 4 * 1024 * 1024) {
        toast.error("Plik za duży (maks. 4 MB)");
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/callups/${callupId}/consent-file`, { method: "POST", body: fd });
      if (res.ok) {
        toast.success("Dziękujemy! Zgoda przesłana do trenera");
        fetchCallup();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Nie udało się przesłać");
      }
    } catch {
      toast.error("Nie udało się odczytać zdjęcia – spróbuj zrobić je jeszcze raz");
    } finally {
      setUploadingConsent(false);
    }
  }

  if (loading || !callup) {
    return (
      <div className="space-y-4 -mx-4 sm:-mx-6 -my-4 sm:-my-6 px-4 sm:px-6 py-4 sm:py-6 bg-ice min-h-screen">
        <Link href="/dashboard/wyjazdy">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Wszystkie wyjazdy
          </Button>
        </Link>
        <p className="text-center text-slate-500 py-8">Ładowanie…</p>
      </div>
    );
  }

  const t = callup.tournament;
  const start = new Date(t.startDate);
  const deadline = t.parentDeadline ? new Date(t.parentDeadline) : null;
  const isPastDeadline = deadline ? new Date() > deadline : false;
  const meeting = t.meetingTime ? new Date(t.meetingTime) : null;
  const hasBus = t.transportFee != null && t.transportFee > 0;

  let statusBadge: React.ReactNode;
  if (callup.status === "CONFIRMED") {
    const label =
      callup.transportChoice === "BUS"
        ? "🚌 Autokar SWH"
        : callup.transportChoice === "OWN"
        ? "🚗 Własny transport"
        : "Potwierdzony";
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" /> JADĘ — {label}
      </span>
    );
  } else if (callup.status === "DECLINED") {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
        <XCircle className="h-3.5 w-3.5" /> NIE JADĘ
      </span>
    );
  } else {
    statusBadge = (
      <span className="badge-pulse inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs">
        <Clock className="h-3.5 w-3.5" /> WYMAGA ODPOWIEDZI
      </span>
    );
  }

  return (
    <div className="space-y-4 -mx-4 sm:-mx-6 -my-4 sm:-my-6 px-4 sm:px-6 py-4 sm:py-6 bg-ice min-h-screen">
      <Link href="/dashboard/wyjazdy">
        <Button variant="ghost" size="sm" className="text-slate-700">
          <ArrowLeft className="h-4 w-4 mr-1" /> Wszystkie wyjazdy
        </Button>
      </Link>

      <div className="max-w-2xl">
        <div className="card-rink rounded-3xl overflow-hidden">
          {/* Header z gradientem */}
          <div className="header-ice-blue px-6 py-6">
            <div className="relative">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-amber-900 text-xs font-bold">
                  <Trophy className="h-3.5 w-3.5" /> POWOŁANIE NA TURNIEJ
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/20 text-white text-xs font-bold">
                  {getCategoryLabel(callup.player.category)}
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">
                {t.name}
              </h2>
              <p className="text-sky-100 text-sm">
                Powołany:{" "}
                <strong className="text-white">
                  {callup.player.firstName} {callup.player.lastName}
                </strong>
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
            {statusBadge}
            {callup.respondedAt && (
              <p className="text-xs text-slate-500 mt-2">
                Ostatnia odpowiedź:{" "}
                {new Date(callup.respondedAt).toLocaleString("pl-PL")}.
                Możesz ją zmienić aż do terminu odpowiedzi.
              </p>
            )}
          </div>

          {/* Detale */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
                <div className="text-xs text-sky-700 font-semibold mb-1">
                  📅 Termin
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {start.toLocaleDateString("pl-PL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
                <div className="text-xs text-sky-700 font-semibold mb-1">
                  📍 Lokalizacja
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {t.location}
                </div>
              </div>
              {(meeting || t.meetingLocation) && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <div className="text-xs text-amber-700 font-semibold mb-1">
                    🚐 Zbiórka
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {meeting && (
                      <>
                        {meeting.toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.meetingLocation ? ", " : ""}
                      </>
                    )}
                    {t.meetingLocation}
                  </div>
                </div>
              )}
              {deadline && (
                <div
                  className={
                    isPastDeadline
                      ? "bg-rose-50 rounded-xl p-3 border border-rose-100"
                      : "bg-rose-50 rounded-xl p-3 border border-rose-100"
                  }
                >
                  <div className="text-xs text-rose-700 font-semibold mb-1">
                    ⏰ {isPastDeadline ? "Przekroczono termin" : "Deadline"}
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {deadline.toLocaleDateString("pl-PL", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    do{" "}
                    {deadline.toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}
            </div>

            {t.description && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 leading-relaxed border border-slate-100 whitespace-pre-wrap">
                <strong className="text-slate-900">Opis:</strong> {t.description}
              </div>
            )}

            {(t.documents?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Dokumenty do pobrania
                </div>
                <p className="text-xs text-slate-500">
                  Wydrukuj i podpisz zgodę. Potem zrób telefonem zdjęcie i prześlij je
                  poniżej – albo przekaż kartkę trenerowi na treningu.
                </p>
                <ul className="space-y-1">
                  {t.documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={`/api/tournaments/${t.id}/documents/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-sky-700 font-medium hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> {d.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <p
                  className={
                    callup.consentReceivedAt
                      ? "text-xs font-semibold text-emerald-700"
                      : "text-xs text-amber-700"
                  }
                >
                  {callup.consentReceivedAt
                    ? `✓ Zgoda dostarczona (${new Date(callup.consentReceivedAt).toLocaleDateString("pl-PL")})`
                    : "Zgoda jeszcze nie dotarła do trenera"}
                </p>
                {callup.consentFile && (
                  <a
                    href={`/api/callups/${callupId}/consent-file`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 hover:underline"
                  >
                    Zobacz przesłane zdjęcie zgody
                  </a>
                )}
                <label
                  className={`flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 py-3 text-sm font-semibold text-sky-800 cursor-pointer active:bg-sky-100 ${uploadingConsent ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Camera className="h-4 w-4" />
                  {uploadingConsent
                    ? "Przesyłanie…"
                    : callup.consentFile
                      ? "Prześlij zgodę ponownie"
                      : "Prześlij podpisaną zgodę"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadConsent(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            {hasBus && (
              <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 text-sm">
                💰 Opłata autokar SWH:{" "}
                <strong>{formatPLN(t.transportFee as number)}</strong> / zawodnik
              </div>
            )}

            {/* Twoja odpowiedź */}
            <div className="pt-2">
              <div className="text-sm font-semibold text-slate-900 mb-3">
                Twoja odpowiedź:
              </div>
              <div
                className={`grid gap-2.5 ${
                  hasBus ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`}
              >
                {hasBus && (
                  <button
                    onClick={() => respond("BUS")}
                    disabled={submitting}
                    className={`btn-confirm-bus rounded-xl p-3 flex flex-col items-center gap-1 ${
                      callup.transportChoice === "BUS"
                        ? "ring-4 ring-sky-300"
                        : ""
                    }`}
                  >
                    <span className="text-2xl">🚌</span>
                    <span className="text-xs font-bold">TAK</span>
                    <span className="text-[10px] opacity-90">
                      Autokar SWH · {formatPLN(t.transportFee as number)}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => respond("OWN")}
                  disabled={submitting}
                  className={`btn-confirm-own rounded-xl p-3 flex flex-col items-center gap-1 ${
                    callup.transportChoice === "OWN"
                      ? "ring-4 ring-amber-300"
                      : ""
                  }`}
                >
                  <span className="text-2xl">🚗</span>
                  <span className="text-xs font-bold">TAK</span>
                  <span className="text-[10px] opacity-90">
                    Własny transport
                  </span>
                </button>

                <button
                  onClick={() => respond("NONE")}
                  disabled={submitting}
                  className={`btn-decline-soft rounded-xl p-3 flex flex-col items-center gap-1 ${
                    callup.transportChoice === "NONE"
                      ? "ring-4 ring-rose-300 bg-rose-50"
                      : ""
                  }`}
                >
                  <span className="text-2xl">✖</span>
                  <span className="text-xs font-bold">NIE</span>
                  <span className="text-[10px] opacity-80">
                    Nie jedzie
                  </span>
                </button>
              </div>

              <div className="mt-4">
                <Label
                  htmlFor="notes"
                  className="text-sm text-slate-700"
                >
                  Komentarz (opcjonalnie)
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="💬 np. Antek po kontuzji kostki, ważny wyjazd rodzinny…"
                  rows={2}
                  className="mt-1 rounded-xl border-slate-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Zdjęcie z telefonu bywa > 4 MB i w formacie HEIC — zmniejszamy do JPEG (dłuższy bok 2000 px)
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "") return file;
  if (file.type === "image/jpeg" && file.size < 1.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85)
  );
  const name = (file.name || "zgoda").replace(/.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

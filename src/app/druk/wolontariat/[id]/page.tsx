"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  buildAgreementSections,
  CHILD_DECLARATION,
  PARENT_CONSENT,
  SWH_ORG,
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
  player: { firstName: string; lastName: string; dateOfBirth: string };
  hours: Hour[];
}

function Header() {
  return (
    <p className="text-center text-xs">
      <b>{SWH_ORG.name}</b> · {SWH_ORG.address} · {SWH_ORG.ids}
    </p>
  );
}

function AgreementDoc({ a }: { a: Agreement }) {
  const sections = buildAgreementSections({
    number: a.number,
    playerName: `${a.player.firstName} ${a.player.lastName}`,
    playerBirth: a.player.dateOfBirth,
    periodFrom: a.periodFrom,
    periodTo: a.periodTo,
    maxHours: a.maxHours,
  });
  return (
    <div className="space-y-3">
      <Header />
      <h1 className="text-center text-lg font-bold">POROZUMIENIE O WYKONYWANIU ŚWIADCZEŃ WOLONTARIUSZA nr {a.number}</h1>
      {sections.map((s) => (
        <div key={s.title}>
          <p className="font-semibold">{s.title}</p>
          {s.paragraphs.map((p, i) => <p key={i} className="mt-1">{p}</p>)}
        </div>
      ))}
      <div className="mt-4 space-y-2 border-t pt-3">
        <p className="font-semibold">Podpisy (forma elektroniczna – SWH Manager)</p>
        <p><b>Wolontariusz:</b> „{CHILD_DECLARATION}” – {a.childSignature ?? "…………………………"}{a.childAcceptedAt ? `, ${fmtDateTime(a.childAcceptedAt)}` : ""}</p>
        <p><b>Rodzic / opiekun:</b> „{PARENT_CONSENT}” – {a.parentSignature ?? "…………………………"}{a.parentAcceptedAt ? `, ${fmtDateTime(a.parentAcceptedAt)}` : ""}</p>
        <p><b>Szkoła i klasa:</b> {a.school ?? "…………………………"}</p>
        <p><b>Za Korzystającego (Zarząd SWH):</b> {a.boardApprovedAt ? `zatwierdzono – ${a.boardApprovedBy}, ${fmtDateTime(a.boardApprovedAt)}` : "oczekuje na zatwierdzenie"}</p>
      </div>
    </div>
  );
}

function CertificateDoc({ a }: { a: Agreement }) {
  const total = a.hours.reduce((s, h) => s + h.hours, 0);
  const first = a.hours[0]?.date ?? a.periodFrom;
  const last = a.hours[a.hours.length - 1]?.date ?? a.periodTo;
  const types = Array.from(new Set(a.hours.map((h) => h.eventType))).join(", ");
  return (
    <div className="space-y-3">
      <Header />
      <p className="text-right">Siedlce, dnia {fmtDate(new Date())} r.</p>
      <h1 className="pt-4 text-center text-lg font-bold">ZAŚWIADCZENIE<br />o wykonywaniu świadczeń wolontariusza</h1>
      <p className="pt-2">Stowarzyszenie Wybieram Hokej (SWH Gwardia Siedlce) zaświadcza, że</p>
      <p className="text-center text-base font-bold">{a.player.firstName} {a.player.lastName}, ur. {fmtDate(a.player.dateOfBirth)}</p>
      <p>uczeń/uczennica: {a.school ?? "…………………………………………"}</p>
      <p>
        w okresie od {fmtDate(first)} do {fmtDate(last)} wykonywał/a nieodpłatnie świadczenia wolontariusza na rzecz Stowarzyszenia, na podstawie porozumienia nr {a.number}, w łącznym wymiarze <b>{total} godzin</b>.
      </p>
      <p>Zakres świadczeń: pomoc trenerowi w prowadzeniu bezpłatnych zajęć hokejowych i łyżwiarskich dla dzieci na lodowisku ARMS w Siedlcach, pomoc najmłodszym dzieciom, przygotowanie sprzętu{types ? `; rodzaje wydarzeń: ${types}` : ""}.</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border px-1 text-left">Data</th>
            <th className="border px-1 text-left">Wydarzenie</th>
            <th className="border px-1 text-left">Zadania</th>
            <th className="border px-1 text-left">Godz.</th>
          </tr>
        </thead>
        <tbody>
          {a.hours.map((h) => (
            <tr key={h.id}>
              <td className="border px-1">{fmtDate(h.date)}</td>
              <td className="border px-1">{h.eventType}</td>
              <td className="border px-1">{h.tasks}</td>
              <td className="border px-1">{h.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Opinia: …………………………………………………………………………………………………………………………</p>
      <p className="text-xs">Zaświadczenie wydaje się na podstawie art. 44 ust. 4 i 5 ustawy z dnia 24 kwietnia 2003 r. o działalności pożytku publicznego i o wolontariacie, w celu przedłożenia w szkole.</p>
      <div className="grid grid-cols-2 gap-8 pt-12 text-sm">
        <div>…………………………………<br />Wojciech Komorowski<br />Prezes Zarządu</div>
        <div>…………………………………<br />Wiceprezes Zarządu</div>
      </div>
    </div>
  );
}

function PrintInner() {
  const { id } = useParams<{ id: string }>();
  const typ = useSearchParams().get("typ") ?? "porozumienie";
  const [a, setA] = useState<Agreement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/volunteer/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Błąd");
        setA(d);
      })
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (err) return <p className="p-8">{err}</p>;
  if (!a) return <p className="p-8">Wczytywanie…</p>;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm leading-relaxed text-black">
      <div className="mb-4 flex gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-md bg-sky-600 px-4 py-2 text-white">
          Drukuj / zapisz PDF
        </button>
      </div>
      {typ === "zaswiadczenie" ? <CertificateDoc a={a} /> : <AgreementDoc a={a} />}
    </div>
  );
}

export default function PrintVolunteerPage() {
  return (
    <Suspense fallback={<p className="p-8">Wczytywanie…</p>}>
      <PrintInner />
    </Suspense>
  );
}

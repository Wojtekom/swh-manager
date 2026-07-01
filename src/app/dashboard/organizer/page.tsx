"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Hourglass,
  MapPin,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Deadline {
  date: string;
  day: string;
  event: string;
  place?: string;
  category: "Turniej" | "Ostrówek" | "SWH" | "PSL-GS" | "TS Feniks";
  status: "done" | "urgent" | "planned" | "waiting";
  note?: string;
}

interface WaitingItem {
  what: string;
  waiting_for: string;
  since?: string;
}

interface TodoItem {
  topic: string;
  action: string;
  status: string;
}

const DEADLINES: Deadline[] = [
  // LIPIEC
  {
    date: "07.07.2026",
    day: "Wt",
    event: "Konsultacje projektowe CONCRET + Meritum",
    place: "Jastrzębie-Zdrój",
    category: "Ostrówek",
    status: "planned",
    note: "Ocenić czy 30 mln PLN mieści sale wideo, siłownię, strzelnicę, fitness",
  },
  {
    date: "22.07.2026",
    day: "Śr",
    event: "Mazowsze Program Współpracy 2027 — koniec konsultacji",
    place: "dialog.mazovia.pl",
    category: "SWH",
    status: "done",
    note: "Złożono 2 zgłoszenia 1.07.2026 (PSL-GS 60k + HLH 40k)",
  },
  // SIERPIEŃ
  {
    date: "05.08.2026",
    day: "Śr",
    event: "DEADLINE: Wniosek Mazowsze Pakiet Promocyjny 30 000 zł",
    place: "dkpit@mazovia.pl",
    category: "Turniej",
    status: "urgent",
    note: "Po ustaleniach ze spotkania z Prokurat 29.06. Materiały o turnieju.",
  },
  {
    date: "25.08.2026",
    day: "Wt",
    event: "Deadline dostawy: stroje (40 kpl.) + bandy MAT-ICE",
    place: "ARMS Siedlce",
    category: "Turniej",
    status: "waiting",
    note: "Zależy od odpowiedzi ORLEN i Corona Serwis",
  },
  // WRZESIEŃ
  {
    date: "04.09.2026",
    day: "Pt",
    event: "III ODH — dzień przygotowań / otwarcie",
    place: "ARMS Siedlce",
    category: "Turniej",
    status: "planned",
  },
  {
    date: "05.09.2026",
    day: "So",
    event: "III Turniej im. Wiesława Jobczyka — dzień 1",
    place: "ARMS Siedlce",
    category: "Turniej",
    status: "planned",
  },
  {
    date: "06.09.2026",
    day: "Nd",
    event: "III Turniej im. Wiesława Jobczyka — dzień 2 + ceremonia",
    place: "ARMS Siedlce",
    category: "Turniej",
    status: "planned",
  },
  // PAŹDZIERNIK
  {
    date: "06.10.2026",
    day: "Wt",
    event: "DEADLINE: Raport sponsoringowy dla ORLEN",
    place: "Email ORLEN",
    category: "Turniej",
    status: "waiting",
    note: "Foto/video z turnieju, statystyki zasięgu, pismo końcowe",
  },
];

const WAITING: WaitingItem[] = [
  { what: "ORLEN 12 000 zł (bandy)", waiting_for: "Decyzja sponsoringowa", since: "25.06.2026" },
  { what: "Corona Serwis Jobczyk 20 000 zł", waiting_for: "Odpowiedź na email sponsoringowy", since: "01.07.2026" },
  { what: "Stroje — oferty (Metsport, Aron, eFanshop, Roma)", waiting_for: "Oferty cenowe od 4 firm", since: "30.06.2026" },
  { what: "ARMS Siedlce — PSL-GS tercja + szatnie", waiting_for: "Odpowiedź Prezes Cegiełkowski", since: "07.2026" },
  { what: "PKD TS Feniks KRS", waiting_for: "Rejestracja zmiany przez sąd", since: "30.06.2026" },
  { what: "Mazowsze Program 2027 (PSL-GS 60k + HLH 40k)", waiting_for: "Wyniki konsultacji po 22.07.2026", since: "01.07.2026" },
];

const TODOS: TodoItem[] = [
  { topic: "Mazowsze Pakiet Promocyjny", action: "Przygotować wniosek 30k zł (po spotkaniu Prokurat 29.06)", status: "⏳ Do złożenia przed 5.08" },
  { topic: "Szymon UZ-M — zaległość PIT ~17k", action: "Wniosek art. 67a §1 pkt 3 Op do US Siedlce", status: "🔴 PILNE" },
  { topic: "Wizyty u dyrektorów szkół", action: "Strzała, Żelków, Stok Lacki, Iganie — PSL-GS_Program_Nauczania", status: "🔄 W toku od 02.07.2026" },
  { topic: "Mail Erasmus+ po francusku", action: "Do Nancy HC lub Dijon HC (przez Nikolę)", status: "⏳ Lipiec/Sierpień" },
  { topic: "Wizyta Kurzawy (gł. trener PZHL)", action: "Umówić termin wizyty w Siedlcach", status: "⏳ Do umówienia" },
  { topic: "Materiały metodyczne dla Grutha (PZHL)", action: "Wysłać dokumenty SWH / program szkoleniowy", status: "⏳ Do wysłania" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Turniej: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Ostrówek: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  SWH: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "PSL-GS": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "TS Feniks": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

function StatusIcon({ status }: { status: Deadline["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "urgent") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === "waiting") return <Hourglass className="h-4 w-4 text-amber-500 shrink-0" />;
  return <CalendarClock className="h-4 w-4 text-sky-500 shrink-0" />;
}

function groupByMonth(items: Deadline[]) {
  const months: Record<string, Deadline[]> = {};
  for (const item of items) {
    const [, m, y] = item.date.split(".");
    const key = m && y ? `${y}-${m}` : "Bez daty";
    if (!months[key]) months[key] = [];
    months[key].push(item);
  }
  return months;
}

const MONTH_LABELS: Record<string, string> = {
  "2026-07": "Lipiec 2026",
  "2026-08": "Sierpień 2026",
  "2026-09": "Wrzesień 2026",
  "2026-10": "Październik 2026",
  "2027-03": "Marzec 2027",
};

export default function OrganizerPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
    if (authStatus === "authenticated" && session?.user?.role !== "ADMIN") router.push("/dashboard");
  }, [authStatus, session, router]);

  const grouped = groupByMonth(DEADLINES);

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Organizer projektów</h1>
        <p className="text-sm text-muted-foreground mt-1">SWH · HLH · PSL-GS · Ostrówek · TS Feniks — terminy i zadania 2026</p>
      </div>

      {/* TERMINY */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-sky-500" />
          Terminy
        </h2>

        {Object.entries(grouped).map(([key, items]) => (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              {MONTH_LABELS[key] ?? key}
            </h3>
            {items.map((item, i) => (
              <Card
                key={i}
                className={cn(
                  "border transition-colors",
                  item.status === "done" && "opacity-60",
                  item.status === "urgent" && "border-red-300 dark:border-red-800"
                )}
              >
                <CardContent className="p-3 flex gap-3">
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        item.status === "done" && "line-through text-muted-foreground"
                      )}>
                        {item.event}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.date} {item.day}
                      </span>
                      {item.place && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.place}
                        </span>
                      )}
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", CATEGORY_COLORS[item.category])}>
                        {item.category}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">{item.note}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </section>

      {/* OCZEKIWANIE */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-amber-500" />
          Oczekiwanie (bez akcji z naszej strony)
        </h2>
        <div className="space-y-2">
          {WAITING.map((item, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex gap-3 items-start">
                <HelpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.what}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.waiting_for}
                    {item.since && <span className="ml-2 opacity-60">od {item.since}</span>}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* TO DO */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5 text-violet-500" />
          Do zrobienia (bez daty)
        </h2>
        <div className="space-y-2">
          {TODOS.map((item, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex gap-3 items-start">
                <AlertCircle className={cn(
                  "h-4 w-4 shrink-0 mt-0.5",
                  item.status.includes("PILNE") ? "text-red-500" : "text-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.topic}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.action}</p>
                  <p className={cn(
                    "text-[11px] font-medium mt-1",
                    item.status.includes("PILNE") ? "text-red-500" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {item.status}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

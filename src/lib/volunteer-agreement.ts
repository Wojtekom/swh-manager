// Treść porozumienia wolontariackiego SWH – zawodnik (wspólna dla ekranu podpisu i wydruku).
// Wzór papierowy: Pobrane\Ferie_2027_umowy\WZOR_Porozumienie_wolontariackie_SWH_zawodnik_ze_zgoda_rodzica.docx

export const SWH_ORG = {
  name: "Stowarzyszenie Wybieram Hokej (SWH Gwardia Siedlce)",
  address: "ul. Zygmunta Vogla 41, 08-110 Siedlce",
  ids: "KRS 0001132537, NIP 8212694282",
};

export const VOLUNTEER_STATUS_LABEL: Record<string, string> = {
  SENT: "Czeka na podpis rodzica",
  PARENT_SIGNED: "Podpisane – czeka na zatwierdzenie zarządu",
  ACTIVE: "Obowiązuje",
  ENDED: "Zakończone",
  CANCELLED: "Anulowane",
};

export const VOLUNTEER_EVENT_TYPES = ["trening", "turniej", "nabór", "inne"] as const;

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "…………";
  return new Date(d).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export interface AgreementTextInput {
  number: string;
  playerName: string;
  playerBirth: string | Date;
  periodFrom: string | Date;
  periodTo: string | Date;
  maxHours?: number | null;
}

export interface AgreementSection {
  title: string;
  paragraphs: string[];
}

export function buildAgreementSections(a: AgreementTextInput): AgreementSection[] {
  return [
    {
      title: "Strony",
      paragraphs: [
        `Porozumienie nr ${a.number} zawarte na podstawie art. 42–50 ustawy z dnia 24 kwietnia 2003 r. o działalności pożytku publicznego i o wolontariacie pomiędzy:`,
        `${SWH_ORG.name}, ${SWH_ORG.address}, ${SWH_ORG.ids}, reprezentowanym przez Zarząd – zwanym dalej „Korzystającym”,`,
        `a ${a.playerName}, ur. ${fmtDate(a.playerBirth)} – zwanym/ą dalej „Wolontariuszem”, działającym/ą za zgodą rodzica (opiekuna prawnego), zwanego dalej „Rodzicem”.`,
      ],
    },
    {
      title: "§ 1. Przedmiot porozumienia",
      paragraphs: [
        "1. Wolontariusz dobrowolnie i bez wynagrodzenia wykonuje na rzecz Korzystającego świadczenia polegające na pomocy w prowadzeniu bezpłatnych zajęć hokejowych i łyżwiarskich dla dzieci, w szczególności: a) pomoc trenerowi w prowadzeniu ćwiczeń (pokaz ćwiczeń, prowadzenie stacji, pomoc dzieciom początkującym na lodzie), b) przygotowanie i sprzątanie sprzętu, c) pomoc najmłodszym dzieciom w szatni (zakładanie sprzętu, sznurowanie łyżew), d) pomoc przy organizacji turniejów, naboru i wydarzeń Stowarzyszenia.",
        "2. Świadczenia wykonywane są w ramach działalności statutowej Korzystającego, na lodowisku i rolkowisku ARMS w Siedlcach oraz podczas turniejów i wydarzeń Stowarzyszenia.",
        "3. Wolontariusz wykonuje świadczenia wyłącznie pod nadzorem trenera Korzystającego i nie zastępuje trenera ani opiekuna dzieci.",
      ],
    },
    {
      title: "§ 2. Czas trwania",
      paragraphs: [
        `Porozumienie obowiązuje od ${fmtDate(a.periodFrom)} do ${fmtDate(a.periodTo)}.${
          a.maxHours ? ` Łączny wymiar świadczeń nie przekroczy ${a.maxHours} godzin.` : ""
        } Czas świadczeń jest dostosowany do wieku Wolontariusza i nie koliduje z jego nauką i odpoczynkiem.`,
      ],
    },
    {
      title: "§ 3. Obowiązki Korzystającego",
      paragraphs: [
        "Korzystający zobowiązuje się: 1) poinformować Wolontariusza o zasadach bezpieczeństwa i ryzyku dla zdrowia związanym z wykonywanymi świadczeniami oraz o Standardach ochrony małoletnich obowiązujących w Stowarzyszeniu; 2) zapewnić bezpieczne warunki wykonywania świadczeń oraz nadzór trenera; 3) ubezpieczyć Wolontariusza od następstw nieszczęśliwych wypadków (NNW), jeżeli świadczenia trwają krócej niż 30 dni; 4) pokryć uzgodnione wcześniej koszty związane z wykonywaniem świadczeń; 5) prowadzić ewidencję godzin i wydać Wolontariuszowi pisemne zaświadczenie o wykonywaniu świadczeń (z liczbą godzin), a na jego wniosek – pisemną opinię.",
      ],
    },
    {
      title: "§ 4. Obowiązki Wolontariusza",
      paragraphs: [
        "Wolontariusz zobowiązuje się: 1) wykonywać świadczenia starannie, zgodnie z poleceniami trenera i zasadami bezpieczeństwa; 2) przestrzegać Standardów ochrony małoletnich, zasad fair play i kultury wobec dzieci, rodziców i pracowników obiektu; 3) zachować w tajemnicy dane i informacje o dzieciach, nie fotografować dzieci i nie publikować ich wizerunku bez zgody Korzystającego; 4) informować trenera z wyprzedzeniem o nieobecności; 5) korzystać na lodzie z kasku i rękawic.",
      ],
    },
    {
      title: "§ 5. Postanowienia końcowe",
      paragraphs: [
        "1. Świadczenia wykonywane są nieodpłatnie. Wolontariuszowi nie przysługuje wynagrodzenie.",
        "2. Każda ze stron może rozwiązać porozumienie w każdym czasie, w formie pisemnej lub elektronicznej (np. wiadomością w SWH Manager).",
        "3. Porozumienie zawierane jest w formie elektronicznej w aplikacji SWH Manager: Rodzic i Wolontariusz potwierdzają zapoznanie się z treścią i wyrażają zgodę, wpisując swoje imię i nazwisko; Zarząd zatwierdza porozumienie w aplikacji. Na żądanie każdej ze stron porozumienie zostanie potwierdzone na piśmie.",
        "4. Administratorem danych osobowych Wolontariusza i Rodzica jest Stowarzyszenie Wybieram Hokej; dane przetwarzane są wyłącznie w celu wykonania porozumienia, ubezpieczenia i wydania zaświadczenia.",
        "5. W sprawach nieuregulowanych stosuje się przepisy ustawy o działalności pożytku publicznego i o wolontariacie oraz Kodeksu cywilnego.",
      ],
    },
  ];
}

export const CHILD_DECLARATION =
  "Przeczytałem/am porozumienie, rozumiem swoje obowiązki i chcę zostać wolontariuszem Stowarzyszenia Wybieram Hokej.";

export const PARENT_CONSENT =
  "Jako rodzic/opiekun prawny wyrażam zgodę na zawarcie przez moje dziecko powyższego porozumienia i wykonywanie przez nie świadczeń wolontariusza na rzecz Stowarzyszenia Wybieram Hokej. Oświadczam, że nie są mi znane przeciwwskazania zdrowotne do wykonywania tych świadczeń.";

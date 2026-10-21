import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError } from "@/lib/auth-helpers";
import { PAYMENT_REFERENCE_REGEX } from "@/lib/payments";

// Santander CSV format (no header row, first row is export metadata):
// Col 0: Data operacji (DD-MM-YYYY or YYYY-MM-DD)
// Col 1: Data ksiegowania (DD-MM-YYYY)
// Col 2: Tytul przelewu
// Col 3: Nadawca/odbiorca + adres
// Col 4: Numer konta
// Col 5: Kwota ("180,00" or "-180,00")
// Col 6: Saldo
// Col 7: Nr operacji

function parsePolishDate(val: string): Date | null {
  const trimmed = val.trim().replace(/'/g, "");
  // DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  // YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  return null;
}

function parseAmount(val: string): number {
  // "180,00" or "-1000,00" — remove quotes, replace comma
  const cleaned = val.replace(/"/g, "").replace(",", ".").trim();
  return parseFloat(cleaned) || 0;
}

// Parse CSV that may have quoted fields with commas inside
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Normalize string for matching: lowercase, remove diacritics, extra spaces
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Try to match a player by first+last name appearing in the title
function findPlayerMatch(
  title: string,
  players: { id: string; firstName: string; lastName: string }[]
): { id: string; firstName: string; lastName: string } | null {
  const normTitle = normalize(title);

  for (const p of players) {
    const normFirst = normalize(p.firstName);
    const normLast = normalize(p.lastName);

    // "Franciszek Biarda" or "Biarda Franciszek"
    if (
      normTitle.includes(`${normFirst} ${normLast}`) ||
      normTitle.includes(`${normLast} ${normFirst}`) ||
      normTitle.includes(`${normLast}, ${normFirst}`)
    ) {
      return p;
    }
  }

  // Partial match: just last name (less reliable, but useful)
  for (const p of players) {
    const normLast = normalize(p.lastName);
    if (normLast.length >= 4 && normTitle.includes(normLast)) {
      return p;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Brak uprawnien" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const feeId = formData.get("feeId") as string | null;
    const commit = formData.get("mode") === "import";

    if (!file) {
      return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    // Load all active players
    const players = await prisma.player.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
    });

    const stats = {
      total: 0,
      matched: 0,
      unmatched: 0,
      skippedNegative: 0,
      created: 0,
      settled: 0, // rozliczone naliczone należności (po kodzie SWH-XXXXXX)
      errors: [] as string[],
    };

    const results: {
      date: string;
      title: string;
      sender: string;
      amount: number;
      playerName: string | null;
      playerId: string | null;
      status: "matched" | "unmatched" | "skipped";
    }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);
      if (fields.length < 6) continue;

      const date = parsePolishDate(fields[0]);
      if (!date) continue; // skip header/metadata rows

      const title = fields[2] || "";
      const sender = fields[3] || "";
      const amount = parseAmount(fields[5]);

      stats.total++;

      // Skip negative amounts (outgoing payments)
      if (amount <= 0) {
        stats.skippedNegative++;
        results.push({
          date: fields[0],
          title,
          sender,
          amount,
          playerName: null,
          playerId: null,
          status: "skipped",
        });
        continue;
      }

      // 1) Kod płatności w tytule (SWH-XXXXXX) → rozlicz konkretną naliczoną należność
      const codeMatch = title.match(PAYMENT_REFERENCE_REGEX);
      if (codeMatch) {
        const open = await prisma.payment.findFirst({
          where: {
            id: { endsWith: codeMatch[1].toLowerCase() },
            status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
          },
          include: { player: { select: { id: true, firstName: true, lastName: true } } },
        });
        if (open) {
          if (commit) {
            const paid = (open.paidAmount || 0) + amount;
            await prisma.payment.update({
              where: { id: open.id },
              data: {
                paidAmount: paid,
                paidDate: date,
                status: paid + 0.005 >= open.amount ? "PAID" : "PARTIAL",
                notes: [open.notes, `Import bankowy: ${title}`].filter(Boolean).join(" | "),
              },
            });
            stats.settled++;
          }
          stats.matched++;
          results.push({
            date: fields[0],
            title,
            sender,
            amount,
            playerName: `${open.player.firstName} ${open.player.lastName}`,
            playerId: open.player.id,
            status: "matched",
          });
          continue;
        }
      }

      // 2) Dopasowanie po imieniu i nazwisku (tytuł lub nadawca)
      const player = findPlayerMatch(title, players) || findPlayerMatch(sender, players);

      if (player) {
        stats.matched++;
        results.push({
          date: fields[0],
          title,
          sender,
          amount,
          playerName: `${player.firstName} ${player.lastName}`,
          playerId: player.id,
          status: "matched",
        });

        // If feeId provided, create payment record
        if (feeId) {
          try {
            await prisma.payment.create({
              data: {
                playerId: player.id,
                feeId,
                amount,
                dueDate: date,
                paidDate: date,
                paidAmount: amount,
                status: "PAID",
                notes: `Import bankowy: ${title}`,
              },
            });
            stats.created++;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            stats.errors.push(`${player.firstName} ${player.lastName}: ${msg}`);
          }
        }
      } else {
        stats.unmatched++;
        results.push({
          date: fields[0],
          title,
          sender,
          amount,
          playerName: null,
          playerId: null,
          status: "unmatched",
        });
      }
    }

    return NextResponse.json({
      message: "Analiza zakonczona",
      stats,
      results,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_CONFIG } from "@/lib/notifications/config";
import { sendNotification } from "@/lib/notifications/sender";
import { daysFromDue, transferTitle, SWH_BANK } from "@/lib/payments";

// Codziennie (Vercel Cron, GET z nagłówkiem Authorization: Bearer CRON_SECRET):
// 1. Należności po terminie: PENDING → OVERDUE.
// 2. Przypomnienia dla rodziców: 3 dni przed terminem, 3 dni po i 10 dni po.
//    Każdy etap wysyłany raz (klucz w metadata powiadomienia), z zapasem dni,
//    gdyby cron jednego dnia nie ruszył.

type Stage = { key: string; from: number; to: number };
const STAGES: Stage[] = [
  { key: "przed-3", from: -3, to: -1 },
  { key: "po-3", from: 3, to: 9 },
  { key: "po-10", from: 10, to: 20 },
];

const MAX_PER_RUN = 40;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${NOTIFICATION_CONFIG.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  try {
    // 1. Po terminie → OVERDUE
    const overdue = dryRun
      ? { count: await prisma.payment.count({ where: { status: "PENDING", dueDate: { lt: startOfToday } } }) }
      : await prisma.payment.updateMany({
          where: { status: "PENDING", dueDate: { lt: startOfToday } },
          data: { status: "OVERDUE" },
        });

    // 2. Przypomnienia
    const open = await prisma.payment.findMany({
      where: { status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
      include: {
        fee: { select: { name: true } },
        player: {
          select: {
            firstName: true,
            lastName: true,
            status: true,
            parents: { select: { parentId: true } },
          },
        },
      },
    });

    let sent = 0;
    const planned: string[] = [];
    for (const p of open) {
      if (p.player.status !== "ACTIVE") continue;
      const days = daysFromDue(p.dueDate, today);
      const stage = STAGES.find((s) => days >= s.from && days <= s.to);
      if (!stage) continue;

      const reminderKey = `${p.id}:${stage.key}`;
      const already = await prisma.notification.findFirst({
        where: { type: "PAYMENT_REMINDER", metadata: { contains: reminderKey } },
        select: { id: true },
      });
      if (already) continue;

      const name = `${p.player.firstName} ${p.player.lastName}`;
      const amount = (p.amount - (p.paidAmount || 0)).toFixed(2).replace(".", ",");
      const due = p.dueDate.toLocaleDateString("pl-PL");
      const title =
        days < 0
          ? `Przypomnienie: ${p.fee.name} – ${name}, termin ${due}`
          : `Zaległa płatność: ${p.fee.name} – ${name}`;
      const body =
        (days < 0
          ? `Za ${-days} ${-days === 1 ? "dzień" : "dni"} mija termin płatności (${due}). `
          : `Termin płatności minął ${due}. `) +
        `Kwota: ${amount} zł. Przelew na konto ${SWH_BANK.accountFormatted} (${SWH_BANK.recipient}), ` +
        `tytuł: ${transferTitle(p.id, name)}. Kod QR do przelewu znajdziesz w aplikacji w zakładce Płatności. ` +
        `Jeśli płatność została już wykonana – dziękujemy, prosimy zignorować wiadomość.`;

      for (const pp of p.player.parents) {
        planned.push(`${reminderKey} → ${pp.parentId}`);
        if (dryRun) continue;
        // Limit czasu funkcji (60 s): resztę wyśle jutrzejsze uruchomienie (etapy mają zapas dni)
        if (sent >= MAX_PER_RUN) break;
        await sendNotification({
          userId: pp.parentId,
          type: "PAYMENT_REMINDER",
          title,
          body,
          link: "/dashboard/payments",
          metadata: { paymentId: p.id, stage: stage.key, reminderKey },
        });
        sent++;
        await sleep(1100); // limit Resend ~2 maile/s
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      overdueMarked: overdue.count,
      remindersSent: sent,
      ...(dryRun ? { planned } : {}),
    });
  } catch (error) {
    console.error("[CRON] Payment reminders failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
export const maxDuration = 60;

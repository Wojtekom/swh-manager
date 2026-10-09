import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/channels/email";
import { getAppUrl } from "@/lib/app-url";

export type MailingMode = "all" | "pending";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Kogo obejmuje wysyłka: "all" = wszyscy powołani (bez odmów/kontuzji),
// "pending" = tylko ci, którzy nie odpowiedzieli albo nie dostarczyli zgody.
export async function getMailingPlan(tournamentId: string, mode: MailingMode) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      documents: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "asc" } },
      callups: {
        where: { status: { in: ["CALLED", "CONFIRMED"] } },
        include: {
          player: {
            select: {
              firstName: true,
              lastName: true,
              parents: {
                where: { parent: { active: true } },
                select: { parent: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
        orderBy: { player: { lastName: "asc" } },
      },
    },
  });
  if (!tournament) return null;

  const callups = tournament.callups.filter((c) =>
    mode === "all" ? true : c.status === "CALLED" || !c.consentReceivedAt
  );

  const recipients = callups
    .filter((c) => c.player.parents.length > 0)
    .map((c) => ({
      callupId: c.id,
      player: `${c.player.firstName} ${c.player.lastName}`,
      status: c.status,
      consentReceived: !!c.consentReceivedAt,
      parents: c.player.parents.map((pp) => pp.parent),
    }));

  const withoutParent = callups
    .filter((c) => c.player.parents.length === 0)
    .map((c) => `${c.player.firstName} ${c.player.lastName}`);

  return { tournament, recipients, withoutParent };
}

export async function sendTournamentDocuments(tournamentId: string, mode: MailingMode) {
  const plan = await getMailingPlan(tournamentId, mode);
  if (!plan) throw new Error("Turniej nie istnieje");
  const { tournament: t, recipients, withoutParent } = plan;

  const docs = await prisma.tournamentDocument.findMany({
    where: { tournamentId },
    select: { name: true, data: true },
    orderBy: { createdAt: "asc" },
  });
  const attachments = docs.map((d) => ({ filename: d.name, content: Buffer.from(d.data) }));

  const appUrl = getAppUrl();
  const dateStr = new Date(t.startDate).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
  const deadlineStr = t.parentDeadline
    ? new Date(t.parentDeadline).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Warsaw",
      })
    : null;

  let sent = 0;
  const failed: string[] = [];

  for (const r of recipients) {
    const link = `${appUrl}/dashboard/wyjazdy/turniej/${r.callupId}`;
    const needsAnswer = r.status === "CALLED";
    const title = `${t.name} – ${r.player}`;

    const steps: string[] = [];
    if (needsAnswer) steps.push("Potwierdź w aplikacji, czy dziecko jedzie.");
    if (attachments.length > 0 && !r.consentReceived) {
      steps.push("Wydrukuj zgodę z załącznika i podpisz ją.");
      steps.push(
        "Zrób telefonem zdjęcie podpisanej zgody i prześlij je w aplikacji (przycisk „Prześlij podpisaną zgodę”) – albo przekaż ją trenerowi na treningu."
      );
    }

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#38bdf8,#3b82f6);padding:20px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;">🏒 SWH Gwardia Siedlce</h2>
      </div>
      <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;color:#334155;">
        <h3 style="color:#0c4a6e;margin-top:0;">${escapeHtml(t.name)}</h3>
        <p><strong>Zawodnik:</strong> ${escapeHtml(r.player)}<br/>
        <strong>Kiedy:</strong> ${dateStr}<br/>
        <strong>Gdzie:</strong> ${escapeHtml(t.location)}
        ${deadlineStr ? `<br/><strong>Prosimy o odpowiedź do:</strong> ${deadlineStr}` : ""}</p>
        ${attachments.length > 0 ? `<p>W załączniku: ${attachments.map((a) => escapeHtml(a.filename)).join(", ")}.</p>` : ""}
        ${steps.length > 0 ? `<p><strong>Co trzeba zrobić:</strong></p><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>` : "<p>Dziękujemy – mamy już Państwa odpowiedź i zgodę.</p>"}
        <a href="${link}" style="display:inline-block;padding:12px 22px;background:#38bdf8;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Otwórz powołanie w aplikacji</a>
        <p style="font-size:12px;color:#64748b;margin-top:16px;">Nie pamiętasz hasła? Odpowiedz na tę wiadomość albo zapytaj trenera.</p>
      </div>
    </div>`;

    for (const parent of r.parents) {
      try {
        await sendEmail(parent.email, `SWH: ${title}`, html, parent.id, attachments);
        await prisma.notification.create({
          data: {
            userId: parent.id,
            type: "CALLUP",
            title,
            body: steps.join(" ") || "Dokumenty wyjazdu",
            link: `/dashboard/wyjazdy/turniej/${r.callupId}`,
            channel: "IN_APP",
            status: "SENT",
            sentAt: new Date(),
          },
        });
        sent++;
      } catch (e) {
        console.error("[TOURNAMENT MAILING]", parent.email, e);
        failed.push(`${parent.name} (${parent.email})`);
      }
      await sleep(600); // limit Resend: 2 maile/s
    }

    await prisma.callup.update({
      where: { id: r.callupId },
      data: { documentsSentAt: new Date() },
    });
  }

  return { sent, failed, withoutParent };
}

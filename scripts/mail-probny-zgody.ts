// Mail próbny: treść jak dla rodzica (pierwsze powołanie turnieju), ale wysłany TYLKO na podany adres.
// Nic nie zapisuje w bazie. Uruchom: tsx scripts/mail-probny-zgody.ts "<fragment nazwy turnieju>" <adres>
import { prisma } from "../src/lib/prisma";
import { getMailingPlan, buildParentMail } from "../src/lib/tournament-mailing";
import { sendEmail } from "../src/lib/notifications/channels/email";

async function main() {
  const [nameFragment, to] = process.argv.slice(2);
  const t = await prisma.tournament.findFirst({ where: { name: { contains: nameFragment } } });
  if (!t || !to) throw new Error("Podaj nazwę turnieju i adres");
  const plan = await getMailingPlan(t.id, "all");
  const r = plan!.recipients[0];
  const docs = await prisma.tournamentDocument.findMany({
    where: { tournamentId: t.id },
    select: { name: true, data: true },
    orderBy: { createdAt: "asc" },
  });
  const attachments = docs.map((d) => ({ filename: d.name, content: Buffer.from(d.data) }));
  const mail = buildParentMail(t, r, attachments);
  await sendEmail(to, `[PRÓBA] ${mail.subject}`, mail.html, undefined, attachments);
  console.log("Wysłano próbę na", to, "| wzór:", r.player, "| załączniki:", docs.map((d) => d.name).join(", "));
}
main().catch((e) => console.error(e.message)).finally(() => prisma.$disconnect());

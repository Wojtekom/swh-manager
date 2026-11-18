import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { sendNotification } from "@/lib/notifications/sender";
import { z } from "zod";

const agreementInclude = {
  player: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
  hours: { orderBy: { date: "asc" as const } },
};

// GET /api/volunteer — porozumienia wolontariackie
// ADMIN/COACH: wszystkie; PARENT: dzieci rodzica; PLAYER: własne
export async function GET() {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { id: userId, role } = session!.user;

  let where = {};
  if (role === "PARENT") {
    where = { player: { parents: { some: { parentId: userId } } } };
  } else if (role === "PLAYER") {
    where = { player: { playerUser: { userId } } };
  } else if (role !== "ADMIN" && role !== "COACH") {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const agreements = await prisma.volunteerAgreement.findMany({
    where,
    include: agreementInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agreements);
}

const createSchema = z.object({
  playerId: z.string().min(1),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  maxHours: z.number().int().positive().nullable().optional(),
});

// POST /api/volunteer — nowe porozumienie (ADMIN), powiadamia rodziców
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { playerId, periodFrom, periodTo, maxHours } = parsed.data;
  const from = new Date(periodFrom);
  const to = new Date(periodTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
    return NextResponse.json({ error: "Nieprawidłowy okres" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { parents: { select: { parentId: true } } },
  });
  if (!player) return NextResponse.json({ error: "Nie znaleziono zawodnika" }, { status: 404 });

  // Numer kolejny w roku rozpoczęcia: "N/RRRR"
  const year = from.getFullYear();
  const existing = await prisma.volunteerAgreement.findMany({
    where: { number: { endsWith: `/${year}` } },
    select: { number: true },
  });
  const next = existing.reduce((m, a) => Math.max(m, parseInt(a.number, 10) || 0), 0) + 1;

  const agreement = await prisma.volunteerAgreement.create({
    data: {
      number: `${next}/${year}`,
      playerId,
      periodFrom: from,
      periodTo: to,
      maxHours: maxHours ?? null,
      createdById: session!.user.id,
    },
    include: agreementInclude,
  });

  for (const p of player.parents) {
    await sendNotification({
      userId: p.parentId,
      type: "NEW_ANNOUNCEMENT",
      title: "Porozumienie wolontariackie do podpisu",
      body: `${player.firstName} może zostać wolontariuszem SWH (pomoc przy zajęciach młodszych dzieci i turniejach). Przeczytaj porozumienie razem z dzieckiem i podpiszcie je w aplikacji.`,
      link: "/dashboard/wolontariat",
      metadata: { volunteerAgreementId: agreement.id },
    });
  }

  return NextResponse.json(
    { ...agreement, notifiedParents: player.parents.length },
    { status: 201 }
  );
}

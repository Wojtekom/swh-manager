import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { sendNotification } from "@/lib/notifications/sender";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

async function loadForUser(id: string, userId: string, role: string) {
  const agreement = await prisma.volunteerAgreement.findUnique({
    where: { id },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          parents: { select: { parentId: true } },
          playerUser: { select: { userId: true } },
        },
      },
      hours: { orderBy: { date: "asc" } },
    },
  });
  if (!agreement) return { agreement: null, allowed: false, isParent: false };
  const isParent = agreement.player.parents.some((p) => p.parentId === userId);
  const isPlayer = agreement.player.playerUser?.userId === userId;
  const allowed = role === "ADMIN" || role === "COACH" || isParent || isPlayer;
  return { agreement, allowed, isParent };
}

// GET /api/volunteer/[id]
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { id } = await ctx.params;
  const { agreement, allowed } = await loadForUser(id, session!.user.id, session!.user.role);
  if (!agreement) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  const { parents: _p, playerUser: _u, ...player } = agreement.player;
  return NextResponse.json({ ...agreement, player });
}

const signSchema = z.object({
  action: z.literal("sign"),
  school: z.string().trim().min(2, "Podaj szkołę i klasę"),
  childSignature: z.string().trim().min(3, "Dziecko wpisuje imię i nazwisko"),
  parentSignature: z.string().trim().min(3, "Rodzic wpisuje imię i nazwisko"),
  childAccepted: z.literal(true),
  parentAccepted: z.literal(true),
});
const adminSchema = z.object({
  action: z.enum(["approve", "end", "cancel", "certificate"]),
});

// PATCH /api/volunteer/[id]
//  - rodzic: { action: "sign", ... } — podpis rodzica i dziecka
//  - ADMIN: { action: "approve" | "end" | "cancel" | "certificate" }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { id } = await ctx.params;
  const { id: userId, role, name } = session!.user;
  const body = await req.json();

  const { agreement, isParent } = await loadForUser(id, userId, role);
  if (!agreement) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });

  if (body?.action === "sign") {
    if (!isParent) {
      return NextResponse.json({ error: "Podpisać może tylko rodzic zawodnika" }, { status: 403 });
    }
    if (agreement.status !== "SENT") {
      return NextResponse.json({ error: "Porozumienie zostało już podpisane" }, { status: 409 });
    }
    const parsed = signSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const now = new Date();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const updated = await prisma.volunteerAgreement.update({
      where: { id },
      data: {
        status: "PARENT_SIGNED",
        school: parsed.data.school,
        childSignature: parsed.data.childSignature,
        childAcceptedAt: now,
        parentId: userId,
        parentSignature: parsed.data.parentSignature,
        parentAcceptedAt: now,
        parentIp: ip,
      },
    });
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    for (const a of admins) {
      await sendNotification({
        userId: a.id,
        type: "NEW_ANNOUNCEMENT",
        title: "Podpisane porozumienie wolontariackie",
        body: `${agreement.player.firstName} ${agreement.player.lastName} – porozumienie nr ${agreement.number} podpisane przez rodzica. Zatwierdź w zakładce Wolontariat.`,
        link: "/dashboard/wolontariat",
      });
    }
    return NextResponse.json(updated);
  }

  const roleError = requireRole("ADMIN", role);
  if (roleError) return roleError;
  const parsed = adminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  let data: Record<string, unknown> = {};
  switch (parsed.data.action) {
    case "approve":
      if (agreement.status !== "PARENT_SIGNED") {
        return NextResponse.json({ error: "Najpierw podpis rodzica" }, { status: 409 });
      }
      data = { status: "ACTIVE", boardApprovedAt: now, boardApprovedBy: name };
      break;
    case "end":
      data = { status: "ENDED" };
      break;
    case "cancel":
      data = { status: "CANCELLED" };
      break;
    case "certificate":
      data = { certificateIssuedAt: now };
      break;
  }
  const updated = await prisma.volunteerAgreement.update({ where: { id }, data });
  return NextResponse.json(updated);
}

// DELETE /api/volunteer/[id] — usuń niepodpisane porozumienie (ADMIN)
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;
  const { id } = await ctx.params;
  const a = await prisma.volunteerAgreement.findUnique({ where: { id }, select: { status: true } });
  if (!a) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (a.status !== "SENT") {
    return NextResponse.json(
      { error: "Podpisanego porozumienia nie usuwamy – użyj „Anuluj”" },
      { status: 409 }
    );
  }
  await prisma.volunteerAgreement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

async function staffOnly() {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  return requireRole(["ADMIN", "COACH"], session!.user.role);
}

// GET /api/players/[id]/parents — połączeni rodzice + lista kont rodziców do wyboru
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await staffOnly();
  if (denied) return denied;

  const [linked, candidates] = await Promise.all([
    prisma.parentPlayer.findMany({
      where: { playerId: id },
      select: { parent: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: "PARENT", active: true },
      select: {
        id: true,
        name: true,
        email: true,
        parentPlayers: { select: { player: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    linked: linked.map((l) => l.parent),
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      children: c.parentPlayers.map((pp) => `${pp.player.firstName} ${pp.player.lastName}`),
    })),
  });
}

// POST /api/players/[id]/parents { parentId } — połącz rodzica z dzieckiem
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await staffOnly();
  if (denied) return denied;

  const parsed = z.object({ parentId: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Wybierz rodzica" }, { status: 400 });

  const [player, parent] = await Promise.all([
    prisma.player.findUnique({ where: { id }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: parsed.data.parentId }, select: { id: true, role: true } }),
  ]);
  if (!player) return NextResponse.json({ error: "Zawodnik nie istnieje" }, { status: 404 });
  if (!parent || parent.role !== "PARENT") {
    return NextResponse.json({ error: "To nie jest konto rodzica" }, { status: 400 });
  }

  const exists = await prisma.parentPlayer.findFirst({
    where: { parentId: parent.id, playerId: player.id },
  });
  if (!exists) {
    await prisma.parentPlayer.create({ data: { parentId: parent.id, playerId: player.id } });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/players/[id]/parents?parentId=... — odłącz rodzica
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await staffOnly();
  if (denied) return denied;

  const parentId = new URL(req.url).searchParams.get("parentId");
  if (!parentId) return NextResponse.json({ error: "parentId wymagane" }, { status: 400 });

  await prisma.parentPlayer.deleteMany({ where: { playerId: id, parentId } });
  return NextResponse.json({ ok: true });
}

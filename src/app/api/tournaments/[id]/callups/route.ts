import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { triggerCallupCreated } from "@/lib/notifications/triggers-callup";
import { z } from "zod";

// Schemat: trener powołuje konkretnych zawodników LUB całą grupę
const callupSchema = z
  .object({
    playerIds: z.array(z.string()).optional(),
    groupId: z.string().optional(),
    notifyImmediately: z.boolean().default(true),
  })
  .refine((d) => (d.playerIds && d.playerIds.length > 0) || d.groupId, {
    message: "Wybierz min. 1 zawodnika lub grupę",
  });

const updateSchema = z.object({
  callupId: z.string(),
  status: z.enum(["CALLED", "CONFIRMED", "DECLINED", "INJURED"]).optional(),
  transportChoice: z
    .enum(["UNDECIDED", "BUS", "OWN", "NONE"])
    .optional(),
  notes: z.string().optional(),
  consentReceived: z.boolean().optional(), // trener odebrał podpisaną zgodę
});

// GET /api/tournaments/[id]/callups
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await getSessionOrError();
  if (error) return error;

  const callups = await prisma.callup.findMany({
    where: { tournamentId: id },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          jerseyNum: true,
          category: true,
          parents: {
            select: {
              parent: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: [{ player: { lastName: "asc" } }, { createdAt: "asc" }],
  });

  const stats = {
    total: callups.length,
    called: callups.filter((c: { status: string }) => c.status === "CALLED").length,
    confirmed: callups.filter((c: { status: string }) => c.status === "CONFIRMED").length,
    declined: callups.filter((c: { status: string }) => c.status === "DECLINED").length,
    injured: callups.filter((c: { status: string }) => c.status === "INJURED").length,
    busCount: callups.filter((c: { transportChoice: string }) => c.transportChoice === "BUS").length,
    ownCount: callups.filter((c: { transportChoice: string }) => c.transportChoice === "OWN").length,
  };

  return NextResponse.json({ callups, stats });
}

// POST /api/tournaments/[id]/callups — powołaj zawodników (bulk lub cała grupa)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = callupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let playerIds = parsed.data.playerIds || [];
  if (parsed.data.groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: parsed.data.groupId },
      select: { playerId: true },
    });
    const groupPlayerIds = members.map((m: { playerId: string }) => m.playerId);
    playerIds = Array.from(new Set([...playerIds, ...groupPlayerIds]));
  }

  if (playerIds.length === 0) {
    return NextResponse.json(
      { error: "Lista zawodników pusta" },
      { status: 400 }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Turniej nie istnieje" }, { status: 404 });
  }

  const created: string[] = [];
  for (const playerId of playerIds) {
    try {
      const callup = await prisma.callup.create({
        data: { tournamentId: id, playerId },
      });
      created.push(callup.id);
    } catch {
      // duplikat
    }
  }

  if (parsed.data.notifyImmediately && created.length > 0) {
    Promise.all(created.map((cid) => triggerCallupCreated(cid))).catch((e) =>
      console.error("[CALLUPS] Notify error:", e)
    );
  }

  return NextResponse.json(
    { created: created.length, skipped: playerIds.length - created.length },
    { status: 201 }
  );
}

// PUT /api/tournaments/[id]/callups — aktualizacja statusu/transportu
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  // Rodzice odpowiadają przez /api/parent/callups/[callupId]/respond
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.consentReceived !== undefined) {
    updateData.consentReceivedAt = parsed.data.consentReceived ? new Date() : null;
  }
  if (parsed.data.status || parsed.data.transportChoice || parsed.data.notes !== undefined) {
    updateData.respondedAt = new Date();
  }
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.transportChoice)
    updateData.transportChoice = parsed.data.transportChoice;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const callup = await prisma.callup.update({
    where: { id: parsed.data.callupId },
    data: updateData,
  });

  return NextResponse.json(callup);
}

// DELETE — usuń powołanie
export async function DELETE(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const { searchParams } = new URL(req.url);
  const callupId = searchParams.get("callupId");

  if (!callupId) {
    return NextResponse.json({ error: "callupId wymagane" }, { status: 400 });
  }

  await prisma.callup.delete({ where: { id: callupId } });
  return NextResponse.json({ message: "Usunięto" });
}

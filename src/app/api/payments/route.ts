import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

const createPaymentSchema = z.object({
  playerId: z.string(),
  feeId: z.string(),
  amount: z.number().positive(),
  dueDate: z.string().transform((v) => new Date(v)),
});

const bulkAssignSchema = z.object({
  feeId: z.string(),
  playerIds: z.array(z.string()).min(1),
  dueDate: z.string().transform((v) => new Date(v)),
});

// GET /api/payments — lista płatności
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const playerId = searchParams.get("playerId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (playerId) where.playerId = playerId;

  // Rodzic widzi tylko płatności swoich dzieci
  if (session!.user.role === "PARENT") {
    const parentLinks = await prisma.parentPlayer.findMany({
      where: { parentId: session!.user.id },
      select: { playerId: true },
    });
    where.playerId = { in: parentLinks.map((p) => p.playerId) };
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      player: { select: { id: true, firstName: true, lastName: true, category: true } },
      fee: { select: { id: true, name: true, frequency: true } },
    },
    orderBy: { dueDate: "desc" },
  });

  return NextResponse.json(payments);
}

// POST /api/payments — dodaj płatność lub nalicz grupowo
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();

  // Bulk assign
  if (body.playerIds) {
    const parsed = bulkAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const fee = await prisma.feeDefinition.findUnique({ where: { id: parsed.data.feeId } });
    if (!fee) {
      return NextResponse.json({ error: "Składka nie istnieje" }, { status: 404 });
    }

    // Nie naliczaj drugi raz tej samej składki z tym samym terminem
    const due = parsed.data.dueDate;
    const dayStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const existing = await prisma.payment.findMany({
      where: {
        feeId: parsed.data.feeId,
        playerId: { in: parsed.data.playerIds },
        dueDate: { gte: dayStart, lt: dayEnd },
      },
      select: { playerId: true },
    });
    const skip = new Set(existing.map((e) => e.playerId));
    const toCreate = parsed.data.playerIds.filter((pid) => !skip.has(pid));

    const created = await prisma.payment.createMany({
      data: toCreate.map((pid) => ({
        playerId: pid,
        feeId: parsed.data.feeId,
        amount: fee.amount,
        dueDate: due,
        status: "PENDING" as const,
      })),
    });

    return NextResponse.json(
      {
        message:
          `Naliczono ${created.count} płatności` +
          (skip.size ? ` (pominięto ${skip.size} – już naliczone z tym terminem)` : ""),
      },
      { status: 201 }
    );
  }

  // Single payment
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payment = await prisma.payment.create({ data: parsed.data });
  return NextResponse.json(payment, { status: 201 });
}

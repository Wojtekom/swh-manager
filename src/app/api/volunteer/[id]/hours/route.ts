import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const hourSchema = z.object({
  date: z.string().min(1),
  eventType: z.string().trim().min(1),
  tasks: z.string().trim().min(3, "Opisz wykonane zadania"),
  timeFrom: z.string().optional().nullable(),
  timeTo: z.string().optional().nullable(),
  hours: z.number().positive().max(12),
});

// POST /api/volunteer/[id]/hours — wpis do ewidencji godzin (ADMIN/COACH)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;
  const { id } = await ctx.params;

  const agreement = await prisma.volunteerAgreement.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!agreement) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (agreement.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Godziny wpisujemy tylko do obowiązującego porozumienia" },
      { status: 409 }
    );
  }

  const parsed = hourSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const date = new Date(parsed.data.date);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Nieprawidłowa data" }, { status: 400 });
  }

  const hour = await prisma.volunteerHour.create({
    data: {
      agreementId: id,
      date,
      eventType: parsed.data.eventType,
      tasks: parsed.data.tasks,
      timeFrom: parsed.data.timeFrom || null,
      timeTo: parsed.data.timeTo || null,
      hours: parsed.data.hours,
      coachName: session!.user.name ?? "",
      createdById: session!.user.id,
    },
  });
  return NextResponse.json(hour, { status: 201 });
}

// DELETE /api/volunteer/[id]/hours?hourId=... (ADMIN/COACH)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;
  const { id } = await ctx.params;
  const hourId = req.nextUrl.searchParams.get("hourId");
  if (!hourId) return NextResponse.json({ error: "Brak hourId" }, { status: 400 });
  const res = await prisma.volunteerHour.deleteMany({ where: { id: hourId, agreementId: id } });
  if (res.count === 0) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  return NextResponse.json({ success: true });
}

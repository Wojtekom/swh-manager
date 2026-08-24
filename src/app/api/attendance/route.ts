import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

const bulkAttendanceSchema = z.object({
  scheduleId: z.string(),
  date: z.string().transform((v) => new Date(v)),
  records: z.array(
    z.object({
      playerId: z.string(),
      present: z.boolean(),
      note: z.string().optional(),
    })
  ),
});

// GET /api/attendance?scheduleId=...&date=...
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  const date = searchParams.get("date");
  const playerId = searchParams.get("playerId");

  const where: Record<string, unknown> = {};
  if (scheduleId) where.scheduleId = scheduleId;
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: d, lt: nextDay };
  }
  if (playerId) where.playerId = playerId;

  const attendance = await prisma.attendance.findMany({
    where,
    include: {
      player: { select: { id: true, firstName: true, lastName: true, category: true } },
      schedule: { select: { id: true, startTime: true, endTime: true, location: true, group: { select: { name: true } } } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(attendance);
}

// POST /api/attendance — bulk save attendance for a session
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = bulkAttendanceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Upsert each record
  const results = await Promise.all(
    parsed.data.records.map((r) =>
      prisma.attendance.upsert({
        where: {
          scheduleId_playerId_date: {
            scheduleId: parsed.data.scheduleId,
            playerId: r.playerId,
            date: parsed.data.date,
          },
        },
        update: { present: r.present, note: r.note },
        create: {
          scheduleId: parsed.data.scheduleId,
          playerId: r.playerId,
          date: parsed.data.date,
          present: r.present,
          note: r.note,
        },
      })
    )
  );

  const presentCount = parsed.data.records.filter((r) => r.present).length;

  return NextResponse.json({
    saved: results.length,
    present: presentCount,
    absent: results.length - presentCount,
  });
}

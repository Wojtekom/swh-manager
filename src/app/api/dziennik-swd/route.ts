import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";

const DAY_NAMES = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

// GET /api/dziennik-swd?groupId=xxx
// Zwraca dane dziennika w formacie wymaganym przez program MSiT "Sport Wszystkich Dzieci":
// - lista uczestników z frekwencją
// - tematy zajęć z dat sesji treningowych
// - miejsce i godzina zajęć (wymóg SWD pkt 23 — data/dzień/miejsce/godzina)
export async function GET(request: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const groupId = request.nextUrl.searchParams.get("groupId");

  try {
    const group = groupId
      ? await prisma.trainingGroup.findUnique({
          where: { id: groupId },
          include: { coach: { include: { user: { select: { name: true } } } } },
        })
      : null;

    const players = groupId
      ? await prisma.player.findMany({
          where: { status: "ACTIVE", groupMembers: { some: { groupId } } },
          orderBy: { lastName: "asc" },
        })
      : await prisma.player.findMany({
          where: { status: "ACTIVE" },
          orderBy: { lastName: "asc" },
        });

    // Sesje treningowe z datami, wraz z harmonogramem (miejsce/godzina)
    const sessions = await prisma.trainingSession.findMany({
      where: {
        date: { not: null },
        plan: groupId ? { groupId } : undefined,
      },
      orderBy: { date: "asc" },
      include: {
        plan: { select: { name: true, category: true } },
        schedule: { select: { location: true, startTime: true, endTime: true, dayOfWeek: true } },
        skillFocus: { include: { skill: { select: { code: true, name: true } } } },
        drills: {
          orderBy: { order: "asc" },
          include: { drill: { select: { name: true, category: true } } },
        },
      },
    });

    const attendances = await prisma.attendance.findMany({
      where: { playerId: { in: players.map((p) => p.id) } },
      orderBy: { date: "asc" },
    });

    const attendanceMap: Record<string, Record<string, boolean>> = {};
    for (const a of attendances) {
      const dateKey = a.date.toISOString().split("T")[0];
      if (!attendanceMap[a.playerId]) attendanceMap[a.playerId] = {};
      attendanceMap[a.playerId][dateKey] = a.present;
    }

    const schedule = sessions.map((s) => ({
      id: s.id,
      date: s.date!.toISOString(),
      dateFormatted: s.date!.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }),
      dayName: DAY_NAMES[s.date!.getDay()],
      title: s.title,
      topic: s.topic,
      objectives: s.objectives,
      duration: s.duration,
      location: s.schedule?.location ?? null,
      startTime: s.schedule?.startTime ?? null,
      endTime: s.schedule?.endTime ?? null,
      skills: s.skillFocus.map((sf) => ({
        code: sf.skill.code,
        name: sf.skill.name,
        intensity: sf.intensity,
      })),
      drills: s.drills.map((d) => ({
        name: d.drill.name,
        category: d.drill.category,
        duration: d.duration,
        notes: d.notes,
      })),
    }));

    const playerData = players.map((p) => {
      const att = attendanceMap[p.id] || {};
      const totalPresent = Object.values(att).filter(Boolean).length;
      const totalSessions = Object.keys(att).length;
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth.toISOString().split("T")[0],
        category: p.category,
        attendance: att,
        totalPresent,
        totalSessions,
        percentPresent: totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0,
      };
    });

    return NextResponse.json({
      program: "Sport Wszystkich Dzieci 2026 (MSiT)",
      projectPeriod: "01.08.2026 – 11.12.2026",
      group: group ? { id: group.id, name: group.name, category: group.category, coach: group.coach?.user?.name } : null,
      participantCount: players.length,
      sessionCount: schedule.length,
      players: playerData,
      schedule,
    });
  } catch (err) {
    console.error("Błąd dziennik-swd:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

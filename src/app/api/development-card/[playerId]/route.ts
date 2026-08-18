import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";

const CATEGORIES = [
  { key: "ROLKI",   icon: "🛼", label: "Jazda na rolkach" },
  { key: "LYZWY",   icon: "⛸",  label: "Jazda na łyżwach" },
  { key: "KRAZEK",  icon: "🏒", label: "Technika prowadzenia krążka" },
  { key: "PODANIA", icon: "↔",  label: "Technika podania i przyjęcia" },
  { key: "STRZALY", icon: "🎯", label: "Technika strzału" },
  { key: "OBRONA",  icon: "🛡",  label: "Taktyka — obrona" },
  { key: "ATAK",    icon: "⚡", label: "Taktyka — atak" },
  { key: "CIALO",   icon: "💪", label: "Gra ciałem" },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  try {
    const { playerId } = await params;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        groupMembers: { include: { group: { select: { id: true, name: true, category: true } } } },
        skillAssessments: {
          include: { skill: true },
          orderBy: { assessedAt: "desc" },
        },
        fitnessTests: {
          orderBy: [{ testType: "asc" }, { testDate: "desc" }],
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Zawodnik nie znaleziony" }, { status: 404 });
    }

    const skills = await prisma.skillDefinition.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Ostatnie oceny per umiejętność
    const latestAssessments: Record<string, { grade: string; assessedAt: string; notes: string | null; assessedBy: string | null }> = {};
    for (const a of player.skillAssessments) {
      if (!latestAssessments[a.skillId]) {
        latestAssessments[a.skillId] = {
          grade: a.grade,
          assessedAt: a.assessedAt.toISOString(),
          notes: a.notes,
          assessedBy: a.assessedBy,
        };
      }
    }

    // Grupowanie umiejętności per kategoria
    const groupedSkills = CATEGORIES.map((cat) => ({
      ...cat,
      skills: skills
        .filter((s) => s.category === cat.key)
        .map((s) => ({ ...s, assessment: latestAssessments[s.id] || null })),
    }));

    // Testy sprawnościowe per typ i okres
    const fitnessByType: Record<string, Record<string, { result: string; testDate: string; notes: string | null }>> = {};
    for (const ft of player.fitnessTests) {
      if (!fitnessByType[ft.testType]) fitnessByType[ft.testType] = {};
      if (!fitnessByType[ft.testType][ft.period]) {
        fitnessByType[ft.testType][ft.period] = {
          result: ft.result,
          testDate: ft.testDate.toISOString(),
          notes: ft.notes,
        };
      }
    }

    const groupName = player.groupMembers[0]?.group?.name || null;

    return NextResponse.json({
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        dateOfBirth: player.dateOfBirth,
        category: player.category,
        groupName,
      },
      categories: groupedSkills,
      fitnessTests: fitnessByType,
      assessmentCount: player.skillAssessments.length,
    });
  } catch (err) {
    console.error("Błąd pobierania karty rozwoju:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  try {
    const { playerId } = await params;
    const body = await request.json();

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: "Zawodnik nie znaleziony" }, { status: 404 });
    }

    // Ocena umiejętności (W/T/D/O)
    if (body.skillId && body.grade) {
      if (!["W", "T", "D", "O"].includes(body.grade)) {
        return NextResponse.json({ error: "Nieprawidłowa ocena" }, { status: 400 });
      }
      const assessment = await prisma.playerSkillAssessment.create({
        data: {
          playerId,
          skillId: body.skillId,
          grade: body.grade,
          notes: body.notes || null,
          assessedBy: session!.user.name || null,
        },
        include: { skill: true },
      });
      return NextResponse.json({ ok: true, assessment });
    }

    // Test sprawnościowy
    if (body.testType && body.result && body.period) {
      if (!["start", "progress", "end"].includes(body.period)) {
        return NextResponse.json({ error: "Nieprawidłowy okres" }, { status: 400 });
      }
      const existing = await prisma.playerFitnessTest.findFirst({
        where: { playerId, testType: body.testType, period: body.period },
      });
      const data = {
        playerId,
        testType: body.testType,
        result: String(body.result),
        period: body.period,
        testDate: body.testDate ? new Date(body.testDate) : new Date(),
        notes: body.notes || null,
      };
      const fitnessTest = existing
        ? await prisma.playerFitnessTest.update({ where: { id: existing.id }, data })
        : await prisma.playerFitnessTest.create({ data });
      return NextResponse.json({ ok: true, fitnessTest });
    }

    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  } catch (err) {
    console.error("Błąd zapisywania oceny:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
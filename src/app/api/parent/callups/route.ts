import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError } from "@/lib/auth-helpers";

// GET /api/parent/callups — lista powołań na turnieje dla dzieci tego rodzica
// Domyślnie zwraca aktualne i przyszłe turnieje
export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const userId = session!.user.id;
  const { searchParams } = new URL(req.url);
  const includePast = searchParams.get("includePast") === "1";

  // Znajdź zawodników, których rodzicem jest aktualnie zalogowany user
  const parentLinks = await prisma.parentPlayer.findMany({
    where: { parentId: userId },
    select: { playerId: true },
  });
  const playerIds = parentLinks.map((p: { playerId: string }) => p.playerId);

  if (playerIds.length === 0) {
    return NextResponse.json({ callups: [] });
  }

  // Powołania tych zawodników
  const dateFilter = includePast
    ? {}
    : { tournament: { startDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } };

  const callups = await prisma.callup.findMany({
    where: {
      playerId: { in: playerIds },
      ...dateFilter,
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          category: true,
          description: true,
          transportFee: true,
          meetingTime: true,
          meetingLocation: true,
          parentDeadline: true,
          documents: {
            select: { id: true, name: true, size: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: true,
        },
      },
      consentFile: { select: { name: true, createdAt: true } },
    },
    orderBy: { tournament: { startDate: "asc" } },
  });

  return NextResponse.json({ callups });
}

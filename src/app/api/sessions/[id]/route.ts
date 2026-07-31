import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

const patchSessionSchema = z.object({
  topic: z.string().max(80).nullable().optional(),
  objectives: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PATCH /api/sessions/[id] — edycja tematu dnia / celów / notatek sesji treningowej
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.trainingSession.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Błąd aktualizacji sesji:", err);
    return NextResponse.json({ error: "Nie znaleziono sesji" }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { canAccessTournamentDocuments } from "@/lib/tournament-documents";

// GET /api/tournaments/[id]/documents/[docId] — pobranie pliku
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;

  if (!(await canAccessTournamentDocuments(session!.user, id))) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const doc = await prisma.tournamentDocument.findFirst({
    where: { id: docId, tournamentId: id },
  });
  if (!doc) {
    return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// DELETE /api/tournaments/[id]/documents/[docId] — usunięcie (admin/trener)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const result = await prisma.tournamentDocument.deleteMany({
    where: { id: docId, tournamentId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  }
  return NextResponse.json({ message: "Usunięto" });
}

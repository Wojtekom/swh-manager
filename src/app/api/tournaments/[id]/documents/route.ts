import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  canAccessTournamentDocuments,
} from "@/lib/tournament-documents";

// GET /api/tournaments/[id]/documents — lista dokumentów (bez treści plików)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;

  if (!(await canAccessTournamentDocuments(session!.user, id))) {
    return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
  }

  const documents = await prisma.tournamentDocument.findMany({
    where: { tournamentId: id },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(documents);
}

// POST /api/tournaments/[id]/documents — wgranie dokumentu (admin/trener), multipart: file
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { id: true } });
  if (!tournament) {
    return NextResponse.json({ error: "Turniej nie istnieje" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Dozwolone pliki: PDF, JPG, PNG, DOC/DOCX" },
      { status: 400 }
    );
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: "Plik większy niż 4 MB" }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const doc = await prisma.tournamentDocument.create({
    data: {
      tournamentId: id,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data,
    },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
  });

  return NextResponse.json(doc, { status: 201 });
}

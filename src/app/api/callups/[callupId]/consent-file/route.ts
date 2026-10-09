import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError } from "@/lib/auth-helpers";
import { MAX_DOCUMENT_SIZE } from "@/lib/tournament-documents";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Rodzic dziecka z powołania albo admin/trener
async function getAccess(callupId: string, user: { id: string; role: string }) {
  const callup = await prisma.callup.findUnique({
    where: { id: callupId },
    select: { id: true, player: { select: { parents: { select: { parentId: true } } } } },
  });
  if (!callup) return { callup: null, allowed: false };
  const isStaff = user.role === "ADMIN" || user.role === "COACH";
  const isParent = callup.player.parents.some((p) => p.parentId === user.id);
  return { callup, allowed: isStaff || isParent };
}

// GET — podgląd odesłanej zgody
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callupId: string }> }
) {
  const { callupId } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { callup, allowed } = await getAccess(callupId, session!.user);
  if (!callup) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });

  const file = await prisma.callupConsentFile.findUnique({ where: { callupId } });
  if (!file) return NextResponse.json({ error: "Brak pliku" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// POST — rodzic (lub trener) wgrywa zdjęcie/skan podpisanej zgody; zastępuje poprzedni plik
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ callupId: string }> }
) {
  const { callupId } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { callup, allowed } = await getAccess(callupId, session!.user);
  if (!callup) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Dozwolone: zdjęcie (JPG/PNG) lub PDF" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: "Plik większy niż 4 MB" }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const fileData = {
    name: file.name || "zgoda.jpg",
    mimeType: file.type,
    size: file.size,
    data,
    uploadedById: session!.user.id,
    createdAt: new Date(),
  };
  await prisma.$transaction([
    prisma.callupConsentFile.upsert({
      where: { callupId },
      create: { callupId, ...fileData },
      update: fileData,
    }),
    prisma.callup.update({
      where: { id: callupId },
      data: { consentReceivedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE — usunięcie pliku (np. złe zdjęcie); zgoda wraca do „niedostarczona”
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ callupId: string }> }
) {
  const { callupId } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const { callup, allowed } = await getAccess(callupId, session!.user);
  if (!callup) return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });

  await prisma.$transaction([
    prisma.callupConsentFile.deleteMany({ where: { callupId } }),
    prisma.callup.update({ where: { id: callupId }, data: { consentReceivedAt: null } }),
  ]);
  return NextResponse.json({ ok: true });
}

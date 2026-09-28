import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2, "Imie min. 2 znaki").optional(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "COACH", "PARENT", "PLAYER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, "Haslo min. 6 znakow").optional(),
  specialization: z.string().optional(),
  licenseNum: z.string().optional(),
});

// GET /api/users/[id] — szczegoly uzytkownika
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const { id } = await params;

  // Uzytkownik moze pobrac swoje dane, admin moze pobrac dowolne
  if (session!.user.id !== id) {
    const roleError = requireRole("ADMIN", session!.user.role);
    if (roleError) return roleError;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      createdAt: true,
      coach: { select: { specialization: true, licenseNum: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Nie znaleziono uzytkownika" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/users/[id] — edycja uzytkownika
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const { id } = await params;

  // Uzytkownik moze edytowac swoje dane (imie, telefon, haslo), admin moze edytowac wszystko
  const isSelf = session!.user.id === id;
  if (!isSelf) {
    const roleError = requireRole("ADMIN", session!.user.role);
    if (roleError) return roleError;
  }

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Nie-admin nie moze zmieniac roli ani statusu active
  if (isSelf && session!.user.role !== "ADMIN") {
    delete parsed.data.role;
    delete parsed.data.active;
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      active: true,
    },
  });

  const finalRole = parsed.data.role ?? user.role;
  if (
    finalRole === "COACH" &&
    (parsed.data.specialization !== undefined || parsed.data.licenseNum !== undefined)
  ) {
    await prisma.coach.upsert({
      where: { userId: id },
      create: {
        userId: id,
        specialization: parsed.data.specialization || null,
        licenseNum: parsed.data.licenseNum || null,
      },
      update: {
        ...(parsed.data.specialization !== undefined && { specialization: parsed.data.specialization || null }),
        ...(parsed.data.licenseNum !== undefined && { licenseNum: parsed.data.licenseNum || null }),
      },
    });
  }

  return NextResponse.json(user);
}

// DELETE /api/users/[id] — dezaktywacja uzytkownika (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const { id } = await params;

  // Nie mozna dezaktywowac siebie
  if (session!.user.id === id) {
    return NextResponse.json({ error: "Nie mozna dezaktywowac wlasnego konta" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { active: false },
    select: { id: true, email: true, name: true, active: true },
  });

  return NextResponse.json(user);
}

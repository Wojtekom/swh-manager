import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Nieprawidłowy email"),
  password: z.string().min(6, "Hasło min. 6 znaków"),
  name: z.string().min(2, "Imię min. 2 znaki"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "COACH", "PARENT", "PLAYER"]),
  specialization: z.string().optional(),
  licenseNum: z.string().optional(),
});

// GET /api/users — lista użytkowników (admin only)
export async function GET() {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const users = await prisma.user.findMany({
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
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

// POST /api/users — dodaj użytkownika (admin only)
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    return NextResponse.json({ error: "Email już zajęty" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      phone: parsed.data.phone || "",
      role: parsed.data.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (parsed.data.role === "COACH" && (parsed.data.specialization || parsed.data.licenseNum)) {
    await prisma.coach.create({
      data: {
        userId: user.id,
        specialization: parsed.data.specialization || null,
        licenseNum: parsed.data.licenseNum || null,
      },
    });
  }

  return NextResponse.json(user, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

// GET /api/coaches — lista kadry szkoleniowej klubu (wszyscy zalogowani)
export async function GET() {
  const { error } = await getSessionOrError();
  if (error) return error;

  const coaches = await prisma.user.findMany({
    where: { role: "COACH" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      active: true,
      coach: {
        select: {
          specialization: true,
          licenseNum: true,
          trainingGroups: { select: { id: true, name: true, category: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(coaches);
}

const createCoachSchema = z.object({
  email: z.string().email("Nieprawidłowy email"),
  password: z.string().min(6, "Hasło min. 6 znaków"),
  name: z.string().min(2, "Imię min. 2 znaki"),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  licenseNum: z.string().optional(),
});

// POST /api/coaches — dodaj trenera (admin only)
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = createCoachSchema.safeParse(body);
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
      role: "COACH",
      coach: {
        create: {
          specialization: parsed.data.specialization || null,
          licenseNum: parsed.data.licenseNum || null,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      coach: { select: { specialization: true, licenseNum: true } },
    },
  });

  return NextResponse.json(user, { status: 201 });
}

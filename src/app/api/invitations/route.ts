import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import { generateTempPassword, hashPassword, sendInvitationEmail } from "@/lib/invitations";

const inviteSchema = z.object({
  email: z.string().email("Podaj poprawny adres email"),
  parentName: z.string().min(1, "Podaj imię rodzica"),
  playerName: z.string().optional(),
});

// POST /api/invitations — ADMIN wysyła zaproszenie do rodzica
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, parentName, playerName } = parsed.data;

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Użytkownik z tym adresem email już istnieje w systemie" },
      { status: 409 }
    );
  }

  // Generate temp password
  const tempPassword = generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      email,
      name: parentName,
      passwordHash: hashedPassword,
      role: "PARENT",
      active: true,
    },
  });

  // Send invitation email
  try {
    await sendInvitationEmail({ email, parentName, playerName, tempPassword, userId: user.id });
  } catch (emailError) {
    console.error("[INVITATION EMAIL ERROR]", emailError);
    // Account created but email failed — return credentials so admin can share manually
    return NextResponse.json({
      userId: user.id,
      email,
      tempPassword,
      emailSent: false,
      message: "Konto utworzone, ale email nie został wysłany. Przekaż dane logowania ręcznie.",
    }, { status: 201 });
  }

  return NextResponse.json({
    userId: user.id,
    email,
    tempPassword,
    emailSent: true,
    message: "Zaproszenie wysłane!",
  }, { status: 201 });
}

// GET /api/invitations — lista zaproszonych rodziców (ADMIN)
export async function GET() {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const parents = await prisma.user.findMany({
    where: { role: "PARENT" },
    select: {
      id: true, email: true, name: true, active: true, createdAt: true,
      parentPlayers: {
        include: { player: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(parents);
}

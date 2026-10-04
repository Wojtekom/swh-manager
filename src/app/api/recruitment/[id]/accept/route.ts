import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import { generateTempPassword, hashPassword, sendInvitationEmail } from "@/lib/invitations";

const acceptSchema = z.object({
  groupIds: z.array(z.string()).default([]),
  sendInvite: z.boolean().default(true),
});

// POST /api/recruitment/[id]/accept — przyjęcie zgłoszenia z naboru (ADMIN):
// tworzy zawodnika (lub znajduje istniejącego), dopisuje do grup,
// zakłada konto rodzica (lub używa istniejącego), łączy rodzica z dzieckiem,
// przenosi zgody z formularza i wysyła rodzicowi zaproszenie e-mail.
// Można wywołać ponownie dla już przyjętego zgłoszenia — niczego nie dubluje.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;

  const roleError = requireRole("ADMIN", session!.user.role);
  if (roleError) return roleError;

  const body = await req.json().catch(() => ({}));
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { groupIds, sendInvite } = parsed.data;

  const r = await prisma.recruitment.findUnique({ where: { id } });
  if (!r) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia" }, { status: 404 });
  }

  const firstName = r.childFirstName.trim();
  const lastName = r.childLastName.trim();
  const parentName = r.parentName.trim().replace(/\s+/g, " ");
  const parentEmail = r.parentEmail.trim().toLowerCase();
  const parentPhone = r.parentPhone.trim();
  const playerName = `${firstName} ${lastName}`;

  // Zgody z formularza naboru → znaczniki czasu na koncie rodzica
  const consentAt = r.createdAt;
  const consents = {
    consentHealthAt: r.consentHealth ? consentAt : null,
    consentImageAt: r.consentImage ? consentAt : null,
    consentTravelAt: r.consentTravel ? consentAt : null,
    consentGoodPracticeAt: r.consentGoodPractice ? consentAt : null,
    consentDataAt: r.consentData ? consentAt : null,
  };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Zawodnik — ten sam, jeśli już istnieje (imię, nazwisko, data urodzenia)
    let playerCreated = false;
    let player = await tx.player.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        dateOfBirth: r.childBirthDate,
      },
    });
    if (!player) {
      player = await tx.player.create({
        data: {
          firstName,
          lastName,
          dateOfBirth: r.childBirthDate,
          category: r.category,
          status: "ACTIVE",
          notes: r.healthNotes ? `Uwagi zdrowotne z naboru: ${r.healthNotes}` : null,
        },
      });
      playerCreated = true;
    }

    // 2. Grupy
    if (groupIds.length > 0) {
      await tx.groupMember.createMany({
        data: groupIds.map((groupId) => ({ groupId, playerId: player!.id })),
        skipDuplicates: true,
      });
    }

    // 3. Konto rodzica — istniejące (po e-mailu) albo nowe
    let parentCreated = false;
    let parent = await tx.user.findUnique({ where: { email: parentEmail } });
    if (!parent) {
      parent = await tx.user.create({
        data: {
          email: parentEmail,
          name: parentName,
          phone: parentPhone || null,
          passwordHash,
          role: "PARENT",
          active: true,
          ...consents,
        },
      });
      parentCreated = true;
    } else {
      // uzupełnij tylko brakujące dane — niczego nie nadpisujemy
      const fill: Record<string, unknown> = {};
      if (!parent.phone && parentPhone) fill.phone = parentPhone;
      for (const [k, v] of Object.entries(consents)) {
        if (v && !(parent as Record<string, unknown>)[k]) fill[k] = v;
      }
      if (Object.keys(fill).length > 0) {
        parent = await tx.user.update({ where: { id: parent.id }, data: fill });
      }
    }

    // 4. Połączenie rodzic ↔ dziecko
    await tx.parentPlayer.upsert({
      where: { parentId_playerId: { parentId: parent.id, playerId: player.id } },
      update: {},
      create: { parentId: parent.id, playerId: player.id },
    });

    // 5. Status zgłoszenia + notatka
    const date = new Date().toLocaleDateString("pl-PL");
    const note = `[${date}] Przyjęto: zawodnik ${playerCreated ? "dodany" : "już istniał"}, konto rodzica ${parentCreated ? "założone" : "już istniało"}.`;
    await tx.recruitment.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        adminNotes: r.adminNotes ? `${r.adminNotes}\n${note}` : note,
      },
    });

    return { playerId: player.id, parentId: parent.id, playerCreated, parentCreated };
  });

  // 6. Zaproszenie — tylko dla nowo założonego konta
  let emailSent = false;
  if (result.parentCreated && sendInvite) {
    try {
      await sendInvitationEmail({
        email: parentEmail,
        parentName,
        playerName,
        tempPassword,
        userId: result.parentId,
      });
      emailSent = true;
    } catch (emailError) {
      console.error("[RECRUITMENT ACCEPT EMAIL ERROR]", emailError);
    }
  }

  return NextResponse.json({
    ...result,
    parentEmail,
    emailSent,
    // hasło zwracamy tylko, gdy konto jest nowe, a mail nie wyszedł — do przekazania ręcznie
    tempPassword: result.parentCreated && !emailSent ? tempPassword : undefined,
  });
}

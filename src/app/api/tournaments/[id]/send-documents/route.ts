import { NextRequest, NextResponse } from "next/server";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { getMailingPlan, sendTournamentDocuments } from "@/lib/tournament-mailing";
import { z } from "zod";

export const maxDuration = 60; // wysyłka z odstępem 0,6 s na maila

const schema = z.object({
  mode: z.enum(["all", "pending"]).default("all"),
  dryRun: z.boolean().default(false),
});

// POST /api/tournaments/[id]/send-documents
// dryRun: true  -> tylko podgląd, komu pójdzie mail
// dryRun: false -> wysyłka maili z dokumentami turnieju w załączniku
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { mode, dryRun } = parsed.data;

  if (dryRun) {
    const plan = await getMailingPlan(id, mode);
    if (!plan) return NextResponse.json({ error: "Turniej nie istnieje" }, { status: 404 });
    return NextResponse.json({
      documents: plan.tournament.documents.map((d) => d.name),
      recipients: plan.recipients.map((r) => ({
        player: r.player,
        status: r.status,
        consentReceived: r.consentReceived,
        parents: r.parents.map((p) => `${p.name} <${p.email}>`),
      })),
      withoutParent: plan.withoutParent,
    });
  }

  try {
    const result = await sendTournamentDocuments(id, mode);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd wysyłki" },
      { status: 500 }
    );
  }
}

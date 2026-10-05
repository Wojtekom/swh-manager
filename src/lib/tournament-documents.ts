import { prisma } from "@/lib/prisma";

export const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024; // limit body na Vercel to ~4,5 MB

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

// Dokumenty turnieju widzą: admin, trener oraz rodzic dziecka powołanego na ten turniej
export async function canAccessTournamentDocuments(
  user: { id: string; role: string },
  tournamentId: string
) {
  if (user.role === "ADMIN" || user.role === "COACH") return true;

  const callup = await prisma.callup.findFirst({
    where: {
      tournamentId,
      player: { parents: { some: { parentId: user.id } } },
    },
    select: { id: true },
  });
  return !!callup;
}

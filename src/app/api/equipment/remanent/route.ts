import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrError, requireRole } from "@/lib/auth-helpers";
import { STAN_TO_CONDITION, catByKey, matchesCat, norm } from "@/lib/remanent";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  magazyn: z.array(
    z.object({
      cat: z.string(),
      size: z.string(),
      qty: z.number().int().min(0),
      stan: z.string().optional(),
      brand: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
  wypozyczenia: z.array(
    z.object({
      playerId: z.string(),
      cat: z.string(),
      has: z.boolean(),
      size: z.string().optional(),
    })
  ),
  braki: z.array(
    z.object({
      czego: z.string().min(1),
      cat: z.string().optional(),
      rozmiar: z.string().optional(),
      ile: z.number().int().min(1).default(1),
      dla: z.string().optional(),
      zrodlo: z.string().optional(),
    })
  ),
});

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Znajdź rekord magazynu dla wiersza karty albo go utwórz (pusty: 0 szt.)
async function findOrCreate(tx: Tx, catKey: string, size: string) {
  const cat = catByKey(catKey);
  if (!cat) throw new Error(`Nieznana kategoria: ${catKey}`);
  const candidates = await tx.equipment.findMany({ where: { category: cat.category } });
  const hit = candidates.find((e) => matchesCat(e, cat) && norm(e.size) === norm(size));
  if (hit) return hit;
  return tx.equipment.create({
    data: {
      name: cat.name,
      category: cat.category,
      size: size === "—" ? null : size,
      quantity: 0,
      available: 0,
      condition: "GOOD",
    },
  });
}

// POST /api/equipment/remanent — zapis remanentu do magazynu, wypożyczeń i zapotrzebowania
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrError();
  if (error) return error;
  const roleError = requireRole(["ADMIN", "COACH"], session!.user.role);
  if (roleError) return roleError;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { magazyn, wypozyczenia, braki } = parsed.data;
  const userId = session!.user.id;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const touched = new Set<string>();
        let loansCreated = 0;
        let loansReturned = 0;

        // Część 2 — wypożyczenia: zaznaczone tworzą wypożyczenie, odznaczone wracają do magazynu
        for (const w of wypozyczenia) {
          const cat = catByKey(w.cat);
          if (!cat) continue;
          const sameCat = await tx.equipmentLoan.findMany({
            where: { playerId: w.playerId, status: { in: ["ACTIVE", "OVERDUE"] }, equipment: { category: cat.category } },
            include: { equipment: true },
          });
          const current = sameCat.filter((l) => matchesCat(l.equipment, cat));
          const size = (w.size ?? "").trim() || "—";

          let keep: string | null = null;
          if (w.has) {
            const target = await findOrCreate(tx, w.cat, size);
            touched.add(target.id);
            const already = current.find((l) => l.equipmentId === target.id);
            if (already) keep = already.id;
            else {
              await tx.equipmentLoan.create({
                data: {
                  equipmentId: target.id,
                  playerId: w.playerId,
                  issuedById: userId,
                  quantity: 1,
                  notes: "Remanent",
                },
              });
              loansCreated++;
            }
          }
          for (const l of current) {
            if (l.id === keep) continue;
            await tx.equipmentLoan.update({
              where: { id: l.id },
              data: { status: "RETURNED", returnDate: new Date(), notes: [l.notes, "zamknięte w remanencie"].filter(Boolean).join(" · ") },
            });
            touched.add(l.equipmentId);
            loansReturned++;
          }
        }

        // Część 1 — magazyn: wpisana ilość = sztuki na miejscu (dostępne)
        for (const m of magazyn) {
          const e = await findOrCreate(tx, m.cat, m.size);
          const condition = m.stan ? STAN_TO_CONDITION[m.stan] : undefined;
          await tx.equipment.update({
            where: { id: e.id },
            data: {
              available: m.qty,
              ...(condition ? { condition } : {}),
              ...(m.brand !== undefined ? { brand: m.brand || null } : {}),
              ...(m.location !== undefined ? { location: m.location || null } : {}),
              ...(m.notes !== undefined ? { notes: m.notes || null } : {}),
            },
          });
          touched.add(e.id);
        }

        // Łącznie = na miejscu + u zawodników
        for (const id of touched) {
          const agg = await tx.equipmentLoan.aggregate({
            where: { equipmentId: id, status: { in: ["ACTIVE", "OVERDUE"] } },
            _sum: { quantity: true },
          });
          const e = await tx.equipment.findUnique({ where: { id } });
          if (e) {
            await tx.equipment.update({
              where: { id },
              data: { quantity: e.available + (agg._sum.quantity ?? 0) },
            });
          }
        }

        // Część 3 — braki trafiają do Zapotrzebowania
        for (const b of braki) {
          const cat = b.cat ? catByKey(b.cat) : undefined;
          await tx.equipmentRequest.create({
            data: {
              userId,
              name: b.czego,
              description: b.rozmiar ? `Rozmiar: ${b.rozmiar}` : null,
              equipmentCategory: cat?.category ?? "OTHER",
              quantity: b.ile,
              notes: ["Z remanentu", b.dla && `dla: ${b.dla}`, b.zrodlo && `z czego: ${b.zrodlo}`].filter(Boolean).join(" · "),
            },
          });
        }

        return { rows: magazyn.length, loansCreated, loansReturned, braki: braki.length };
      },
      { timeout: 50000, maxWait: 10000 }
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[REMANENT]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd zapisu remanentu" },
      { status: 500 }
    );
  }
}


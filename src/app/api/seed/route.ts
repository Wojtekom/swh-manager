import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// POST /api/seed — tworzy konto admina jesli nie istnieje
export async function POST(req: NextRequest) {
  // Zabezpieczenie: wymaga skonfigurowanego SEED_SECRET — bez niego endpoint jest zablokowany
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json({ error: "Endpoint wylaczony (brak SEED_SECRET)" }, { status: 403 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${seedSecret}`) {
    return NextResponse.json({ error: "Brak autoryzacji seed" }, { status: 403 });
  }

  const adminEmail = "admin@swh.pl";

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    return NextResponse.json({ message: "Admin już istnieje" });
  }

  const passwordHash = await bcrypt.hash("Admin123!", 12);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: "Administrator SWH",
      role: "ADMIN",
      phone: "",
    },
  });

  return NextResponse.json({
    message: "Admin utworzony",
    email: admin.email,
    password: "Admin123!",
  });
}

import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/notifications/channels/email";
import { getAppUrl } from "@/lib/app-url";

// Hasło tymczasowe dla nowego konta rodzica
export function generateTempPassword() {
  return randomBytes(4).toString("hex") + "A1!";
}

export async function hashPassword(password: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

// Mail z zaproszeniem do SWH Manager (dane logowania + link)
export async function sendInvitationEmail(params: {
  email: string;
  parentName: string;
  playerName?: string;
  tempPassword: string;
  userId: string;
}) {
  const { email, parentName, playerName, tempPassword, userId } = params;
  const appUrl = getAppUrl();

  await sendEmail(
    email,
    "Zaproszenie do SWH Manager — Wybieram Hokej Siedlce",
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#38bdf8,#3b82f6);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">SWH Manager</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;">Stowarzyszenie Wybieram Hokej — Siedlce</p>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
          <h2 style="color:#0c4a6e;margin-top:0;">Witaj, ${parentName}!</h2>
          <p style="color:#334155;">Zostałeś/aś zaproszony/a do aplikacji SWH Manager${playerName ? ` jako rodzic zawodnika <strong>${playerName}</strong>` : ""}.</p>
          <p style="color:#334155;">Aplikacja pozwala na:</p>
          <ul style="color:#334155;">
            <li>Przeglądanie harmonogramu treningów</li>
            <li>Komunikację z trenerami</li>
            <li>Śledzenie obecności i turniejów</li>
            <li>Zgłaszanie zapotrzebowania na sprzęt</li>
            <li>Zarządzanie składkami</li>
          </ul>
          <div style="background:#e0f2fe;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:bold;color:#0369a1;">Dane logowania:</p>
            <p style="margin:4px 0;color:#334155;">Email: <strong>${email}</strong></p>
            <p style="margin:4px 0;color:#334155;">Hasło tymczasowe: <strong>${tempPassword}</strong></p>
          </div>
          <p style="color:#64748b;font-size:13px;">Zalecamy zmianę hasła po pierwszym logowaniu.</p>
          <a href="${appUrl}/login" style="display:inline-block;padding:12px 24px;background:#38bdf8;color:white;border-radius:8px;text-decoration:none;margin-top:12px;font-weight:bold;">Zaloguj się do aplikacji</a>
        </div>
      </div>`,
    userId
  );
}

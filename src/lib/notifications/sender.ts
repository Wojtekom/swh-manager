import { prisma } from "../prisma";
import { isDemoUser } from "./config";
import { sendEmail } from "./channels/email";
import { sendPushNotification } from "./channels/push";
import { sendSms } from "./channels/sms";
import { getAppUrl } from "../app-url";

interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function sendNotification(
  payload: NotificationPayload
): Promise<void> {
  const { userId, type, title, body, link, metadata } = payload;
  const isDemo = isDemoUser(userId);

  // Always create IN_APP notification
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: type as never,
        title,
        body,
        link,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    if (isDemo) {
      console.log(`[DEMO NOTIFICATION] ${title}: ${body}`);
      return;
    }
    throw error;
  }

  // Get user preferences for this notification type
  let prefs: { email: boolean; push: boolean; sms: boolean } | null = null;
  try {
    prefs = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type: type as never } },
    });
  } catch {
    // No preferences = use defaults
  }

  if (!prefs) {
    prefs = { email: true, push: true, sms: false };
  }

  // Get user details
  let user: {
    email: string;
    phone: string | null;
    pushSubscriptions: { endpoint: string; p256dh: string; auth: string }[];
  } | null = null;

  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, pushSubscriptions: true },
    });
  } catch {
    if (isDemo) return;
    return;
  }

  if (!user) return;

  // Send via enabled channels — EMAIL
  if (prefs.email && user.email) {
    try {
      await sendEmail(
        user.email,
        `SWH: ${title}`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#38bdf8,#3b82f6);padding:20px;border-radius:12px 12px 0 0;">
            <h2 style="color:white;margin:0;">🏒 SWH Manager</h2>
          </div>
          <div style="padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
            <h3 style="color:#0c4a6e;">${title}</h3>
            <p style="color:#334155;">${body}</p>
            ${
              link
                ? `<a href="${getAppUrl()}${link}" style="display:inline-block;padding:10px 20px;background:#38bdf8;color:white;border-radius:8px;text-decoration:none;margin-top:10px;">Otwórz w aplikacji</a>`
                : ""
            }
          </div>
        </div>`,
        userId
      );
    } catch (error) {
      console.error("[EMAIL ERROR]", error);
    }
  }

  // PUSH notifications
  if (prefs.push && user.pushSubscriptions) {
    for (const sub of user.pushSubscriptions) {
      try {
        await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title, body, link: link || "/dashboard", icon: "/icon-192.png" },
          userId
        );
      } catch (error) {
        console.error("[PUSH ERROR]", error);
      }
    }
  }

  // SMS
  if (prefs.sms && user.phone) {
    try {
      await sendSms(user.phone, `SWH: ${title} - ${body}`, userId);
    } catch (error) {
      console.error("[SMS ERROR]", error);
    }
  }
}

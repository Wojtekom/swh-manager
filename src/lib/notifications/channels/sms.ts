import {
  NOTIFICATION_CONFIG,
  isDemoUser,
  isServiceConfigured,
} from "../config";

export async function sendSms(
  phone: string,
  message: string,
  userId?: string
): Promise<void> {
  if (userId && isDemoUser(userId)) {
    console.log(`[DEMO SMS] To: ${phone}, Message: ${message}`);
    return;
  }

  if (!isServiceConfigured("sms")) {
    console.log(`[SMS SKIP] SMSAPI not configured. To: ${phone}`);
    return;
  }

  // Normalize Polish phone number
  let normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");
  if (normalizedPhone.startsWith("0"))
    normalizedPhone = "48" + normalizedPhone.slice(1);
  if (!normalizedPhone.startsWith("48") && normalizedPhone.length === 9) {
    normalizedPhone = "48" + normalizedPhone;
  }

  const params = new URLSearchParams({
    to: normalizedPhone,
    message,
    format: "json",
    encoding: "utf-8",
  });

  // Dodaj nadawcę tylko jeśli jest zarejestrowany w SMSAPI
  // Po rejestracji nazwy "SWH" odkomentować poniższą linię:
  // params.set("from", "SWH");

  const res = await fetch(
    `https://api.smsapi.pl/sms.do?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTIFICATION_CONFIG.smsapiToken}`,
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`SMS send failed: ${error}`);
  }
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SWH_BANK, transferTitle, zbpTransferQr } from "@/lib/payments";

// Dane do przelewu dla jednej należności + kod QR (standard ZBP) do zeskanowania w aplikacji bankowej.
export function TransferInfo({
  paymentId,
  playerName,
  amount,
}: {
  paymentId: string;
  playerName: string;
  amount: number;
}) {
  const title = transferTitle(paymentId, playerName);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(zbpTransferQr(amount, title), { margin: 1, width: 180 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [amount, title]);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`Skopiowano: ${label}`),
      () => toast.error("Nie udało się skopiować")
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      {qr && (
        <img
          src={qr}
          alt="Kod QR do przelewu"
          className="h-[180px] w-[180px] rounded border bg-white"
        />
      )}
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Zeskanuj kod w aplikacji banku (opcja „Płatność kodem QR” / „Skanuj i zapłać”) albo wpisz dane ręcznie:
        </p>
        <Row label="Odbiorca" value={SWH_BANK.recipient} />
        <Row
          label="Nr konta"
          value={SWH_BANK.accountFormatted}
          onCopy={() => copy(SWH_BANK.account, "numer konta")}
        />
        <Row label="Kwota" value={`${amount.toFixed(2).replace(".", ",")} zł`} />
        <Row label="Tytuł" value={title} onCopy={() => copy(title, "tytuł przelewu")} />
        <p className="text-xs text-muted-foreground">
          Prosimy nie zmieniać kodu {title.split(" ")[0]} w tytule – dzięki niemu wpłata zostanie
          automatycznie przypisana.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}:</span>
      <span className="font-medium break-all">{value}</span>
      {onCopy && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

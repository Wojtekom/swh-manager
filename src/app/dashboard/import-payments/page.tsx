"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, X, AlertTriangle, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentResult {
  date: string;
  title: string;
  sender: string;
  amount: number;
  playerName: string | null;
  playerId: string | null;
  status: "matched" | "unmatched" | "skipped";
}

interface ImportStats {
  total: number;
  matched: number;
  unmatched: number;
  skippedNegative: number;
  created: number;
  errors: string[];
}

interface Fee {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

export default function ImportPaymentsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaymentResult[] | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [mode, setMode] = useState<"preview" | "import">("preview");

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    fetch("/api/fees")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFees(data);
      })
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setStats(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Tryb: "preview" niczego nie zapisuje, "import" rozlicza należności z kodem SWH-XXXXXX
      formData.append("mode", mode);

      // W trybie import dodaj feeId
      if (mode === "import" && selectedFeeId) {
        formData.append("feeId", selectedFeeId);
      }

      const res = await fetch("/api/import-payments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results);
        setStats(data.stats);
        if (mode === "import" && data.stats.created > 0) {
          toast.success(`Utworzono ${data.stats.created} platnosci`);
        } else if (mode === "preview") {
          toast.success("Podglad zakonczony — sprawdz dopasowania");
        }
      } else {
        toast.error(data.error || "Blad importu");
      }
    } catch {
      toast.error("Blad polaczenia");
    } finally {
      setLoading(false);
    }
  };

  const matched = results?.filter((r) => r.status === "matched") || [];
  const unmatched = results?.filter((r) => r.status === "unmatched") || [];
  const skipped = results?.filter((r) => r.status === "skipped") || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import wplat bankowych</h1>
      <p className="text-muted-foreground">
        Wgraj plik CSV z historii konta Santander. System automatycznie dopasuje wplaty do zawodnikow na podstawie tytulu przelewu.
      </p>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Wgraj plik CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{file ? file.name : "Wybierz plik CSV"}</p>
                  <p className="text-sm text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Historia operacji z Santander"}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Tryb</p>
              <div className="flex gap-2">
                <Button
                  variant={mode === "preview" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("preview")}
                >
                  Podglad
                </Button>
                <Button
                  variant={mode === "import" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("import")}
                >
                  Import
                </Button>
              </div>
            </div>

            {mode === "import" && (
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium">Przypisz do skladki</p>
                <Select value={selectedFeeId} onValueChange={(v) => v && setSelectedFeeId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz skladke">
                      {fees.find((f) => f.id === selectedFeeId)?.name || "Wybierz skladke"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fees.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({f.amount} zl)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fees.length === 0 && (
                  <p className="text-xs text-destructive">
                    Najpierw zdefiniuj skladki w module Skladki → Definicje skladek
                  </p>
                )}
              </div>
            )}

            <Button onClick={handleUpload} disabled={!file || loading}>
              {loading ? "Przetwarzam..." : mode === "preview" ? "Analizuj" : "Importuj"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Operacji</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-sm text-green-700">Dopasowane</p>
              <p className="text-2xl font-bold text-green-700">{stats.matched}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <p className="text-sm text-orange-700">Niedopasowane</p>
              <p className="text-2xl font-bold text-orange-700">{stats.unmatched}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-4">
              <p className="text-sm text-gray-600">Pominiete (wydatki)</p>
              <p className="text-2xl font-bold text-gray-600">{stats.skippedNegative}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Matched */}
      {matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" />
              Dopasowane wplaty ({matched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tytul</TableHead>
                    <TableHead>Zawodnik</TableHead>
                    <TableHead className="text-right">Kwota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{r.title}</TableCell>
                      <TableCell>
                        <Badge variant="default">{r.playerName}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700">
                        {r.amount.toFixed(2)} zl
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-right">
              <p className="text-lg font-bold text-green-700">
                <Banknote className="inline h-5 w-5 mr-1" />
                Suma: {matched.reduce((s, r) => s + r.amount, 0).toFixed(2)} zl
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Niedopasowane wplaty ({unmatched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Te wplaty nie zostaly automatycznie dopasowane do zawodnikow. Sprawdz tytuly przelew i przypisz recznie w module Skladki.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tytul</TableHead>
                    <TableHead>Nadawca</TableHead>
                    <TableHead className="text-right">Kwota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{r.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.sender}</TableCell>
                      <TableCell className="text-right font-medium">
                        {r.amount.toFixed(2)} zl
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skipped */}
      {skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-500">
              <X className="h-5 w-5" />
              Pominiete ({skipped.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Operacje wychodzace (wydatki) — automatycznie pominiete.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

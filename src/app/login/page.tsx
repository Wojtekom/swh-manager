"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute top-[30%] right-[10%] w-[200px] h-[200px] rounded-full bg-teal-200/20 blur-2xl" />

      <Card className="relative w-full max-w-md shadow-xl shadow-sky-900/5 border-white/60 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 p-4 shadow-lg shadow-sky-500/25">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 rounded-full bg-sky-100 p-1">
                <Snowflake className="h-3.5 w-3.5 text-sky-400" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-sky-700 to-blue-600 bg-clip-text text-transparent">
            SWH Manager
          </CardTitle>
          <CardDescription className="text-sm">
            Stowarzyszenie Wybieram Hokej — Siedlce
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="twoj@email.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-white border-sky-100 focus:border-sky-300 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Haslo</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl bg-white border-sky-100 focus:border-sky-300 focus:ring-sky-200"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-semibold shadow-md shadow-sky-500/20 transition-all"
              disabled={loading}
            >
              {loading ? "Logowanie..." : "Zaloguj sie"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

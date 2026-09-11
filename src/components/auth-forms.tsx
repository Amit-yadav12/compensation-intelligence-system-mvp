"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!isLogin && name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${isLogin ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLogin ? { email, password } : { name: name.trim(), email, password },
        ),
      });
      const json = await res.json();
      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setError(json?.error?.message ?? "Authentication failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-stone-900">
        {isLogin ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        {isLogin
          ? "Log in to submit compensation data."
          : "Sign up to contribute to the dataset."}
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {!isLogin && (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-[12px] font-medium text-red-600" role="alert">{fieldErrors.name}</p>
            )}
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-[12px] font-medium text-red-600" role="alert">{fieldErrors.email}</p>
          )}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-[12px] font-medium text-red-600" role="alert">{fieldErrors.password}</p>
          )}
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </Button>
      </form>

      {isLogin && (
        <p className="mt-5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-relaxed text-stone-500">
          Demo account — <span className="font-medium text-stone-700">demo@compscope.dev</span> /{" "}
          <span className="font-medium text-stone-700">demo1234</span>
        </p>
      )}
    </Card>
  );
}

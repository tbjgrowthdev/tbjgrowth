"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, Mail, KeyRound } from "lucide-react";
import { requestLoginCode, verifyLoginCode } from "@/app/(portal)/actions/auth";
import { fill, type PortalStrings } from "@/lib/portal/strings";

type Props = { language: "en" | "bn"; t: PortalStrings; next: string };

export default function PortalLoginForm({ language, t, next }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      await requestLoginCode({ email });
      setStep("code");
      setCode("");
      setNotice(fill(t.login.codeSentTo, { email: email.trim() }));
    } catch {
      setError(t.login.genericError);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await verifyLoginCode({ email, code });
      if (result.success) {
        router.replace(next);
        router.refresh();
        return;
      }
      setError(result.error);
    } catch {
      setError(t.login.genericError);
    }
    setBusy(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void (step === "email" ? sendCode() : verify());
  };

  return (
    <div className="w-full max-w-md">
      <div className="admin-card overflow-hidden !rounded-[1.75rem]">
        <div className="border-b border-border px-6 pb-6 pt-8 text-center">
          <span className="inline-flex items-center rounded-2xl bg-white px-4 py-2.5 ring-1 ring-[var(--border-c)] dark:bg-[var(--card-bg)]">
            <Image src="/primarylogo.png" alt={t.brand} width={1000} height={200} sizes="160px" priority className="h-8 w-auto dark:hidden" />
            <Image src="/primary-logo-dark.png" alt={t.brand} width={1000} height={200} sizes="160px" priority className="hidden h-8 w-auto dark:block" />
          </span>
          <p className="eyebrow eyebrow-accent mt-6">{t.login.eyebrow}</p>
          <h1 className="admin-title mt-2 text-3xl">{t.login.title}</h1>
          <p className="mt-3 text-sm text-muted">{step === "email" ? t.login.intro : notice}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {step === "email" ? (
            <div>
              <label htmlFor="portal-email" className="mb-1.5 block text-sm font-bold">
                {t.login.emailLabel}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-caption" aria-hidden="true" />
                <input
                  id="portal-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.login.emailPlaceholder}
                  className="w-full rounded-2xl border py-3 pl-10 pr-4"
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="portal-code" className="mb-1.5 block text-sm font-bold">
                {t.login.codeLabel}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-caption" aria-hidden="true" />
                <input
                  id="portal-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-2xl border py-3 pl-10 pr-4 font-mono tracking-[0.4em]"
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            {busy ? t.login.working : step === "email" ? t.login.sendCode : t.login.verify}
            {!busy && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
          </button>

          {step === "code" && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-semibold text-[var(--admin-orange-text)] underline-offset-4 hover:underline">
                {t.login.resend}
              </button>
              <button type="button" onClick={() => { setStep("email"); setError(""); }} disabled={busy} className="font-semibold text-muted underline-offset-4 hover:underline">
                {t.login.changeEmail}
              </button>
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 text-xs text-caption">
          <p>{t.login.inviteOnly}</p>
          <Link href={language === "bn" ? "/portal/login" : "/portal/login?lang=bn"} className="portal-tap inline-flex shrink-0 items-center font-semibold text-foreground" lang={language === "bn" ? "en" : "bn"}>
            {t.login.switchLanguage}
          </Link>
        </div>
      </div>
    </div>
  );
}

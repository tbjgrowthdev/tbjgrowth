"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import PageTitle from "@/components/Admin/PageTitle";
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Credentials provider can't return a user mid-way, so the two-factor
  // step is a second signIn() call from this same form rather than a
  // separate page — see lib/auth.ts's "2FA_REQUIRED" sentinel.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        ...(needsTwoFactor ? (useBackupCode ? { backupCode: code } : { totpCode: code }) : {}),
      });

      if (result?.error === "2FA_REQUIRED") {
        setNeedsTwoFactor(true);
        setError("");
      } else if (result?.error) {
        setError(result.error);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-canvas relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Orbit rings: brand motif, one corner only */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem]">
        <span className="orbit inset-0" />
        <span className="orbit inset-16 opacity-70" />
        <span className="orbit inset-32 opacity-50" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="admin-card overflow-hidden !rounded-[1.75rem]">
          {/* Header */}
          <div className="border-b border-border p-8 pb-6 text-center">
            <span className="inline-flex items-center rounded-2xl bg-white px-4 py-2.5 ring-1 ring-[var(--border-c)] dark:bg-[var(--card-bg)]">
              <Image src="/primarylogo.png" alt="TBJ Growth Tech" width={1000} height={200} sizes="180px" priority className="h-9 w-auto dark:hidden" />
              <Image src="/primary-logo-dark.png" alt="TBJ Growth Tech" width={1000} height={200} sizes="180px" priority className="hidden h-9 w-auto dark:block" />
            </span>
            <p className="eyebrow eyebrow-accent mt-6">Administration panel</p>
            <PageTitle className="mt-2">Secure Access</PageTitle>
            <p className="mt-3 text-sm text-muted">Sign in to access the TBJ Administration Panel.</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  role="alert"
                  className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}

              {!needsTwoFactor ? (
                <>
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-bold text-foreground mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-caption" />
                      </div>
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="username"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border rounded-2xl transition-all text-foreground"
                        placeholder="admin@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-bold text-foreground mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-caption" />
                      </div>
                      <input
                        id="login-password"
                        autoComplete="current-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-11 py-3 border rounded-2xl transition-all text-foreground"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-caption hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    {useBackupCode ? "Backup code" : "Authenticator code"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-caption" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border rounded-2xl transition-all text-foreground"
                      placeholder={useBackupCode ? "XXXX-XXXX" : "6-digit code"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode((prev) => !prev);
                      setCode("");
                      setError("");
                    }}
                    className="mt-3 text-xs font-semibold text-muted hover:text-foreground underline transition-colors"
                  >
                    {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full !py-3.5 disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{needsTwoFactor ? "Verify" : "Sign In"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

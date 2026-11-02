import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, useSignIn, useSignUp } from "@clerk/tanstack-react-start";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clerkConfigured } from "@/components/tailor/TailorClerk";
import logoUrl from "@/assets/logo.png";
import heroImage from "@/assets/homepage/outfit-concept.webp";

export const AUTH_REDIRECTS = ["/studio", "/shoe-design", "/bag-design", "/wardrobe", "/tailor"] as const;
export type AuthRedirect = (typeof AUTH_REDIRECTS)[number];

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
    </svg>
  );
}

const GLASS_WRAPPER =
  "rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10";
const GLASS_INPUT =
  "h-12 rounded-2xl border-0 bg-transparent px-4 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

function errorMessage(error: unknown): string {
  const e = error as { longMessage?: string; message?: string } | null;
  return e?.longMessage ?? e?.message ?? "Something went wrong. Try again.";
}

type Mode = "in" | "up";
type Step = "start" | "code" | "verify" | "reset" | "reset-code";

function AuthForm({ redirectTo, initialMode }: { redirectTo: AuthRedirect; initialMode: Mode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = signInStatus === "fetching" || signUpStatus === "fetching";

  useEffect(() => {
    if (isLoaded && isSignedIn) void navigate({ to: redirectTo });
  }, [isLoaded, isSignedIn, navigate, redirectTo]);

  async function finish(finalize: () => Promise<{ error: unknown }>) {
    const { error: finError } = await finalize();
    if (finError) {
      setError(errorMessage(finError));
      return;
    }
    window.location.assign(redirectTo);
  }

  async function submitSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password) {
      const { error: err } = await signIn.password({ emailAddress: email, password });
      if (err) return setError(errorMessage(err));
      if (signIn.status === "complete") return finish(() => signIn.finalize());
      return setError("This sign-in needs another step we do not support here yet.");
    }
    const { error: err } = await signIn.emailCode.sendCode({ emailAddress: email });
    if (err) return setError(errorMessage(err));
    setStep("code");
    setNotice(`We sent a sign-in code to ${email}.`);
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const { error: err } = await signIn.emailCode.verifyCode({ code });
    if (err) return setError(errorMessage(err));
    if (signIn.status === "complete") return finish(() => signIn.finalize());
    setError("That code did not finish the sign-in. Request a new code and try again.");
  }

  async function submitSignUp(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const { error: err } = await signUp.create({ emailAddress: email, password });
    if (err) return setError(errorMessage(err));
    if (signUp.status === "complete") return finish(() => signUp.finalize());
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return setError(errorMessage(sendError));
    setStep("verify");
    setNotice(`We sent a verification code to ${email}.`);
  }

  async function submitVerify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const { error: err } = await signUp.verifications.verifyEmailCode({ code });
    if (err) return setError(errorMessage(err));
    if (signUp.status === "complete") return finish(() => signUp.finalize());
    setError("That code did not finish the sign-up. Request a new code and try again.");
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const { error: createError } = await signIn.create({ identifier: email });
    if (createError) return setError(errorMessage(createError));
    const { error: err } = await signIn.resetPasswordEmailCode.sendCode();
    if (err) return setError(errorMessage(err));
    setStep("reset-code");
    setNotice(`We sent a reset code to ${email}.`);
  }

  async function submitResetCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const { error: err } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (err) return setError(errorMessage(err));
    if (signIn.status !== "needs_new_password") return setError("That code was not accepted. Request a new code and try again.");
    const { error: pwError } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (pwError) return setError(errorMessage(pwError));
    if ((signIn.status as string) === "complete") return finish(() => signIn.finalize());
    setError("Password updated. Sign in with your new password.");
    setStep("start");
    setMode("in");
  }

  async function google() {
    setError("");
    const redirectUrl = `${window.location.origin}${redirectTo}`;
    const redirectCallbackUrl = `${window.location.origin}/sso-callback`;
    const { error: err } =
      mode === "in"
        ? await signIn.sso({ strategy: "oauth_google", redirectUrl, redirectCallbackUrl })
        : await signUp.sso({ strategy: "oauth_google", redirectUrl, redirectCallbackUrl });
    if (err) setError(errorMessage(err));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStep("start");
    setError("");
    setNotice("");
    setCode("");
  }

  const title =
    step === "reset" || step === "reset-code"
      ? "Reset your password"
      : mode === "in"
        ? "Welcome back"
        : "Create your account";
  const description =
    step === "code" || step === "verify"
      ? "Enter the code we sent to your email."
      : step === "reset" || step === "reset-code"
        ? "We will email you a code to set a new password."
        : mode === "in"
          ? "Sign in to open your design studio."
          : "Create an account to open your design studio.";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background font-sans text-foreground md:flex-row">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <section className="relative flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex w-fit items-center gap-2" aria-label="Fashley home">
            <img src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-display text-xl">Fashley</span>
          </Link>
          <h1 className="mt-8 font-sans text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>

          {step === "start" && (
            <>
              <form className="mt-8 space-y-5" onSubmit={mode === "in" ? submitSignIn : submitSignUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email" className="text-muted-foreground">Email Address</Label>
                  <div className={GLASS_WRAPPER}>
                    <Input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={GLASS_INPUT}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-password" className="text-muted-foreground">Password</Label>
                  <div className={`${GLASS_WRAPPER} relative`}>
                    <Input
                      id="auth-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "in" ? "current-password" : "new-password"}
                      required={mode === "up"}
                      placeholder={mode === "in" ? "Enter your password, or leave blank for an email code" : "Enter your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${GLASS_INPUT} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {mode === "in" && (
                  <div className="flex items-center justify-end text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("reset");
                        setError("");
                        setNotice("");
                      }}
                      className="text-violet-500 underline-offset-4 transition-colors hover:underline"
                    >
                      Reset password
                    </button>
                  </div>
                )}
                {mode === "up" && <div id="clerk-captcha" />}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {notice && <p role="status" className="text-sm">{notice}</p>}
                <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={busy || !isLoaded}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "in" ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="relative my-6 flex items-center justify-center" aria-hidden="true">
                <span className="w-full border-t border-border" />
                <span className="absolute bg-background px-4 text-sm text-muted-foreground">Or continue with</span>
              </div>

              <Button type="button" variant="outline" size="lg" className="h-12 w-full rounded-2xl bg-foreground/5 backdrop-blur-sm" onClick={() => void google()} disabled={busy || !isLoaded}>
                <GoogleIcon /> Continue with Google
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "in" ? (
                  <>New to Fashley?{" "}
                    <button type="button" onClick={() => switchMode("up")} className="font-medium text-violet-500 underline-offset-4 hover:underline">
                      Create Account
                    </button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("in")} className="font-medium text-violet-500 underline-offset-4 hover:underline">
                      Sign In
                    </button>
                  </>
                )}
              </p>
            </>
          )}

          {(step === "code" || step === "verify") && (
            <form className="mt-8 space-y-5" onSubmit={step === "code" ? submitCode : submitVerify}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-code">Email code</Label>
                <div className={GLASS_WRAPPER}>
                  <Input
                    id="auth-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    placeholder="Enter the code from your email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={GLASS_INPUT}
                  />
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {notice && <p role="status" className="text-sm">{notice}</p>}
              <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={busy || !isLoaded}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("start");
                  setCode("");
                  setError("");
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back
              </button>
            </form>
          )}

          {step === "reset" && (
            <form className="mt-8 space-y-5" onSubmit={submitReset}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-reset-email">Email address</Label>
                <div className={GLASS_WRAPPER}>
                  <Input
                    id="auth-reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={GLASS_INPUT}
                  />
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={busy || !isLoaded}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset code"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("start")}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back to sign in
              </button>
            </form>
          )}

          {step === "reset-code" && (
            <form className="mt-8 space-y-5" onSubmit={submitResetCode}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-reset-code">Reset code</Label>
                <div className={GLASS_WRAPPER}>
                  <Input
                    id="auth-reset-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    placeholder="Enter the code from your email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={GLASS_INPUT}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-new-password">New password</Label>
                <div className={GLASS_WRAPPER}>
                  <Input
                    id="auth-new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={GLASS_INPUT}
                  />
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {notice && <p role="status" className="text-sm">{notice}</p>}
              <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={busy || !isLoaded}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("start")}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="relative hidden flex-1 p-4 md:block" aria-hidden="true">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-lg border border-border object-cover"
        />
        <p className="absolute bottom-8 left-8 rounded-2xl border border-white/20 bg-zinc-900/30 px-4 py-3 text-sm text-white backdrop-blur-xl">
          Example outfit in Ankara print.
        </p>
      </section>
    </div>
  );
}

export function CustomAuth({ redirectTo, initialMode }: { redirectTo: AuthRedirect; initialMode: Mode }) {
  if (!clerkConfigured) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <Alert role="status">
          <AlertTitle>Sign-in is not configured</AlertTitle>
          <AlertDescription>
            <p>Sign-in is unavailable in this deployment. No account data was loaded or changed.</p>
          </AlertDescription>
        </Alert>
      </main>
    );
  }
  return <AuthForm redirectTo={redirectTo} initialMode={initialMode} />;
}

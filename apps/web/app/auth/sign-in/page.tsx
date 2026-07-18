import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "../../../components/brand-mark";
import { isLiveProcessingEnabled } from "../../../lib/live-processing";
import { requestMagicLink } from "../actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error, status } = await searchParams;
  const liveProcessingEnabled = isLiveProcessingEnabled();

  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <BrandMark />
        <div>
          <p className="eyebrow text-white/55">SECURE REVIEW WORKSPACE</p>
          <h1>Keep revision evidence tied to the people reviewing it.</h1>
          <p>
            Passwordless authentication protects live projects. The built-in sample remains
            available without presenting it as uploaded analysis.
          </p>
        </div>
        <span className="technical text-[10px] tracking-[0.1em] text-white/45">
          {liveProcessingEnabled
            ? "SUPABASE AUTH · PASSWORDLESS EMAIL LINK"
            : "PORTFOLIO MODE · LIVE PROCESSING OFFLINE"}
        </span>
      </section>
      <section className="auth-form-shell">
        {liveProcessingEnabled ? (
          <form action={requestMagicLink} className="auth-form">
            <Link className="back-link" href="/">
              <ArrowLeft aria-hidden="true" size={16} /> Product page
            </Link>
            {status === "check-email" ? (
              <CheckCircle2
                aria-hidden="true"
                className="text-[#17845B]"
                size={28}
                strokeWidth={1.5}
              />
            ) : (
              <LockKeyhole aria-hidden="true" size={26} strokeWidth={1.5} />
            )}
            <div>
              <p className="eyebrow">{status === "check-email" ? "EMAIL SENT" : "SIGN IN"}</p>
              <h2>{status === "check-email" ? "Check your inbox" : "Access live projects"}</h2>
              <p>
                {status === "check-email"
                  ? "Use the secure link in the email to finish signing in. You can close this page."
                  : "Enter your email and Supabase will send a one-time sign-in link. No password is stored here."}
              </p>
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            {status !== "check-email" ? (
              <>
                <label htmlFor="email">
                  Work email
                  <input
                    autoComplete="email"
                    id="email"
                    name="email"
                    placeholder="name@company.com"
                    required
                    type="email"
                  />
                </label>
                <button type="submit">Send secure sign-in link</button>
              </>
            ) : null}
            <Link className="text-action" href="/app/analyses/sample">
              Open the labelled sample instead
            </Link>
          </form>
        ) : (
          <div className="auth-form">
            <Link className="back-link" href="/">
              <ArrowLeft aria-hidden="true" size={16} /> Product page
            </Link>
            <LockKeyhole aria-hidden="true" size={26} strokeWidth={1.5} />
            <div>
              <p className="eyebrow">PORTFOLIO MODE</p>
              <h2>Live project access is temporarily offline</h2>
              <p>
                Sign-in and uploads remain disabled until production access is enabled. The labelled
                sample is fully available without an account.
              </p>
            </div>
            <Link className="text-action" href="/app/analyses/sample">
              Open the labelled sample
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

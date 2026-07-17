import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "../../../components/brand-mark";

export default function SignInPage() {
  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <BrandMark />
        <div>
          <p className="eyebrow text-white/55">SECURE REVIEW WORKSPACE</p>
          <h1>Keep revision evidence tied to the people reviewing it.</h1>
          <p>
            Authentication protects live projects. The built-in sample remains available without
            presenting it as uploaded analysis.
          </p>
        </div>
        <span className="technical text-[10px] tracking-[0.1em] text-white/45">
          SUPABASE AUTH · WIRING FOLLOWS DATABASE MIGRATION
        </span>
      </section>
      <section className="auth-form-shell">
        <div className="auth-form">
          <Link className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={16} /> Product page
          </Link>
          <LockKeyhole aria-hidden="true" size={26} strokeWidth={1.5} />
          <div>
            <p className="eyebrow">SIGN IN</p>
            <h2>Access live projects</h2>
            <p>
              Supabase email authentication becomes active after the versioned schema is applied.
            </p>
          </div>
          <label htmlFor="email">
            Work email
            <input
              autoComplete="email"
              disabled
              id="email"
              placeholder="name@company.com"
              type="email"
            />
          </label>
          <button disabled type="button">
            Authentication pending migration
          </button>
          <Link className="text-action" href="/app/analyses/sample">
            Open the labelled sample instead
          </Link>
        </div>
      </section>
    </main>
  );
}

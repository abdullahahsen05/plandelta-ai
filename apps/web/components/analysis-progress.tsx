"use client";

import { AlertTriangle, CircleX, LoaderCircle, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest, PlanDeltaApiError } from "../lib/api/client";
import { analysisSchema, type Analysis } from "../lib/api/contracts";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function AnalysisProgress({ initial }: { initial: Analysis }) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (terminalStatuses.has(analysis.status)) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`analysis-progress-${analysis.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          filter: `id=eq.${analysis.id}`,
        },
        (payload) => {
          const update = payload.new as Record<string, unknown>;
          const status = typeof update.status === "string" ? update.status : analysis.status;
          setAnalysis((current) => ({
            ...current,
            status: status as Analysis["status"],
            cancellationRequested:
              typeof update.cancellation_requested === "boolean"
                ? update.cancellation_requested
                : current.cancellationRequested,
            progress: typeof update.progress === "number" ? update.progress : current.progress,
            currentStage:
              typeof update.current_stage === "string"
                ? update.current_stage
                : current.currentStage,
          }));
          if (status === "COMPLETED") router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [analysis.id, analysis.status, router]);

  useEffect(() => {
    if (terminalStatuses.has(analysis.status)) return;
    let active = true;
    const poll = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) {
          router.push("/auth/sign-in");
          return;
        }
        const next = await apiRequest(
          `/analyses/${analysis.id}`,
          data.session.access_token,
          analysisSchema,
        );
        if (!active) return;
        setAnalysis((current) =>
          current.cancellationRequested &&
          !next.cancellationRequested &&
          !terminalStatuses.has(next.status)
            ? {
                ...next,
                cancellationRequested: true,
                currentStage: current.currentStage,
              }
            : next,
        );
        setError(null);
        if (next.status === "COMPLETED") router.refresh();
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Progress is temporarily unavailable.",
          );
        }
      }
    };
    const timer = window.setInterval(() => void poll(), 2000);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [analysis.id, analysis.status, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Your session has expired.");
      const next = await apiRequest(
        `/analyses/${analysis.id}/retry`,
        data.session.access_token,
        analysisSchema,
        { method: "POST" },
      );
      setAnalysis(next);
    } catch (reason) {
      setError(
        reason instanceof PlanDeltaApiError || reason instanceof Error
          ? reason.message
          : "The analysis could not be retried.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Your session has expired.");
      const next = await apiRequest(
        `/analyses/${analysis.id}/cancel`,
        data.session.access_token,
        analysisSchema,
        { method: "POST" },
      );
      setAnalysis(next);
    } catch (reason) {
      setError(
        reason instanceof PlanDeltaApiError || reason instanceof Error
          ? reason.message
          : "The cancellation request could not be sent.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const failed = analysis.status === "FAILED";
  const cancelled = analysis.status === "CANCELLED";
  const terminalProblem = failed || cancelled;
  const cancellationPending = analysis.cancellationRequested && !cancelled;

  return (
    <main className="analysis-progress-page">
      <section className="analysis-progress-panel" aria-live="polite">
        <div
          className={terminalProblem ? "progress-symbol progress-symbol-error" : "progress-symbol"}
        >
          {failed ? (
            <AlertTriangle aria-hidden="true" size={28} />
          ) : cancelled ? (
            <CircleX aria-hidden="true" size={28} />
          ) : (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={28} />
          )}
        </div>
        <p className="eyebrow">LIVE ANALYSIS · {analysis.status.replaceAll("_", " ")}</p>
        <h1>
          {failed
            ? "Analysis needs attention"
            : cancelled
              ? "Analysis cancelled"
              : cancellationPending
                ? "Stopping analysis"
                : "Reading revision evidence"}
        </h1>
        <p>
          {failed
            ? (analysis.errorMessage ?? "The analysis did not complete.")
            : cancelled
              ? "This comparison request was cancelled. No result was published."
              : cancellationPending
                ? "Finishing the current safe operation, then stopping this comparison."
                : "OpenCV alignment, directional differencing, and OCR are running on the selected page."}
        </p>
        <div
          className="progress-track"
          aria-label={`${analysis.progress}% complete`}
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={analysis.progress}
        >
          <span style={{ width: `${analysis.progress}%` }} />
        </div>
        <div className="progress-meta">
          <span>{analysis.currentStage.replaceAll("_", " ")}</span>
          <b>{analysis.progress}%</b>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="progress-actions">
          <Link className="text-action" href={`/app/projects/${analysis.projectId}`}>
            Return to project
          </Link>
          {terminalProblem ? (
            <button className="signal-button" disabled={retrying} onClick={retry} type="button">
              <RotateCcw aria-hidden="true" size={16} /> {retrying ? "Queueing…" : "Retry analysis"}
            </button>
          ) : (
            <button
              className="cancel-analysis-button"
              disabled={cancelling || cancellationPending}
              onClick={cancel}
              type="button"
            >
              <X aria-hidden="true" size={16} />{" "}
              {cancelling || cancellationPending ? "Cancelling…" : "Cancel analysis"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

"use client";

import { ArrowRight, Check, ImageOff, ScanSearch } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { changeKindMeta, type ChangeKind, type SampleChange } from "../lib/sample-data";

export type ChangeFilter = "all" | ChangeKind;

function sentenceCase(value: string) {
  return value.length > 0 ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
}

function EvidenceCrop({ label, variant }: { label: string; variant: "old" | "new" }) {
  return (
    <div className="evidence-crop">
      <span>{label}</span>
      <svg aria-hidden="true" viewBox="0 0 160 78">
        <rect fill="#F7F6F2" height="78" width="160" />
        <g fill="none" opacity="0.82" stroke="#263844" strokeWidth="1.5">
          <path d="M12 14h136v49H12zM56 14v49M104 14v49" />
          <path d={variant === "old" ? "M56 44h48" : "M56 44h22m12 0h14"} />
        </g>
        {variant === "new" ? (
          <rect
            fill="none"
            height="24"
            stroke="#D88916"
            strokeDasharray="5 3"
            width="42"
            x="70"
            y="32"
          />
        ) : null}
      </svg>
    </div>
  );
}

function LiveEvidenceImage({ change }: { change: SampleChange }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === change.evidenceUrl;

  if (!change.evidenceUrl || failed) {
    return failed ? (
      <div className="evidence-image-error" role="status">
        <ImageOff aria-hidden="true" size={18} />
        <span>
          Evidence preview could not load. The source drawings remain available in the viewer.
        </span>
      </div>
    ) : null;
  }

  return (
    <figure className="live-evidence-crop">
      <Image
        alt={`Before and revised evidence for change ${change.sequence}`}
        height={220}
        onError={() => setFailedUrl(change.evidenceUrl ?? null)}
        src={change.evidenceUrl}
        unoptimized
        width={640}
      />
      <figcaption>Before on left · revised on right</figcaption>
    </figure>
  );
}

export function ChangeLedger({
  changes,
  selectedId,
  filter,
  onFilterChange,
  onSelect,
}: {
  changes: SampleChange[];
  selectedId: string;
  filter: ChangeFilter;
  onFilterChange: (filter: ChangeFilter) => void;
  onSelect: (id: string) => void;
}) {
  const selected = changes.find((change) => change.id === selectedId) ?? changes[0];
  const filtered = filter === "all" ? changes : changes.filter((change) => change.kind === filter);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const row = rowRefs.current.get(selectedId);
    row?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  return (
    <aside aria-label="Change ledger" className="change-ledger">
      <div className="ledger-heading">
        <div>
          <p className="eyebrow">ANALYSIS RESULT</p>
          <h2>
            {changes.length} {changes.length === 1 ? "change" : "changes"} found
          </h2>
          <p>Select a change to see what PlanDelta detected.</p>
        </div>
        <ScanSearch aria-hidden="true" size={20} strokeWidth={1.6} />
      </div>

      <div aria-label="Filter changes" className="ledger-filters" role="group">
        {(["all", "added", "modified", "removed"] as ChangeFilter[]).map((value) => (
          <button
            aria-pressed={filter === value}
            key={value}
            onClick={() => onFilterChange(value)}
            type="button"
          >
            {value === "all"
              ? "All"
              : value === "modified"
                ? "Changed"
                : changeKindMeta[value].label}
          </button>
        ))}
      </div>

      <div className="ledger-list">
        {filtered.length > 0 ? (
          filtered.map((change) => {
            const meta = changeKindMeta[change.kind];
            const isSelected = selected?.id === change.id;

            return (
              <button
                aria-pressed={isSelected}
                className="ledger-row"
                key={change.id}
                onClick={() => onSelect(change.id)}
                ref={(node) => {
                  if (node) rowRefs.current.set(change.id, node);
                  else rowRefs.current.delete(change.id);
                }}
                style={{ borderLeftColor: meta.color }}
                type="button"
              >
                <span className="ledger-sequence">{String(change.sequence).padStart(2, "0")}</span>
                <span className="min-w-0 text-left">
                  <span className="ledger-row-meta">
                    <b style={{ color: meta.color }}>{meta.label}</b> ·{" "}
                    {change.category.replaceAll("_", " ")}
                  </span>
                  <strong>{sentenceCase(change.title)}</strong>
                  <span>Relevant to {change.trades.join(" and ")}</span>
                </span>
                <span className="technical text-[10px] text-[#646762]">
                  {Math.round(change.confidence * 100)}%
                </span>
              </button>
            );
          })
        ) : (
          <div className="ledger-empty">
            <Check aria-hidden="true" size={20} />
            <p>No {filter === "modified" ? "changed" : filter} items were detected.</p>
          </div>
        )}
      </div>

      {selected ? (
        <section aria-live="polite" className="change-detail">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">WHAT CHANGED · {String(selected.sequence).padStart(2, "0")}</p>
              <h3>{sentenceCase(selected.title)}</h3>
            </div>
            <span style={{ color: changeKindMeta[selected.kind].color }}>
              {changeKindMeta[selected.kind].label}
            </span>
          </div>

          {selected.evidenceUrl ? (
            <LiveEvidenceImage change={selected} />
          ) : (
            <div className="crop-pair">
              <EvidenceCrop label="Before" variant="old" />
              <EvidenceCrop label="Revised" variant="new" />
            </div>
          )}

          {selected.oldText || selected.newText ? (
            <dl className="detail-data">
              <div>
                <dt>Text before</dt>
                <dd>{selected.oldText ?? "Not present"}</dd>
              </div>
              <ArrowRight aria-hidden="true" size={14} />
              <div>
                <dt>Text in revised drawing</dt>
                <dd>{selected.newText ?? "Removed"}</dd>
              </div>
            </dl>
          ) : (
            <p className="geometry-change-note">
              Drawing geometry changed here; no text change was detected.
            </p>
          )}

          <div className="detail-metrics">
            <span>
              Detection confidence <b>{Math.round(selected.confidence * 100)}%</b>
            </span>
            <span>
              Relevant work <b>{selected.trades.join(", ")}</b>
            </span>
          </div>
          <p className="detail-impact">
            <strong>Review note</strong>
            {selected.impact}
          </p>
        </section>
      ) : null}
    </aside>
  );
}

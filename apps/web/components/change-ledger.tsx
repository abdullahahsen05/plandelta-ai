import { ArrowRight, Check, ScanSearch } from "lucide-react";

import { changeKindMeta, type ChangeKind, type SampleChange } from "../lib/sample-data";

export type ChangeFilter = "all" | ChangeKind;

function EvidenceCrop({ label, variant }: { label: string; variant: "old" | "new" }) {
  return (
    <div className="evidence-crop">
      <span>{label}</span>
      <svg aria-hidden="true" viewBox="0 0 160 78">
        <rect fill="#10263B" height="78" width="160" />
        <g fill="none" opacity="0.8" stroke="#DCE7EC" strokeWidth="1.5">
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

  return (
    <aside aria-label="Change ledger" className="change-ledger">
      <div className="ledger-heading">
        <div>
          <p className="eyebrow">CHANGE LEDGER</p>
          <h2>{changes.length} evidence regions</h2>
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
            {value === "all" ? "All" : changeKindMeta[value].label}
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
                style={{ borderLeftColor: meta.color }}
                type="button"
              >
                <span className="ledger-sequence">{String(change.sequence).padStart(2, "0")}</span>
                <span className="min-w-0 text-left">
                  <span className="ledger-row-meta">
                    <b style={{ color: meta.color }}>{meta.shortLabel}</b> {meta.label} ·{" "}
                    {change.category}
                  </span>
                  <strong>{change.title}</strong>
                  <span>{change.trades.join(" · ")}</span>
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
            <p>No {filter} regions in this sample.</p>
          </div>
        )}
      </div>

      {selected ? (
        <section aria-live="polite" className="change-detail">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">
                SELECTED EVIDENCE · {String(selected.sequence).padStart(2, "0")}
              </p>
              <h3>{selected.title}</h3>
            </div>
            <span style={{ color: changeKindMeta[selected.kind].color }}>
              {changeKindMeta[selected.kind].label}
            </span>
          </div>
          <div className="crop-pair">
            <EvidenceCrop label="Baseline crop" variant="old" />
            <EvidenceCrop label="Candidate crop" variant="new" />
          </div>
          <dl className="detail-data">
            <div>
              <dt>Baseline text</dt>
              <dd>{selected.oldText ?? "No matching text"}</dd>
            </div>
            <ArrowRight aria-hidden="true" size={14} />
            <div>
              <dt>Candidate text</dt>
              <dd>{selected.newText ?? "Element absent"}</dd>
            </div>
          </dl>
          <div className="detail-metrics">
            <span>
              Confidence <b>{Math.round(selected.confidence * 100)}%</b>
            </span>
            <span>
              Affected trades <b>{selected.trades.join(", ")}</b>
            </span>
          </div>
          <p className="detail-impact">{selected.impact}</p>
        </section>
      ) : null}
    </aside>
  );
}

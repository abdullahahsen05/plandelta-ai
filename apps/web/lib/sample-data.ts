export type ChangeKind = "added" | "modified" | "removed";

export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SampleChange = {
  id: string;
  sequence: number;
  title: string;
  kind: ChangeKind;
  category: string;
  confidence: number;
  trades: string[];
  oldText: string | null;
  newText: string | null;
  impact: string;
  box: NormalizedBox;
  evidenceUrl?: string | undefined;
};

export const changeKindMeta: Record<
  ChangeKind,
  { label: string; color: string; shortLabel: string }
> = {
  added: { label: "Added", shortLabel: "+", color: "#17845B" },
  modified: { label: "Modified", shortLabel: "±", color: "#D88916" },
  removed: { label: "Removed", shortLabel: "−", color: "#C53F3F" },
};

export const sampleChanges: SampleChange[] = [
  {
    id: "chg-wall-01",
    sequence: 1,
    title: "Conference room partition added",
    kind: "added",
    category: "Wall / linework",
    confidence: 0.94,
    trades: ["Framing", "Electrical"],
    oldText: "OPEN WORK 201",
    newText: "CONFERENCE 204",
    impact:
      "Review the new partition against the reflected ceiling plan and power layout before coordination.",
    box: { x: 0.17, y: 0.23, width: 0.22, height: 0.19 },
  },
  {
    id: "chg-door-02",
    sequence: 2,
    title: "Door swing and opening revised",
    kind: "modified",
    category: "Door",
    confidence: 0.89,
    trades: ["Doors / hardware", "Framing"],
    oldText: "D-204A",
    newText: "D-204B",
    impact: "Confirm handing, frame preparation, and clearance at the revised opening.",
    box: { x: 0.65, y: 0.46, width: 0.19, height: 0.16 },
  },
  {
    id: "chg-note-03",
    sequence: 3,
    title: "Keynote 07 wording changed",
    kind: "modified",
    category: "Text / note",
    confidence: 0.86,
    trades: ["General contractor"],
    oldText: "PATCH TO MATCH EXISTING",
    newText: "REMOVE AND REPLACE FINISH",
    impact:
      "The revised note may change the expected finish scope; verify it with the finish schedule.",
    box: { x: 0.41, y: 0.66, width: 0.25, height: 0.12 },
  },
  {
    id: "chg-fixture-04",
    sequence: 4,
    title: "Break-room sink removed",
    kind: "removed",
    category: "Fixture / symbol",
    confidence: 0.82,
    trades: ["Plumbing", "Casework"],
    oldText: "SK-1",
    newText: null,
    impact:
      "Check whether associated supply, waste, and casework requirements were removed elsewhere.",
    box: { x: 0.7, y: 0.7, width: 0.14, height: 0.13 },
  },
];

export const sampleProject = {
  id: "northline-office",
  name: "Northline Office Renovation",
  number: "PD-24017",
  location: "Built-in sample · non-client data",
  updatedAt: "17 Jul 2026",
  baseline: {
    label: "Baseline",
    revision: "Rev 03",
    sheet: "A2.14",
    title: "Level 02 floor plan",
    issuedAt: "08 Jul 2026",
    pages: 1,
  },
  candidate: {
    label: "Candidate",
    revision: "Rev 04",
    sheet: "A2.14",
    title: "Level 02 floor plan",
    issuedAt: "15 Jul 2026",
    pages: 1,
  },
  analysis: {
    id: "sample",
    status: "Complete",
    engine: "deterministic-sample@0.1.0",
    alignment: "Strong",
    reprojectionError: "1.8 px",
    completedAt: "16 Jul 2026 · 14:32",
    warning: "Precomputed evidence from committed, non-sensitive sample drawings.",
  },
} as const;

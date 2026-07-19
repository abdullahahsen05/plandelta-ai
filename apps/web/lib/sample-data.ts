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
    title: "Vertical partition line added",
    kind: "added",
    category: "Wall / linework",
    confidence: 0.94,
    trades: ["Framing", "Electrical"],
    oldText: null,
    newText: null,
    impact:
      "Review the new partition against the reflected ceiling plan and power layout before coordination.",
    box: { x: 0.635, y: 0.49, width: 0.025, height: 0.33 },
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
    box: { x: 0.29, y: 0.61, width: 0.08, height: 0.13 },
  },
  {
    id: "chg-note-03",
    sequence: 3,
    title: "Room label revised",
    kind: "modified",
    category: "Room label",
    confidence: 0.86,
    trades: ["General contractor"],
    oldText: "OFFICE 101",
    newText: "OFFICE 107",
    impact: "Verify the revised room identifier against schedules, signage, and MEP references.",
    box: { x: 0.15, y: 0.33, width: 0.26, height: 0.08 },
  },
  {
    id: "chg-fixture-04",
    sequence: 4,
    title: "Fixture symbol removed",
    kind: "removed",
    category: "Fixture / symbol",
    confidence: 0.82,
    trades: ["Plumbing", "Casework"],
    oldText: null,
    newText: null,
    impact:
      "Check whether associated supply, waste, and casework requirements were removed elsewhere.",
    box: { x: 0.78, y: 0.61, width: 0.09, height: 0.12 },
  },
];

export const sampleProject = {
  id: "northline-office",
  name: "Northline Office Renovation",
  number: "PD-24017",
  location: "Built-in sample · non-client data",
  updatedAt: "17 Jul 2026",
  analysisProfile: "CONSTRUCTION_DRAWING",
  profileLabel: "Construction drawing",
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

export const schematicSampleChanges: SampleChange[] = [
  {
    id: "sch-label-r2",
    sequence: 1,
    title: "R2 value label revised",
    kind: "modified",
    category: "Label",
    confidence: 0.93,
    trades: ["Electrical", "Controls", "Documentation"],
    oldText: "R2 4.7k",
    newText: "R2 10k",
    impact: "Verify the revised resistor value against the governing design calculation.",
    box: { x: 0.39, y: 0.57, width: 0.13, height: 0.1 },
  },
  {
    id: "sch-component-r3",
    sequence: 2,
    title: "R3 pull-down component and connections added",
    kind: "added",
    category: "Component / connection",
    confidence: 0.91,
    trades: ["Electrical", "Controls", "Instrumentation"],
    oldText: null,
    newText: "R3",
    impact: "Verify the component rating, signal-node connection, and 0 V termination.",
    box: { x: 0.58, y: 0.45, width: 0.1, height: 0.28 },
  },
  {
    id: "sch-note-revb",
    sequence: 3,
    title: "Revision note updated",
    kind: "modified",
    category: "Note",
    confidence: 0.89,
    trades: ["Engineering", "Documentation"],
    oldText: "REV A: ISSUED FOR REVIEW",
    newText: "REV B: ADD R3 PULL-DOWN",
    impact: "Confirm that the revision narrative matches the shown component and connections.",
    box: { x: 0.53, y: 0.84, width: 0.39, height: 0.06 },
  },
];

export const schematicSampleProject = {
  id: "control-loop-schematic",
  name: "Control Loop S-101",
  number: "PD-SCH-101",
  location: "Built-in synthetic schematic · non-client data",
  updatedAt: "19 Jul 2026",
  analysisProfile: "ENGINEERING_SCHEMATIC",
  profileLabel: "Engineering schematic",
  baseline: {
    label: "Baseline",
    revision: "Rev A",
    sheet: "S-101",
    title: "Control loop schematic",
    issuedAt: "12 Jul 2026",
    pages: 1,
  },
  candidate: {
    label: "Candidate",
    revision: "Rev B",
    sheet: "S-101",
    title: "Control loop schematic",
    issuedAt: "19 Jul 2026",
    pages: 1,
  },
  analysis: {
    id: "schematic-sample",
    status: "Complete",
    engine: "deterministic-sample@0.2.0",
    alignment: "Strong",
    reprojectionError: "0.0 px",
    completedAt: "19 Jul 2026 · 11:30",
    warning: "Precomputed evidence from committed synthetic schematic revisions.",
  },
} as const;

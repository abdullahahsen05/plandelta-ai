type ReportChange = {
  id: string;
  changeType: string;
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildDeterministicReport(
  changes: ReportChange[],
  profile: "CONSTRUCTION_DRAWING" | "ENGINEERING_SCHEMATIC" = "CONSTRUCTION_DRAWING",
) {
  const counts = changes.reduce<Record<string, number>>((result, change) => {
    result[change.changeType] = (result[change.changeType] ?? 0) + 1;
    return result;
  }, {});
  const executiveSummary =
    changes.length === 0
      ? "No material revision regions were detected within the configured tolerance."
      : `${changes.length} evidence-based revision region${changes.length === 1 ? " was" : "s were"} detected: ${Object.entries(
          counts,
        )
          .map(([type, count]) => `${count} ${titleCase(type)}`)
          .join(", ")}. Review each region against the source ${
          profile === "ENGINEERING_SCHEMATIC" ? "schematics" : "drawings"
        } before coordination.`;

  return {
    executiveSummary,
    structuredSummary: { counts, changeIds: changes.map((change) => change.id) },
  };
}

export interface DataSourceHeader {
  name: string;
  value: string;
}

export interface DataSourceSummary {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  errorSamples: string[];
}

export interface DataSourceResponse {
  id: string;
  name: string;
  url: string;
  headers: DataSourceHeader[];
  sheetName: string;
  tracking: "row" | "match";
  strategy: string | null;
  nameMatchMode: string | null;
  activateNew: boolean;
  titleColumn: string | null;
  nameColumn: string;
  rawPhoneColumn: string | null;
  emailColumn: string | null;
  activated: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastSummary: DataSourceSummary | null;
  syncSkipped: boolean;
}

export interface SheetPreview {
  columns: string[];
  heads: string[][];
}

export function summaryParts(counts: {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}): string[] {
  return [
    counts.added > 0 ? `${counts.added} added` : null,
    counts.updated > 0 ? `${counts.updated} updated` : null,
    counts.skipped > 0 ? `${counts.skipped} skipped` : null,
    counts.errors > 0 ? `${counts.errors} with errors` : null,
  ].filter((part) => part !== null);
}

const STRATEGY_LABELS: Record<string, string> = {
  smartMerge: "Smart Merge",
  overwrite: "Overwrite",
  skip: "Skip",
};

export function modeLabel(
  source: Pick<DataSourceResponse, "tracking" | "strategy" | "nameMatchMode">,
): string {
  if (source.tracking === "row") return "New record";
  const strategy = STRATEGY_LABELS[source.strategy ?? ""] ?? "Skip";
  const match =
    source.nameMatchMode === "fuzzy" ? "Similar names" : "Exact names";
  return `${strategy} · ${match}`;
}

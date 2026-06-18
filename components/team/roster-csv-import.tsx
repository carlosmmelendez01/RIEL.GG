"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  importRosterCsv,
  type ImportRosterCsvResult,
  type RosterCsvImportRow,
} from "@/lib/team/roster-actions";
import {
  normalizeRosterCsvHeader,
  prepareRosterCsvRows,
  ROSTER_CSV_MAX_BYTES,
  ROSTER_CSV_MAX_ROWS,
  type RosterCsvClientError,
} from "@/lib/team/roster-csv";
import { cn } from "@/lib/utils";

export function RosterCsvImportDialog({
  rosterId,
  competitionName,
}: {
  rosterId: string;
  competitionName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RosterCsvImportRow[]>([]);
  const [errors, setErrors] = useState<RosterCsvClientError[]>([]);
  const [result, setResult] = useState<ImportRosterCsvResult | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFile() {
    setFileName(null);
    setRows([]);
    setErrors([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function loadFile(file: File | undefined) {
    resetFile();
    if (!file) return;
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrors([{ sourceRow: null, field: "file", message: "Choose a .csv file." }]);
      return;
    }
    if (file.size > ROSTER_CSV_MAX_BYTES) {
      setErrors([{
        sourceRow: null,
        field: "file",
        message: "The CSV is too large. Keep it under 100 KB and 50 player rows.",
      }]);
      return;
    }

    Papa.parse<Record<string, string | undefined>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeRosterCsvHeader,
      complete: (parsed) => {
        const prepared = prepareRosterCsvRows(parsed.meta.fields ?? [], parsed.data);
        const parseErrors: RosterCsvClientError[] = parsed.errors.map((error) => ({
          sourceRow: typeof error.row === "number" ? error.row + 2 : null,
          field: "row",
          message: error.message,
        }));
        setRows(prepared.rows);
        setErrors([...parseErrors, ...prepared.errors]);
      },
      error: () => {
        setErrors([{
          sourceRow: null,
          field: "file",
          message: "ArcLight could not read this CSV. Export it again as UTF-8 CSV.",
        }]);
      },
    });
  }

  function handleImport() {
    if (rows.length === 0 || errors.length > 0) return;
    setResult(null);
    startTransition(async () => {
      const imported = await importRosterCsv({ rosterId, rows });
      setResult(imported);
      if (!imported.ok && imported.rowErrors) {
        setErrors(
          imported.rowErrors.map((error) => ({
            sourceRow: error.sourceRow,
            field: error.field,
            message: error.message,
          })),
        );
      }
      if (imported.ok) router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload data-icon="inline-start" />
        Import CSV
      </Button>

      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-[color:var(--brand-crimson)]" />
            Import roster CSV
          </DialogTitle>
          <DialogDescription>
            Add or update up to {ROSTER_CSV_MAX_ROWS} players on {competitionName}.
          </DialogDescription>
        </DialogHeader>

        {result?.ok ? (
          <ImportSuccess result={result} />
        ) : (
          <div className="space-y-4">
            <section className="space-y-3 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Set up the file</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Use one student per row and keep the header row in place.
                  </p>
                </div>
                <a
                  href="/arclight-roster-template.csv"
                  download
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <Download data-icon="inline-start" />
                  Download template
                </a>
              </div>

              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Column</th>
                      <th className="px-3 py-2 font-semibold">Required</th>
                      <th className="px-3 py-2 font-semibold">What to enter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <SetupRow column="full_name" required value="Student's full name" />
                    <SetupRow column="email" required value="Student's school or login email" />
                    <SetupRow column="in_game_name" value="IGN, Riot ID, gamertag, or player handle" />
                    <SetupRow column="role" value="PLAYER or CAPTAIN; blank becomes PLAYER" />
                    <SetupRow column="starter" value="yes or no; blank becomes yes" />
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <label
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  loadFile(event.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-5 py-6 text-center transition-colors",
                  dragging
                    ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/5"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => loadFile(event.target.files?.[0])}
                />
                <Upload className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {fileName ?? "Choose a CSV or drop it here"}
                </span>
                <span className="text-xs text-muted-foreground">UTF-8 CSV, up to 100 KB</span>
              </label>

              {errors.length > 0 ? <ImportErrors errors={errors} /> : null}
              {fileName && errors.length === 0 && rows.length > 0 ? (
                <RosterPreview rows={rows} onClear={resetFile} />
              ) : null}

              {result && !result.ok ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {result.error}
                </div>
              ) : null}
            </section>
          </div>
        )}

        <DialogFooter>
          {result?.ok ? (
            <Button type="button" onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={pending || rows.length === 0 || errors.length > 0}
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Upload data-icon="inline-start" />
                )}
                {pending
                  ? "Importing…"
                  : rows.length > 0
                    ? `Import ${rows.length} player${rows.length === 1 ? "" : "s"}`
                    : "Import players"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupRow({ column, required = false, value }: { column: string; required?: boolean; value: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-foreground">{column}</td>
      <td className="px-3 py-2 text-muted-foreground">{required ? "Yes" : "No"}</td>
      <td className="px-3 py-2 text-muted-foreground">{value}</td>
    </tr>
  );
}

function ImportErrors({ errors }: { errors: RosterCsvClientError[] }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
      <p className="flex items-center gap-1.5 font-semibold">
        <CircleAlert className="size-3.5" />
        Fix {errors.length} CSV issue{errors.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-1">
        {errors.slice(0, 8).map((error, index) => (
          <li key={`${error.sourceRow}-${error.field}-${index}`}>
            {error.sourceRow ? `Row ${error.sourceRow}, ` : ""}
            <span className="font-mono">{error.field}</span>: {error.message}
          </li>
        ))}
        {errors.length > 8 ? <li>And {errors.length - 8} more.</li> : null}
      </ul>
    </div>
  );
}

function RosterPreview({ rows, onClear }: { rows: RosterCsvImportRow[]; onClear: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          {rows.length} valid player{rows.length === 1 ? "" : "s"} ready
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={onClear}>
          <X data-icon="inline-start" />
          Clear
        </Button>
      </div>
      <div className="max-h-60 overflow-auto rounded-md border border-border/60">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Row</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">IGN</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Lineup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={`${row.sourceRow}-${row.email}`}>
                <td className="px-3 py-2 font-mono text-muted-foreground">{row.sourceRow}</td>
                <td className="max-w-40 truncate px-3 py-2 font-medium">{row.fullName}</td>
                <td className="max-w-52 truncate px-3 py-2 font-mono text-muted-foreground">{row.email}</td>
                <td className="max-w-36 truncate px-3 py-2 font-mono text-muted-foreground">{row.inGameName || "—"}</td>
                <td className="px-3 py-2">{row.role === "CAPTAIN" ? "Captain" : "Player"}</td>
                <td className="px-3 py-2">{row.isStarter ? "Starter" : "Sub"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportSuccess({ result }: { result: Extract<ImportRosterCsvResult, { ok: true }> }) {
  const [copied, setCopied] = useState(false);
  const unsent = result.invitations.filter((invite) => invite.delivery !== "SENT");

  function copyLinks() {
    const text = unsent.map((invite) => `${invite.email}: ${invite.url}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-4" />
        Roster import complete
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <ResultCount value={result.added} label="Added" />
        <ResultCount value={result.updated} label="Updated" />
        <ResultCount value={result.invited} label="Invited" />
      </div>
      {result.invited > 0 && unsent.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          New students were sent email-locked school invitations. Their roster spots are ready,
          and they must sign in with the same email to claim access.
        </p>
      ) : null}
      {unsent.length > 0 ? (
        <div className="space-y-2 border-t border-amber-500/30 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex max-w-xl items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {unsent.length} invitation email{unsent.length === 1 ? " was" : "s were"} not sent.
              Share the email-locked claim {unsent.length === 1 ? "link" : "links"} below.
            </p>
            <Button type="button" variant="outline" size="xs" onClick={copyLinks}>
              <Copy data-icon="inline-start" />
              {copied ? "Copied" : "Copy links"}
            </Button>
          </div>
          <div className="max-h-40 space-y-1 overflow-auto rounded-md bg-background/60 p-2">
            {unsent.map((invite) => (
              <div key={invite.email} className="grid gap-0.5 border-b border-border/40 py-1.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_2fr] sm:gap-3">
                <span className="truncate font-mono text-[11px]">{invite.email}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">{invite.url}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultCount({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2 py-2">
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

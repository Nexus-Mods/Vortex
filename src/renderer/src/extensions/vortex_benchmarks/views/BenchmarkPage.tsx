/**
 * Benchmark Page
 * Only visible in development mode
 */

import { getErrorMessage } from "@vortex/shared";
import React, { useCallback, useRef, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { benchmarks } from "../benchmarks";
import type { IBenchmark } from "../types";

interface IBenchmarkPageProps {
  /** Whether the page is the one showing, which its `Page` needs. */
  active?: boolean;
}

const defaultOptions = (benchmark: IBenchmark): Record<string, string | number> =>
  Object.fromEntries(benchmark.options.map((option) => [option.id, option.default]));

export const BenchmarkPage = ({ active }: IBenchmarkPageProps) => {
  const [benchmark, setBenchmark] = useState(benchmarks[0]);
  const [options, setOptions] = useState(() => defaultOptions(benchmarks[0]));
  const [records, setRecords] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController>(undefined);

  const select = useCallback((next: IBenchmark) => {
    setBenchmark(next);
    setOptions(defaultOptions(next));
    setRecords([]);
    setError(undefined);
  }, []);

  const run = useCallback(() => {
    const abort = new AbortController();
    controller.current = abort;
    setRecords([]);
    setError(undefined);
    setRunning(true);

    benchmark
      .run({
        options,
        signal: abort.signal,
        report: (record) => setRecords((prev) => [...prev, JSON.stringify(record)]),
      })
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setRunning(false));
  }, [benchmark, options]);

  const selectDirectory = useCallback(async (id: string) => {
    const result = await window.api.dialog.showOpen({ properties: ["openDirectory"] });
    const selected = result.filePaths?.[0];
    if (selected !== undefined) {
      setOptions((prev) => ({ ...prev, [id]: selected }));
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(records.join("\n"));
  }, [records]);

  return (
    <Page active={active} pageId="vortex-benchmarks" scrollable={false}>
      <PageHeader
        pictogramName="tools"
        subtitle="This page is only visible in development mode."
        title="Benchmarks"
      />

      <PageScroll className="space-y-6 p-6">
        {benchmarks.length > 1 && (
          <div className="flex gap-2">
            {benchmarks.map((candidate) => (
              <Button
                key={candidate.id}
                appearance={candidate.id === benchmark.id ? "strong" : "weak"}
                brand="neutral"
                disabled={running}
                onClick={() => select(candidate)}
              >
                {candidate.name}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <Typography as="h2" typographyType="heading-md">
            {benchmark.name}
          </Typography>
          <Typography>{benchmark.description}</Typography>

          {benchmark.options.map((option) =>
            option.type === "directory" ? (
              <div key={option.id} className="flex items-center gap-4">
                <Button
                  appearance="weak"
                  brand="neutral"
                  disabled={running}
                  onClick={() => void selectDirectory(option.id)}
                >
                  {option.label}
                </Button>
                <Typography>{String(options[option.id]) || "No directory selected"}</Typography>
              </div>
            ) : (
              <TextField
                key={option.id}
                disabled={running}
                label={option.label}
                type={option.type}
                value={options[option.id]}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    [option.id]:
                      option.type === "number" ? Number(event.target.value) : event.target.value,
                  }))
                }
              />
            ),
          )}

          <div className="flex gap-2">
            <Button disabled={running} isLoading={running} onClick={run}>
              Run
            </Button>
            <Button appearance="weak" brand="neutral" disabled={!running} onClick={cancel}>
              Cancel
            </Button>
            <Button
              appearance="weak"
              brand="neutral"
              disabled={records.length === 0}
              onClick={copy}
            >
              Copy as JSON lines
            </Button>
          </div>
        </div>

        {error !== undefined && <Typography>{`Failed: ${error}`}</Typography>}

        {records.length > 0 && (
          <pre className="overflow-x-auto rounded p-4 text-xs">{records.join("\n")}</pre>
        )}
      </PageScroll>
    </Page>
  );
};

export default BenchmarkPage;

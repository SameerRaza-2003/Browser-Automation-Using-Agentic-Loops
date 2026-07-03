"use client";

import { FormEvent, useMemo, useState } from "react";

const defaultTemplate =
  "Navigate to {url}. Fill the registration form using the provided customer data. If the form contains additional required fields that are not present in the customer data, generate realistic placeholder values. Leave optional fields blank when appropriate. Complete and submit the form.";

type PipelineState = {
  sql_question: string;
  browser_goal_template: string;
  target_url: string;
  customer_data: Record<string, unknown> | null;
  browser_result: string | null;
};

type RunResponse = {
  state?: PipelineState;
  logs?: string;
  error?: string;
  stderr?: string;
  stdout?: string;
  durationMs?: number;
};

type TraceItem = {
  title: string;
  body: string;
  tone: "sql" | "browser" | "system" | "error";
};

function sectionBetween(logs: string, start: string, end?: string) {
  const startIndex = logs.indexOf(start);
  if (startIndex === -1) {
    return "";
  }

  const contentStart = startIndex + start.length;
  const endIndex = end ? logs.indexOf(end, contentStart) : -1;
  return logs
    .slice(contentStart, endIndex === -1 ? undefined : endIndex)
    .trim();
}

function parseTrace(rawLogs = "", error?: string): TraceItem[] {
  const items: TraceItem[] = [];
  const chunks = rawLogs
    .split(/\n(?========== )/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/^=+\s*([^=\n]+?)\s*=+/);
    const title = titleMatch?.[1]?.trim() || "Agent trace";
    const lowerTitle = title.toLowerCase();
    const tone = lowerTitle.includes("sql")
      ? "sql"
      : lowerTitle.includes("browser") || lowerTitle.includes("agent trace")
        ? "browser"
        : "system";

    items.push({
      title,
      body: chunk.replace(/^=+\s*[^=\n]+?\s*=+\s*/, "").trim(),
      tone,
    });
  }

  if (error) {
    items.unshift({
      title: "Pipeline Error",
      body: error,
      tone: "error",
    });
  }

  return items;
}

function formatDuration(durationMs?: number) {
  if (!durationMs) {
    return "Not run";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Custom target";
  }
}

function FieldIcon({ label }: { label: string }) {
  return (
    <span className="fieldIcon" aria-hidden="true">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function Home() {
  const [sqlQuestion, setSqlQuestion] = useState(
    "Get all details for the customer named Ayesha Khan",
  );
  const [targetUrl, setTargetUrl] = useState(
    "https://demoqa.com/automation-practice-form",
  );
  const [browserGoalTemplate, setBrowserGoalTemplate] =
    useState(defaultTemplate);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const customerRows = useMemo(() => {
    const customer = result?.state?.customer_data;
    return customer ? Object.entries(customer) : [];
  }, [result]);

  const rawLogs = result?.logs || result?.stderr || result?.stdout || "";
  const generatedSql = sectionBetween(
    rawLogs,
    "========== GENERATED SQL ==========",
    "========== EXECUTING SQL ==========",
  );
  const sqlExecution = sectionBetween(
    rawLogs,
    "========== EXECUTING SQL ==========",
    "========== BROWSER AGENT ==========",
  );
  const traceItems = parseTrace(rawLogs, result?.error);
  const hasResult = Boolean(result?.state || result?.error);

  async function runPipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sqlQuestion,
          targetUrl,
          browserGoalTemplate,
        }),
      });
      const payload = (await response.json()) as RunResponse;
      setResult(payload);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="shell">
      <div className="ambientGrid" aria-hidden="true" />
      <section className="workspace">
        <header className="hero">
          <div>
            <p className="eyebrow">Agentic Browser Automation</p>
            <h1>Browser Automation Using Agentic Loops</h1>
            <p className="heroCopy">
              Run the LangGraph pipeline, inspect the SQL decision, then watch
              the browser agent trace from one focused dashboard.
            </p>
          </div>
          <div className="heroMeta">
            <div className="modelPill">OpenRouter · qwen-plus</div>
            <div className="runStatus" data-state={isRunning ? "running" : hasResult ? "done" : "idle"}>
              <span />
              {isRunning ? "Running" : hasResult ? "Result ready" : "Idle"}
            </div>
          </div>
        </header>

        <section className="summaryStrip">
          <div>
            <span>Pipeline</span>
            <strong>SQL lookup → browser form fill</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{hostnameFromUrl(targetUrl)}</strong>
          </div>
          <div>
            <span>Runtime</span>
            <strong>{formatDuration(result?.durationMs)}</strong>
          </div>
          <div>
            <span>Rows</span>
            <strong>{customerRows.length ? "1 customer" : "Waiting"}</strong>
          </div>
        </section>

        <section className="mainGrid">
          <form className="controlPanel" onSubmit={runPipeline}>
            <div className="panelTitle">
              <div>
                <p className="sectionKicker">Control</p>
                <h2>Run Configuration</h2>
              </div>
              <button disabled={isRunning} type="submit">
                {isRunning ? "Running..." : "Run Pipeline"}
              </button>
            </div>

            <label>
              <span>Customer query</span>
              <input
                value={sqlQuestion}
                onChange={(event) => setSqlQuestion(event.target.value)}
              />
            </label>

            <label>
              <span>Target URL</span>
              <input
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
              />
            </label>

            <label>
              <span>Browser goal template</span>
              <textarea
                value={browserGoalTemplate}
                onChange={(event) => setBrowserGoalTemplate(event.target.value)}
                rows={8}
              />
            </label>
          </form>

          <aside className="executionPanel">
            <div className="panelTitle">
              <div>
                <p className="sectionKicker">Live Trace</p>
                <h2>Execution Timeline</h2>
              </div>
              <span className="countBadge">{traceItems.length || 0} events</span>
            </div>
            <div className="timeline">
              {traceItems.length ? (
                traceItems.slice(0, 8).map((item, index) => (
                  <article className="traceCard" data-tone={item.tone} key={`${item.title}-${index}`}>
                    <div className="traceMarker">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <h3>{item.title}</h3>
                      <pre>{item.body || "Trace checkpoint reached."}</pre>
                    </div>
                  </article>
                ))
              ) : (
                <div className="emptyTrace">
                  <span />
                  <p>Trace events will appear here after the first run.</p>
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="resultsGrid">
          <div className="panel">
            <div className="panelTitle compact">
              <div>
                <p className="sectionKicker">SQLite</p>
                <h2>Generated SQL</h2>
              </div>
              <span className="countBadge">{generatedSql ? "Ready" : "Pending"}</span>
            </div>
            <pre className="sqlBox">{generatedSql || "SELECT query will appear here."}</pre>
            <pre className="miniLog">{sqlExecution || "Execution response will appear here."}</pre>
          </div>

          <div className="panel">
            <div className="panelTitle compact">
              <div>
                <p className="sectionKicker">Customer</p>
                <h2>Resolved Record</h2>
              </div>
              <span className="countBadge">{customerRows.length ? "Loaded" : "Waiting"}</span>
            </div>
            <dl className="dataList">
              {customerRows.length ? (
                customerRows.map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      <FieldIcon label={key} />
                      {key.replaceAll("_", " ")}
                    </dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))
              ) : (
                <p className="muted">Run the pipeline to fetch a customer.</p>
              )}
            </dl>
          </div>
        </section>

        <section className="browserPanel">
          <div className="panelTitle">
            <div>
              <p className="sectionKicker">Playwright MCP</p>
              <h2>Browser Agent Result</h2>
            </div>
            <span className="countBadge">
              {result?.state?.browser_result ? "Complete" : "Idle"}
            </span>
          </div>
          <pre className="resultText">
            {result?.state?.browser_result ||
              result?.error ||
              "The browser agent summary will appear here after the form run."}
          </pre>
        </section>
      </section>
    </main>
  );
}

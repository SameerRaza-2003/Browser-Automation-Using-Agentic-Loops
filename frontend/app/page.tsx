"use client";

import { FormEvent, useMemo, useState } from "react";

const defaultPrompt =
  "Get all details for the customer named Sameer Raza Malik. Fill the registration form using the provided customer data. IMPORTANT: The target form's State and City dropdowns only contain Indian states. Do NOT fill the State and City fields; skip them entirely. If the form contains additional required fields that are not present in the customer data, generate realistic placeholder values. Leave optional fields blank when appropriate. Complete and submit the form.";

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

type AgentStage = {
  id: string;
  label: string;
  icon: string;
  status: "idle" | "running" | "done" | "error";
  detail: string;
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

function deriveAgentStages(
  isRunning: boolean,
  rawLogs: string,
  result: RunResponse | null,
): AgentStage[] {
  const hasError = Boolean(result?.error);
  const hasSql = rawLogs.includes("GENERATED SQL");
  const hasSqlExec = rawLogs.includes("EXECUTING SQL");
  const hasBrowser = rawLogs.includes("BROWSER AGENT");
  const hasBrowserResult = Boolean(result?.state?.browser_result);
  const hasCustomer = Boolean(result?.state?.customer_data);

  const generatedSql = sectionBetween(
    rawLogs,
    "========== GENERATED SQL ==========",
    "========== EXECUTING SQL ==========",
  );

  // --- Orchestrator ---
  let orchStatus: AgentStage["status"] = "idle";
  let orchDetail = "Waiting to start pipeline…";
  if (hasError && !hasSql) {
    orchStatus = "error";
    orchDetail = "Pipeline failed before SQL generation.";
  } else if (hasBrowserResult || (hasCustomer && !isRunning)) {
    orchStatus = "done";
    orchDetail = "Pipeline complete. All agents finished.";
  } else if (isRunning) {
    orchStatus = "running";
    orchDetail = "Coordinating agents…";
  }

  // --- SQL Agent ---
  let sqlStatus: AgentStage["status"] = "idle";
  let sqlDetail = "Waiting for orchestrator…";
  if (hasError && hasSql && !hasCustomer) {
    sqlStatus = "error";
    sqlDetail = result?.error?.includes("No matching customer")
      ? "No matching customer found."
      : "SQL execution failed.";
  } else if (hasCustomer) {
    sqlStatus = "done";
    sqlDetail = generatedSql
      ? `Executed: ${generatedSql.slice(0, 80)}${generatedSql.length > 80 ? "…" : ""}`
      : "Query executed — customer resolved.";
  } else if (hasSql && isRunning) {
    sqlStatus = "running";
    sqlDetail = hasSqlExec ? "Executing query…" : "Generating SQL…";
  } else if (isRunning) {
    sqlStatus = "running";
    sqlDetail = "Generating SQL from natural language…";
  }

  // --- Browser Agent ---
  let browserStatus: AgentStage["status"] = "idle";
  let browserDetail = "Waiting for customer data…";
  if (hasError && hasBrowser) {
    browserStatus = "error";
    browserDetail = "Browser agent encountered an error.";
  } else if (hasBrowserResult) {
    browserStatus = "done";
    const txt = result?.state?.browser_result || "";
    browserDetail = txt.slice(0, 100) + (txt.length > 100 ? "…" : "");
  } else if (hasBrowser && isRunning) {
    browserStatus = "running";
    browserDetail = "Automating browser form fill…";
  } else if (hasCustomer && isRunning) {
    browserStatus = "running";
    browserDetail = "Launching Playwright browser…";
  }

  return [
    { id: "orchestrator", label: "Orchestrator", icon: "🧠", status: orchStatus, detail: orchDetail },
    { id: "sql", label: "SQL Agent", icon: "🗄️", status: sqlStatus, detail: sqlDetail },
    { id: "browser", label: "Browser Agent", icon: "🌐", status: browserStatus, detail: browserDetail },
  ];
}

export default function Home() {
  const [userPrompt, setUserPrompt] = useState(defaultPrompt);
  const [targetUrl, setTargetUrl] = useState(
    "https://demoqa.com/automation-practice-form",
  );
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
  const hasResult = Boolean(result?.state || result?.error);
  const agentStages = deriveAgentStages(isRunning, rawLogs, result);

  async function runPipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt,
          targetUrl,
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
            <p className="eyebrow">Multi-Agent System</p>
            <h1>Browser Automation Using Agentic Loops</h1>
            <p className="heroCopy">
              A multi-agent pipeline powered by LangGraph — the Orchestrator
              coordinates the SQL Agent and Browser Agent to automate
              end-to-end form filling.
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
            <span>Architecture</span>
            <strong>Multi-Agent Pipeline</strong>
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
            <span>Agents</span>
            <strong>{agentStages.filter(s => s.status === "done").length} / {agentStages.length} completed</strong>
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
                {isRunning ? "Running…" : "Run Pipeline"}
              </button>
            </div>

            <label>
              <span>Orchestrator prompt</span>
              <textarea
                value={userPrompt}
                onChange={(event) => setUserPrompt(event.target.value)}
                rows={8}
              />
            </label>

            <label>
              <span>Target URL</span>
              <input
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
              />
            </label>
          </form>

          <aside className="executionPanel">
            <div className="panelTitle">
              <div>
                <p className="sectionKicker">Agent Flow</p>
                <h2>Execution Timeline</h2>
              </div>
              <span className="countBadge">
                {agentStages.filter(s => s.status === "done").length} / {agentStages.length} agents
              </span>
            </div>
            <div className="agentFlow">
              {agentStages.map((stage, index) => (
                <div key={stage.id}>
                  <article className="agentNode" data-status={stage.status} data-agent={stage.id}>
                    <div className="agentNodeHeader">
                      <span className="agentIcon">{stage.icon}</span>
                      <div>
                        <h3>{stage.label}</h3>
                        <span className="agentStatusBadge" data-status={stage.status}>
                          {stage.status === "idle" && "Pending"}
                          {stage.status === "running" && "Running"}
                          {stage.status === "done" && "Complete"}
                          {stage.status === "error" && "Failed"}
                        </span>
                      </div>
                    </div>
                    <p className="agentDetail">{stage.detail}</p>
                    {stage.status === "running" && (
                      <div className="agentProgress">
                        <div className="agentProgressBar" />
                      </div>
                    )}
                  </article>
                  {index < agentStages.length - 1 && (
                    <div className="agentConnector" data-active={stage.status === "done" ? "true" : "false"}>
                      <svg width="24" height="32" viewBox="0 0 24 32">
                        <path d="M12 0 L12 24 L6 18 M12 24 L18 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
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

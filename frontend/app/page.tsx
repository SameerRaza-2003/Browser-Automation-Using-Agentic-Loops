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
};

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
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">VisionRD</p>
            <h1>Agent Console</h1>
          </div>
          <div className="modelPill">OpenRouter: qwen-plus</div>
        </header>

        <form className="controlPanel" onSubmit={runPipeline}>
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
              rows={5}
            />
          </label>

          <button disabled={isRunning} type="submit">
            {isRunning ? "Running pipeline..." : "Run pipeline"}
          </button>
        </form>

        <section className="resultsGrid">
          <div className="panel">
            <div className="panelHeader">
              <h2>Customer Data</h2>
              <span>{customerRows.length ? "Loaded" : "Waiting"}</span>
            </div>
            <dl className="dataList">
              {customerRows.length ? (
                customerRows.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))
              ) : (
                <p className="muted">Run the pipeline to fetch a customer.</p>
              )}
            </dl>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>Browser Result</h2>
              <span>{result?.state?.browser_result ? "Complete" : "Idle"}</span>
            </div>
            <pre className="resultText">
              {result?.state?.browser_result ||
                result?.error ||
                "The browser agent summary will appear here."}
            </pre>
          </div>
        </section>

        <section className="logs">
          <div className="panelHeader">
            <h2>Trace</h2>
            <span>{result?.logs || result?.stderr ? "Captured" : "Quiet"}</span>
          </div>
          <pre>{result?.logs || result?.stderr || result?.stdout || ""}</pre>
        </section>
      </section>
    </main>
  );
}

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

type RunBody = {
  sqlQuestion?: string;
  targetUrl?: string;
  browserGoalTemplate?: string;
};

function pythonCommand(projectRoot: string) {
  if (process.env.PYTHON_BIN) {
    return process.env.PYTHON_BIN;
  }

  if (process.platform === "win32") {
    return path.join(projectRoot, ".venv", "Scripts", "python.exe");
  }

  return path.join(projectRoot, ".venv", "bin", "python");
}

export async function POST(request: Request) {
  const body = (await request.json()) as RunBody;
  const startedAt = Date.now();

  if (!body.sqlQuestion || !body.targetUrl || !body.browserGoalTemplate) {
    return NextResponse.json(
      { error: "sqlQuestion, targetUrl, and browserGoalTemplate are required." },
      { status: 400 },
    );
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const scriptPath = path.join(projectRoot, "orchestrator.py");

  try {
    const { stdout, stderr } = await execFileAsync(
      pythonCommand(projectRoot),
      [
        scriptPath,
        "--json",
        "--sql-question",
        body.sqlQuestion,
        "--target-url",
        body.targetUrl,
        "--browser-goal-template",
        body.browserGoalTemplate,
      ],
      {
        cwd: projectRoot,
        env: process.env,
        maxBuffer: 1024 * 1024 * 8,
        timeout: 1000 * 60 * 10,
      },
    );

    return NextResponse.json({
      state: JSON.parse(stdout),
      logs: stderr,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const err = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return NextResponse.json(
      {
        error: err.message,
        stdout: err.stdout,
        stderr: err.stderr,
        code: err.code,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

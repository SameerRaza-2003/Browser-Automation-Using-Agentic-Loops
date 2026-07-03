import os
import argparse
import asyncio
import contextlib
import json
import sys
from typing import Optional, TypedDict

from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from langchain_openai import ChatOpenAI

from browser_agent import run_browser_agent
from sql_agent import run_sql_agent

load_dotenv()

llm = ChatOpenAI(
    model=os.getenv("OPENROUTER_MODEL", "qwen/qwen-plus-2025-07-28"),
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    temperature=0,
    default_headers={
        "HTTP-Referer": "http://localhost",
        "X-Title": "Browser Automation Using Agentic Loops",
    },
)

class PipelineState(TypedDict):
    user_prompt: str
    target_url: str
    sql_question: Optional[str]
    browser_goal_template: Optional[str]
    customer_data: Optional[dict]
    browser_result: Optional[str]


def analyze_prompt_node(state: PipelineState) -> PipelineState:
    print("\n========== ORCHESTRATOR AGENT ==========")
    prompt = f"""
You are an orchestrator agent. The user wants to automate a browser task that requires fetching customer data first.
Your job is to split the user's prompt into two distinct parts:
1. 'sql_question': A question to query the database and get customer details. Keep it focused on the customer name/identity.
2. 'browser_goal_template': Instructions for the browser agent to fill a form using the retrieved customer data. It MUST start with "Navigate to {{url}}." and include any specific form-filling instructions from the prompt. Ensure you leave the exact literal string "{{url}}" (with curly braces) in the template.

User Prompt:
{state["user_prompt"]}

Return ONLY a valid JSON object with keys 'sql_question' and 'browser_goal_template'. No markdown or explanation.
"""
    response = llm.invoke(prompt)
    content = response.content.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {
            "sql_question": "Get all details for the customer",
            "browser_goal_template": "Navigate to {url}. Fill the form."
        }
    
    print(f"\nDeduced SQL Question:\n{parsed.get('sql_question')}")
    print(f"\nDeduced Browser Goal:\n{parsed.get('browser_goal_template')}")
    
    return {
        **state,
        "sql_question": parsed.get("sql_question"),
        "browser_goal_template": parsed.get("browser_goal_template"),
    }


def fetch_data_node(state: PipelineState) -> PipelineState:
    print("\n========== SQL AGENT ==========")

    rows = run_sql_agent(state["sql_question"])

    if not rows:
        raise ValueError("No matching customer found.")

    print("\nCustomer Retrieved:")
    print(rows[0])

    return {
        **state,
        "customer_data": rows[0],
    }


def fill_form_node(state: PipelineState) -> PipelineState:
    print("\n========== BROWSER AGENT ==========")

    goal = state["browser_goal_template"].format(
        url=state["target_url"]
    )

    try:
        result = asyncio.run(
            run_browser_agent(
                goal,
                state["customer_data"],
            )
        )
    except Exception as e:
        result = f"Browser Agent Failed: {e}"

    return {
        **state,
        "browser_result": result,
    }


def build_pipeline_graph():
    graph = StateGraph(PipelineState)

    graph.add_node("analyze_prompt", analyze_prompt_node)
    graph.add_node("fetch_data", fetch_data_node)
    graph.add_node("fill_form", fill_form_node)

    graph.set_entry_point("analyze_prompt")

    graph.add_edge("analyze_prompt", "fetch_data")
    graph.add_edge("fetch_data", "fill_form")
    graph.add_edge("fill_form", END)

    return graph.compile()


def run_pipeline(
    user_prompt: str,
    target_url: str,
) -> PipelineState:

    graph = build_pipeline_graph()

    return graph.invoke(
        {
            "user_prompt": user_prompt,
            "target_url": target_url,
            "sql_question": None,
            "browser_goal_template": None,
            "customer_data": None,
            "browser_result": None,
        }
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the agentic browser automation pipeline.")
    parser.add_argument(
        "--user-prompt",
        default="Get all details for the customer named Sameer Raza Malik. Fill the registration form using the provided customer data. IMPORTANT: The target form's State and City dropdowns only contain Indian states. Do NOT fill the State and City fields; skip them entirely. If the form contains additional required fields that are not present in the customer data, generate realistic placeholder values. Leave optional fields blank when appropriate. Complete and submit the form.",
    )
    parser.add_argument(
        "--target-url",
        default="https://demoqa.com/automation-practice-form",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the final pipeline state as JSON.",
    )
    args = parser.parse_args()

    if args.json:
        with contextlib.redirect_stdout(sys.stderr):
            final_state = run_pipeline(
                user_prompt=args.user_prompt,
                target_url=args.target_url,
            )
    else:
        final_state = run_pipeline(
            user_prompt=args.user_prompt,
            target_url=args.target_url,
        )

    if args.json:
        print(json.dumps(final_state, indent=2))
    else:
        print("\n========== FINAL RESULT ==========")

        print("\nCustomer Data:")
        print(final_state["customer_data"])

        print("\nBrowser Result:")
        print(final_state["browser_result"])

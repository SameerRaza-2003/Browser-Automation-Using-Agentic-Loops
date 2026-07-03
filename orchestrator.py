import argparse
import asyncio
import contextlib
import json
import sys
from typing import Optional, TypedDict

from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

from browser_agent import run_browser_agent
from sql_agent import run_sql_agent

load_dotenv()


class PipelineState(TypedDict):
    sql_question: str
    browser_goal_template: str
    target_url: str
    customer_data: Optional[dict]
    browser_result: Optional[str]


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

    graph.add_node("fetch_data", fetch_data_node)
    graph.add_node("fill_form", fill_form_node)

    graph.set_entry_point("fetch_data")

    graph.add_edge("fetch_data", "fill_form")
    graph.add_edge("fill_form", END)

    return graph.compile()


def run_pipeline(
    sql_question: str,
    target_url: str,
    browser_goal_template: str,
) -> PipelineState:

    graph = build_pipeline_graph()

    return graph.invoke(
        {
            "sql_question": sql_question,
            "browser_goal_template": browser_goal_template,
            "target_url": target_url,
            "customer_data": None,
            "browser_result": None,
        }
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the VisionRD agent pipeline.")
    parser.add_argument(
        "--sql-question",
        default="Get all details for the customer named Ayesha Khan",
    )
    parser.add_argument(
        "--target-url",
        default="https://demoqa.com/automation-practice-form",
    )
    parser.add_argument(
        "--browser-goal-template",
        default=(
            "Navigate to {url}. "
            "Fill the registration form using the provided customer data. "
            "If the form contains additional required fields that are not present "
            "in the customer data, generate realistic placeholder values. "
            "Leave optional fields blank when appropriate. "
            "Complete and submit the form."
        ),
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
                sql_question=args.sql_question,
                target_url=args.target_url,
                browser_goal_template=args.browser_goal_template,
            )
    else:
        final_state = run_pipeline(
            sql_question=args.sql_question,
            target_url=args.target_url,
            browser_goal_template=args.browser_goal_template,
        )

    if args.json:
        print(json.dumps(final_state, indent=2))
    else:
        print("\n========== FINAL RESULT ==========")

        print("\nCustomer Data:")
        print(final_state["customer_data"])

        print("\nBrowser Result:")
        print(final_state["browser_result"])

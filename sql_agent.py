import json
import os
import sqlite3
import sys
from typing import Optional, TypedDict

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

load_dotenv()

DB_PATH = "customers.db"
MAX_RETRIES = 3
DEFAULT_OPENROUTER_MODEL = "qwen/qwen-plus-2025-07-28"

SCHEMA_DESCRIPTION = """
Table: customers
Columns:
  id INTEGER PRIMARY KEY
  first_name TEXT
  last_name TEXT
  email TEXT
  gender TEXT
  mobile TEXT
  date_of_birth TEXT
  address TEXT
  state TEXT
  city TEXT
  subjects TEXT
  hobbies TEXT
"""

llm = ChatOpenAI(
    model=os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL),
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    temperature=0,
    default_headers={
        "HTTP-Referer": "http://localhost",
        "X-Title": "Browser Automation Using Agentic Loops",
    },
)


class SQLAgentState(TypedDict):
    question: str
    sql_query: Optional[str]
    result: Optional[list]
    error: Optional[str]
    retry_count: int


def generate_sql(state: SQLAgentState) -> SQLAgentState:
    error_context = ""

    if state.get("error"):
        error_context = f"""
Previous Query:
{state["sql_query"]}

Database Error:
{state["error"]}

Generate a corrected SQLite query.
"""

    prompt = f"""
You are an expert SQLite engineer.

Database Schema:

{SCHEMA_DESCRIPTION}

Convert the user's request into exactly one SQLite SELECT query.

Rules:
- Return ONLY SQL.
- No markdown.
- No explanation.
- Never generate INSERT, UPDATE, DELETE, DROP, ALTER or CREATE.
- Use only the schema provided.
- If searching by a person's name, use first_name and last_name.

User Question:
{state["question"]}

{error_context}
"""

    response = llm.invoke(prompt)

    sql = response.content.strip()
    sql = sql.replace("```sql", "").replace("```", "").strip()

    print("\n========== GENERATED SQL ==========")
    print(sql)

    return {
        **state,
        "sql_query": sql,
        "error": None,
    }


def execute_sql(state: SQLAgentState) -> SQLAgentState:
    try:
        print("\n========== EXECUTING SQL ==========")
        print(state["sql_query"])

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()
        cursor.execute(state["sql_query"])

        rows = [dict(row) for row in cursor.fetchall()]

        conn.close()

        print(f"\nRows Returned: {len(rows)}")

        return {
            **state,
            "result": rows,
            "error": None,
        }

    except Exception as e:
        return {
            **state,
            "result": None,
            "error": str(e),
            "retry_count": state["retry_count"] + 1,
        }


def should_retry(state: SQLAgentState) -> str:
    if state.get("error") and state["retry_count"] < MAX_RETRIES:
        return "retry"

    return "done"


def build_sql_agent_graph():
    graph = StateGraph(SQLAgentState)

    graph.add_node("generate_sql", generate_sql)
    graph.add_node("execute_sql", execute_sql)

    graph.set_entry_point("generate_sql")

    graph.add_edge("generate_sql", "execute_sql")

    graph.add_conditional_edges(
        "execute_sql",
        should_retry,
        {
            "retry": "generate_sql",
            "done": END,
        },
    )

    return graph.compile()


def run_sql_agent(question: str) -> list:
    graph = build_sql_agent_graph()

    final_state = graph.invoke(
        {
            "question": question,
            "sql_query": None,
            "result": None,
            "error": None,
            "retry_count": 0,
        }
    )

    if final_state.get("error"):
        raise RuntimeError(
            f"SQL Agent failed after {MAX_RETRIES} retries.\n"
            f"Last Error: {final_state['error']}"
        )

    return final_state["result"]


if __name__ == "__main__":
    question = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Get all details for the customer named Ayesha Khan"
    )

    print("\n========== SQL AGENT ==========")
    print(f"\nQuestion:\n{question}")

    result = run_sql_agent(question)

    print("\n========== RESULT ==========")
    print(json.dumps(result, indent=2))

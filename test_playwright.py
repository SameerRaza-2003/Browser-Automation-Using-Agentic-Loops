import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient


async def check(step, func):
    print(f"\n{'=' * 70}")
    print(step)
    print("=" * 70)

    try:
        result = await func()
        print("✅ PASS")
        print(result)
        return result
    except Exception as e:
        print("❌ FAIL")
        print(e)
        raise


async def main():
    print("\nPLAYWRIGHT MCP FULL DIAGNOSTIC")

    client = MultiServerMCPClient(
        {
            "playwright": {
                "command": "npx",
                "args": ["@playwright/mcp@latest"],
                "transport": "stdio",
            }
        }
    )

    tools = await client.get_tools()
    tool_map = {tool.name: tool for tool in tools}

    print(f"\nLoaded {len(tools)} tools")

    print("\nTools:")
    for tool in tools:
        print("-", tool.name)

    await check(
        "STEP 1 - Navigate",
        lambda: tool_map["browser_navigate"].ainvoke(
            {
                "url": "https://example.com"
            }
        ),
    )

    await asyncio.sleep(2)

    await check(
        "STEP 2 - List Tabs",
        lambda: tool_map["browser_tabs"].ainvoke(
            {
                "action": "list"
            }
        ),
    )

    await check(
        "STEP 3 - Snapshot",
        lambda: tool_map["browser_snapshot"].ainvoke({}),
    )

    await check(
        "STEP 4 - Current URL",
        lambda: tool_map["browser_evaluate"].ainvoke(
            {
                "function": "() => window.location.href"
            }
        ),
    )

    await check(
        "STEP 5 - Page Title",
        lambda: tool_map["browser_evaluate"].ainvoke(
            {
                "function": "() => document.title"
            }
        ),
    )

    await check(
        "STEP 6 - Current HTML Length",
        lambda: tool_map["browser_evaluate"].ainvoke(
            {
                "function": "() => document.documentElement.outerHTML.length"
            }
        ),
    )

    await check(
        "STEP 7 - Close Browser",
        lambda: tool_map["browser_close"].ainvoke({}),
    )

    print("\n")
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("If STEP 1 succeeds but STEP 2 or later reports about:blank,")
    print("your Python code is correct and the Playwright MCP server is")
    print("losing browser state between tool calls.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
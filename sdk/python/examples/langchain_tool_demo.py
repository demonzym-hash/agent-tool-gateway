import json
import os

from atg_sdk import AtgClient
from atg_sdk.langchain import build_langchain_tool


base_url = os.environ.get("ATG_BASE_URL", "http://localhost:8080")
api_key = os.environ["ATG_API_KEY"]
tool_name = os.environ.get("ATG_TOOL_NAME", "refund_order")
arguments = json.loads(
    os.environ.get(
        "ATG_TOOL_ARGS",
        '{"order_id":"ord_langchain_demo","amount":25,"reason":"langchain_sdk_demo"}',
    ),
)

client = AtgClient(base_url=base_url, api_key=api_key)

if os.environ.get("ATG_USE_LANGCHAIN") == "1":
    try:
        from pydantic import create_model
    except ImportError as exc:
        raise RuntimeError("Install the LangChain extra first: python -m pip install -e \".[langchain]\"") from exc

    ArgsSchema = create_model(
        "AtgRefundOrderArgs",
        order_id=(str, ...),
        amount=(float, ...),
        reason=(str | None, None),
    )
    tool = build_langchain_tool(
        client,
        tool_name,
        description="Invoke the ATG refund order tool through LangChain",
        args_schema=ArgsSchema,
    )
    result = tool.invoke(arguments)
    print(json.dumps(result, ensure_ascii=False, indent=2))
elif os.environ.get("ATG_USE_MCP") == "1":
    client.mcp_initialize()
    tool_names = [tool["name"] for tool in client.mcp_list_tools()]
    if tool_name not in tool_names:
        raise RuntimeError(f"Tool {tool_name} was not returned by MCP tools/list")
    result = client.mcp_call_tool(tool_name, arguments)
    print(json.dumps(result["structuredContent"], ensure_ascii=False, indent=2))
else:
    result = client.invoke(tool_name, arguments)
    print(json.dumps(result, ensure_ascii=False, indent=2))

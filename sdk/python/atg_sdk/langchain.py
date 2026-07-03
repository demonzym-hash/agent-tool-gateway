from __future__ import annotations

from typing import Any

from .client import AtgClient


def build_langchain_tool(
    client: AtgClient,
    tool_name: str,
    *,
    description: str | None = None,
    args_schema: type[Any] | None = None,
):
    try:
        from langchain_core.tools import StructuredTool
    except ImportError as exc:
        raise RuntimeError("Install langchain-core to use the LangChain adapter: pip install langchain-core") from exc

    def _call(**kwargs: Any) -> dict[str, Any]:
        return client.invoke(tool_name, kwargs)

    return StructuredTool.from_function(
        func=_call,
        name=tool_name,
        description=description or f"Invoke ATG tool {tool_name}",
        args_schema=args_schema,
    )

import json
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.config import settings


class LLMError(Exception):
    pass


DEFAULT_MODEL: str = settings.llm_default_model
AVAILABLE_MODELS: list[str] = settings.llm_models

client = AsyncOpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)


async def chat(messages: list[dict], model: str | None = None) -> str:
    """非流式;返回 assistant 全文。model 为空用 DEFAULT_MODEL。"""
    response = await client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=messages,
    )
    return response.choices[0].message.content or ""


async def stream_chat(messages: list[dict], model: str | None = None) -> AsyncIterator[str]:
    """流式;逐块 yield 文本增量。"""
    stream = await client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def complete_json(messages: list[dict], model: str | None = None) -> dict:
    """chat() 后稳健提取 JSON 并返回 dict。"""
    text = await chat(messages, model=model)
    return _loads_json_object(text)


def _loads_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end < start:
        raise LLMError("LLM 返回内容中未找到 JSON 对象")

    try:
        data = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise LLMError("LLM 返回的 JSON 无法解析") from exc

    if not isinstance(data, dict):
        raise LLMError("LLM JSON 根节点不是对象")
    return data

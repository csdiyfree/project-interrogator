from pathlib import Path


PROMPT_DIR = Path(__file__).resolve().parent


def render(name: str, **vars) -> str:
    """读取 app/prompts/{name}.md 全文,用纯字符串替换 {{key}} 占位。"""
    text = (PROMPT_DIR / f"{name}.md").read_text(encoding="utf-8")
    for key, value in vars.items():
        text = text.replace(f"{{{{{key}}}}}", str(value))
    return text

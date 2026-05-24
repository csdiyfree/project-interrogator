from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import HTTPException
from pdfdeal import Doc2X

from app.config import settings


async def pdf_to_text(file_bytes: bytes, filename: str) -> str:
    try:
        suffix = Path(filename).suffix
        if suffix.lower() != ".pdf":
            suffix = ".pdf"

        with TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / f"resume{suffix}"
            pdf_path.write_bytes(file_bytes)

            client = Doc2X(apikey=settings.doc2x_api_key)
            success, failed, has_error = await client.pdf2file_back(
                pdf_file=str(pdf_path),
                output_path=tmp_dir,
                output_format="text",
            )

        text = success[0] if success else ""
        if has_error or not text:
            message = "Doc2X 转换失败"
            if failed and failed[0].get("error"):
                message = str(failed[0]["error"])
            raise RuntimeError(message)
        return str(text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "pdf_failed", "message": str(exc) or "Doc2X 转换失败"},
        ) from exc

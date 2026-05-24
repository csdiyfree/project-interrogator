from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.db import init_db


app = FastAPI(title="项目拷打器 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def require_session(x_session_id: str | None = Header(None, alias="X-Session-Id")) -> str:
    if not x_session_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "missing_session", "message": "缺少 X-Session-Id 请求头"},
        )
    return x_session_id


# require_session 需先定义,供后续路由在导入时复用。
from app.routers import guides, interrogations, resumes


app.include_router(resumes.router)
app.include_router(interrogations.router)
app.include_router(guides.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "http_error"))
        message = str(detail.get("message", "请求失败"))
    else:
        code = "http_error"
        message = str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "bad_request", "message": "请求参数不符合契约"}},
    )


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "内部服务错误"}},
    )

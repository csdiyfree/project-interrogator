from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import authenticate


router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    session_id: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    session_id = authenticate(body.username, body.password)
    if session_id is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_credentials", "message": "账号或密码错误"},
        )
    return LoginResponse(session_id=session_id)

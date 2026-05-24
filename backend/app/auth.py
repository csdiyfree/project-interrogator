USERS = {
    "admin": {
        "password": "kaoda-2025-admin",
        "session_id": "sess-admin-9f3c1a2b8e7d",
    },
    "guest": {
        "password": "kaoda-2025-guest",
        "session_id": "sess-guest-4a6d2e9c1b07",
    },
}

VALID_SESSION_IDS = {user["session_id"] for user in USERS.values()}


def authenticate(username: str, password: str) -> str | None:
    """校验账号密码,成功返回该用户的 session_id,失败返回 None。"""
    user = USERS.get(username)
    if user is None or user["password"] != password:
        return None
    return user["session_id"]


def is_valid_session(session_id: str | None) -> bool:
    return bool(session_id) and session_id in VALID_SESSION_IDS

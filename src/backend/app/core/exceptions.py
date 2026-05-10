import uuid as _uuid

from fastapi import Request


def make_error(code: str, message: str, request_id: str | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id or str(_uuid.uuid4()),
        }
    }


async def request_id_middleware(request: Request, call_next):
    request_id = str(_uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response

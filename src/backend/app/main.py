from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

_origins_raw = settings.cors_origins.strip()
if _origins_raw == "*":
    _orig_list = ["*"]
else:
    _orig_list = [o.strip() for o in _origins_raw.split(",") if o.strip()]

app = FastAPI(title="VECTOR / RMO API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_orig_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True}


app.include_router(api_router, prefix="/api/v1")

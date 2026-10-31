# 담당: 민주
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import children, conversation, evening, vision, voice
from app.storage import STATIC_DIR, request_base_url


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Aibom API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def remember_base_url(request: Request, call_next):
    """응답에 넣는 파일 URL 을 요청 주소 기준으로 (태희: 폰·터널 어디서 접속해도 맞게)"""
    request_base_url.set(str(request.base_url).rstrip("/"))
    return await call_next(request)

for r in (children, voice, vision, conversation, evening):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"ok": True}

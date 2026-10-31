# 담당: 민주
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session

from app.db import init_db
from app.routers import activity, children, conversation, evening, profile, vision, voice
from app.storage import STATIC_DIR, request_base_url
from app.config import ALLOW_LEGACY_API, CORS_ORIGINS
from app.routers import backend


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    from app.db import engine
    from app.services import seed_content
    with Session(engine) as session:
        seed_content(session)
    yield


app = FastAPI(title="Aibom API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def remember_base_url(request: Request, call_next):
    """응답에 넣는 파일 URL 을 요청 주소 기준으로 (태희: 폰·터널 어디서 접속해도 맞게)"""
    request_base_url.set(str(request.base_url).rstrip("/"))
    return await call_next(request)

app.include_router(backend.router)
if ALLOW_LEGACY_API:
    for r in (children, voice, vision, conversation, evening, activity, profile):
        app.include_router(r.router)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "중복 요청 또는 데이터 관계를 확인해 주세요"})


@app.exception_handler(OperationalError)
async def database_error(request: Request, exc: OperationalError):
    if "locked" in str(exc).lower():
        return JSONResponse(status_code=503, content={"detail": "처리 중이에요. 잠시 후 다시 시도해 주세요"}, headers={"Retry-After": "1"})
    raise exc


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/debug/log")
async def debug_log(request: Request):
    """(태희) 앱 오류를 서버 터미널에 출력 — 폰 로그를 못 볼 때 원인 확인용"""
    body = (await request.body()).decode("utf-8", "replace")[:2000]
    print(f"[APP] {body}", flush=True)
    return {"ok": True}

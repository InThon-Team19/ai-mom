"""환경변수 (server/.env). 키 이름은 .env.example 참고"""
import os

from dotenv import load_dotenv

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DB_URL = os.getenv("DB_URL") or os.getenv("SUPABASE_DB_URL") or f"sqlite:///{(ROOT / 'aibom.db').as_posix()}"
if DB_URL.startswith(("postgres://", "postgresql://")):
    DB_URL = "postgresql+psycopg://" + DB_URL.split("://", 1)[1]
ALLOW_LEGACY_API = os.getenv("ALLOW_LEGACY_API", "false").lower() == "true"
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",") if origin.strip()]
if "*" in CORS_ORIGINS:
    raise ValueError("Cookie authentication requires explicit CORS_ORIGINS, not '*'")
SESSION_COOKIE_NAME = "aibom_session"
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
PASSWORD_MIN_LENGTH = max(4, int(os.getenv("PASSWORD_MIN_LENGTH", "8")))

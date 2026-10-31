"""환경변수 (server/.env). 키 이름은 .env.example 참고"""
import os

from dotenv import load_dotenv

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DB_URL = os.getenv("DB_URL", f"sqlite:///{(ROOT / 'aibom.db').as_posix()}")
ALLOW_LEGACY_API = os.getenv("ALLOW_LEGACY_API", "false").lower() == "true"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")

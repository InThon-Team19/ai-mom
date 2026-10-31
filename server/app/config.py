"""환경변수 (server/.env). 키 이름은 .env.example 참고"""
import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DB_URL = os.getenv("DB_URL", "sqlite:///./aibom.db")

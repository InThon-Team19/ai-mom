"""테스트 데이터는 운영 DB/파일과 분리한다."""
import os
import tempfile

_root = tempfile.mkdtemp(prefix="aibom-tests-")
os.environ["DB_URL"] = f"sqlite:///{_root}/test.db"
os.environ["DATA_DIR"] = _root + "/data"
os.environ["ALLOW_LEGACY_API"] = "true"  # 기존 입력 파이프라인 회귀 테스트만 허용
for _key in ("GROQ_API_KEY", "OPENAI_API_KEY", "FISH_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "STT_API_KEY"):
    os.environ[_key] = ""  # 테스트에서 실제 외부 호출/과금 방지

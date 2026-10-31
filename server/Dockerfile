# 아이맘 서버 배포 이미지 (Railway·Render·Fly 공통). 담당: 태희
# - API 키는 이미지에 넣지 않음 → 배포 서비스의 환경 변수로 (OPENAI/GROQ/FISH/ANTHROPIC_* …)
# - 녹음·DB 는 /data 볼륨에 → 재배포해도 남음 (엄마 목소리 복제에 녹음 파일이 필요)
FROM python:3.12-slim

# mediapipe·opencv 가 쓰는 시스템 라이브러리 + 한국 시간대 (하루 기록 날짜가 9시간 어긋나지 않게)
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV TZ=Asia/Seoul \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/data/files \
    DB_URL=sqlite:////data/aibom.db \
    ALLOW_LEGACY_API=true

# 배포 서비스가 주는 PORT 사용 (없으면 8000)
CMD ["sh", "-c", "mkdir -p /data/files && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

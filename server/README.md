# 아이봄 FastAPI 백엔드

2026-10-31. 실제 구현은 이 폴더의 Python/FastAPI + SQLModel/SQLite다. 별도 Fastify 시제품을 설명한 `docs/backend-status-and-erd.md`와 구분한다.

## 실행

Python 3.12 권장. 프로젝트 루트가 아니라 `server/`에서 실행한다.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux/WSL: source .venv/bin/activate
python -m pip install -r requirements.txt
# .env.example을 .env로 복사한 뒤 필요한 제공자 키만 입력
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

이번 PC에는 WSL용 Python 3.12와 `.venv`를 준비했다. PowerShell에서:

```powershell
cd server
.\run.ps1
# 휴대폰 연결 시에만: .\run.ps1 -BindAddress 0.0.0.0
```

헬스: `http://localhost:8000/health`, API 명세/요청 실행: `http://localhost:8000/docs`.

기본 DB는 `server/aibom.db`, 비공개 파일은 `server/data/`다. 서버 재시작 후에도 계정·토큰·기기·계획·기록이 유지된다. 신규 DB 스키마를 자동 생성한다. 기존 데이터가 있는 DB의 스키마 변경은 자동 마이그레이션하지 않으므로 운영 전 마이그레이션 도구/백업 정책이 필요하다. 테스트와 데모는 임시 DB를 사용한다.

## 기본 흐름

1. `/api/auth/signup`으로 부모 계정을 만든다. 반환된 토큰을 Swagger의 Authorize에 입력한다. 이후에는 `/api/auth/login`을 사용한다.
2. 아이와 페르소나를 만들고 페르소나를 확정한다. 두 데이터 동의와 사용 설정을 등록한다.
3. 가입용 음성 WAV/M4A와 입모양 수치를 등록한다. 실제 파일 품질/수치를 처리하며 임의 메타데이터만으로 준비 완료 처리하지 않는다.
4. 부모가 6자리 연결 코드를 발급하고 태블릿이 `/api/tablet/pair`로 교환한다. 태블릿 토큰은 부모 API를 사용할 수 없다.
5. 오늘 계획을 만들고 그 계획에 대한 음성/입모양 낭독 샘플을 올린 뒤 `/plans/{id}/reading`으로 접수한다.
6. 태블릿은 오늘 계획으로 세션을 시작한다. 첫 발화 → 메시지/음성 turn → 감각 이벤트 → 종료로 활동한다.
7. 부모는 홈·리포트·확인 항목을 보고 저녁 확인과 피드백을 남긴다. 피드백 ID를 다음날 계획 생성에 전달하고 낭독한다.

전체 필드/경로는 [API 명세](../docs/api.md)와 `/docs`를 참고한다. 화면과 공유할 타입은 `app/src/lib/types.ts`의 `Backend*` 타입이다. 기존 앱의 임시 `/profile` 연결을 새 인증 흐름으로 바꾸는 화면 통합은 별도 작업이다.

## AI 및 미디어

| 기능 | 실제 연결 | 키가 없을 때 |
|---|---|---|
| STT | Groq/OpenAI 호환 API | 무음은 API 없이 처리, 발화는 503 |
| TTS/음성 등록 | Fish Audio | 등록/합성 요청은 503 (등록 전 합성은 400) |
| 입모양 | 기기에서 측정한 수치 처리·기준값/코칭 | 키 없이 동작 |
| 프레임 분석 | MediaPipe | 첫 요청 시 모델 다운로드 필요 |
| 응답 | 자료 기반 안전 문장 + 선택형 LLM | 키 없이 사과·바나나·과자 자료 기반 응답 |

`.env`의 `GROQ_API_KEY` 또는 `OPENAI_API_KEY`, `FISH_API_KEY`, `ANTHROPIC_AUTH_TOKEN`을 사용한다. 유료 외부 호출의 실사용 검증은 실제 키를 설정한 뒤 수행해야 한다. 키 없는 테스트가 외부 제공자의 성공을 보증하지 않는다.

교육 자료는 내부 시연 문장으로 전문가 검증 자료가 아니다. 자유 생성 응답 대신 서버가 보유한 문장만 출력한다. 아이 원문·원본 프레임은 저장하지 않으며 STT 임시 녹음은 처리 후 삭제한다. 부모 음성/입모양 자료는 비공개 저장소에 둔다. 재생용 TTS 파일은 기존 계약대로 `/static`에 제공된다.

## 검증

```bash
python -m pytest -q
python scripts/demo.py
```

데모는 별도 임시 DB/데이터 폴더와 로컬 HTTP 포트에서 서버를 시작해 가입·실제 WAV/입모양 처리·기기 연결·계획 낭독·활동·리포트·피드백·다음날 계획·연결 해제를 검증하고 서버를 종료한다. 외부 API 키를 비워 과금 없이 동작한다. 오늘은 실제 서울 날짜이며 데모 시간대 설정은 하루 전체다. 다음날 계획을 미리 만들지만 태블릿에서 미래 날짜 세션은 실행하지 않는다.

기존 `tests/test_inputs.py`는 호환 API를 켜 회귀 검증한다. 실제 서비스에서는 `ALLOW_LEGACY_API=false`가 기본값이다. 가입/로그인/연결 시도 제한은 DB에 저장되며, 실패 요청도 횟수에 포함한다.

## 운영 전 남은 범위

현재는 로컬/해커톤용 서버다. 운영 인증 연동·계정 복구/이메일 검증, TLS/배포, 법적 동의 정책, 데이터 삭제/보존, DB 마이그레이션, 모니터링, 대규모 요청 제한은 운영 환경에 맞춰야 한다. SQLite를 다른 DB로 바꾸는 것만으로 이 항목이 해결되지는 않는다. 설정 시간대·상한을 넘은 요청은 서버가 거부하지만 단말의 예약 시작/자동 중단·알림은 앱에서 구현해야 한다.

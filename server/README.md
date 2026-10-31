# 아이봄 FastAPI 백엔드

## Supabase 계정 저장

`server/.env`에 `SUPABASE_DB_URL`을 설정하면 SQLModel 데이터가 Supabase PostgreSQL에 저장됩니다.
Supabase Dashboard → Connect → Session pooler URI를 복사하고 비밀번호를 URL 인코딩하세요.
연결 문자열 끝에 `?sslmode=require`를 지정합니다. `DB_URL`이 있으면 우선 적용됩니다.
설정이 없으면 기존 SQLite를 사용합니다. `pip install -r requirements.txt` 후 서버를 시작하면 신규 테이블이 생성됩니다.
DB 연결 문자열은 서버에만 보관하고 앱 환경변수에 넣지 마세요.

현재 앱은 Supabase Auth 대신 자체 아이디/비밀번호 인증을 사용하며, Supabase는 DB로 사용합니다.
`loginaccount`에는 아이디, scrypt 비밀번호 해시, child_id를 저장합니다.
`parent`와 같은 ID를 사용하고 `/auth`와 `/api` 모두 `accesstoken`으로 인증합니다.
가족 프로필은 `familyprofile` 한 곳에서 저장·조회하며 JSON 파일에 이중 저장하지 않습니다.
기존 `loginaccount.profile`, `loginsession`은 시작 시 버전별 마이그레이션으로 이전합니다.
신규/기존 애플리케이션 테이블 전체에 PostgreSQL RLS를 적용하고 anon/authenticated 직접 접근 권한을 회수합니다.
시작 시 마이그레이션을 수행하므로 DB 소유자 권한이 필요합니다. Supabase Auth 자체 스키마는 변경하지 않습니다.
PostgreSQL의 시간 열은 UTC `TIMESTAMPTZ`로 이전합니다. 기존 timezone 없는 값은 UTC로 해석합니다.

앱 API: `POST /auth/signup` (`login_id`, `password`, `child_id`, `profile`),
`POST /auth/login` (`login_id`, `password`), `POST /auth/password` (`login_id`, `password`, `new_password`).
로그인 응답은 `login_id`, `child_id`, `token`, `profile`입니다.
`PUT /auth/profile`은 `Authorization: Bearer <token>` 또는 HttpOnly 세션 쿠키로 인증합니다.
부모 토큰은 7일, 태블릿 토큰은 30일 유효합니다. 비밀번호 변경은 부모·태블릿 세션을 모두 폐기합니다.
`POST /auth/logout`은 만료/폐기된 토큰에도 성공하며 쿠키를 삭제합니다.
새 비밀번호는 기본 8자 이상이며 `PASSWORD_MIN_LENGTH`로 설정합니다. 기존 짧은 비밀번호 로그인은 유지합니다.
`/profile/*`은 항상 활성화하고 인증·가족 소유권·부모/태블릿 역할을 검사합니다.
`ALLOW_LEGACY_API=true`는 기존 미디어 경로만 활성화하며 인증을 우회하지 않습니다.
연결 코드는 10분 유효하고 한 번만 교환할 수 있습니다. 새 코드 발급 시 기존 태블릿을 해제합니다.
가입 시 앱의 기존 6자리 child_id를 초기 코드로 사용하고 이후에는 서버 난수 코드를 사용합니다.
가입 후 10분이 지났으면 설정 화면에서 코드를 재발급하세요.

### 프론트엔드를 수정하지 않은 범위의 한계

이번 변경은 `server/`와 API 문서만 수정합니다. 새 화면/복구/탈퇴 API는 추가하지 않습니다.
현재 화면의 API 주소와 주요 응답 키를 유지합니다. 서버는 Bearer 및 HttpOnly 쿠키를 지원하지만,
실제 앱이 토큰/쿠키를 보내는지는 별도입니다. 현재 미디어 요청에는 Bearer 헤더가 없고,
교차 출처 웹 fetch에는 credentials 옵션이 없으므로 쿠키가 전달되지 않는 환경에서는 401로 차단됩니다.
가입 전 미디어 업로드 역시 인증이 필요합니다. 이를 안전하게 완전히 연결하려면 추후 프론트엔드 작업이 필요합니다.
서버가 무인증 접근을 허용하거나 IP만으로 가족을 추정하지는 않습니다.
HTTPS에서는 Secure 쿠키가 기본이며, 로컬 HTTP 개발에서만 `SESSION_COOKIE_SECURE=false`로 설정하세요.
앱의 AsyncStorage 토큰 보관, 시작 화면의 세션 검사, 네트워크 단절 시 로컬 로그아웃,
동기화 실패 표시/재시도는 프론트엔드에 있어 변경하지 않았습니다.
가입에서 받은 프로필은 계정과 같은 트랜잭션으로 저장합니다. 현재 화면이 이후 요청으로 보내는 PIN/동의는
서버에서 임시 상태로 유지하며, 모든 필수 정보가 유효할 때만 가입 완료 상태를 허용합니다.

### 기존 DB/파일 데이터 이전

운영 서버를 중지하고 SQLite 및 data 폴더를 먼저 백업하세요. 새 DB는 빈 대상 DB를 사용하세요.

```bash
# server/에서 실행. 기본은 건수 확인이며 쓰지 않습니다.
python scripts/migrate_data.py --source sqlite:////absolute/path/backup.db
python scripts/migrate_data.py --source sqlite:////absolute/path/backup.db --apply
# 이미 소유권이 확정된 Child에만 이전하며 기존 프로필은 덮어쓰지 않습니다.
python scripts/migrate_data.py --profiles /absolute/path/old-data --apply
```

인증 계정/자녀 소유권이 없는 JSON 프로필은 자동으로 계정에 연결하지 않고 이전을 거부합니다.
음성·영상·활동 원본 파일은 별도로 보관 위치를 이전해야 합니다. 이 스크립트는 파일을 삭제하지 않습니다.
마이그레이션은 중복 기본키가 있으면 데이터 복사를 전체 롤백합니다. 소스 DB를 변경하지 않습니다.

### PostgreSQL 검증

```bash
python -m pytest -q
# 전용 테스트 DB에서만 지정. 임의의 테스트 스키마를 생성한 뒤 제거합니다.
TEST_POSTGRES_URL='postgresql+psycopg://...' python -m pytest tests/test_postgres.py -q
```

연결 문자열이 없으면 실제 PostgreSQL 검증은 skip됩니다. DDL 타입 검사는 연결 없이 실행합니다.

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

전체 필드/경로는 [API 명세](../docs/api.md)와 `/docs`, 실제 DB 관계는 [ERD](../docs/backend-erd.md)를 참고한다. 화면과 공유할 타입은 `app/src/lib/types.ts`의 `Backend*` 타입, 새 호출 함수는 `app/src/lib/api.ts`의 `backendApi(token)`이다. 모바일은 인증된 base64 JSON 경로로 음성을 전송할 수 있다. 기존 앱의 임시 `/profile` 연결을 새 인증 흐름으로 바꾸는 화면 통합은 별도 작업이다.

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

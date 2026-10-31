# 아이맘 (ai-mom) — InThon 2026 Team 19

> 낮에는 부모 아바타가 아이와 청각·시각·촉각 대화를 하고, 밤에는 부모가 피드백과 입모양 낭독으로 다음날을 갱신합니다.

## 심사위원 실행 안내 (설치·체험)

| 항목 | 내용 |
|---|---|
| 설치 파일 | 안드로이드 APK (제출 양식의 다운로드 링크) — **안드로이드 전용** (폰·태블릿 모두 가능) |
| 서버 | https://aimom-server.onrender.com (24시간 운영, 상태 확인: `/health` → `{"ok": true}`) |
| 계정 | 앱에서 바로 새로 가입 (아이디·비밀번호만, 이메일 인증 없음) |

**기기 2대 (부모 폰 + 아이 태블릿) — 권장**
1. 두 기기에 APK 설치 (설치 중 "출처를 알 수 없는 앱 허용"을 눌러 주세요)
2. 부모 폰: 앱 실행 → **부모 폰** → 가입 → 아이 소개·말투·아바타 → 목소리·입모양 학습(문장 몇 개 읽기) → PIN·동의 → 연결 코드가 나옴
3. 아이 태블릿: 앱 실행 → **아이 태블릿** → 연결 코드 입력 → 아바타가 먼저 말을 걸어요 (놀자 · 손 놀이 · 동화 듣기 · 엄마랑 이야기)
4. 부모 폰: **리포트**(감각 일지·확인할 점) → **피드백**(내일 계획·탭하여 낭독하기) → 다음날 대화에 반영

**기기 1대로 보기**
- 부모로 가입한 뒤 **설정 → 이 기기를 아이 모드로 바꾸기** → 아이 화면 체험 → **부모** 버튼을 3초 꾹 누르고 PIN 을 넣으면 부모 화면으로 돌아와요
- 2일차(과자)를 바로 보려면: 내일 계획 낭독 후 **설정 → 학습 이력 → 시연: 지금 다음 일차로 넘기기**

**참고**
- 마이크·카메라 권한을 허용해 주세요 (카메라는 기기 안에서 입모양 수치만 계산하고 얼굴 영상은 저장하지 않아요)
- 엄마 목소리 학습 전에는 아바타가 기기 기본 음성으로 말해요
- 서버가 오래 쉬었다가 처음 열면 첫 응답이 조금 늦을 수 있어요

백엔드의 현재 실행 방법은 [server/README.md](server/README.md), API 계약은 [docs/api.md](docs/api.md), 실제 DB 관계는 [docs/backend-erd.md](docs/backend-erd.md)를 참고하세요. `/api`에 가입·인증·기기 연결·계획·활동·리포트·피드백을 구현했고 SQLite에 저장합니다. 기존 앱 화면의 임시 경로는 기본 비활성입니다. 화면 통합 시 `backendApi(token)`을 사용하거나, 격리된 기존 시연에서만 `ALLOW_LEGACY_API=true`로 켭니다.

## 구조
기준 문서: **`docs/기획서.md`(최종 v2)**, **`docs/wireframe.md` + `docs/wireframe/*.png`**
```
ai-mom/
├─ app/                          # Expo SDK 58 — 부모 폰 + 아이 태블릿 (시작 화면에서 기기 용도 선택)
│  └─ src/
│     ├─ app/onboarding/         # 가입 1-1~1-7 (아이 정보·부모 성향·아바타·목소리·입모양·설정/연결 코드)
│     ├─ app/parent/             # 부모 앱 탭: 홈 · 리포트 · 피드백 · 내일 계획(낭독)
│     ├─ app/child/              # 아이 태블릿 3-1~3-8 (연결·놀이·따라 말하기·동화·청각 모드·마무리)
│     ├─ components/             # ui · Avatar(부모가 꾸민 캐릭터) · RingGauge · FaceTracker(기기 안 얼굴 인식)
│     ├─ hooks/                  # useReadAloud(낭독) · useSpeak(아바타 말하기) · useVoiceRecorder
│     ├─ lib/                    # api · store(프로필) · sense(효과음·진동·반응 기록) · config(서버 주소)
│     └─ content/curriculum.ts   # 1일차 사과·바나나(+동화), 2일차 과자 — 콘텐츠는 출력 담당이 교체
├─ server/                       # FastAPI
│  └─ app/
│     ├─ routers/backend.py      # /api 가입·인증·기기·계획·세션·리포트·피드백·인증된 미디어 처리
│     ├─ models.py db.py         # SQLModel 19개 테이블·SQLite 영속 저장
│     ├─ auth.py services.py     # 토큰·소유권·동의·상태·시간 제한·집계
│     ├─ routers/voice.py        # 부모 음성·학습률·특성 분석·코칭, STT, TTS(Fish Audio)
│     ├─ routers/vision.py       # 입모양 기준값·학습률 (앱이 보낸 수치)
│     ├─ routers/activity.py     # 아이 반응 기록·하루 요약(세 감각 균형)
│     ├─ routers/profile.py      # (임시) 프로필·태블릿 연결 — 민주 children API 로 교체 예정
│     ├─ routers/children·conversation·evening.py  # 이전 경로 자리, 새 흐름은 backend.py
│     ├─ voice/ vision/          # 오디오 특성 · MediaPipe
│     ├─ agent/  llm.py          # 충항: 에이전트 (LLM = Lablup Token Factory)
│     └─ tts/fish.py             # Fish Audio 목소리 복제·합성
├─ docs/                         # 기획서 · 와이어프레임 · api.md · data-sources.md
└─ scripts/setup-github.sh
```

## 역할
| 이름 | 역할 | 맡은 곳 |
|---|---|---|
| 태희 (팀장) | **입력 파이프라인** (부모 음성·입모양 영상, 아이 영상·음성) · **UI/UX 프론트** · **통합/배포** | `app/` 화면·components·hooks, `server/app/vision/`, `server/app/voice/` |
| 민주 | 백엔드 + **TTS** | `server/app/` main·db·models·routers, `tts/`, `app/src/lib/`, `docs/api.md` |
| 충항 | **에이전트** (흐름 + 프롬프트 + 안전 검사) | `server/app/agent/`, `server/app/content/` |
| 민철 (PM) | 와이어프레임·디자인 · 발표 · QA | 와이어프레임, `docs/data-sources.md` |

- 앱 화면은 와이어프레임 21장 기준으로 구현 완료. 민주·충항은 **TTS / 에이전트 서버 작업만**, 화면 연결은 태희가 함.
- 아바타 대사는 지금 `content/curriculum.ts` 고정 문장 → 충항 에이전트 API 가 생기면 교체.

## 실행
**서버** (Python 3.11 또는 3.12. `.env`에 키: `GROQ_API_KEY`(무료 STT) · `FISH_API_KEY`(엄마 목소리) · `ANTHROPIC_*`(Token Factory). 키가 없어도 앱은 동작 — STT 없이 칭찬, 기기 기본 음성)
```bash
cd server
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload   # http://localhost:8000/docs
pytest -q                                                   # 서버 테스트
```
**앱** (Expo SDK 58)
```bash
cd app
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL = 노트북 IP:8000 (localhost X)
npx expo start              # 폰/태블릿 Expo Go로 QR
```
- 패키지 추가는 `npx expo install <pkg>` (SDK 맞는 버전)
- **새 파일을 만들었는데 앱이 못 찾거나("Unable to resolve module") 고친 내용이 안 보이면** 개발 서버를 끄고 `npx expo start --clear` 로 다시 시작 (Windows 한글 경로에서 파일 감시가 새 파일을 놓침)
- 같은 와이파이가 안 되면 `cloudflared tunnel --url http://localhost:8000`


## 서버 운영 (시연)
- 서버는 **태희 노트북 1대**에서 실행 (`--host 0.0.0.0 --port 8000`). 폰/태블릿은 같은 와이파이로 `http://노트북IP:8000`
- 앱 **홈 화면 아래 서버 주소 칸**에서 주소를 바꾸고 저장 → APK를 다시 빌드할 필요 없음
- 와이파이가 막히면(대회장 격리 등) `cloudflared tunnel --url http://localhost:8000` → 나온 https 주소를 홈 화면에 입력
- APK: `cd app && npx eas-cli@latest build -p android --profile preview` (http 주소 허용 설정 포함)
- 확인: `http://노트북IP:8000/docs`, 서버 테스트 `cd server && pytest -q`

## Git 규칙 (해커톤용: main 직접 push)
1. **main에 바로 push**. 브랜치·PR 필요 없음
2. 작업 전 `git pull`, push 전 `git pull --rebase` (충돌 나면 바로 풀고 다시 push)
3. 작게 자주 커밋·push (한 번에 몰아서 X). **push 전에 내 쪽이 실행되는지 확인** (main은 항상 실행되는 상태)
4. 내 담당 폴더 밖 파일은 되도록 건드리지 않기
5. 공용 파일(`docs/api.md`, `lib/types.ts`, `models.py`, `.env.example`) 바꾸면 단톡 공지
6. 커밋 머리말: `feat:` `fix:` `chore:` `docs:`
7. API 키는 `.env`에만, DM으로 공유 (절대 커밋 X)
8. `--force` push 금지

```bash
# 매번 작업 흐름
git pull
# ... 작업 ...
git add . && git commit -m "feat: 설명"
git pull --rebase && git push
```

## 타임라인 (마감 11/1 12:00)
| 시간 | 목표 |
|---|---|
| ~17:30 | 전원 clone·실행 확인, API 명세 확정, 와이어프레임 |
| **21:00** | **1차 통합**: 가입 → 아이 대화 한 바퀴 |
| **03:00** | **기능 동결** — 이후 버그만 |
| 06~09 | 배포, APK 빌드, 발표 자료 |
| 09~11:30 | 백업 시연 영상 → 리허설 → **11:30 제출** |

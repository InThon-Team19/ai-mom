# 아이봄 (Ai-Bom) — InThon 2026 Team 19

> 낮에는 부모 아바타가 아이와 청각·시각·촉각 대화를 하고, 밤에는 부모가 피드백과 입모양 낭독으로 다음날을 갱신합니다.

## 구조
```
aibom/
├─ app/                      # Expo (React Native) — 부모 폰 + 아이 태블릿
│  └─ src/
│     ├─ app/parent/         # 충항: onboarding, avatar, voice, mouth, persona, evening, plan-read
│     ├─ app/child/          # 태희: index(시작), talk(아바타 + 감각 놀이)
│     ├─ components/         # 공용 UI (민철 디자인 반영)
│     ├─ hooks/              # 녹음·카메라 등
│     └─ lib/                # 민주: api.ts, types.ts / config.ts
├─ server/                   # FastAPI
│  └─ app/
│     ├─ main.py db.py models.py   # 민주
│     ├─ routers/            # 민주: children, voice, vision, conversation, evening
│     ├─ tts/                # 민주: ElevenLabs
│     ├─ vision/             # 태희: MediaPipe 입모양·응시
│     ├─ voice/              # 태희: STT, 말하기 특성
│     ├─ agent/              # 태희(흐름)·충항(프롬프트): 에이전트, 안전 검사
│     └─ content/            # 충항: 검증된 학습 범위 데이터
├─ docs/                     # api.md(민주), data-sources.md(민철)
└─ scripts/setup-github.sh   # 팀장 1회: repo·권한·브랜치 설정
```
지금은 **빈 뼈대**: 앱은 화면 이동만, 서버는 `/health`만 동작.

## 역할
| 이름 | 역할 | 시작 브랜치 |
|---|---|---|
| 태희 (팀장) | 컴퓨터 비전 · 에이전트 · 음성, 통합/배포 | `feat/taehee-vision`, `feat/taehee-agent` |
| 민주 | 백엔드 + TTS | `feat/minju-backend-init`, `feat/minju-tts` |
| 충항 | 부모 앱 화면 + 프롬프트 | `feat/chungang-parent-screens` |
| 민철 (PM) | 디자인 · 발표 · QA | `feat/mincheol-design` |

## 실행
**서버** (Python 3.11 — MediaPipe 호환)
```bash
cd server
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload   # http://localhost:8000/docs
```
**앱** (Expo SDK 58)
```bash
cd app
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL = 노트북 IP:8000 (localhost X)
npx expo start              # 폰/태블릿 Expo Go로 QR
```
- 패키지 추가는 `npx expo install <pkg>` (SDK 맞는 버전)
- 같은 와이파이가 안 되면 `cloudflared tunnel --url http://localhost:8000`

## Git 규칙
1. `main`은 항상 실행되는 상태 — **직접 push 금지**
2. `feat/이름-기능` 브랜치 → PR → **Squash merge** (승인 없이 셀프 머지 OK)
3. 기능 하나 끝나면 바로 PR (브랜치 2~3시간 이상 들고 있지 않기)
4. 작업 시작 전 `git pull origin main`, push 전 `git pull --rebase origin main`
5. 공용 파일(`docs/api.md`, `lib/types.ts`, `models.py`, `.env.example`) 바꾸면 단톡 공지
6. 커밋 머리말: `feat:` `fix:` `chore:` `docs:`
7. API 키는 `.env`에만, DM으로 공유 (절대 커밋 X)

```bash
# 매번 작업 흐름
git checkout main && git pull
git checkout -b feat/이름-기능
git add . && git commit -m "feat: 설명"
git push -u origin feat/이름-기능     # → GitHub에서 PR → Squash and merge
```

## 타임라인 (마감 11/1 12:00)
| 시간 | 목표 |
|---|---|
| ~17:30 | 전원 clone·실행 확인, API 명세 확정, 와이어프레임 |
| **21:00** | **1차 통합**: 가입 → 아이 대화 한 바퀴 |
| **03:00** | **기능 동결** — 이후 버그만 |
| 06~09 | 배포, APK 빌드, 발표 자료 |
| 09~11:30 | 백업 시연 영상 → 리허설 → **11:30 제출** |

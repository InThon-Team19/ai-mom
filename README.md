# 아이봄 (Ai-Bom) — InThon 2026 Team 19

> 낮에는 부모 아바타가 아이와 청각·시각·촉각 대화를 하고, 밤에는 부모가 피드백과 입모양 낭독으로 다음날을 갱신합니다.

## 구조
```
aibom/
├─ app/                      # Expo (React Native) — 부모 폰 + 아이 태블릿
│  └─ src/
│     ├─ app/parent/         # 태희: 화면 전체 (민철 와이어프레임 기준)
│     │                      #   └ voice·mouth·plan-read = 부모 음성/입모양 영상 입력
│     ├─ app/child/          # 태희: index(시작), talk(아바타 + 아이 영상/음성 입력)
│     ├─ components/         # 태희: 공용 UI (민철 디자인 반영)
│     ├─ hooks/              # 태희: 녹음·카메라 훅
│     └─ lib/                # 민주: api.ts, types.ts / config.ts
├─ server/                   # FastAPI
│  └─ app/
│     ├─ main.py db.py models.py   # 민주
│     ├─ routers/            # 민주: children, voice, vision, conversation, evening
│     ├─ tts/                # 민주: ElevenLabs 목소리 등록·합성
│     ├─ vision/             # 태희: MediaPipe 입모양(부모·아이)·응시
│     ├─ voice/              # 태희: STT(부모·아이), 말하기 특성
│     ├─ agent/              # 충항: 에이전트 흐름·프롬프트, 안전 검사
│     └─ content/            # 충항: 검증된 학습 범위 데이터
├─ docs/                     # api.md(민주), data-sources.md(민철)
└─ scripts/setup-github.sh   # 팀장 1회: repo·권한 설정
```
지금은 **빈 뼈대**: 앱은 화면 이동만, 서버는 `/health`만 동작.

## 역할
| 이름 | 역할 | 맡은 곳 |
|---|---|---|
| 태희 (팀장) | **입력 파이프라인** (부모 음성·입모양 영상, 아이 영상·음성) · **UI/UX 프론트** · **통합/배포** | `app/` 화면·components·hooks, `server/app/vision/`, `server/app/voice/` |
| 민주 | 백엔드 + **TTS** | `server/app/` main·db·models·routers, `tts/`, `app/src/lib/`, `docs/api.md` |
| 충항 | **에이전트** (흐름 + 프롬프트 + 안전 검사) | `server/app/agent/`, `server/app/content/` |
| 민철 (PM) | 와이어프레임·디자인 · 발표 · QA | 와이어프레임, `docs/data-sources.md` |

- 앱 화면 디테일은 **민철 와이어프레임이 나오면 그대로 따라감**. 그 전엔 화면은 Placeholder로 두고 TTS·에이전트·입력 파이프라인 API부터.
- 민주·충항은 앱 화면을 신경 쓰지 말고 **TTS / 에이전트 서버 작업만**. 화면 붙이기는 태희가 함.

## 실행
**서버** (Python 3.11 또는 3.12 — MediaPipe 호환. 첫 실행 때 얼굴 모델을 `server/models/`에 자동 다운로드)
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
- 같은 와이파이가 안 되면 `cloudflared tunnel --url http://localhost:8000`

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

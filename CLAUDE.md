# CLAUDE.md

아이봄 (Ai-Bom) — InThon 2026 Team 19. 마감 **11/1 12:00** (기능 동결 03:00).
낮에는 부모 아바타(부모 목소리 TTS + 입모양)가 아이와 대화하고, 밤에는 부모가 대화 확인·피드백·다음날 계획 낭독(음성+입모양 영상)으로 내용을 갱신한다.

## 구성
- `app/` — Expo SDK 58 + Expo Router (React Native). 부모 폰 + 아이 태블릿 한 앱. **앱 작업 전 `app/AGENTS.md` 먼저 읽기** (Expo API는 기억 말고 v58 문서 확인, 패키지는 `npx expo install`).
  - `src/app/parent/` 부모 화면: onboarding → avatar → voice → mouth → persona (가입 5단계), evening·plan-read (밤)
  - `src/app/child/` 아이 화면: index(시작) → talk(아바타 대화)
  - `src/lib/api.ts` 서버 호출은 전부 여기 (화면에서 fetch 직접 금지), `types.ts` 서버 모델과 맞춘 타입, `config.ts` 서버 주소
- `server/` — FastAPI, Python **3.11** (MediaPipe 호환), SQLModel(SQLite), OpenAI, ElevenLabs.
  - `routers/` children·voice·vision·conversation·evening, 각 prefix만 잡혀 있음
  - `tts/` ElevenLabs · `vision/` MediaPipe 입모양·응시 · `voice/` STT · `agent/` 에이전트·프롬프트·안전 검사 · `content/` 학습 범위 데이터
  - 생성 파일은 `server/static/` (git 제외), `/static`으로 서빙
- `docs/api.md` API 명세 (비어 있음, 민주가 채움) · `docs/data-sources.md` 외부 자료 출처·라이선스

현재 상태: 빈 뼈대. 앱은 화면 이동만, 서버는 `/health`만 동작.

## 역할 (어느 파일을 누가 맡는지)
| 이름 | 맡은 일 | 경로 |
|---|---|---|
| 태희 (팀장) | 입력 파이프라인(부모 음성·입모양 영상, 아이 영상·음성), UI/UX 프론트, 통합/배포 | `app/src/app/**`, `components/`, `hooks/`, `server/app/vision/`, `server/app/voice/` |
| 민주 | 백엔드 + TTS | `server/app/{main,db,models,config}.py`, `routers/`, `tts/`, `app/src/lib/`, `docs/api.md` |
| 충항 | 에이전트 (흐름 + 프롬프트 + 안전 검사) | `server/app/agent/`, `server/app/content/` |
| 민철 (PM) | 와이어프레임·디자인, 발표, QA | 와이어프레임, `docs/data-sources.md` |

- 앱 화면 디테일은 **민철 와이어프레임을 따른다**. 와이어프레임 없이 화면 디자인을 임의로 정하지 말 것.
- 민주·충항 작업은 서버(TTS / 에이전트)만. 화면 연결은 태희가 한다.
- 각 파일 첫 줄 주석에 담당자가 적혀 있다. 담당 밖 파일을 크게 바꿔야 하면 사용자에게 먼저 알린다.

## 실행
```bash
# 서버
cd server && python3.11 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload             # http://localhost:8000/docs

# 앱
cd app && npm install && cp .env.example .env   # EXPO_PUBLIC_API_URL = 노트북 IP:8000 (localhost X)
npx expo start
```
같은 와이파이가 안 되면 `cloudflared tunnel --url http://localhost:8000`.

## 확인 (끝났다고 하기 전에)
- 앱: `cd app && npx tsc --noEmit` 과 `npx expo lint`
- 서버: `uvicorn app.main:app` 이 뜨고 `/docs`에서 바꾼 API 호출 확인
- Expo Go엔 번들된 네이티브 모듈만 있다. 네이티브 라이브러리 추가 시 dev build 필요 → 해커톤 중엔 가능하면 피한다.

## 공용 계약 (같이 바꿔야 하는 파일)
API나 모델을 바꾸면 **세 곳을 같이** 수정하고 단톡 공지:
`docs/api.md` + `server/app/models.py` + `app/src/lib/types.ts`. `.env.example` 키 추가도 공지 대상.

## Git (해커톤용)
- **main에 직접 push**. 브랜치·PR 없이 진행 (private 무료 org라 보호 규칙도 없음)
- 작업 전 `git pull`, push 전 `git pull --rebase`. `--force` push 금지
- 작게 자주 커밋. push 전에 실행되는지 확인 (main은 항상 실행되는 상태)
- 커밋 머리말: `feat:` `fix:` `chore:` `docs:`
- API 키·`.env`는 절대 커밋하지 않는다 (DM 공유)

## 외부 자료
오픈소스 이미지·효과음·동화·학습 자료를 쓰면 `docs/data-sources.md`에 출처·라이선스 한 줄 추가.

# CLAUDE.md

아이맘 (ai-mom) — InThon 2026 Team 19. 마감 **11/1 12:00** (기능 동결 03:00).
**기획서 최종본 `docs/기획서.md`(v2), 와이어프레임 `docs/wireframe.md` + `docs/wireframe/*.png`가 기준이다.** 기능·문구·흐름이 애매하면 이 둘을 먼저 본다.

## 제품 한 줄
맞벌이 부모의 페르소나(목소리·입모양·말투)를 담은 **아바타**가 낮에 2~5세 아이와 청각·시각·촉각 놀이로 대화하고, 밤에 부모가 리포트 확인 → 피드백 → 다음날 계획 낭독(입모양+음성)으로 다음날 대화를 갱신한다 (Dual-Loop, Parent-on-the-loop).

## 꼭 지킬 제품 규칙 (기획서 근거)
- **아바타는 실제 얼굴이 아니다** — 부모가 고른 캐릭터(`components/Avatar.tsx`). 부모 입모양은 *수치*(입 벌림 기준값)로만 반영. 얼굴 사진·영상을 아바타에 쓰거나 서버에 저장하지 않는다.
- **안전망**: 낮 대화는 검증된 학습 범위(`app/src/content/curriculum.ts`, 이후 에이전트 `server/app/agent`) 안에서만. 범위 밖 질문은 지어내지 않고 주제로 되돌린 뒤 부모 확인 목록에 남긴다. "아파" 등 위험 신호는 기록·알림.
- **아이에게 틀렸다는 표시 없음.** 칭찬·다시 해보기만.
- **감각 자극 제한**: 진동은 짧고 약하게(`lib/sense.ts haptic()`만 사용), 효과음 작게, 깜빡임 없는 애니메이션, 진동 끄기 설정 존중.
- **개인정보**: 부모 음성·입모양 수치·아이 반응은 비공개 `server/data/`(git 제외)에만. 공개 `/static`에는 재생용 TTS mp3만. 건강 정보·싫어하는 것·실제 부모-아이 대화는 받지/기록하지 않는다.
- 아이 화면은 글자 최소, 아바타가 먼저 말 건다. 마무리에서 실제 부모에게 연결한다.
- 부모 리포트는 대화 전체가 아니라 요약 + **확인 필요 건(범위 밖 질문·차단된 문장)**을 반드시 포함.
- 커리큘럼은 하나로 고정: 1일차 사과·바나나(+전래동화), 2일차 과자. 해커톤은 2일차까지.
- 콘텐츠(이미지·효과음·진동·대본)는 출력 담당 팀원 몫. 지금 `content/curriculum.ts`의 이모지·`assets/sounds` 합성음은 **자리 표시용** — 받으면 교체.

## 구성
- `app/` — Expo SDK 58 + Expo Router. 부모 폰 + 아이 태블릿 한 앱(시작 화면에서 기기 용도 선택). **앱 작업 전 `app/AGENTS.md` 먼저 읽기.**
  - `src/app/onboarding/` 가입 1-1~1-7 · `src/app/parent/` 부모 앱 탭(홈·리포트·피드백·내일 계획) · `src/app/child/` 아이 태블릿 3-1~3-8
  - 공용: `theme.ts`, `components/`(ui·Avatar·RingGauge·FaceTracker), `hooks/`(useReadAloud 낭독·useSpeak 아바타 말하기·useVoiceRecorder), `lib/`(api·store 프로필·sense 효과음/진동/반응 기록·config 서버 주소), `content/curriculum.ts`
  - 서버 호출은 전부 `lib/api.ts` (화면에서 fetch 직접 금지)
- `server/` — FastAPI, Python 3.11/3.12, MediaPipe, OpenAI(STT), Fish Audio(TTS), Lablup Token Factory(LLM, `app/llm.py`)
  - `routers/`: voice(부모 음성·학습률·분석·코칭·STT·TTS) · vision(입모양 기준값·학습률) · activity(아이 반응·하루 요약) · profile(임시 프로필·태블릿 연결) · children/conversation/evening(민주·충항 자리)
  - `voice/` 오디오 특성 · `vision/` MediaPipe · `agent/` 에이전트 · `tts/` Fish Audio
- `docs/` 기획서.md(최종 v2) · wireframe.md(+png) · api.md · data-sources.md

## 역할 (어느 파일을 누가 맡는지)
| 이름 | 맡은 일 | 경로 |
|---|---|---|
| 태희 (팀장) | 입력 파이프라인(부모 음성·입모양, 아이 영상·음성·터치), UI/UX 프론트, 통합/배포 | `app/src/**`, `server/app/{vision,voice}/`, `routers/{voice,vision,activity}.py` |
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

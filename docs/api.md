# API 명세 (담당: 민주)

## 영속 백엔드 `/api` — 2026-10-31

현재 구현은 `server/app/routers/backend.py`, 입력 계약은 `server/app/schemas.py`, DB는 `server/app/models.py`다. 실행과 흐름 예시는 [server/README.md](../server/README.md)를 따른다. `/docs`의 OpenAPI가 필드·형식·필수값의 전체 명세다. 모든 요청/응답 필드는 **snake_case**다.

인증: `Authorization: Bearer <access_token>`. 부모 토큰은 7일, 기기 토큰은 30일. 로그아웃/기기 해제 후 즉시 거부하며 원본 토큰과 비밀번호는 저장하지 않는다. 부모와 태블릿 API의 권한을 분리한다. 타인 소유 ID는 404다.

| 권한 | 메서드·경로 (`/api` 기준) | 입력·동작 |
|---|---|---|
| 공개 | `POST /auth/signup` | `email`, `password`(10~128자), `display_name`; 토큰과 부모 반환 |
| 공개 | `POST /auth/login` | `email`, `password`; 토큰 반환 |
| 공통 | `POST /auth/logout` | 현재 토큰 철회 |
| 부모 | `GET /me` | 비밀번호 제외 부모 정보 |
| 공개 | `GET /ui-options`, `GET /recording-prompts` | 선택값·녹음 예문 |
| 부모 | `POST /children`, `GET /children`, `GET /children/{id}` | 생성: `nickname`, `birth_month`(YYYY-MM), `speech_level?`, `interests?` |
| 부모 | `POST /personas`, `GET /personas` | `parent_title?`, `speaking_style?`, `english_enabled?`, `education_goals?`, `avatar?` |
| 부모 | `POST /personas/{id}/confirm` | 페르소나 확정 |
| 부모 | `PUT /children/{id}/consents` | `parent_biometrics`, `child_signals`, `policy_version: demo-v1`; 변경 이력 저장 |
| 부모 | `PUT /children/{id}/settings` | `haptics_enabled`, `daily_limit_minutes`(1~120), `window_start`, `window_end`(HH:mm). 기본값은 OpenAPI 참고 |
| 부모 | `GET /children/{id}/onboarding?persona_id=` | 가입 체크리스트와 `ready` |
| 부모 | `POST /children/{id}/samples/audio` | multipart: `file`, `persona_id`, `text`, `purpose?`, `plan_id?`. 20MB 제한, 음성 품질 검사 |
| 부모 | `POST /children/{id}/samples/audio-b64` | JSON: `audio_b64`, `ext?`, `persona_id`, `text`, `purpose?`, `plan_id?`. 모바일 첨부 호환, 동일한 인증·품질 검사 |
| 부모 | `POST /children/{id}/samples/mouth` | JSON: `persona_id`, `text?`, `track:[{t,open,width,face?}]`, `purpose?`, `plan_id?`. 영상 대신 수치 저장 |
| 부모 | `GET /children/{id}/training-progress?persona_id=` | 샘플 등록량. 모델 정확도가 아님 |
| 부모 | `GET /children/{id}/voice-analysis?persona_id=` | 부모 음성 특성·안내 |
| 부모 | `GET /children/{id}/coaching?persona_id=` | 가입 기준 대비 낭독 코칭 |
| 부모 | `POST /children/{id}/voice/register?persona_id=` | 실제 Fish Audio 모델 등록. `FISH_API_KEY` 필요 |
| 부모 | `POST /children/{id}/pairing-codes` | `persona_id`; 5분·1회용 6자리 코드 |
| 공개 | `POST /tablet/pair` | `code`, `label?`; 기기 토큰·기기 반환. IP당 분당 5회 |
| 부모 | `GET /devices`, `DELETE /devices/{id}` | 기기 목록·연결 해제 |
| 태블릿 | `GET /tablet/context` | 기기·아이·페르소나·오늘 계획·체크리스트 |
| 공통 | `GET /learning-content` | 내부 시연 자료: 1일차 사과·바나나, 2일차 과자 |
| 부모 | `POST /children/{id}/plans` | `date`, `persona_id`, `day_number`(1/2), `feedback_id?` |
| 부모 | `GET /plans/{id}` | 계획·자료 ID·낭독 대본 |
| 부모 | `POST /plans/{id}/reading` | `audio_sample_id`, `mouth_sample_id`; 같은 계획·아이·페르소나의 실제 등록 샘플 검사 |
| 태블릿 | `POST /tablet/sessions` | `plan_id`, `mode?`; 세션과 첫 발화. 오늘·동의·낭독·사용 시간 검사 |
| 태블릿 | `POST /tablet/sessions/{id}/messages` | `text`; 자료 기반 응답과 `source_ids`, `engine`, 세션 상태 |
| 태블릿 | `POST /tablet/sessions/{id}/events` | `content_id`, `sense`, `action`, `reaction_ms?` |
| 태블릿 | `PATCH /tablet/sessions/{id}` | `mode: multisensory/audio_only` |
| 태블릿 | `POST /tablet/sessions/{id}/end` | 종료. 반복 호출 가능 |
| 태블릿 | `POST /tablet/sessions/{id}/stt` | multipart `file`; 실제 STT. 임시 파일 삭제 |
| 태블릿 | `POST /tablet/sessions/{id}/turn` | multipart `file`; STT → 자료 기반 응답. 무음은 `heard:false` |
| 태블릿 | `POST /tablet/sessions/{id}/stt-b64`, `POST /tablet/sessions/{id}/turn-b64` | JSON: `audio_b64`, `ext?`; multipart와 같은 동작·권한 검사 |
| 태블릿 | `POST /tablet/sessions/{id}/messages/{message_id}/tts` | 저장된 서버 발화만 TTS 합성. 임의 텍스트 합성 불가 |
| 태블릿 | `POST /tablet/sessions/{id}/frame` | multipart `file`; 프레임 분석 후 저장하지 않음 |
| 태블릿 | `GET /tablet/mouth-profile` | 연결한 페르소나의 입모양 기준값 |
| 부모 | `GET /children/{id}/home?date=&persona_id=` | 홈 요약과 저녁 할 일 |
| 부모 | `GET /children/{id}/report?date=&period=day/week` | 지정일 또는 최근 7일 집계 |
| 부모 | `GET /children/{id}/review?date=` | 부모 확인 항목 |
| 부모 | `PATCH /reviews/{id}` | `status: reviewed` |
| 부모 | `GET /children/{id}/timeline?date=` | 세션 시각·상태와 확인 항목. 전체 대화 원문 제외 |
| 부모 | `POST /children/{id}/evening-review` | `date`; 같은 날짜 반복 호출 가능 |
| 부모 | `POST /children/{id}/feedback` | `for_date`, `concerns?`, `new_words?`; `too_fast`는 다음 계획 slow |

### 처리 규칙

- 음성·입모양 등록에는 두 동의가 필요하다. `purpose`는 `onboarding` 또는 `night_reading`; 후자는 `plan_id` 필수다. 낭독 접수는 `required → submitted`이며 모델 학습 완료를 뜻하지 않는다.
- base64는 엄격히 디코딩하며 원본 20MB 이하, 확장자 `wav/m4a/mp3/webm/ogg/aac`만 허용한다. 앱의 새 호출 함수는 `app/src/lib/api.ts`의 `backendApi(token)`이다. 화면은 반환 토큰을 별도로 관리하고 역할에 맞는 인스턴스를 사용해야 한다.
- 부모·아이·페르소나·계획·기기·샘플의 소유 범위를 검사한다. 샘플과 TTS 모델은 아이+페르소나 조합으로 분리한다.
- 태블릿은 전체 가입 체크리스트와 현재 동의를 매 요청 검사한다. 철회/기기 해제 시 진행 세션을 종료한다.
- 대화 시간대는 서울 시각, 계획 날짜는 서울 날짜다. 같은 날의 시작/종료 시간만 지원하며 하루 상한은 서버가 수락한 세션 경과 시간 합계다. 새 세션/메시지/이벤트에서 제한한다. 단말의 자동 재생 중단은 앱이 담당한다.
- 아이별 동시 활성 세션은 하나. 계획 `(child_id,date)`, 계획 순서 `(plan_id,position)`, 발화 순서 `(session_id,sequence)`, 저녁 확인 `(child_id,date)`, 피드백 적용은 DB 유일성 제약으로 보호한다.
- 피드백은 같은 아이의 바로 다음날 계획에 한 번만 적용한다. 계획과 자료 연결은 단일 트랜잭션이다. 다른 피드백 선택지는 기록만 한다.
- 청각 모드에서 시각·촉각 이벤트를 거부한다. `haptics_enabled:false`는 단말 진동 금지이며 실제 터치 반응 기록 자체는 허용한다.
- 청각 모드 발화는 터치 지시 대신 함께 말하기 문장을 사용한다. 영어 노출 설정을 발화에도 반영한다. TTS는 세션 `slow`일 때 속도 0.8, 기본 0.95로 합성하며 캐시도 속도별로 분리한다.
- 아이 발화 원문은 DB에 저장하지 않는다. 범위 밖 질문은 안내·부모 확인 항목을 남긴다. 위험 표현은 가까운 어른에게 연결하는 문구와 함께 세션을 종료한다. 키워드 규칙은 의료/위험 판정 시스템이 아니다.
- LLM 키가 없으면 자료 기반 결정형 응답. 키가 있으면 LLM은 제공 자료 ID와 허용 칭찬 유형만 고른다. 출력은 서버 문장으로 재구성하며 외부 LLM에 아이 원문을 보내지 않는다. 실패 시 `engine: curriculum_fallback`.
- 감각 비율은 클라이언트가 보낸 이벤트 개수 비율이고 없으면 null. `practiced_words`는 따라 말하기 이벤트의 자료 단어이며 성공/습득 판정이 아니다. 발달 점수·학습률은 null. 세션 시간은 계획 날짜에 귀속하며 자정으로 나누지 않는다.
- 401 인증 오류, 403 역할 오류, 404 소유 항목 없음, 409 준비/상태/중복 오류, 413 파일 크기 초과, 422 입력 오류, 429 요청 제한, 502 외부 API 오류, 503 키 미설정/일시적 DB 잠금.

## 기존 임시 API (호환 시연용)

아래는 기존 앱이 호출하던 인증 없는 임시 경로다. **기본적으로 등록되지 않는다.** 격리된 시연 환경에서만 `ALLOW_LEGACY_API=true`로 켤 수 있다. 현재 앱 화면·`store.ts`는 아직 이 경로를 사용하므로 새 `/api` 토큰 흐름으로 전환해야 한다. 앱 화면 전환은 이 백엔드 변경에 포함하지 않았다.

> 16:30까지 확정. 바꾸면 `server/app/models.py` + `app/src/lib/types.ts` 같이 수정하고 단톡 공지.
> 서버 실행 후 `http://<서버>:8000/docs` 에서 바로 테스트 가능.

## 가입 (1회) — `routers/children.py`, `voice.py`, `vision.py`
| 메서드 | 경로 | 요청 | 응답 | 담당 |
|---|---|---|---|---|
| | | | | |

## 낮: 자율 대화 — `routers/conversation.py`
| 메서드 | 경로 | 요청 | 응답 | 담당 |
|---|---|---|---|---|
| | | | | |

## 밤: 확인 · 피드백 · 낭독 — `routers/evening.py`
| 메서드 | 경로 | 요청 | 응답 | 담당 |
|---|---|---|---|---|
| | | | | |

## 입력 파이프라인·아이 반응 (태희) — `routers/voice.py`, `vision.py`, `activity.py`
응답 타입은 `app/src/lib/types.ts`. 파일 업로드는 multipart, 필드 이름 `file`. 학습률 `Gauge = {progress, baseline, usable, amount, sentences, remaining_sentences}`
| 메서드 | 경로 | 요청 | 응답 | 화면 |
|---|---|---|---|---|
| POST | `/voice/parent-sample` | `child_id`, `text`(읽은 문장), `kind`(signup\|plan), `file` | `features, quality{ok,quiet,loud,message}, gauge, gained` | 1-5 목소리, 2-4 낭독 |
| GET | `/voice/gauge/{child_id}` | | `Gauge` (최소 30초 / 100%=60초) | 2-1 홈 |
| GET | `/voice/analysis/{child_id}` | | `summary, traits[], tips[]` (발화 간격·톤·속도 → 의사소통 피드백) | 1-5 |
| GET | `/voice/coaching/{child_id}` | | `messages[]` (가입 기준 대비 톤·입모양·속도) | 2-4 |
| POST | `/vision/parent-mouth-track` | JSON `{child_id, kind, text, track:[{t,open,width,face}]}` (앱이 기기 안에서 0.05초마다 잰 수치) | `ok, profile, gauge, gained, message` | 1-6, 2-4 |
| POST | `/vision/parent-mouth` | (예비) `child_id, kind, text, file`(영상) → 수치만 뽑고 영상 삭제 | 위와 같음 | WebView 카메라 안 될 때 |
| GET | `/vision/gauge/{child_id}` | | `Gauge` (최소 20초 / 100%=40초) | 2-1 홈 |
| GET | `/vision/mouth-profile/{child_id}` | | `open_p50, open_p90, width_p50…` → 아바타 입 크기 | 아이 태블릿 |
| POST | `/voice/stt` | `file`, `expected`('사과\|apple'), `who` | `text, features, matched, alert` | 3-4 따라 말하기 |
| POST | `/activity/{child_id}` | JSON `{events:[{type, t, data}]}` type: touch·gaze·smile·imitate·repeat·voice·listen·out_of_scope·alert·session | `ok` | 아이 태블릿 (3초마다 묶어서) |
| GET | `/activity/{child_id}/summary?day=` | | `sessions, touches, reaction_ms, gaze_s, smiles, repeats, repeat_ok, words, favorites, balance{visual,audio,touch}, out_of_scope, alerts` | 2-1 홈, 2-2 리포트 |
| GET/PUT | `/profile/{child_id}` | (임시) 가입 정보·설정·일차·피드백 JSON (`linkCode`·`devices`는 아래 전용 API로만 바뀜) | 프로필 | 부모 앱 |
| GET | `/link/{code}` | 태블릿 연결 키 | 프로필 (재발급된 이전 키는 404) | 아이 태블릿 연결 |
| POST | `/profile/{child_id}/link-code` | | `{linkCode}` 새 키, 이전 키 무효 + 아이 기기 연결 해제 | 설정 탭 |
| POST | `/profile/{child_id}/devices` | `{device_id, role(parent\|child), name}` | `{devices}` | 기기 등록 (부모 앱 열 때·태블릿 연결 때) |
| DELETE | `/profile/{child_id}/devices/{device_id}` | | `{devices}` | 설정 탭 연결 해제, 태블릿 어른 메뉴 |
| GET | `/profile/{child_id}/history` | | `{voice[], mouth[], days[]}` 최근 낭독·아이 하루 요약 | 설정 탭 학습 이력 |
| POST | `/debug/log` | 텍스트 | `{ok}` | 앱 오류를 서버 터미널에 출력 (원인 추적용) |

## TTS (민주, Fish Audio 초안 태희) — `routers/voice.py`, `tts/fish.py`
| POST | `/voice/register` | `child_id` | `model_id, state, sample_count` | 품질 좋은 최근 20문장 + 대본으로 목소리 등록/갱신 |
|---|---|---|---|---|
| POST | `/voice/tts` | JSON `{child_id, text}` | `url`(mp3, 공개 /static) | 아바타 말하기 (실패 시 앱이 기기 TTS로 대체) |

- 저장: 부모 음성 `server/data/children/<id>/parent/voice/<kind>/sample_NNN.{wav,json}`, 입모양 `…/parent/mouth/<kind>/profile_NNN.json`, 아이 반응 `…/activity/<날짜>.jsonl` (모두 비공개)
- **민주**: 목소리 등록 원본은 `routers/voice.py`의 `samples(child_id)` (wav + 대본 text + 품질)

## 로그인 (서버 구현: 민주) ← 앱은 이미 이 계약으로 호출 중 (`app/src/lib/account.ts`)
| 메서드 | 경로 | 요청 (JSON) | 응답 (JSON) | 화면 |
|---|---|---|---|---|
| POST | `/auth/signup` | `{login_id, password, child_id}` | `{login_id, child_id, token}` / 409 이미 있는 아이디 / 400 형식 오류 | 가입 1-7, 설정 탭 |
| POST | `/auth/login` | `{login_id, password}` | `{login_id, child_id, token, profile}` / 401 틀림 | 1-1 로그인 |
| POST | `/auth/password` | `{login_id, password, new_password}` | `{token}` / 401 | 설정 탭 |

- `login_id`는 앱이 소문자로 보냄 (영문·숫자·`_.@-` 3~40자), 비밀번호 4자 이상
- `profile`은 `GET /profile/{child_id}`와 같은 모양 → 앱이 이 기기에 저장하고 부모 앱으로 들어감
- 서버가 404/연결 실패면 앱은 가입을 막지 않고 아이디만 기기에 저장 → 설정 탭 "다시 등록"
- 비밀번호는 해시로 저장 (예: PBKDF2/bcrypt). 토큰 검사는 다른 API에 나중에 붙여도 됨

## 에이전트 대화 (충항) — `routers/conversation.py` ← 앱은 이미 이 계약으로 호출 중 (`app/src/lib/agent.ts`)
| 메서드 | 경로 | 요청 (JSON) | 응답 (JSON) |
|---|---|---|---|
| POST | `/conversation/turn` | `{child_id, day, item('apple'\|'banana'\|'snack'), moment('invite'\|'reply'), child_text?}` | `{text, out_of_scope?, blocked?}` |

- `moment=invite`: 아바타가 사물을 권하는 첫 마디 (예: "지호야, 사과 한 입 먹어볼까?"). `reply`: 아이 말(`child_text`, STT 결과)에 대답
- `text`: 아바타가 말할 문장. 검증된 학습 범위 안에서만. 프로필(`GET /profile/{child_id}`)의 부모 호칭·말투·피드백 반영
- `out_of_scope=true`: 아이 말이 범위 밖 → 앱이 부모 확인 목록에 기록하고 `text`(주제로 되돌리는 말)를 말함
- `blocked`: 출력 전 검사에서 막은 원래 문장 → 앱이 리포트의 "차단된 문장"으로 기록 (기획 v2: 리포트에 반드시 포함)
- **2.5초 안에 답이 없거나 404/에러면 앱은 커리큘럼 고정 문장으로 말함** → 에이전트가 없어도 시연은 돌아감
- 부모 피드백(밤 2-3)은 프로필 `feedback[]`에 `{day, issues[], note, review[], newWords}`로 쌓임 → 다음날 대사에 반영

## LLM (에이전트용, 충항)
- `server/app/llm.py`의 `chat(system, messages)` 사용. Lablup Token Factory(Anthropic 호환) 경유, 모델 `ANTHROPIC_MODEL`

### 앱 아이디 로그인 (Supabase PostgreSQL 저장)

`SUPABASE_DB_URL` 설정 시 계정·세션·가족 프로필은 Supabase DB에 저장된다. Supabase Auth가 아닌 자체 아이디 인증이다.

- `POST /auth/signup`: `{login_id, password, child_id, profile?}` → 201 `{login_id, child_id, token}`. 중복 아이디/child_id는 409.
- `POST /auth/login`: `{login_id, password}` → `{login_id, child_id, token, profile}`. 잘못된 자격 증명은 401.
- `POST /auth/password`: `{login_id, password, new_password}` → `{token}`. 기존 모든 세션을 폐기한다.
- `PUT /auth/profile`: Bearer 또는 HttpOnly 쿠키 인증, 프로필 일부 객체 → 병합된 프로필. childId는 계정에 연결된 값으로 고정한다.
- `POST /auth/logout`: `{ok: true}`. 현재 세션을 폐기하고 쿠키를 삭제한다. 만료/기폐기 상태도 성공한다.

아이디는 소문자로 정규화하며 공백 없는 3~60자이다. 새 비밀번호는 기본 8~128자(`PASSWORD_MIN_LENGTH` 설정 가능), 기존 비밀번호 로그인은 유지한다. 비밀번호 원문과 토큰 원문은 DB에 저장하지 않는다. 부모 토큰은 7일 유효하고 기존 `/api`와 같은 `AccessToken`을 사용한다.

`/profile/{child_id}` GET/PUT, 기기 등록/삭제, 연결 코드 재발급, 이력 조회는 인증과 가족 소유권 검사가 적용된다. 프로필 쓰기/이력/기기 삭제/코드 발급은 부모 전용이다. `familyprofile`에 저장하며 기존 JSON 파일에는 쓰지 않는다.
`GET /link/{code}`는 10분짜리 일회용 코드를 교환해 태블릿 프로필, `token`, `expires_at`을 반환하고 HttpOnly 쿠키를 설정한다. 신규 코드 발급은 기존 태블릿 세션을 폐기한다. 초기 코드는 앱의 6자리 child_id를 사용하며 이후에는 서버 난수 코드다.
현재 화면이 Bearer/쿠키를 전송하지 않는 환경에서는 401이 발생한다. 프론트엔드 수정 없이 무인증 접근을 허용하지 않는다. 상세 설정·이전·검증·화면 제약은 `server/README.md`를 참고한다.

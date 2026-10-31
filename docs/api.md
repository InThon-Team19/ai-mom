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
- 부모·아이·페르소나·계획·기기·샘플의 소유 범위를 검사한다. 샘플과 TTS 모델은 아이+페르소나 조합으로 분리한다.
- 태블릿은 전체 가입 체크리스트와 현재 동의를 매 요청 검사한다. 철회/기기 해제 시 진행 세션을 종료한다.
- 대화 시간대는 서울 시각, 계획 날짜는 서울 날짜다. 같은 날의 시작/종료 시간만 지원하며 하루 상한은 서버가 수락한 세션 경과 시간 합계다. 새 세션/메시지/이벤트에서 제한한다. 단말의 자동 재생 중단은 앱이 담당한다.
- 아이별 동시 활성 세션은 하나. 계획 `(child_id,date)`, 계획 순서 `(plan_id,position)`, 발화 순서 `(session_id,sequence)`, 저녁 확인 `(child_id,date)`, 피드백 적용은 DB 유일성 제약으로 보호한다.
- 피드백은 같은 아이의 바로 다음날 계획에 한 번만 적용한다. 계획과 자료 연결은 단일 트랜잭션이다. 다른 피드백 선택지는 기록만 한다.
- 청각 모드에서 시각·촉각 이벤트를 거부한다. `haptics_enabled:false`는 단말 진동 금지이며 실제 터치 반응 기록 자체는 허용한다.
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
| GET/PUT | `/profile/{child_id}` | (임시) 가입 정보·설정·일차·피드백 JSON | 프로필 | 태블릿 연결(코드 = child_id) |

## TTS (민주, Fish Audio 초안 태희) — `routers/voice.py`, `tts/fish.py`
| POST | `/voice/register` | `child_id` | `model_id, state, sample_count` | 품질 좋은 최근 20문장 + 대본으로 목소리 등록/갱신 |
|---|---|---|---|---|
| POST | `/voice/tts` | JSON `{child_id, text}` | `url`(mp3, 공개 /static) | 아바타 말하기 (실패 시 앱이 기기 TTS로 대체) |

- 저장: 부모 음성 `server/data/children/<id>/parent/voice/<kind>/sample_NNN.{wav,json}`, 입모양 `…/parent/mouth/<kind>/profile_NNN.json`, 아이 반응 `…/activity/<날짜>.jsonl` (모두 비공개)
- **민주**: 목소리 등록 원본은 `routers/voice.py`의 `samples(child_id)` (wav + 대본 text + 품질)

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

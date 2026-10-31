# API 명세 (담당: 민주)

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

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

## LLM (에이전트용, 충항)
- `server/app/llm.py`의 `chat(system, messages)` 사용. Lablup Token Factory(Anthropic 호환) 경유, 모델 `ANTHROPIC_MODEL`

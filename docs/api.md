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

## 입력 파이프라인 (태희) — `routers/voice.py`, `vision.py`
모두 `multipart/form-data`, 파일 필드 이름은 `file`. 응답 타입은 `app/src/lib/types.ts`.
| 메서드 | 경로 | 요청 | 응답 | 쓰는 곳 |
|---|---|---|---|---|
| POST | `/voice/parent-sample` | `child_id`, `file`(m4a 등) | `url, features, total_speech_s, progress(학습률 0~1), sample_count` | 가입 3 목소리 |
| POST | `/voice/stt` | `file`, `expected`(따라 말하기 목표, 선택), `who`(child\|parent) | `text, features, matched` | 아이 따라 말하기, 부모 낭독 |
| POST | `/vision/parent-mouth` | `child_id`, `kind`(signup\|plan), `file`(mp4) | `ok, face_ratio, sprites[4], face_url, video_url, audio_url, track_url, message` | 가입 4 입모양, 밤 낭독 |
| POST | `/vision/child-frame` | `file`(jpg) | `face, looking, mouth_open, mouth, gaze` | 아이 대화 (1.5초 간격) |

- 저장 위치: `server/static/children/<child_id>/parent/{voice,signup,plan}/` → `/static/...` URL
- **민주(TTS)**: 목소리 등록은 `routers/voice.py`의 `parent_samples(child_id)`가 돌려주는 wav 목록을 ElevenLabs에 올리면 됨. 입모양 영상의 음성(`audio_url`)도 샘플로 사용 가능
- **아바타 립싱크**: TTS 오디오 음량에 맞춰 `sprites[0]`(닫힘) ~ `sprites[3]`(크게 벌림)을 바꿔 끼우는 방식

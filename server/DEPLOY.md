# 서버 클라우드 배포 (3주 시연용) — 담당: 태희

노트북 없이 항상 켜져 있게 Railway 에 올린다. 녹음 파일·DB 는 볼륨(/data)에 저장돼 재배포해도 남는다.

## 1. Railway 프로젝트 만들기
1. https://railway.app 에 GitHub 로 로그인 → New Project → Deploy from GitHub repo → `InThon-Team19/ai-mom`
2. 서비스 Settings → **Root Directory: `server`** (Dockerfile 로 빌드됨)
3. 서비스 → **Volumes → Add Volume → Mount path: `/data`** (1GB 면 충분)
4. Settings → Networking → **Generate Domain** → `https://xxxx.up.railway.app` 주소가 생김

## 2. 환경 변수 (Variables) — server/.env 와 같은 키, 값은 절대 커밋하지 않음
| 키 | 비고 |
|---|---|
| `GROQ_API_KEY` | 아이 말 인식 |
| `OPENAI_API_KEY` | (선택) 인식 대체 |
| `FISH_API_KEY` | 엄마 목소리 |
| `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` | Token Factory 대화 |
| `ALLOW_LEGACY_API` | `true` (Dockerfile 기본값) |
| `PUBLIC_BASE_URL` | 위에서 만든 https 주소 (TTS mp3 주소에 씀) |
| `CORS_ORIGINS` | 필요 시 |

`DATA_DIR=/data/files`, `DB_URL=sqlite:////data/aibom.db`, `TZ=Asia/Seoul` 은 Dockerfile 에 들어 있음.
Supabase 를 쓰려면 `SUPABASE_DB_URL` 을 넣으면 DB 만 Supabase 로 감(녹음 파일은 여전히 볼륨).

## 3. 앱 연결
- APK 첫 화면 아래 **서버 주소** 칸에 `https://xxxx.up.railway.app` 입력 → 저장 (다시 빌드 불필요)
- 또는 `app/eas.json` 의 `preview.env.EXPO_PUBLIC_API_URL` 을 그 주소로 바꿔 다시 빌드하면 기본값이 됨

## 4. 확인
`https://xxxx.up.railway.app/health` → `{"ok": true}` / `/docs` 에서 API 확인.
노트북 DB 의 계정은 옮겨지지 않으므로 시연 계정을 새로 가입하고 태블릿을 다시 연결한다.

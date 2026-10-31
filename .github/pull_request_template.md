<!-- 해커톤 중에는 main 직접 push가 기본. PR은 큰 변경을 같이 보고 싶을 때만 -->
## 무엇을
-

## 확인
- [ ] 앱: `npx tsc --noEmit` 통과
- [ ] 서버: `uvicorn app.main:app` 실행 후 `/docs`에서 해당 API 호출 확인
- [ ] API/타입 바꿨으면 `docs/api.md` + `app/src/lib/types.ts` + `server/app/models.py` 같이 수정

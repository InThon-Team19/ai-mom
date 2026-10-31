#!/usr/bin/env bash
# 팀장 1회 실행: GitHub repo 생성 + 권한 + 머지 설정 (팀원은 main에 직접 push)
# 필요: gh CLI 로그인 (gh auth login), org 생성 + 팀원 org 초대 완료
# 사용: ./scripts/setup-github.sh <org> <repo> <member1> <member2> <member3>
set -euo pipefail
ORG=$1; REPO=$2; shift 2; MEMBERS=("$@")

# 1) repo 생성 + 첫 push (Public이어야 무료 org에서 브랜치 보호 가능)
git init -b main 2>/dev/null || true
git add . && git commit -m "chore: init aibom repo" || true
gh repo create "$ORG/$REPO" --public --source=. --remote=origin --push

# 2) 팀원 Write 권한
for m in "${MEMBERS[@]}"; do
  gh api -X PUT "repos/$ORG/$REPO/collaborators/$m" -f permission=push >/dev/null && echo "write: $m"
done

# 3) 머지 방식: squash만, 머지 후 브랜치 자동 삭제
gh api -X PATCH "repos/$ORG/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null && echo "merge: squash only"

# 4) main 보호 없음: 해커톤 중엔 팀원 전원 main 직접 push (README Git 규칙 참고)

echo "완료 → https://github.com/$ORG/$REPO"

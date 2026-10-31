#!/usr/bin/env bash
# 팀장 1회 실행: GitHub repo 생성 + 권한 + main 보호 + 시작 브랜치
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

# 4) main 보호: PR 필수, 승인 0명 (해커톤용) — Private + 무료 org면 실패하니 팀 약속으로 대체
gh api -X PUT "repos/$ORG/$REPO/branches/main/protection" --input - <<'JSON' >/dev/null && echo "main: protected" || echo "main 보호 실패 (Private 무료 org) → '직접 push 금지' 팀 약속으로"
{"required_status_checks": null, "enforce_admins": false,
 "required_pull_request_reviews": {"required_approving_review_count": 0},
 "restrictions": null, "allow_force_pushes": false, "allow_deletions": false}
JSON

# 5) 역할별 시작 브랜치 (각자 여기서 시작 → 기능 하나 끝나면 PR)
for b in feat/minju-backend-init feat/minju-tts feat/chungang-parent-screens feat/taehee-vision feat/taehee-agent feat/mincheol-design; do
  git push -q origin "main:refs/heads/$b" && echo "branch: $b"
done
echo "완료 → https://github.com/$ORG/$REPO"

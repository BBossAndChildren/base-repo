#!/usr/bin/env bash
# 저장소 라벨 세트 생성 — 새 저장소에서 한 번 실행한다 (이미 있으면 색·설명만 갱신)
# 사용: gh auth login 후 저장소 루트에서  bash scripts/setup-labels.sh
set -euo pipefail

label() { gh label create "$1" --color "$2" --description "$3" --force; }

# 유형 — 커밋 type 과 같은 이름. 이슈·PR 마다 하나
label "feat"     "1D76DB" "새 기능"
label "fix"      "D73A4A" "버그 수정"
label "hotfix"   "B60205" "배포 환경 긴급 수정"
label "refactor" "5319E7" "동작 변경 없는 구조 개선 · UI/CSS 변경"
label "docs"     "0075CA" "문서"
label "test"     "BFD4F2" "테스트 추가·수정"
label "chore"    "C5DEF5" "설정 · 빌드 · 배포"

# 영역 — 커밋 scope 와 같은 이름
label "be"       "F9D0C4" "백엔드"
label "fe"       "C2E0C6" "프론트엔드"

# 상태 · 우선순위
label "priority: high" "E99695" "먼저 처리"
label "blocked"        "000000" "다른 작업·결정을 기다리는 중"
label "question"       "D876E3" "논의·결정이 필요함"
label "wontfix"        "FFFFFF" "처리하지 않기로 함 (사유를 댓글로)"
label "duplicate"      "CFD3D7" "중복 이슈"

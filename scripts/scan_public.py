#!/usr/bin/env python3
"""공개 저장소에 개인정보·비밀값이 들어가지 않았는지 검사한다.

사용: python3 scripts/scan_public.py [검사할 폴더, 기본 .]
검출되면 종료 코드 1. GitHub Actions(배포 전)와 로컬 pre-push 훅이 같이 쓴다.
"""
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

PATTERNS = {
    "GitHub 토큰": r"\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}",
    "Anthropic 키": r"\bsk-ant-[A-Za-z0-9_-]{20,}",
    "OpenAI 키": r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}",
    "Google API 키": r"\bAIza[0-9A-Za-z_-]{35}",
    "Notion 토큰": r"\b(?:secret_|ntn_)[A-Za-z0-9]{40,}",
    "Telegram 봇 토큰": r"\b\d{8,10}:AA[A-Za-z0-9_-]{30,}",
    "Slack 토큰": r"\bxox[abprs]-[A-Za-z0-9-]{10,}",
    "개인 키": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "이메일": r"[A-Za-z0-9._%+-]+@(?:gmail|naver|daum|hanmail|kakao|icloud|outlook|hotmail)\.[a-z.]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.ac\.kr",
    "전화번호": r"\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b",
    "주민등록번호": r"\b\d{6}-[1-4]\d{6}\b",
    "Drive 문서 ID": r"(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])",
    "Gist ID": r"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])",
    "로컬 경로": r"/Users/[A-Za-z0-9_-]+/",
    "개인 이름": r"희원|민희원|2145091",
    "보드 개인 데이터 키": r"\"deadlines\"\s*:|\"jobs\"\s*:\s*\{",
}
BLOCKED_FILES = re.compile(
    r"(^|/)(\.env(\..*)?|\.dev\.vars|.*\.pem|.*\.key|id_rsa.*|credentials.*\.json|.*\.token|settings\.local\.json)$"
)
ALLOWED_ENV_EXAMPLE = re.compile(r"(^|/)\.env\.example$")
TEXT_EXT = {".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".md", ".txt", ".yml", ".yaml", ".py", ".sh", ""}
SKIP_DIRS = {".git", "node_modules"}
SELF = os.path.normpath("scripts/scan_public.py")


def main() -> int:
    problems = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            if os.path.normpath(rel) == SELF:
                continue
            if BLOCKED_FILES.search(rel) and not ALLOWED_ENV_EXAMPLE.search(rel):
                problems.append(f"{rel}: 공개 금지 파일 형식")
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT:
                continue
            try:
                text = open(path, encoding="utf-8").read()
            except UnicodeDecodeError:
                continue
            for label, pattern in PATTERNS.items():
                for m in re.finditer(pattern, text):
                    line = text.count("\n", 0, m.start()) + 1
                    problems.append(f"{rel}:{line}: {label}")
    if problems:
        print("공개 금지 항목이 발견되어 중단합니다 (값은 출력하지 않음):")
        for p in problems:
            print("  -", p)
        return 1
    print("검사 통과: 개인정보·비밀값 패턴 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())

# 정적 학습 페이지

- `/` 마케팅·투자 퀴즈
- `/bucket/` 버킷리스트 노트 (데이터는 사용자 본인의 비공개 Gist, 토큰은 각 기기 브라우저에만 저장)

`main`에 푸시하면 GitHub Actions가 `scripts/scan_public.py`로 개인정보·비밀값을 검사하고, 통과했을 때만 `site/`를 Pages로 배포합니다.

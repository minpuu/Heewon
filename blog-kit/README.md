# 블로그 반자동화 키트

네이버 블로그(홈판 + 애드포스트)를 위한 작업 도구 모음입니다.
**발행은 사람이 직접** 합니다. 자동 발행(매크로)은 약관 위반이라 쓰지 않습니다.
이 키트는 그 앞 단계인 소재 찾기, 초안, 이미지, 팩트체크를 줄여줍니다.

```
blog-kit/
├── draft-kit/              ① 초안 키트
│   ├── style-guide.md        문체·제목·이미지·광고 표기 기준
│   ├── persona.md            "나"의 설정 시트 (직접 채우기)
│   ├── memo-form.md          초안 요청 메모 양식 + 요청 문장
│   ├── factcheck.md          발행 전 체크리스트 + 공식 출처 목록
│   ├── seasonal-calendar.md  월별 2030 돈 일정
│   └── templates/
│       ├── 1-experience.md   개별 경험담
│       ├── 2-curation.md     이슈 큐레이션
│       └── 3-hub.md          허브(모아보기)
├── infographic/            ② 인포그래픽 생성기
│   ├── brand.json            블로그 이름·색상
│   ├── generate.mjs          JSON → PNG 카드
│   └── cards/                카드 데이터 (example-*.json 참고)
├── briefing/               ③ 아침 브리핑
│   └── prompt.md             예약 작업 프롬프트 원본
└── drafts/                 초안 저장 폴더
```

## 글 1편 만드는 흐름

| 단계 | 누가 | 할 일 | 시간 |
|---|---|---|---|
| 1 | 자동 | 아침 7:43 브리핑 도착 (휴대폰 알림) | — |
| 2 | 나 | 소재 고르기, 경험이면 사진·캡처 챙기기 | 5분 |
| 3 | 나 | `memo-form.md` 양식을 `drafts/`에 복사해서 채우기 | 10분 |
| 4 | Claude | 초안 + 제목 후보 + 태그 + 카드 JSON 작성 | — |
| 5 | Claude | `node generate.mjs`로 카드 PNG 생성 | — |
| 6 | 나 | `[직접 작성]` 칸 채우기, 내 말투로 다듬기 | 20~30분 |
| 7 | 나 | `factcheck.md` 체크리스트 확인 | 5분 |
| 8 | 나 | 네이버에 붙여넣기, 사진 배치, **예약발행** | 15분 |

## ① 초안 키트

처음 한 번: `draft-kit/persona.md`를 내 실제 상황으로 채웁니다.

매번: `memo-form.md` 하단의 "요청 문장"을 복사해서 Claude에게 보냅니다.
경험이 없는 부분은 초안에 `[직접 작성: ○○]`로 남도록 되어 있습니다. AI가 경험을 지어내면 안 되기 때문입니다.

## ② 인포그래픽 생성기

```bash
cd blog-kit/infographic
npm install                       # 처음 한 번 (폰트 설치)
node generate.mjs cards/파일.json  # → out/파일.png (1080×1080)
npm run build                     # cards/ 전체
```

Node.js와 Playwright(Chromium)가 필요합니다. 이 클라우드 환경에는 이미 설치돼 있습니다.

### 카드 종류

| type | 용도 | 주요 필드 |
|---|---|---|
| `stat` | 큰 숫자 하나 | `label`, `value`, `unit`, `sub`, `note` |
| `bars` | 항목 비교 막대 | `items: [{label, value, display}]`, `highlight` |
| `compare` | 전/후, A/B | `left`, `right` (`tag`, `label`, `value`, `unit`, `sub`), `highlight` |
| `summary` | 한눈에 요약 표 | `rows: [["대상", "…"], …]` |
| `steps` | 신청 순서 | `steps: ["…", …]` |

공통 필드: `kicker`(작은 라벨), `title`, `source`(출처, 하단 표시)
- 글자 사이에 `**굵게**`를 쓰면 초록 강조색이 됩니다.
- 제목·막대 이름에서 `\n`은 줄바꿈입니다.
- 블로그 이름과 색상은 `brand.json`에서 바꿉니다.

## ③ 아침 브리핑

- 예약 작업 이름: **2030 경제 이슈 아침 브리핑**
- 매일 오전 7:43 (서울), 실행될 때마다 새 세션이 열리고 끝나면 푸시 알림
- 내용: 최근 48시간 2030 돈 이슈 Top 3 (출처·숫자·제목 후보), 2~4주 내 일정, 기존 글 업데이트 알림
- 프롬프트 수정: `briefing/prompt.md`를 고친 뒤 Claude에게 반영 요청
- 끄기·시간 변경: Claude에게 "아침 브리핑 꺼줘 / 8시로 바꿔줘"

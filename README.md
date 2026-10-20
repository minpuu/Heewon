# 오늘 어디 (임시 서비스명)

> 현재 위치에서 걸어갈 수 있는 식당 한 곳을 바로 결정해주는 모바일 웹 앱.
> "뭐 먹을래?" "아무거나." 를 끝내는 것이 목적이다. 검색보다 결정을 먼저 보여준다.

서비스명은 아직 확정되지 않았다. 변경은 `src/config/app.ts` 의 `APP_NAME` 한 곳에서 한다.

## 실행 방법

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run typecheck  # 타입 검사
npm test           # 도메인 로직 단위 테스트
npm run build      # 프로덕션 빌드
npm start          # 빌드 결과 실행
```

API 키나 외부 서비스 없이 Mock 데이터로 전체 흐름이 동작한다.
iPhone 390px 화면을 기준으로 설계했다. 데스크톱에서는 가운데 카드 형태로 보인다.

## 화면 구성

| 경로 | 화면 | 내용 |
| --- | --- | --- |
| `/` | 거리 선택 | 위치 표시·변경, 도보 5/10/15분 (기본 10분), 제외 조건 설정, "아무거나 골라줘" |
| `/pick?walk=10` | 결과 | 식당 한 곳. 길찾기 · 다시 뽑기 · 목록 보기 |
| `/list?walk=10` | 목록 | 카테고리 탭(전체/한식/중식/일식/양식/기타)과 식당 수, 항목 선택 시 상세 시트 → "여기로 결정" |

기본 흐름은 `/` → `/pick` 두 번의 조작으로 끝난다.

## 추천 로직

1. 현재 위치 확인 (브라우저 Geolocation, 또는 테스트 기준 위치)
2. 반경 내 식당 조회 (`restaurantProvider.searchNearby`)
3. 도보 정보 계산 (`walkingRouteProvider.getWalkingRoute`) — 경로를 구할 수 없는 식당은 제외
4. 도보 시간 초과 · 영업 종료 · 켜진 제외 조건 적용 (`filterRestaurants`)
5. 이번 세션에서 추천한 식당을 피하며 균등 랜덤 선택 (`pickRandomRestaurant`)
   - 모든 후보를 소진하면 이력을 비우고 다시 시작한다. 직전 식당은 가능한 한 피한다.
   - 후보가 1곳뿐이면 같은 식당이 나올 수 있고, 화면에 그 사실을 안내한다.

### 파일 구조

```
src/
  config/app.ts              서비스명, 도보 옵션, 검색 반경
  domain/                    순수 로직 (UI 의존 없음, 테스트 대상)
    types.ts                 Restaurant, WalkingRoute, Candidate
    geo.ts                   calculateDistanceMeters (Haversine)
    walking.ts               estimateWalkingMinutes, WalkingRouteProvider, EstimatedWalkingRouteProvider
    filter.ts                filterRestaurants, groupRestaurantsByCategory
    pick.ts                  pickRandomRestaurant
    exclusions.ts            제외 조건 타입·기본값
    mapLink.ts               길찾기 URL
  data/                      데이터 제공자 (API 교체 지점)
    restaurantProvider.ts    RestaurantProvider 인터페이스
    mockRestaurantProvider.ts, mockRestaurants.ts  가상 샘플 데이터
    presetLocations.ts       테스트 기준 위치
    index.ts                 사용할 provider 선택
  services/getNearbyRestaurants.ts
  hooks/                     위치 컨텍스트, 제외 조건, 후보 조회, 결과 세션
  lib/                       저장소 래퍼, 세션 이력, 표시용 포맷
  components/                공통 UI (시트, 토글, 상태 패널 등)
  screens/                   Home / Pick / List 화면
  app/                       App Router 라우트 (얇은 래퍼)
tests/domain.test.ts         도메인 단위 테스트
```

## 중요한 정책과 한계

### 도보 시간은 추정치다

현재 도보 시간은 **좌표 기반 직선거리 × 우회 계수 1.2 ÷ 보행 속도 80m/분**으로 계산한 추정치다.
실제 보행 경로가 아니므로 "도보 10분 이내" 필터가 정확하게 지켜진다고 보장하지 않는다.
화면에는 항상 "도보 약 N분"으로 표시하고, 목록 상단에 추정치임을 밝힌다.
`WalkingRoute.source` 는 `"estimate"` 또는 `"route"` 로 구분되며, 실제 보행 API 연결 시 `"route"` 로 바뀐다.

### 제외 조건과 미확인 데이터

| 조건 | 제외 대상 |
| --- | --- |
| 날것 중심 식당 제외 (ON) | `rawFood === true` 이거나 **미확인(`null`)** 인 식당 |
| 대기 잦은 식당 제외 (ON) | `highWaitingRisk === true` 이거나 **미확인(`null`)** 인 식당 |

- 제외 조건을 켜면 **확인된 정보가 있는 식당만** 통과한다. 미확인 식당을 안전하다고 임의로 판단하지 않는다.
- 제외 조건은 "확인된 정보 기준"의 필터이며, 실제 메뉴나 대기 상황을 보장하지 않는다.
- 대기 제외는 실시간 웨이팅이 아니라 "대기가 잦다고 확인된 식당" 기준이다.
- 영업 종료(`closed`)로 확인된 식당은 제외 조건과 관계없이 항상 제외한다. 확인 불가(`unknown`)는 제외하지 않고 "영업 중" 표시만 생략한다.

### 샘플 데이터

- `src/data/mockRestaurants.ts` 의 식당은 모두 **가상**이다. 이름·주소·메뉴·영업 정보는 실제와 무관하다.
- 샘플 좌표는 실제 가게 위치가 아니므로 길찾기 결과도 테스트용이다.
- 화면 곳곳에 "샘플 데이터 · 실제 영업 정보가 아니에요" 를 표시한다.
- 기준 위치는 공덕·역삼·명동 세 곳에 샘플이 있다.

### 위치

- 최초 실행 시 브라우저 위치 권한을 요청한다. 허용하면 현재 좌표를 쓴다.
- 권한이 거부되거나 지원되지 않으면 안내를 표시하고, "아무거나 골라줘"는 비활성화된다. 테스트 기준 위치를 고를 수 있다.
- 현재 위치 라벨은 "현재 위치"로 표시한다. 좌표를 주소로 바꾸는 역지오코딩은 Phase 2에서 연결한다.
- 테스트 기준 위치를 고르면 다음 방문에도 유지된다. "현재 위치 사용"을 고르면 해제된다.

### 저장되는 값 (브라우저 `localStorage` / `sessionStorage`)

| 키 | 저장소 | 내용 |
| --- | --- | --- |
| `exclusion-settings` | localStorage | 제외 조건 두 개 |
| `location-preset` | localStorage | 선택한 테스트 기준 위치 |
| `pick-history` | sessionStorage | 이번 탭에서 추천한 식당 id (거리·제외 조건이 바뀌면 초기화) |

회원가입, 프로필, 서버 데이터베이스는 사용하지 않는다.

## 실제 API 연결 방법 (Phase 2)

1. `RestaurantProvider` 를 구현한다 (`src/data/restaurantProvider.ts`). 반환값은 반경 안의 식당 목록이다.
2. `WalkingRouteProvider` 를 구현한다 (`src/domain/walking.ts`). 실제 보행 경로와 시간을 `source: "route"` 로 반환한다.
3. `src/data/index.ts` 에서 provider를 교체한다.
4. API 키는 클라이언트 코드에 넣지 않는다. 서버 측 환경변수나 Route Handler를 거친다.
5. 외부 API의 최신 공식 문서에서 사용 조건, 호출 제한, 비용, 데이터 이용 조건을 확인한다. API가 주지 않는 정보는 만들어 쓰지 않는다.

길찾기는 현재 Google Maps 도보 길찾기 URL(`src/domain/mapLink.ts`)을 쓴다. 국내 지도 서비스로 바꾸려면 이 파일만 고치면 된다.

## 검증

- `npm test`: 거리 계산, 도보 추정, 도보 시간·영업 종료·제외 조건 필터, 카테고리 묶음, 랜덤 중복 회피, 후보 없음, 후보 1곳 처리, 길찾기 URL, 쿼리 파싱을 검사한다 (28개).
- `npm run typecheck`, `npm run build` 통과.
- 브라우저 시나리오(Playwright, 390px 뷰포트)로 확인한 항목: 기본 흐름, 다시 뽑기 중복 회피, 목록 보기, 카테고리 필터, 상세 시트와 길찾기 링크, 날것 제외 ON 시 추천 제외, 제외 조건 저장, 5분 거리 필터, 후보 없음 안내, 위치 권한 거부 후 기준 위치 선택.

## 아직 구현하지 않은 것 (Phase 2 이후)

- 실제 장소 검색 API, 실제 보행 경로·도보 시간
- GPS 좌표 → 주소 변환 (현재는 "현재 위치"로 표시)
- 실제 영업 상태 데이터
- 지도 SDK 기반 길찾기 (현재는 외부 지도 앱으로 연결)

의도적으로 만들지 않은 기능 (MVP 범위 밖): 회원가입, 프로필, 리뷰·별점, AI 추천, 그룹 투표, 즐겨찾기, 방문 기록, 실시간 웨이팅, 세부 필터, 복잡한 지도 탐색 화면.

## 알려진 사항

- `npm audit --omit=dev` 는 Next.js 내부에 번들된 PostCSS(`<=8.5.22`)의 고위험 항목을 보고한다. 해결하려면 `npm audit fix --force` 가 필요하고 Next.js를 다운그레이드하게 되므로 적용하지 않았다. 이 앱은 사용자 입력 CSS를 처리하지 않는다. 다음 Next.js 업데이트에서 다시 확인한다.

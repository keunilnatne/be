# CHANGELOG

이 프로젝트의 변경 이력을 기록합니다. 최신 항목이 위로 오도록 작성합니다.

---

## 2026-08-01

### Added — AI 자동 태그 추론 모드
- `src/services/aiService.js`: `inferTags()` 추가. 샘플 텍스트를 주면 **기존 태그 taxonomy 안에서만** 카테고리별(tone/verbosity/structure/directness) 최적 태그를 골라 JSON으로 반환하도록 프롬프트 설계 (새 태그를 지어내지 못하게 제약).
- `src/services/tagService.js`: `mergeInferredTags()` 추가. AI가 추론한 태그를 기존 태그와 **카테고리 단위로 병합** — 이번에 근거가 있는 카테고리만 교체하고, 근거 없는 카테고리는 기존 값 유지.
- `src/controllers/tag.controller.js`: `POST /api/tags/infer` 구현. `assertEntityExists()` 헬퍼 추가해 존재하지 않는 entityId 요청 시 404 반환.
- `public/profiles.html`: 사용자/수신자 폼에 "수동 선택" / "AI 자동 추론" 토글 UI 추가. AI 모드에서는 체크박스 대신 샘플 텍스트 입력창이 나오고, 저장 시 태그를 자동 추론·병합.

### Fixed
- `tags/attach`, `tags/infer`가 entityId 존재 여부를 검증하지 않아 삭제되었거나 존재한 적 없는 엔티티에도 태그가 붙던 문제 수정 (`assertEntityExists` 추가).
- `public/profiles.html`에 `.hidden { display: none; }` 규칙이 누락되어 "취소" 버튼이 실제로는 숨겨지지 않던 문제 수정.

---

## 2026-07-31

### Added — 사용자/수신자 프로필 CRUD, 태그 부착 API (FS-001, FS-003)
- `src/models/User.js`: `jobRole`, `team`, `companyId` 필드 추가. 기본 선호 문체는 필드가 아니라 태그(EntityTag)로 관리하도록 통일.
- `src/models/index.js`: `Company` ↔ `User` 연관관계(`belongsTo`/`hasMany`) 추가.
- `src/services/tagService.js`: `attachTag`, `detachTag`, `setTagsForEntity` 추가 (엔티티 태그 관리 공통 로직).
- `src/controllers/user.controller.js`, `src/routes/user.routes.js`: 사용자 CRUD 전체 구현 (`GET/POST /api/users`, `GET/PUT /api/users/:id`), 태그 포함 직렬화.
- `src/controllers/recipient.controller.js`: `create`, `update` 구현 완료 (기존 `list`/`getOne`에 이어서).
- `src/controllers/tag.controller.js`, `src/routes/tag.routes.js`: `POST/DELETE /api/tags/attach`, `GET /api/tags/entity/:type/:id` 구현.
- `src/server.js`: `sequelize.sync({ alter: true })` 활성화 (개발 중 스키마 변경 자동 반영).
- `public/profiles.html` 신규 작성: 사용자/수신자 생성·수정 폼 + 목록 테이블 관리용 임시 페이지.
- `public/index.html`: 상단 네비게이션 추가 (변환 데모 ↔ 프로필 관리).

### Added — 태그 기반 메시지 변환 MVP (FS-005/006 데모)
- `src/models/Tag.js`, `src/models/EntityTag.js`, `src/models/Recipient.js`: 태그 마스터/폴리모픽 매핑/수신자 모델 실제 필드로 구현.
- `src/models/index.js` 신규 작성: 모델 로더 및 연관관계 설정.
- `src/services/tagService.js`, `src/services/aiService.js` 신규 작성: 엔티티별 태그 조회, Gemini 프롬프트 빌드 및 호출(`convertMessage`).
- `src/controllers/message.controller.js`: `POST /api/messages/convert` 구현 — 수신자 태그를 프롬프트 컨텍스트로 주입해 원문을 변환.
- `src/scripts/seedDemo.js` 신규 작성: 태그 8종 + 데모 수신자 2명(박팀장/김디자이너) 시딩 스크립트 (`npm run db:seed`).
- `public/index.html` 신규 작성: 수신자 선택 → 원문 입력 → 변환 결과(원문/변환문 비교) 데모 페이지.

### Infra
- Railway MySQL(`altaria.proxy.rlwy.net`)에 실제 연결 확인 (raw `mysql2`, Sequelize 양쪽 검증).
- Google Gemini API 키 연결 확인. 사용 가능한 모델 조회 후 `gemini-flash-latest`로 확정 (`gemini-2.0-flash`는 무료 티어 할당량 0, `gemini-2.5-flash`는 신규 사용자 제공 종료).
- `.mcp.json` 추가: Railway MCP 서버(`https://mcp.railway.com`) 연동, OAuth 인증 완료.

### Added — 백엔드 뼈대
- `package.json`, `.env.example`, `.gitignore` 작성 (Express + Sequelize + MySQL 구성).
- `src/config/env.js`, `src/config/database.js`: 환경변수 로드 및 Sequelize 연결 설정.
- `src/app.js`, `src/server.js`: Express 앱 엔트리포인트, 정적 파일 서빙(`public/`) 연결.
- `src/middlewares/errorHandler.js`, `src/utils/ApiError.js`: 공통 에러 처리.
- FS-001~010 전 도메인에 대한 라우트/컨트롤러/모델 스텁 배치 (`auth`, `user`, `company`, `recipient`, `message`, `tag`).

---

## 다음에 이어서 할 일 (미구현)
- FS-002 Company DNA 승인 플로우 (관리자 검토 화면 미정)
- FS-004 메시지 맥락 분석 (누락 정보 질문 생성)
- FS-007 메시지 품질 및 협업 적합도 분석
- FS-008 원문·변환문 비교 및 사용자 수정 (diff 로직 + Message 영속화)
- FS-009 Gmail 연동, FS-010 팀 메모리 (둘 다 보류 — UX 흐름 미정)

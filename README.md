# Skill Marketplace

AI Agent의 Skills, Agents, Commands를 한 곳에서 검색하고 설치할 수 있는 웹 마켓플레이스입니다.

GitHub 또는 Bitbucket Server 저장소를 등록하면 자동으로 스킬을 수집하여 웹 UI로 제공합니다.

> 개인 또는 기업이 자체 Claude Marketplace를 구축할 수 있도록 설계되었습니다.

![Skill Marketplace 메인 화면](public/hero.png)


## 주요 기능

### 스킬 탐색 및 검색

- **실시간 검색** — 이름, 설명, 카테고리를 대상으로 키워드 검색 
- **카테고리 필터링** — `skill` (녹색), `agent` (보라), `command` (노란색) 타입별 필터
- **반응형 카드 그리드** — 모바일 1열, 태블릿 2열, 데스크탑 3열
- **스킬 상세 페이지** — Markdown(GFM) 기반 문서 렌더링 (코드 하이라이팅 포함)
- **관련 스킬 링크** — 설명에 `see <skill-name>` 패턴이 있으면 자동으로 관련 스킬 연결

### 멀티 프로바이더 저장소 연동

GitHub와 Bitbucket Server를 모두 지원합니다.

| Provider | 인증 환경변수 | 저장소 URL 형식 |
|----------|--------------|----------------|
| **GitHub** | `GITHUB_TOKEN` | `https://github.com/{owner}/{repo}` |
| **Bitbucket Server** | `BITBUCKET_TOKEN` | `https://{host}/scm/{project}/{repo}.git` |

- **동적 저장소 추가** — 웹 UI에서 저장소 URL 입력만으로 등록
- **URL 자동 파싱** — URL을 붙여넣으면 provider, owner, repo, baseUrl을 자동 감지
- **저장소 검증** — 추가 전 저장소 접근 가능 여부와 스킬 존재 여부를 자동 확인
- 3가지 소스 디렉토리 자동 탐지:
  - `skills/` — 중첩 디렉토리 구조 (`skills/my-skill/SKILL.md`) 또는 플랫 파일 (`skills/my-skill.md`)
  - `agents/` — 플랫 파일 구조 (`agents/my-agent.md`)
  - `commands/` — 플랫 파일 구조 (`commands/my-command.md`)

### 스킬 상세 및 설치

스킬 카드를 클릭하면 상세 페이지에서 전체 문서, 설치 명령어, 관련 스킬을 확인할 수 있습니다.

![스킬 상세 페이지](public/detail.png)

설치 명령어를 원클릭으로 복사할 수 있습니다.

**GitHub 저장소:**

```
/plugin marketplace add {owner}/{repo}
/plugin install {skill-name}@{repo}
```

**Bitbucket Server 저장소 (full git URL 방식):**

```
/plugin marketplace add https://{host}/scm/{project}/{repo}.git
/plugin install {skill-name}@{repo}
```

### 캐싱 및 성능

- 인메모리 캐시 (TTL 1시간) — API 호출 최소화
- 저장소 추가 시 캐시 자동 무효화
- 헤더의 **Cache Clear** 버튼으로 캐시 수동 초기화 가능


## 시작하기

### 1. 설치

```bash
git clone https://github.com/ghostflare76/skill-marketplace.git
cd skill-marketplace
bun install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성합니다:

```env
GITHUB_TOKEN=ghp_your_personal_access_token
BITBUCKET_TOKEN=your_bitbucket_token        # Bitbucket Server 사용 시
```

- `GITHUB_TOKEN` — public 저장소 읽기 권한만 있으면 됩니다. [GitHub Personal Access Token 생성](https://github.com/settings/tokens)에서 발급할 수 있습니다.
- `BITBUCKET_TOKEN` — Bitbucket Server 저장소 접근 시 필요합니다. (선택)

### 3. 실행

```bash
bun dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

## 저장소 등록 방법

### 웹 UI에서 추가

![저장소 추가 모달](public/repository.png)

1. 메인 페이지에서 **저장소 추가** 버튼 클릭
2. Provider 선택 (GitHub / Bitbucket Server)
3. 저장소 URL 입력 — owner, repo, branch가 자동으로 채워짐
4. 표시 이름과 설명 입력
5. 자동 검증 후 등록 완료

### 기본 저장소 

UI에서 추가한 저장소는 `data/custom-repos.json`에 저장됩니다.

### 저장소 디렉토리 구조

등록하려는 저장소는 아래 디렉토리 구조 중 하나 이상을 포함해야 합니다:

#### Project 구조 (루트 레벨)

```
your-repo/
├── skills/
│   ├── my-skill/
│   │   └── SKILL.md       # 디렉토리 방식 (frontmatter + markdown)
│   └── simple-skill.md    # 플랫 파일 방식
├── agents/
│   └── my-agent.md
└── commands/
    └── my-command.md
```

#### Plugin 구조 (플러그인 단위)

```
your-repo/
└── plugins/
    └── my-plugin/
        ├── skills/
        │   └── my-skill/
        │       └── SKILL.md
        ├── agents/
        │   └── my-agent.md
        └── commands/
            └── my-command.md
```

두 구조를 하나의 저장소에서 함께 사용할 수 있습니다.

## 스크립트

```bash
bun dev            # 개발 서버 (hot reload)
bun run build      # 프로덕션 빌드
bun start          # 프로덕션 서버
bun lint           # ESLint 검사
bun test           # 테스트 실행 (Vitest)
bun test:watch     # 테스트 watch 모드
bun test:coverage  # 테스트 커버리지 리포트
```

## 배포

```bash
bun run build
bun start
```

Vercel, Docker, 또는 Node.js 서버 어디에서든 배포할 수 있습니다.

## 라이선스

MIT

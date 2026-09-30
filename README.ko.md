<div align="center">

# skillfit

**Skill 레지스트리는 무엇이 인기 있는지 알려 줍니다. skillfit은 무엇이 실제로 효과가 있는지 알려 줍니다.**

어떤 skill, 규칙 파일, MCP 설정이 *내* 에이전트, *내* 작업에 실제로 도움이 되는지 측정한 뒤,<br/>
실험을 통과한 것만 설치하세요.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[빠른 시작](#빠른-시작) · [Bench 가이드](benches/README.md) · [지표 프로토콜](docs/metrics.md) · [근거 자료](evidence/)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.svg" alt="skillfit은 같은 작업을 설정 없음과 설정 있음으로 비교하고 통계 판정을 기록합니다" width="100%" />
</p>

---

## 왜 skillfit인가

에이전트 설정 생태계는 **배포**(`npx skills add`, 플러그인 마켓플레이스, MCP 레지스트리)는 해결했지만 **선택**은 해결하지 못했습니다. 검증되지 않은 설정이 오히려 해가 될 수 있다는 근거가 있습니다:

- 큐레이션된 skill은 통과율을 평균 **+16.6pp** 높여 주지만, 에이전트가 스스로 생성한 skill은 **−1.3pp**에 그쳤고, 좁게 집중된 skill이 대규모 번들보다 나았습니다 ([SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670))
- LLM이 생성한 context 파일은 점수가 **−3%** 하락했고 추론 비용은 20% 이상 증가했습니다 ([ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988))
- 스캔된 공개 skill의 36%에 prompt injection이 포함되어 있었습니다 ([Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/))

skillfit은 바로 이 빠진 측정 계층입니다. 결정적 verifier를 갖춘 페어드 A/B 실험, 통계적 판정, 트리거율 측정을 누구나 실행할 수 있는 CLI로 패키징했습니다.

## 무엇을 얻을 수 있는가

실제 실행 결과입니다. skill이 설치만 되어 있고 아무도 언급하지 않을 때, 에이전트가 과연 *스스로 그 skill을 로드해 쓰는지* 측정했습니다:

```console
$ node dist/cli.js eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
Precision           : 1/1 (100%) [95% CI 21%–100%]
F1                  : 0.20 (no CI: a harmonic mean of two proportions has no closed-form binomial interval)
```

도메인 내 9개 작업에서 skill이 트리거된 것은 단 한 번뿐이고, 그 skill 없이도 작업은 3/3으로 모두 통과합니다. 이런 판정은 어떤 레지스트리도 줄 수 없습니다.

<sub>2026-09-22에 Kimi Code에서 당시 4개 작업이던 `code-review` bench를 대상으로 캡처했습니다. 이후 bench에 다섯 번째 작업이 추가되었고, 위 네 줄의 지표는 그 실행에 기록된 작업별 횟수를 다시 렌더링한 것입니다. 즉 실행은 실제이고 형식은 현재 기준입니다.</sub>

## 빠른 시작

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
npm ci
npm run build
node dist/cli.js bench check benches/code-review

# 1. 현재 설정 상태 점검(읽기 전용, 안전)
node dist/cli.js doctor

# 2. 설치 전에 skill을 A/B 테스트(이름으로 번들 bench를 선택하거나 직접 경로를 전달;
#    --agent를 쓰면 API 키 대신 로컬 에이전트 CLI를 구동합니다)
node dist/cli.js eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. 또는 에이전트가 스스로 skill을 트리거하는지, 그리고 트리거해야 할 때만 트리거하는지 측정
node dist/cli.js eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. 도구 호출 없이 MCP server 사전 점검
node dist/cli.js mcp check ./my-server.probe.json --dry-run
node dist/cli.js mcp check ./my-server.probe.json

# 4. 설치 계획 확인(기본값은 dry-run)
node dist/cli.js install

# 선택: 에이전트가 사용법을 배우도록 하기(driver skill을 agents 디렉터리에 복사)
cp -r skills/skillfit ~/.agents/skills/
```

지원 에이전트: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([기능 매트릭스](src/matrix/agents.json) — 기계 판독 가능, 검증 날짜와 문서 링크 포함). trigger 모드 캡처는 현재 Kimi Code와 Codex CLI에서 검증되었습니다.

## 규칙과 MCP 설정 테스트

`skillfit-experiment.json`과 baseline/treatment 프로젝트 오버레이를 같은 디렉터리에 둡니다. 규칙 실험은 `AGENTS.md`를, MCP 실험은 `.codex/config.toml`, `.mcp.json` 또는 지원 에이전트의 기능 매트릭스에 정의된 경로를 추가할 수 있습니다. skillfit은 두 조건에 동일한 fixture를 복사하고 같은 prompt 스냅샷을 만든 뒤 각 오버레이를 적용하므로, 로컬 CLI가 정상 프로젝트 설정 로더를 통해 구성을 발견합니다.

```text
context7-experiment/
├── skillfit-experiment.json
├── baseline/.codex/config.toml
└── treatment/.codex/config.toml
```

```bash
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5 --dry-run
node dist/cli.js eval ./context7-experiment --bench ./my-context7-bench --agent codex --trials 5
```

먼저 `skillfit mcp check`로 stdio 핸드셰이크와 도구 카탈로그를 확인합니다. 이 명령은 `tools/list`만 요청해 이름, 설명, 입력 schema, annotations를 검사하며 도구를 호출하지 않습니다. 이후 페어드 실험으로 모델이 올바른 server를 고르는지와 작업 결과가 개선되는지를 측정합니다. 자세한 내용은 [규칙 및 MCP 실험](docs/config-experiments.md)을 참고하세요.

Codex는 신뢰된 시험 작업공간에서만 프로젝트 MCP 설정을 읽습니다. Codex 결과를 해석하기 전에 이 조건을 확인하세요.

## 선택형 Codex 설정

새 환경에서는 `--list`로 설치 가능한 Skill 67개의 출처를 확인하고, 실제 작업에 필요한 것만 `--skill`을 반복해 선택할 수 있습니다. 중단된 로컬 Skill 7개도 이유와 함께 표시합니다. `--starter`는 기존 사용자용 13개 선택을 유지하지만 묶음 효과는 검증되지 않았습니다. `--all`은 67개 전부를 선택하며 권장 기본 설정이 아닙니다. 이 목록은 출처와 설치만 검증하며 효능을 입증하지 않습니다. 제한적인 과거 비교 실험이 있는 것은 8개뿐이고, 현재 고정된 Skill 버전과 현재 Codex 모델에서 효과가 입증된 항목은 없습니다. 스크립트가 선택한 외부 Skill을 작성자의 고정 커밋에서 받아 SHA-256을 검증한 뒤 전역 `AGENTS.md` 관리 블록의 설치 계획을 보여 줍니다. 직접 작성한 Skill 두 개는 이 저장소에 있습니다. [선택 설치 안내와 근거 요약](docs/selectable-codex.md)을 참고하세요.

```bash
git clone https://github.com/remote-controlled-man/skillfit.git && cd skillfit
bash scripts/setup-codex.sh --list
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs
bash scripts/setup-codex.sh --skill vibe-coding --skill diagnosing-bugs --yes
```

## 옮길 수 있는 Codex 설정

두 개 이상의 Codex 세션에서 사용한 사용자 Skills와 현재 적용 중인 전역 지침을 내보냅니다. 생성된 디렉터리를 새 컴퓨터로 옮긴 뒤 설치하세요. 범위와 옵션은 [이전 가이드](docs/portable-codex.md)를 참고하세요.

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

외부 Skill 65개의 전체 소스 카탈로그를 내보내려면 `--upstream-lock ./profiles/codex-upstream-sources.json`을 추가하세요. 설치 과정에서 고정된 커밋의 파일을 각각 검증하며, 직접 작성한 Skills는 번들에 남습니다. 더 작은 새 환경에는 위 선택 설치 흐름을 사용하세요. [출처 검토](docs/codex-upstream-audit.md)를 참고하세요.

## 여덟 가지 명령어

| 명령어 | 동작 | 파일 쓰기 |
|---|---|---|
| `doctor` | 설치된 에이전트 감지, 규칙 비대화, skill 유효성/충돌, MCP 선언 존재 여부와 지원 형식의 JSON 구문, 조용한 실패 함정(예: Claude Code가 절대 읽지 않는 AGENTS.md) 점검 | 절대 안 함 |
| `report` | 보존된 로컬 세션 기록에서 Skill별 발화 횟수, 발화가 관측되지 않은 후보, 에이전트 제한 전의 원시 카탈로그 크기를 집계합니다. 미관측은 무용함의 증거가 아니라 우선순위 신호입니다 | 절대 안 함 |
| `eval <target>` | Skill, 규칙 오버레이, MCP 오버레이의 페어드 baseline/treatment 실행. 결정적 verifier, 선택적 블라인드 심사, 토큰 차이, McNemar exact test, paired bootstrap CI, facet 점수를 기록합니다. `--mode trigger`는 Skill의 트리거 재현율과 오탐율을 측정합니다 | 로컬 `runs/`에만 |
| `mcp check <spec>` | stdio MCP server를 시작해 프로토콜을 초기화하고 `tools/list`의 이름, 설명, 입력 schema, annotations를 검사합니다. 도구는 호출하지 않습니다 | 절대 안 함 |
| `bench` | `init`은 동작하는 예시 작업이 포함된 bench 디렉터리를 생성하고, `check`는 bench를 오프라인으로 검증하며(verifier 자가 테스트, oracle/NOP 게이트, mock arm 프로브, fixture 위생 상태, 트리거 라벨 커버리지), `add --freeze`는 방금 목격한 실패를 영구적인 bench 작업으로 고정하고, `--decompose`는 에이전트가 verifier + oracle을 초안 작성해 두 게이트를 모두 통과할 때만 채택 | `init`/`add`는 확인 후에만, `check`는 절대 안 함 |
| `install` | 관리 블록 규칙(`<!-- SKILLFIT_START/END -->`, 멱등), 충돌 보호가 적용된 skill 복사, 콘텐츠 해시 lockfile, 설치 후 검증. 쓰기 전에 임시 저장하며, 쓰기 또는 검증이 실패하면 lockfile을 포함해 이번 실행에서 변경한 대상 파일을 되돌립니다. 프로세스가 갑자기 종료되면 부분 설치가 남을 수 있으며 다시 실행해 상태를 조정할 수 있습니다. 원본은 `<file>.skillfit-bak`에 보관되며 첫 백업이 우선하므로 이후 업데이트가 덮어쓰지 못합니다. `--dry-run`은 충돌을 보고하고 0으로 종료하며, `--strict`를 추가하면 충돌 시 실패합니다(CI 게이트용) | 확인 후에만 |
| `setup codex` | 고정·검증된 외부 Skill, 저장소의 직접 작성한 Skill, 전역 사용 안내를 선택해 설치. 기본값은 계획 표시 | `--yes`일 때만 |
| `bundle` | `export`는 사용 기록이 있는 로컬 Skills와 전역 지침을 옮길 수 있는 Codex 프로필로 만듭니다 | 확인 후에만 |

## 나만의 bench 가져오기

평가의 품질은 작업의 품질을 넘지 못합니다. bench는 그저 하나의 디렉터리입니다 — `bench.json` + fixture + 결정적 verifier. `node dist/cli.js bench init`으로 뼈대를 만들고, 에이전트가 방금 망친 실제 실패를 `node dist/cli.js bench add <bench> --freeze`로 영구 작업으로 고정하고, `node dist/cli.js bench check`로 오프라인 검증을 거친 뒤, 여러분의 실제 프로덕션 시나리오를 본떠 만드세요: [benches/README.md](benches/README.md). bench를 한 번도 작성해 본 적이 없다면 [docs/bench-authoring.md](docs/bench-authoring.md)부터 시작하세요. 실제 태스크 하나로 일곱 단계를 처음부터 끝까지 따라가고, bench가 확신에 차서 틀린 숫자를 내놓는 경로도 다룹니다.

## 자체 측정 데이터

skillfit의 harness로 인기 있는 워크플로 skill 8개를 측정했습니다(24쌍의 baseline/treatment, Codex CLI, 2026-07 고정 baseline). 1개에서 3회의 treatment 중 2회에 회귀 테스트 자산의 제한적인 신호가 있었지만, 작업 품질이 확실히 개선된 Skill은 없었습니다. 이 실험은 현재 67개 목록이나 기존 13개 묶음의 효과를 검증하지 않습니다:

| Skill | 품질 Δ | 입력 토큰 | 판정 |
|---|---:|---:|---|
| `diagnosing-bugs` | 테스트 자산 +66.7pp 증가(3회 실행 중 2회), 작업 품질 변화 없음 | +11.7% | 제한적인 과거 작업 절차 신호 |
| `code-review` | +3.3pp(불안정) | +9.1% | 근거 부족 |
| `tdd` | 0.00pp | +9.2% | 측정 가능한 이득 없음 |
| `doubt-driven-development` | 0.00pp | +20.7% | 측정 가능한 이득 없음 |
| `security-and-hardening` | 0.00pp | +27.4% | 측정 가능한 이득 없음, 비용 최고 |
| 나머지 3개 | 0.00pp | +14.7~17.0% | 측정 가능한 이득 없음 |

전체 방법론과 원본 manifest는 [evidence/](evidence/)에서 확인할 수 있습니다. `skillfit eval`로 직접 재현해 보세요.

## 설계 원칙

- **포맷이 아니라 표준.** AGENTS.md(AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — 에이전트가 이미 읽는 것만 작성합니다.
- **기본 거부(Deny by default).** profile이 명시적으로 선언한 것만 설치하고, 콘텐츠 해시로 고정합니다.
- **dry-run 우선.** 모든 쓰기 명령은 파일을 건드리기 전에 계획을 먼저 출력합니다. 백업은 항상 수행합니다.
- **정직한 숫자.** 모든 주장에는 모델 버전, 평가 대상 해시, 날짜, 분산이 기록된 manifest가 링크됩니다. 판정 의미 체계는 [docs/metrics.md](docs/metrics.md)에 고정되어 있습니다: 유의성은 불일치 쌍에 대한 McNemar exact test로 판단하고, 차이값에는 paired bootstrap CI를 함께 제시하며, 검정력이 부족한 실행은 *indicative*로만 표시하고 절대 "효과 있음"이라고 하지 않습니다.

## 면책 조항

Anthropic, OpenAI, Moonshot AI 및 어떤 에이전트 벤더와도 제휴 관계가 없습니다. 평가 결과는 모델 버전, harness, 작업에 따라 달라집니다 — 영원한 진실이 아니라 날짜가 찍힌 근거로 다뤄 주세요.

## 로드맵

- [x] doctor / eval / install 핵심 루프
- [x] 블라인드 심사가 적용된 페어드 A/B harness
- [x] 통계적 판정(McNemar exact + paired bootstrap CI, manifest v4)
- [x] 트리거율 측정(`--mode trigger`: 재현율 / 오탐율, Wilson CI 포함)
- [x] bench 스캐폴딩(`bench init` + `bench check`), 실패 고정(`--freeze`), git 히스토리 마이닝(`--from-commit`), 난이도 보정(`--calibrate`)
- [x] 동일한 prompt를 사용하는 규칙 / MCP 워크스페이스 A/B 실험
- [x] 읽기 전용 stdio MCP 핸드셰이크 및 도구 카탈로그 감사
- [ ] Claude Code용 트리거 캡처(인증 불가로 보류)
- [ ] 커뮤니티 bench 및 evidence 제출(검증 없이 믿는 결과가 아니라, 재현 가능한 설정의 CI 재실행)
- [ ] Cursor / Gemini CLI / OpenCode 어댑터
- [ ] Streamable HTTP 및 2026 stateless MCP 사전 점검
- [ ] 설치된 전체 Skill 집합의 라우팅 경쟁

## 기여하기

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 가장 가치 있는 기여는 여러분의 실제 워크플로로 만든 bench입니다. 릴리스 노트는 [CHANGELOG.md](CHANGELOG.md), 보안 신고는 [SECURITY.md](SECURITY.md)를 참고하세요.

## 라이선스

[MIT](LICENSE)

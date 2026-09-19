<div align="center">

# skillfit

**Skill 레지스트리는 무엇이 인기 있는지 알려 줍니다. skillfit은 무엇이 실제로 효과가 있는지 알려 줍니다.**

어떤 skill, 규칙 파일, MCP 설정이 *내* 에이전트, *내* 작업에 실제로 도움이 되는지 측정한 뒤,<br/>
실험을 통과한 것만 설치하세요.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[빠른 시작](#빠른-시작) · [Bench 가이드](benches/README.md) · [지표 프로토콜](docs/metrics.md) · [근거 자료](evidence/)

</div>

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
$ npx skillfit eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

TASK        FIRE?  FIRED    UNKNOWN  ERRORS  PASS
review-r1   yes    1/3      0        0       3/3
review-r2   yes    0/3      0        0       3/3
review-r3   yes    0/3      0        0       3/3
explain-x1  no     0/3      0        0       3/3

Trigger recall      : 1/9 (11%) [95% CI 2%–44%]
False-trigger rate  : 0/3 (0%) [95% CI 0%–56%]
```

도메인 내 9개 작업에서 skill이 트리거된 것은 단 한 번뿐이고, 그 skill 없이도 작업은 3/3으로 모두 통과합니다. 이런 판정은 어떤 레지스트리도 줄 수 없습니다.

## 빠른 시작

```bash
# 1. 현재 설정 상태 점검(읽기 전용, 안전)
npx skillfit doctor

# 2. 설치 전에 skill을 A/B 테스트(이름으로 번들 bench를 선택하거나 직접 경로를 전달;
#    --agent를 쓰면 API 키 대신 로컬 에이전트 CLI를 구동합니다)
npx skillfit eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. 또는 에이전트가 스스로 skill을 트리거하는지, 그리고 트리거해야 할 때만 트리거하는지 측정
npx skillfit eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. 근거로 입증된 최소 세트만 설치(기본값은 dry-run)
npx skillfit install
```

지원 에이전트: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([기능 매트릭스](src/matrix/agents.json) — 기계 판독 가능, 검증 날짜와 문서 링크 포함). trigger 모드 캡처는 현재 Kimi Code에서만 검증되었습니다.

## 네 가지 명령어

| 명령어 | 동작 | 파일 쓰기 |
|---|---|---|
| `doctor` | 설치된 에이전트 감지, 규칙 비대화, skill 유효성/충돌, MCP 설정 파싱 가능 여부, 조용한 실패 함정(예: Claude Code가 절대 읽지 않는 AGENTS.md) 점검 | 절대 안 함 |
| `eval <skill>` | 기본값(`--mode inject`): 페어드 baseline/treatment 실행, 결정적 verifier + 선택적 블라인드 LLM 심사, 토큰 비용 차이, McNemar exact test + paired bootstrap CI로 판정. `--mode trigger`: 프롬프트 주입 대신 skill을 실제로 설치하고 에이전트 transcript에서 트리거 재현율 / 오탐율 측정 | 로컬 `runs/`에만 |
| `bench` | `init`은 동작하는 예시 작업이 포함된 bench 디렉터리를 생성하고, `check`는 bench를 오프라인으로 검증하며(verifier 자가 테스트, mock arm 프로브, fixture 위생 상태, 트리거 라벨 커버리지), `add --freeze`는 방금 목격한 실패를 영구적인 bench 작업으로 고정 | `init`/`add`는 확인 후에만, `check`는 절대 안 함 |
| `install` | 관리 블록 규칙(`<!-- SKILLFIT_START/END -->`, 멱등, 원자적), 충돌 보호가 적용된 skill 복사, 커밋 고정 lockfile, 설치 후 검증 | 확인 후에만 |

## 나만의 bench 가져오기

평가의 품질은 작업의 품질을 넘지 못합니다. bench는 그저 하나의 디렉터리입니다 — `bench.json` + fixture + 결정적 verifier. `npx skillfit bench init`으로 뼈대를 만들고, 에이전트가 방금 망친 실제 실패를 `npx skillfit bench add <bench> --freeze`로 영구 작업으로 고정하고, `npx skillfit bench check`로 오프라인 검증을 거친 뒤, 여러분의 실제 프로덕션 시나리오를 본떠 만드세요: [benches/README.md](benches/README.md).

## 자체 측정 데이터

skillfit의 harness로 인기 있는 워크플로 skill 8개를 측정했습니다(24쌍의 baseline/treatment, Codex CLI, 2026-07 고정 baseline). **8개 중 1개만이 재현 가능한 이점을 보였습니다**:

| Skill | 품질 Δ | 입력 토큰 | 판정 |
|---|---:|---:|---|
| `diagnosing-bugs` | 테스트 자산 +66.7pp 증가(3회 실행 중 2회) | +11.7% | **조건부** — 어려운 버그에서만 |
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
- **정직한 숫자.** 모든 주장에는 모델 버전, skill 해시, 날짜, 분산이 기록된 manifest가 링크됩니다. 판정 의미 체계는 [docs/metrics.md](docs/metrics.md)에 고정되어 있습니다: 유의성은 불일치 쌍에 대한 McNemar exact test로 판단하고, 차이값에는 paired bootstrap CI를 함께 제시하며, 검정력이 부족한 실행은 *indicative*로만 표시하고 절대 "효과 있음"이라고 하지 않습니다.

## 면책 조항

Anthropic, OpenAI, Moonshot AI 및 어떤 에이전트 벤더와도 제휴 관계가 없습니다. 평가 결과는 모델 버전, harness, 작업에 따라 달라집니다 — 영원한 진실이 아니라 날짜가 찍힌 근거로 다뤄 주세요.

## 로드맵

- [x] doctor / eval / install 핵심 루프
- [x] 블라인드 심사가 적용된 페어드 A/B harness
- [x] 통계적 판정(McNemar exact + paired bootstrap CI, manifest v2)
- [x] 트리거율 측정(`--mode trigger`: 재현율 / 오탐율, Wilson CI 포함)
- [x] bench 스캐폴딩(`bench init` + `bench check`)과 실패 고정(`bench add --freeze`)
- [ ] bench 난이도 보정 실행과 git 히스토리 임포터(`bench add --from-commit`)
- [ ] Claude Code / Codex용 트리거 캡처(검증된 stream-json 형식 필요)
- [ ] 커뮤니티 bench 및 evidence 제출(검증 없이 믿는 결과가 아니라, 재현 가능한 설정의 CI 재실행)
- [ ] Cursor / Gemini CLI / OpenCode 어댑터
- [ ] MCP server 설정 평가

## 기여하기

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 가장 가치 있는 기여는 여러분의 실제 워크플로로 만든 bench입니다.

## 라이선스

[MIT](LICENSE)

---
name: reset-default
description: 커밋/배포 전 초기화 — config/agents.yaml 의 모든 agent provider+model(+fallback)을 --preset (qwen|gpt|gemini, 기본 qwen) canonical 로 되돌린다. plain 실행 = qwen = committed git 기본값. reasoning_effort/temperature/top_p/max_tokens, embedding/reranker/tts 는 preset 무관이라 미변경.
argument-hint: "[--preset qwen|gpt|gemini]"
---

# Reset Default

로컬에서 다른 provider/model 로 갈아끼운 실험 흔적을 지우고, `config/agents.yaml` 을
github 에 배포할 canonical preset 으로 되돌린다. 바꾸는 것은 **각 agent 의
`provider` + `model` (+ `fallback[*].provider` + `fallback[*].model`)** 뿐이다.

PaperLight 는 웹앱이라 초기화 대상은 `config/agents.yaml` **단 한 파일**이다.

## Options

`$ARGUMENTS` 파싱:

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--preset` | `qwen` | 적용할 프리셋. `qwen`(OpenRouter Qwen3.6) / `gpt`(OpenAI) / `gemini`(Google Gemini). plain 실행 = `qwen` = committed canonical |

`--preset` 이 `qwen`/`gpt`/`gemini` 외 값이면 에러 후 종료.

## Source of Truth

**canonical 값은 이 커맨드 본문에 하드코딩하지 않는다.** `config/agents.yaml` 헤더 주석의
**Provider presets** 블록(Tier→(provider,model) 표 + Agent→tier + Agent→fallback-tier)이
단일 진실원(SoT)이다. 매 실행 시 헤더에서 읽어 적용해 drift 를 막는다.

요약(헤더와 항상 동기화할 것):

- **provider**: `qwen`→`openrouter`, `gpt`→`openai`, `gemini`→`gemini` (primary·fallback 공통)
- **Tier→model**

  | tier | qwen | gpt | gemini |
  |------|------|-----|--------|
  | high | `qwen/qwen3.6-plus` | `gpt-5.4-mini` | `gemini-2.5-flash` |
  | mid  | `qwen/qwen3.6-flash` | `gpt-5.4-mini` | `gemini-2.5-flash` |
  | low  | `qwen/qwen3.6-35b-a3b` | `gpt-5.4-nano` | `gemini-2.5-flash-lite` |

- **Agent→tier**
  - high: `figure_description`, `table_description`, `podcast_outline`, `podcast_script`
  - mid: `default`, `summary`, `chat`, `explanation`, `podcast_critique`, `critique`
  - low: `translation`, `paragraph_description`, `paragraph_importance`, `classifier`, `highlight`, `domain_classifier`
- **Agent→fallback-tier** (그 외 agent 는 fallback 없음)
  - `summary`→high, `chat`→high, `explanation`→low, `translation`→mid,
    `figure_description`→mid, `table_description`→mid, `podcast_outline`→mid, `podcast_script`→mid

> gpt/gemini 는 high==mid(같은 model)라 일부 fallback 이 primary 와 동일해질 수 있다 — 무해하니 그대로 둔다.

## Process

### 1. 인자 파싱

`--preset` (기본 `qwen`) 결정. `qwen`/`gpt`/`gemini` 외 값이면 에러.

### 2. 헤더에서 canonical 읽기

`config/agents.yaml` 헤더 **Provider presets** 블록에서 선택 preset 의 provider,
Tier→model 표, Agent→tier, Agent→fallback-tier 를 파싱한다. (본문 표가 아니라
**헤더가 SoT** — 본문 요약과 헤더가 어긋나면 헤더를 따른다.)

### 3. agents.yaml 적용

`default` 와 모든 `agents.*` 항목에 대해:

1. 해당 agent 의 tier 로 `provider` + `model` 의 canonical 값을 구한다.
2. `rg -n` 으로 현재 `provider`/`model` 라인을 확인.
3. 현재 값과 다른 키만 `Edit` 정확 일치 치환으로 교체 (idempotent — 같으면 skip).
4. fallback 이 있는 agent 는 fallback-tier 로 `{ provider, model }` 을 같은 방식으로 교체.
5. **값(`provider:`/`model:` 우측, fallback 라인의 provider/model)만 변경.** 각 줄의
   inline 주석(`# F-14 — vision` 등)과 다른 키(`reasoning_effort`/`temperature`/`top_p`/
   `max_tokens`)는 보존.

**건드리지 않는 것**: `version`, `reasoning_effort`/`temperature`/`top_p`/`max_tokens`
(preset 무관 agent 의미값), `embedding`/`reranker`/`tts` 섹션(preset 무관 canonical),
헤더 주석.

### 4. 결과 요약

변경된 항목만 before → after 로 출력. 예:

```
agents.yaml (preset=gpt 로 reset):
  figure_description : openrouter qwen/qwen3.6-plus  → openai gpt-5.4-mini
  default            : openrouter qwen/qwen3.6-35b-a3b → openai gpt-5.4-mini
  translation        : openrouter qwen/qwen3.6-flash → openai gpt-5.4-nano  (fallback → openai gpt-5.4-mini)
  ...
```

이미 모두 선택 preset 값이면 "변경 없음 (이미 {preset} 상태)" 출력.

## Notes

- **소스만 reset. 빌드/재시작 안 함.** 라우터는 `agents.yaml` 을 `lru_cache` 로 1회 로드하므로
  실행 중인 백엔드에 반영하려면 재시작이 필요하다.
- **API 키 확인.** preset provider 의 키가 `.env` 에 있어야 런타임 동작한다
  (`gpt`→`OPENAI_API_KEY`, `gemini`→`GEMINI_API_KEY`, `qwen`→`OPENROUTER_API_KEY`).
  키 미설정 시 라우터는 fallback 체인으로 넘어가거나 실패한다.
- **커밋 워크플로**: 로컬 실험(다른 provider/model) → `/reset-default` (보통 plain=qwen) →
  `git commit`/`push` → 필요 시 실험 preset 복구. canonical 의 SoT 는 `agents.yaml` 헤더다.
- 헤더에 선언된 키만 reset 한다. 선언되지 않은 키(하이퍼파라미터 등)는 현재 값을 유지한다.

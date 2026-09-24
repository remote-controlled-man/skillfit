<div align="center">

# skillfit

**Los registros de skills dicen qué es popular. skillfit dice qué funciona de verdad.**

Mide si un skill, un archivo de reglas o una configuración de MCP mejora *tu* agente en *tus* tareas —<br/>
e instala solo lo que sobreviva al experimento.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[Inicio rápido](#inicio-rápido) · [Guía de benches](benches/README.md) · [Protocolo de métricas](docs/metrics.md) · [Evidencia](evidence/)

</div>

---

## Por qué

El ecosistema de configuración de agentes ha resuelto la **distribución** (`npx skills add`, marketplaces de plugins, registros de MCP), pero no la **selección**. La evidencia muestra que una configuración sin verificar puede perjudicar:

- Los skills curados mejoran la tasa de aciertos en **+16.6pp** de media — pero los skills autogenerados por el propio agente puntúan **−1.3pp**, y los skills focalizados superan a los bundles grandes ([SkillsBench, arXiv:2602.12670](https://arxiv.org/abs/2602.12670))
- Los archivos de contexto generados por LLM puntuaron **−3%** mientras aumentaban el coste de inferencia más de un 20% ([ETH Zurich, arXiv:2602.11988](https://arxiv.org/abs/2602.11988))
- El 36% de los skills públicos analizados contienen inyección de prompts ([Snyk ToxicSkills, 2026-02](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/))

skillfit es la capa de medición que faltaba: experimentos A/B emparejados con verificadores deterministas, veredictos estadísticos y medición de la tasa de activación — empaquetado como una CLI que cualquiera puede ejecutar.

## Qué se obtiene

Una ejecución real que mide si el agente *siquiera se molesta en cargar* un skill cuando está instalado pero nadie lo menciona:

```console
$ npx skillfit eval ./skills/code-review --mode trigger --bench code-review --agent kimi-code

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

El skill se activó una vez entre nueve tareas de su dominio — y las tareas pasan 3/3 sin él. Ese es un veredicto que ningún registro puede ofrecer.

<sub>Capturado el 2026-09-22 en Kimi Code contra el bench `code-review`, que entonces tenía cuatro tareas. Desde entonces el bench ha ganado una quinta; las cuatro líneas de métricas anteriores están re-renderizadas a partir de los recuentos por tarea registrados en aquella ejecución, así que la ejecución es real y el formato es el actual.</sub>

## Inicio rápido

```bash
# 1. Comprueba el estado de tu configuración actual (solo lectura, seguro)
npx skillfit doctor

# 2. Somete un skill a una prueba A/B antes de instalarlo (elige un bench incluido por nombre o pasa tu propia ruta;
#    usa --agent para controlar la CLI de un agente local en lugar de una API key)
npx skillfit eval ~/.agents/skills/some-skill --bench code-review --trials 3

# 2b. O mide si el agente activa el skill por sí solo (y solo cuando debe)
npx skillfit eval ~/.agents/skills/some-skill --mode trigger --bench code-review --agent kimi-code

# 3. Instala solo el conjunto mínimo respaldado por evidencia (dry-run por defecto)
npx skillfit install

# Opcional: enseña a tu agente a usarlo (copia la driver skill en tu carpeta agents)
cp -r skills/skillfit ~/.agents/skills/
```

Agentes compatibles: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([matriz de capacidades](src/matrix/agents.json): legible por máquina, con fecha de verificación y enlaces a la documentación). La captura del modo trigger está verificada actualmente para Kimi Code y Codex CLI.

## Los cinco comandos

| Comando | Qué hace | ¿Escribe? |
|---|---|---|
| `doctor` | Detecta los agentes instalados, comprueba la hinchazón de reglas, la validez y los conflictos de skills, que la configuración MCP sea parseable y las trampas de fallo silencioso (p. ej., un AGENTS.md que Claude Code nunca lee) | Nunca |
| `report` | Recuentos de uso real de skills desde el historial local de sesiones: activaciones por skill y la lista de nunca activadas (el puro impuesto de enrutamiento/contexto) | Nunca |
| `eval <skill>` | Por defecto (`--mode inject`): ejecuciones baseline/treatment emparejadas, verificador determinista + juez LLM ciego opcional, delta de coste en tokens, veredictos mediante el test exacto de McNemar + IC de bootstrap emparejado, además de IC de puntuación por facetas graduada cuando el bench emite checks. `--mode trigger`: instala el skill en lugar de inyectarlo y mide el recall de activación / la tasa de falsas activaciones a partir de la transcripción del agente | `runs/` en local |
| `bench` | `init` genera el esqueleto de un directorio de bench con una tarea de ejemplo funcional; `check` valida un bench sin conexión (autopruebas del verificador, puertas oracle/NOP, sondeos del brazo mock, higiene de fixtures, cobertura de etiquetas de trigger); `add --freeze` convierte en una tarea de bench permanente un fallo que acabas de presenciar, y `--decompose` hace que un agente redacte el verificador + oracle, admitido solo si supera ambas puertas | `init`/`add` tras confirmación; `check` nunca |
| `install` | Reglas en bloque gestionado (`<!-- SKILLFIT_START/END -->`, idempotentes), copia de skills con protección contra conflictos, lockfile fijado por commit, verificación posterior a la instalación. Las escrituras se preparan y luego se renombran, así que un fallo a mitad no aplica nada; el original se conserva en `<file>.skillfit-bak` y la primera copia de seguridad tiene prioridad, por lo que las actualizaciones posteriores no pueden sobrescribirla. `--dry-run` informa de los conflictos y termina con 0; añade `--strict` para que fallen (puertas de CI) | Solo tras confirmación |

## Trae tu propio bench

Una evaluación solo es tan buena como sus tareas. Un bench no es más que un directorio: `bench.json` + fixtures + un verificador determinista. Genera uno con `npx skillfit bench init`, congela un fallo real que acabas de ver cometer a tu agente con `npx skillfit bench add <bench> --freeze`, valida sin conexión con `npx skillfit bench check` y modélalo a partir de tus propios escenarios de producción: [benches/README.md](benches/README.md). Si nunca has escrito uno, empieza por [docs/bench-authoring.md](docs/bench-authoring.md): recorre los siete pasos de principio a fin sobre una sola tarea real y cubre las formas en que un bench produce números equivocados con total confianza.

## Nuestros propios datos

Ejecutamos el harness de skillfit sobre 8 skills de flujo de trabajo populares (24 pares baseline/treatment, Codex CLI, baseline congelado en 2026-07). Solo 1 de 8 mostró un beneficio repetible:

| Skill | Δ de calidad | Tokens de entrada | Veredicto |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp de ganancia en activos de tests (2/3 ejecuciones) | +11.7% | **Condicional** — solo bugs difíciles |
| `code-review` | +3.3pp (inestable) | +9.1% | Evidencia insuficiente |
| `tdd` | 0.00pp | +9.2% | Sin ganancia medible |
| `doubt-driven-development` | 0.00pp | +20.7% | Sin ganancia medible |
| `security-and-hardening` | 0.00pp | +27.4% | Sin ganancia medible, el coste más alto |
| 3 más | 0.00pp | +14.7~17.0% | Sin ganancia medible |

Metodología completa y manifiestos en bruto: [evidence/](evidence/). Reprodúcelo con `skillfit eval`.

## Principios de diseño

- **Estándares, no formatos.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — escribimos lo que los agentes ya leen.
- **Deny by default.** Solo instalamos lo que un perfil declara explícitamente, fijado por hash de contenido.
- **Dry-run primero.** Cada comando de escritura imprime su plan antes de tocar un archivo. Copias de seguridad siempre.
- **Números honestos.** Cada afirmación enlaza a un manifiesto con la versión del modelo, el hash del skill, la fecha y la varianza. La semántica de los veredictos está congelada en [docs/metrics.md](docs/metrics.md): la significancia procede de un test exacto de McNemar sobre pares discordantes, los deltas llevan IC de bootstrap emparejado y las ejecuciones sin potencia suficiente se etiquetan como *indicative*, nunca «effective».

## Descargo de responsabilidad

Sin afiliación con Anthropic, OpenAI, Moonshot AI ni ningún otro proveedor de agentes. Los resultados de las evaluaciones dependen de la versión del modelo, del harness y de las tareas — trátalos como evidencia fechada, no como una verdad eterna.

## Roadmap

- [x] Bucle central doctor / eval / install
- [x] Harness A/B emparejado con evaluación ciega
- [x] Veredictos estadísticos (McNemar exacto + IC de bootstrap emparejado, manifest v2)
- [x] Medición de la tasa de activación (`--mode trigger`: recall / tasa de falsas activaciones con IC de Wilson)
- [x] Andamiaje de benches (`bench init` + `bench check`), congelación de fallos (`--freeze`), minería del historial git (`--from-commit`) y calibración de dificultad (`--calibrate`)
- [ ] Captura de activaciones para Claude Code (bloqueado: se necesita autenticación válida)
- [ ] Benches y evidencia de la comunidad (re-ejecuciones en CI con configuración reproducible, no resultados de «créeme»)
- [ ] Adaptadores para Cursor / Gemini CLI / OpenCode
- [ ] Evaluación de la configuración de servidores MCP

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md). La contribución de mayor valor es un bench construido a partir de tu flujo de trabajo real. Las notas de versión están en [CHANGELOG.md](CHANGELOG.md) y los informes de seguridad en [SECURITY.md](SECURITY.md).

## Licencia

[MIT](LICENSE)

<div align="center">

# skillfit

**Los registros de skills dicen qué es popular. skillfit dice qué funciona de verdad.**

Mide si un skill, un archivo de reglas o una configuración de MCP mejora *tu* agente en *tus* tareas —<br/>
e instala solo lo que sobreviva al experimento.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![CI](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml/badge.svg)](https://github.com/remote-controlled-man/skillfit/actions/workflows/ci.yml)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-blue)](package.json)
[![GitHub stars](https://img.shields.io/github/stars/remote-controlled-man/skillfit?style=flat)](https://github.com/remote-controlled-man/skillfit/stargazers)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[Inicio rápido](#inicio-rápido) · [Guía de benches](benches/README.md) · [Protocolo de métricas](docs/metrics.md) · [Evidencia](evidence/)

</div>

<p align="center">
  <img src="docs/assets/skillfit-flow.svg" alt="skillfit compara la misma tarea con la configuración desactivada y activada, y registra un veredicto estadístico" width="100%" />
</p>

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

El skill se activó una vez entre nueve tareas de su dominio — y las tareas pasan 3/3 sin él. Ese es un veredicto que ningún registro puede ofrecer.

<sub>Capturado el 2026-09-22 en Kimi Code contra el bench `code-review`, que entonces tenía cuatro tareas. Desde entonces el bench ha ganado una quinta; las cuatro líneas de métricas anteriores están re-renderizadas a partir de los recuentos por tarea registrados en aquella ejecución, así que la ejecución es real y el formato es el actual.</sub>

## Inicio rápido

```bash
git clone https://github.com/remote-controlled-man/skillfit.git
cd skillfit
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js bench check benches/code-review
node dist/cli.js bench check benches/debugging
node dist/cli.js doctor
node dist/cli.js eval skills/skillfit --bench code-review --agent codex --dry-run
node dist/cli.js install --agent codex --dry-run
```

Las dos comprobaciones de bench verifican la integridad sin conexión; no miden la calidad del agente. `doctor` es de solo lectura y los comandos eval e install anteriores solo muestran planes. `codex` es un ID de agente de ejemplo; cámbialo por el tuyo. Una evaluación real requiere tu propio Skill y bench, además de un CLI de agente local o credenciales de API. Los comandos de configuración de abajo funcionan en Bash y PowerShell; elegir Skills externos requiere red y solo `--yes` los instala.

`eval` usa ahora **5 intentos por condición** de forma predeterminada. Con 8 tareas, una evaluación emparejada ejecuta el agente 80 veces. Cinco intentos son un punto de partida; también importan la representatividad de las tareas y una línea base que pueda distinguir diferencias. Revisa el total en el dry-run y sigue [la guía de la primera evaluación real](docs/first-real-eval.md) antes de afirmar eficacia.

Para eval y la calibración de la línea base, `--trials` debe ser un entero entre 1 y 20. Los valores fraccionarios, mal formados o fuera del intervalo se rechazan antes de iniciar una ejecución o comprobación del bench.

Agentes compatibles: **Claude Code**, **OpenAI Codex CLI**, **Kimi Code** ([matriz de capacidades](src/matrix/agents.json): legible por máquina, con fecha de verificación y enlaces a la documentación). La captura del modo trigger está verificada actualmente para Kimi Code y Codex CLI.

## Evalúa una tarea real de OSS

Usa `--input workspace` en comparaciones pareadas con una CLI para inspeccionar y editar archivos
en disco sin incluir el repositorio en el prompt. Usa la misma presentación al calibrar la línea base.
El valor predeterminado sigue siendo `snapshot`; workspace no admite ejecutores API y se usa por separado de `--mode trigger`.

```bash
node dist/cli.js eval <skill-dir> --bench <bench-dir> --agent codex --input workspace --trials 5 --dry-run
node dist/cli.js bench check <bench-dir> --calibrate --agent codex --input workspace --trials 3 --dry-run
```

Al importar una corrección, `bench add --from-commit <sha> --prompt-file issue.md` conserva la solicitud del issue
sin revelar la respuesta del mensaje de corrección. Los informes muestran cada comprobación, la cobertura del uso
y la evidencia que falta para decidir la instalación. Una tarea solo informa sobre esa tarea, no demuestra un beneficio general.
Consulta el [flujo de OSS real](docs/oss-task-evaluation.md) o reproduce el [ejemplo fijado de mcp-use](benches/contrib/oss-mcp-use-utf8/README.md).

## Prueba reglas y configuraciones MCP

Coloca `skillfit-experiment.json` junto a overlays de proyecto baseline/treatment. Un experimento de reglas puede añadir `AGENTS.md`; uno de MCP puede añadir `.codex/config.toml`, `.mcp.json` o la ruta declarada para otro agente compatible. skillfit copia el mismo fixture en ambos brazos, crea una instantánea idéntica para el prompt y después aplica cada overlay, de modo que la CLI local descubre la configuración mediante su cargador normal de proyecto.

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

Empieza con `skillfit mcp check` para validar el handshake stdio y el catálogo de herramientas. Solo solicita `tools/list` y audita nombres, descripciones, schemas de entrada y annotations, sin invocar herramientas. Después ejecuta el experimento emparejado para medir si el modelo elige el servidor correcto y si mejora el resultado. Consulta [Experimentos de reglas y MCP](docs/config-experiments.md).

En las pruebas MCP con Codex, skillfit pasa una opción de confianza por ejecución para cargar la configuración del proyecto temporal sin modificar tu configuración de usuario de Codex.

## Compartir un resultado

Prueba el ejemplo sintético de abajo y luego sustituye su ruta por la ruta `Manifest:` de tu propia evaluación pareada con `eval`. El informe incluye procedencia, intervalos, errores y advertencias; no vuelve a ejecutar el agente. Consulta la [guía para compartir resultados](docs/sharing-results.md).

```bash
node dist/cli.js report eval docs/examples/eval-manifest.synthetic.json
```

## Configuración seleccionable de Codex

En un entorno nuevo, `--list` muestra el catálogo de origen de 67 Skills instalables; repite `--skill` para elegir solo los pertinentes a tus tareas. También muestra siete Skills locales retirados con el motivo. `--starter` conserva la selección original de 13 para usuarios anteriores, pero no se ha evaluado como conjunto; `--all` selecciona los 67 y no es una configuración inicial recomendada. El catálogo verifica origen e instalación, no eficacia: solo ocho entradas tienen pruebas históricas pareadas limitadas, y ninguna tiene un beneficio demostrado para las versiones fijadas actuales y el modelo Codex actual. El comando de configuración descarga los Skills externos elegidos de commits fijados de sus autores, verifica SHA-256 y muestra el plan para un bloque gestionado en el `AGENTS.md` global. Los dos Skills propios están en este repositorio. Consulta la [guía de instalación seleccionable y el resumen de evidencia](docs/selectable-codex.md).

```bash
node dist/cli.js setup codex --list
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs
node dist/cli.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes
```

## Configuración de Codex transferible

Exporta los Skills de usuario usados en al menos dos sesiones de Codex y las instrucciones globales activas. Lleva el directorio resultante al nuevo equipo e instálalo allí. Consulta la [guía de traslado](docs/portable-codex.md) para conocer el alcance y las opciones.

```bash
node dist/cli.js bundle export ./personal-codex --dry-run
node dist/cli.js bundle export ./personal-codex --yes
# transfer the personal-codex directory to the new machine
node ./personal-codex/setup.mjs --dry-run
node ./personal-codex/setup.mjs --yes
```

Para exportar el catálogo completo de 65 Skills externos, añade `--upstream-lock ./profiles/codex-upstream-sources.json`. La instalación verifica cada archivo del commit fijado y los Skills propios permanecen en el paquete. Para un entorno nuevo más pequeño, usa la instalación seleccionable anterior. Consulta la [auditoría de fuentes](docs/codex-upstream-audit.md).

## Los ocho comandos

| Comando | Qué hace | ¿Escribe? |
|---|---|---|
| `doctor` | Detecta los agentes instalados y comprueba la hinchazón de reglas, la validez y los conflictos de skills, la presencia de declaraciones MCP y la sintaxis JSON cuando es compatible, además de fallos silenciosos (p. ej., un AGENTS.md que Claude Code nunca lee) | Nunca |
| `report` | Recibos del historial local conservado: activaciones por skill, candidatas sin activación observada y tamaño bruto del catálogo antes de los límites del agente. La ausencia es una señal de prioridad, no prueba de inutilidad. También convierte un manifiesto de evaluación existente en Markdown con `report eval`. | Nunca |
| `eval <target>` | Ejecuciones baseline/treatment emparejadas para un Skill, overlay de reglas u overlay MCP; verificador determinista, juez ciego opcional, delta de tokens, test exacto de McNemar, IC de bootstrap emparejado y facetas. `--mode trigger` mide el recall y las falsas activaciones de Skills | `runs/` en local |
| `mcp check <spec>` | Inicia un servidor MCP stdio, negocia el protocolo, solicita `tools/list` y audita nombres, descripciones, schemas de entrada y annotations. Nunca invoca una herramienta | Nunca |
| `bench` | `init` genera el esqueleto de un directorio de bench con una tarea de ejemplo funcional; `check` valida un bench sin conexión (autopruebas del verificador, puertas oracle/NOP, sondeos del brazo mock, higiene de fixtures, cobertura de etiquetas de trigger); `add --freeze` convierte en una tarea de bench permanente un fallo que acabas de presenciar, y `--decompose` hace que un agente redacte el verificador + oracle, admitido solo si supera ambas puertas | `init`/`add` tras confirmación; `check` nunca |
| `install` | Reglas en bloque gestionado (`<!-- SKILLFIT_START/END -->`, idempotentes), copia de skills con protección contra conflictos, lockfile con hashes de contenido, verificación posterior a la instalación. Los archivos se preparan antes de escribir; si falla una escritura o la verificación, se revierten los archivos modificados en esta ejecución, incluido el lockfile. Una interrupción brusca aún puede dejar una instalación parcial; vuelve a ejecutar el comando para reconciliar el estado. El original se conserva en `<file>.skillfit-bak` y la primera copia de seguridad tiene prioridad, por lo que las actualizaciones posteriores no pueden sobrescribirla. `--dry-run` informa de los conflictos y termina con 0; añade `--strict` para que fallen (puertas de CI) | Solo tras confirmación |
| `setup codex` | Permite elegir Skills externos fijados y verificados, Skills propios del repositorio y una guía global de activación; por defecto solo muestra el plan | Solo con `--yes` |
| `bundle` | `export` crea un perfil de Codex transferible a partir de Skills locales usados y las instrucciones globales activas | Solo tras confirmación |

## Trae tu propio bench

Una evaluación solo es tan buena como sus tareas. Un bench no es más que un directorio: `bench.json` + fixtures + un verificador determinista. Genera uno con `node dist/cli.js bench init`, congela un fallo real que acabas de ver cometer a tu agente con `node dist/cli.js bench add <bench> --freeze`, valida sin conexión con `node dist/cli.js bench check` y modélalo a partir de tus propios escenarios de producción: [benches/README.md](benches/README.md). Si nunca has escrito uno, empieza por [docs/bench-authoring.md](docs/bench-authoring.md): recorre los siete pasos de principio a fin sobre una sola tarea real y cubre las formas en que un bench produce números equivocados con total confianza.

## Nuestros propios datos

Ejecutamos el harness de skillfit sobre 8 skills de flujo de trabajo populares (24 pares baseline/treatment, Codex CLI, baseline congelado en 2026-07). Uno mostró una señal limitada de pruebas de regresión en 2/3 ejecuciones tratadas; ninguno mostró una mejora sólida en la calidad de las tareas. Estos ensayos no validan el catálogo actual de 67 Skills ni el conjunto original de 13:

| Skill | Δ de calidad | Tokens de entrada | Veredicto |
|---|---:|---:|---|
| `diagnosing-bugs` | +66.7pp en activos de tests (2/3 ejecuciones); calidad de tareas sin cambios | +11.7% | Señal histórica limitada del proceso |
| `code-review` | +3.3pp (inestable) | +9.1% | Evidencia insuficiente |
| `tdd` | 0.00pp | +9.2% | Sin ganancia medible |
| `doubt-driven-development` | 0.00pp | +20.7% | Sin ganancia medible |
| `security-and-hardening` | 0.00pp | +27.4% | Sin ganancia medible, el coste más alto |
| 3 más | 0.00pp | +14.7~17.0% | Sin ganancia medible |

Los informes fechados están en [evidence/](evidence/). Algunos manifiestos históricos sin procesar siguen solo en el entorno local de la ejecución original; el índice de evidencias explica esos límites. Puedes reproducir un resultado con `skillfit eval` usando tu Skill, agente y bench fijados.

## Principios de diseño

- **Estándares, no formatos.** AGENTS.md (AAIF), SKILL.md, `.agents/skills/`, `.mcpb` — escribimos lo que los agentes ya leen.
- **Deny by default.** Solo instalamos lo que un perfil declara explícitamente, fijado por hash de contenido.
- **Dry-run primero.** Cada comando de escritura imprime su plan antes de tocar un archivo. Copias de seguridad siempre.
- **Números honestos.** Los nuevos resultados de eficacia requieren un manifiesto fijado y compartible; algunos informes antiguos no tienen manifiestos descargables. Las reglas de veredicto están en [docs/metrics.md](docs/metrics.md): se muestra la prueba exacta de McNemar sobre pares discordantes y el IC de bootstrap emparejado; las ejecuciones con menos de 8 tareas × 5 intentos por condición se etiquetan como *indicative*, aunque su veredicto dentro del bench sea estadísticamente significativo.

## Descargo de responsabilidad

Sin afiliación con Anthropic, OpenAI, Moonshot AI ni ningún otro proveedor de agentes. Los resultados de las evaluaciones dependen de la versión del modelo, del harness y de las tareas — trátalos como evidencia fechada, no como una verdad eterna.

## Roadmap

[Plan de entrega de octubre de 2026](docs/growth-roadmap-2026-10.md)

- [x] Bucle central doctor / eval / install
- [x] Harness A/B emparejado con evaluación ciega
- [x] Veredictos estadísticos (McNemar exacto + IC de bootstrap emparejado, manifest v4)
- [x] Medición de la tasa de activación (`--mode trigger`: recall / tasa de falsas activaciones con IC de Wilson)
- [x] Andamiaje de benches (`bench init` + `bench check`), congelación de fallos (`--freeze`), minería del historial git (`--from-commit`) y calibración de dificultad (`--calibrate`)
- [x] Experimentos A/B de reglas y MCP con prompts idénticos
- [x] Handshake MCP stdio y auditoría del catálogo en modo lectura
- [ ] Captura de activaciones para Claude Code (bloqueado: se necesita autenticación válida)
- [ ] Benches y evidencia de la comunidad (re-ejecuciones en CI con configuración reproducible, no resultados de «créeme»)
- [ ] Adaptadores para Cursor / Gemini CLI / OpenCode
- [ ] Preflight de Streamable HTTP y MCP stateless 2026
- [ ] Competencia de routing con el conjunto completo de Skills instalados

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md). La contribución de mayor valor es un bench construido a partir de tu flujo de trabajo real. Las notas de versión están en [CHANGELOG.md](CHANGELOG.md) y los informes de seguridad en [SECURITY.md](SECURITY.md).

## Licencia

[MIT](LICENSE)

# 🧠 SDD Model Selection Engine — Documento de Criterios y Arquitectura

**Versión:** 2.0  
**Fecha:** Abril 2026  
**Propósito:** Documento fundacional para construir un motor de asignación inteligente de modelos LLM a fases SDD mediante embeddings, scoring matricial y clasificación ponderada.

---

## TABLA DE CONTENIDOS

1. [Fundamento Teórico](#1-fundamento-teórico)
2. [Taxonomía de Capacidades LLM](#2-taxonomía-de-capacidades-llm)
3. [Dimensiones de Evaluación y Métricas](#3-dimensiones-de-evaluación-y-métricas)
4. [Fuentes de Benchmarks](#4-fuentes-de-benchmarks)
5. [Esquema de la Matriz de Modelos](#5-esquema-de-la-matriz-de-modelos)
6. [Perfiles de Configuración](#6-perfiles-de-configuración)
7. [Criterios Detallados por Fase SDD](#7-criterios-detallados-por-fase-sdd)
8. [Sistema de Ponderación y Scoring](#8-sistema-de-ponderación-y-scoring)
9. [Algoritmo de Selección](#9-algoritmo-de-selección)
10. [Arquitectura del Motor](#10-arquitectura-del-motor)
11. [Esquema de Base de Datos](#11-esquema-de-base-de-datos)
12. [Lógica de Fallback y Graceful Degradation](#12-lógica-de-fallback-y-graceful-degradation)
13. [Reglas de Negocio y Restricciones](#13-reglas-de-negocio-y-restricciones)
14. [Embeddings y Representación Semántica](#14-embeddings-y-representación-semántica)
15. [Actualización y Mantenimiento de la Matriz](#15-actualización-y-mantenimiento-de-la-matriz)

---

## 1. FUNDAMENTO TEÓRICO

### 1.1 El Problema de la Asignación Óptima

El desarrollo de software basado en SDD (Spec-Driven Development) orquesta múltiples agentes LLM especializados en fases secuenciales. Cada fase tiene una **carga cognitiva específica** que no todos los modelos pueden manejar eficientemente.

El error más frecuente en pipelines de agentes es la **homogeneización del stack**: usar el mismo modelo para todas las fases. Esto genera tres antipatrones:

| Antipatrón | Descripción | Consecuencia |
|---|---|---|
| **Overkill cognitivo** | Usar un modelo de razonamiento profundo para dividir tareas simples | Desperdicio de tokens y presupuesto |
| **Underkill arquitectónico** | Usar un modelo pequeño para decisiones de diseño de software | Deuda técnica acumulada |
| **Sesgo de confirmación** | El mismo proveedor escribe y audita el código | Puntos ciegos en la revisión |

### 1.2 El Principio del Plano y el Albañil

El principio más importante de la asignación SDD:

> **"Un blueprint arquitectónico correcto convierte a cualquier coder competente en un ejecutor preciso. Un blueprint incorrecto convierte al mejor coder del mundo en constructor de un edificio mal diseñado."**

Esto implica que la inversión de mayor inteligencia debe hacerse en `sdd-propose` y `sdd-explore` (decisiones que se propagan hacia adelante), no necesariamente en `sdd-apply` (ejecución de una decisión ya tomada).

### 1.3 La Cadena de Propagación de Errores

```
sdd-init → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```

Un error en la fase N se hereda y amplifica en todas las fases N+1 a N+k. El costo de corrección crece exponencialmente con la distancia de la fase de origen.

**Tabla de costo relativo de corrección:**

| Fase del error | Costo de corrección relativo | Por qué |
|---|---|---|
| sdd-propose | 1x (barato) | Solo se reescribe el documento de propuesta |
| sdd-spec | 3x | Se reescribe spec y se invalida el diseño |
| sdd-design | 6x | Se rediseña arquitectura, spec y tareas |
| sdd-apply | 12x | Se refactoriza código real |
| sdd-verify | 20x | Se detecta tarde, hay que retroceder múltiples fases |
| Producción | 100x | El costo más alto posible |

### 1.4 Separación de Responsabilidades Cognitivas

Las capacidades LLM relevantes para SDD se pueden clasificar en cinco grandes categorías:

```
RAZONAMIENTO PROFUNDO    → explore, propose, verify
CONTEXTO MASIVO          → init, onboard
GENERACIÓN DE CÓDIGO     → apply, spec
COMPRENSIÓN VISUAL/UI    → design
VELOCIDAD/VOLUMEN        → tasks, archive, onboard
```

Ningún modelo es óptimo en todas las categorías simultáneamente. El motor de selección debe encontrar la intersección óptima entre las necesidades de cada fase y las capacidades reales de cada modelo disponible.

---

## 2. TAXONOMÍA DE CAPACIDADES LLM

### 2.1 Capacidades Primarias

Estas son las capacidades que el motor evalúa para cada modelo:

#### 2.1.1 Razonamiento Encadenado (Chain-of-Thought)
- **Definición:** Capacidad de generar pasos intermedios de razonamiento antes de emitir una respuesta final
- **Indicadores:** Modelos con sufijos `-thinking`, `-r1`, modelos de la familia `o1/o3`, `QwQ`, `Magistral`
- **Benchmarks relevantes:** GPQA-Diamond, AIME 2025, ARC-AGI, HLE (Humanity's Last Exam)
- **Escala de medición:** 0.0 – 10.0
- **Importancia alta en:** sdd-explore, sdd-propose, sdd-verify
- **Importancia baja en:** sdd-archive, sdd-tasks (donde la velocidad importa más)

#### 2.1.2 Ventana de Contexto (Context Window)
- **Definición:** Cantidad máxima de tokens que el modelo puede procesar en una sola llamada (input + output)
- **Escala:** Tokens numéricos, categorización por rangos
  - Micro: < 8K tokens
  - Pequeño: 8K – 32K tokens
  - Medio: 32K – 128K tokens
  - Grande: 128K – 512K tokens
  - Masivo: 512K – 1M tokens
  - Ultra: > 1M tokens
- **Importancia alta en:** sdd-init (ingestión de repos), sdd-onboard (documentación completa), sdd-spec (specs extensas)
- **Nota crítica:** La ventana nominal ≠ la ventana efectiva. Algunos modelos sufren "Lost in the Middle": degradación de atención en tokens centrales de contextos muy largos. El dato de ventana efectiva real debe medirse por separado.

#### 2.1.3 Capacidad de Generación de Código
- **Definición:** Habilidad para escribir, refactorizar y completar código en múltiples lenguajes respetando patrones de diseño
- **Benchmarks relevantes:** SWE-bench Verified, HumanEval, MBPP, LiveCodeBench, Aider Polyglot
- **Escala:** Porcentaje (0% – 100%) en benchmark estándar
- **Importancia alta en:** sdd-apply, sdd-spec (especificaciones con pseudocódigo/tipos), sdd-verify
- **Subfactores:**
  - Respeto de arquitecturas (Hexagonal, Clean, SOLID)
  - Calidad de tipado (TypeScript, tipos estrictos)
  - Generación de tests unitarios
  - Refactorización sin romper contratos
  - Capacidad FIM (Fill In the Middle)

#### 2.1.4 Instruction Following / Tool Calling
- **Definición:** Fidelidad con la que el modelo sigue instrucciones de sistema y usa herramientas externas de forma precisa
- **Benchmarks relevantes:** IFEval, BFCL (Berkeley Function Calling Leaderboard), ToolBench
- **Escala:** 0.0 – 10.0
- **Importancia crítica en:** sdd-orchestrator (ruteo de herramientas), sdd-spec (seguir templates)
- **Importancia media en:** todas las fases (el modelo debe seguir el formato solicitado)

#### 2.1.5 Comprensión Visual / Multimodal
- **Definición:** Capacidad de procesar y razonar sobre imágenes, diagramas, wireframes y mockups
- **Benchmarks relevantes:** MMMU, MMBench, MathVision, OCRBench
- **Escala:** 0.0 – 10.0
- **Importancia crítica en:** sdd-design (wireframes, mockups, referencias de UI)
- **Modelos destacados:** Gemini Pro, Kimi K2.5 (MoonViT), Pixtral, Llama 3.2 Vision, phi-3.5-vision

#### 2.1.6 Velocidad de Respuesta (Throughput)
- **Definición:** Tokens generados por segundo en condiciones normales de carga
- **Escala:** Tokens/segundo (TPS)
- **Categorías:**
  - Lento: < 20 TPS (típico de modelos de razonamiento: o1, R1)
  - Medio: 20 – 60 TPS
  - Rápido: 60 – 150 TPS
  - Ultra-rápido: > 150 TPS (Claude Haiku 4.5, modelos flash)
- **Importancia alta en:** sdd-tasks, sdd-archive (donde la velocidad > profundidad)
- **Importancia baja en:** sdd-propose (donde es mejor esperar 60s de razonamiento)

#### 2.1.7 Agentic Reliability
- **Definición:** Estabilidad en flujos de múltiples pasos con herramientas, sin desviarse de la tarea original
- **Benchmarks relevantes:** SWE-bench Multi-agent, AgentBench, ClawEval, τ-bench
- **Escala:** 0.0 – 10.0
- **Importancia alta en:** sdd-orchestrator, sdd-apply (en modo agentic), sdd-onboard

#### 2.1.8 Adherencia a Formato Estructurado
- **Definición:** Capacidad de generar output en formatos específicos (JSON, Markdown, XML, YAML) sin desviarse de la estructura
- **Benchmarks relevantes:** No existe benchmark universal; evaluar empíricamente
- **Escala:** 0.0 – 10.0
- **Importancia alta en:** sdd-spec (formato Given/When/Then), sdd-tasks (JSON jerárquico), sdd-design (diagramas Mermaid)

### 2.2 Capacidades Secundarias

#### 2.2.1 Comprensión de Arquitecturas de Software
- Conocimiento profundo de patrones: Hexagonal, Clean Architecture, DDD, SOLID, CQRS, Event Sourcing
- Evaluado implícitamente por SWE-bench y benchmarks de arquitectura
- Crítico para: sdd-propose, sdd-design, sdd-verify

#### 2.2.2 Multilingual Capability
- Capacidad de generar código y documentación en múltiples idiomas de programación
- Importante para: sdd-apply (TypeScript, Python, Rust, Go, etc.)
- Benchmark: Aider Polyglot Score

#### 2.2.3 Long-Horizon Memory Coherence
- Capacidad de mantener coherencia a través de conversaciones largas sin perder el hilo
- Importante para: sdd-apply (múltiples archivos), sdd-verify (revisar el contexto completo)

#### 2.2.4 Calibración (Hallucination Rate)
- Tasa de afirmaciones incorrectas o fabricadas
- Importante en todas las fases, especialmente: sdd-propose (APIs inexistentes), sdd-spec (comportamientos no implementables)
- Benchmark: SimpleQA, TruthfulQA, HalluBench

### 2.3 Características Operacionales (No-Cognitivas)

Estas características afectan la viabilidad operacional del modelo en el pipeline, independientemente de su inteligencia:

| Característica | Descripción | Medición |
|---|---|---|
| **Rate Limit** | Llamadas máximas por minuto/hora/día | RPM / RPH / RPD |
| **Latencia P50** | Tiempo hasta el primer token (TTFT) en el percentil 50 | Milisegundos |
| **Latencia P99** | Tiempo hasta el primer token en el percentil 99 | Milisegundos |
| **Costo por token** | Precio de input y output por millón de tokens | USD/M tokens |
| **Disponibilidad** | Uptime histórico del proveedor | % uptime 30 días |
| **Tier de acceso** | Free / Suscripción / API paga / Plugin nav. | Categoría |
| **Cuota diaria/mensual** | Límite de uso incluido en el tier | Unidades |
| **Cache support** | Si el proveedor soporta prompt caching | Booleano |
| **Streaming support** | Si soporta respuestas en streaming | Booleano |

---

## 3. DIMENSIONES DE EVALUACIÓN Y MÉTRICAS

### 3.1 Mapa Completo de Dimensiones

El motor evalúa cada modelo en **17 dimensiones** organizadas en 4 grupos:

#### Grupo A: Inteligencia y Razonamiento
```
A1. overall_intelligence      — Inteligencia general (MMLU, HLE, chatbot arena)
A2. reasoning_depth           — Profundidad de razonamiento (GPQA, AIME)
A3. instruction_following     — Seguimiento de instrucciones (IFEval)
A4. hallucination_resistance  — Resistencia a alucinaciones (SimpleQA)
```

#### Grupo B: Capacidades Técnicas
```
B1. coding_quality            — Calidad de código (SWE-bench Verified)
B2. coding_multilang          — Soporte multi-lenguaje (Aider Polyglot)
B3. context_window_nominal    — Ventana de contexto declarada (tokens)
B4. context_window_effective  — Ventana de contexto efectiva real (tokens)
B5. tool_calling_accuracy     — Precisión en llamadas a herramientas (BFCL)
B6. agentic_reliability       — Fiabilidad en flujos agénticos (AgentBench)
```

#### Grupo C: Capacidades Especializadas
```
C1. visual_understanding      — Comprensión visual (MMMU, MathVision)
C2. format_adherence          — Adherencia a formatos estructurados (eval empírico)
C3. long_context_coherence    — Coherencia en contextos largos (RULER)
C4. architecture_awareness    — Conocimiento de arquitecturas software (eval empírico)
```

#### Grupo D: Operacionales
```
D1. speed_tokens_per_second   — Velocidad (TPS)
D2. cost_per_million_input    — Costo por millón tokens de entrada (USD)
D3. availability_score        — Disponibilidad histórica (% uptime)
```

### 3.2 Normalización de Métricas

Para que todas las dimensiones sean comparables, se normalizan a una escala 0.0 – 10.0:

**Benchmarks de porcentaje (SWE-bench, MMLU, HumanEval):**
```
score_normalizado = benchmark_percentage / 10
Ejemplo: SWE-bench 78% → 7.8
```

**Ventana de contexto:**
```
score_ctx = log10(context_tokens) / log10(1_048_576) * 10
Ejemplo: 128K tokens → log10(131072)/log10(1048576)*10 = 5.12/6.02*10 = 8.5
Ejemplo: 1M tokens  → 10.0
Ejemplo: 8K tokens  → log10(8192)/log10(1048576)*10 = 3.91/6.02*10 = 6.5
```

**Velocidad (TPS):**
```
score_speed = min(tokens_per_second / 200, 1.0) * 10
Ejemplo: 150 TPS → min(150/200, 1.0)*10 = 7.5
Ejemplo: 40 TPS  → min(40/200, 1.0)*10  = 2.0
```

**Costo (inverso — menor costo = mayor score):**
```
score_cost = max(0, 10 - log10(cost_per_M_input + 1) * 5)
Ejemplo: $0.01/M input  → 10 - log10(0.01+1)*5 = 10 - 0.0*5 ≈ 10.0 (casi gratis)
Ejemplo: $5.00/M input  → 10 - log10(5+1)*5  = 10 - 3.9 = 6.1
Ejemplo: $25.00/M input → 10 - log10(25+1)*5 = 10 - 7.1 = 2.9
```

**Rate limit:**
```
score_ratelimit = min(daily_requests / 10000, 1.0) * 10
Ejemplo: 1,000 req/day  → min(1000/10000, 1.0)*10 = 1.0
Ejemplo: 50,000 req/day → 10.0
Ejemplo: ilimitado       → 10.0
```

---

## 4. FUENTES DE BENCHMARKS

### 4.1 Fuentes Primarias (Alta Confiabilidad)

| Fuente | URL | Qué mide | Frecuencia de actualización |
|---|---|---|---|
| Chatbot Arena / LMSYS | https://arena.ai/leaderboard | ELO por preferencia humana general | Tiempo real |
| Artificial Analysis | https://artificialanalysis.ai/leaderboards/models | Inteligencia, velocidad, costo, contexto | Semanal |
| Scale AI HELM | https://crfm.stanford.edu/helm/ | Benchmark académico multidimensional | Mensual |
| LiveCodeBench | https://livecodebench.github.io/ | Coding en problemas reales (no vistos en training) | Mensual |
| SWE-bench | https://www.swebench.com/ | Resolución de issues reales de GitHub | Por modelo |
| Aider LLM Leaderboard | https://aider.chat/docs/leaderboards/ | Coding en entorno real de edición | Por modelo |
| HuggingFace Open LLM | https://huggingface.co/spaces/open-llm-leaderboard | Benchmarks abiertos (MMLU, ARC, etc.) | Continuo |
| LLM Stats | https://llm-stats.com | Datos agregados de múltiples benchmarks | Semanal |

### 4.2 Fuentes Secundarias (Confiabilidad Media)

| Fuente | URL | Qué mide | Nota |
|---|---|---|---|
| GPQA Diamond | Papers de referencia | Razonamiento experto nivel PhD | Benchmark académico |
| BFCL | https://gorilla.cs.berkeley.edu/leaderboard.html | Function/Tool calling | Muy relevante para orchestrator |
| BigCodeBench | https://bigcode-bench.github.io/ | Coding con librerías reales | Buena cobertura multi-lenguaje |
| AgentBench | GitHub: THUDM/AgentBench | Comportamiento agéntico | Relevante para pipelines |
| RULER | Papers | Long-context coherence real | Importante para init/explore |
| EvalPlus | https://evalplus.github.io/leaderboard.html | HumanEval y MBPP extendidos | Buena cobertura coding |
| Toolbench | GitHub: OpenBMB/ToolBench | Tool calling en APIs reales | Complementa BFCL |

### 4.3 Fuentes de Datos Operacionales

| Fuente | Qué mide | Cómo obtener |
|---|---|---|
| Artificial Analysis | Velocidad (TPS), latencia P50/P99 | API pública |
| OpenRouter | Precios, disponibilidad, contexto | API pública |
| LiteLLM | Agregación de precios multi-provider | Librería Python |
| Provider APIs | Rate limits, cuotas | Documentación oficial cada provider |

### 4.4 Procedimiento de Recolección de Datos

```
Para cada modelo en el sistema:

1. DATOS ESTÁTICOS (actualización mensual):
   - Extraer de las fuentes primarias los benchmark scores
   - Normalizar a escala 0-10 según las fórmulas de la sección 3.2
   - Almacenar con timestamp de extracción

2. DATOS OPERACIONALES (actualización diaria):
   - Consultar OpenRouter/LiteLLM para precios actuales
   - Verificar límites de rate con documentación del provider
   - Calcular disponibilidad de los últimos 30 días

3. DATOS EMPÍRICOS (actualización por PR):
   - format_adherence: evaluar con prompts de test estandarizados
   - architecture_awareness: evaluar con preguntas de diseño de software
   - long_context_coherence: evaluar con el benchmark RULER
   - Contribuciones de la comunidad vía pull requests

4. VALIDACIÓN CRUZADA:
   - Si un benchmark score difiere > 15% entre fuentes, marcar como "disputed"
   - Usar el promedio ponderado de fuentes confiables
   - Flagear modelos sin datos suficientes (< 3 benchmarks primarios)
```

---

## 5. ESQUEMA DE LA MATRIZ DE MODELOS

### 5.1 Estructura del Registro de Modelo

Cada modelo en la base de datos tiene la siguiente estructura:

```json
{
  "model_id": "nvidia/deepseek-ai/deepseek-r1-0528",
  "provider": "nvidia",
  "provider_category": "free_api",
  "model_name": "DeepSeek R1 (mayo 2025)",
  "model_family": "deepseek-r1",
  "model_type": "reasoning",
  "is_thinking_model": true,
  "is_moe": false,
  "total_parameters_B": 671,
  "active_parameters_B": 671,
  
  "context": {
    "window_nominal_tokens": 163840,
    "window_effective_tokens": 120000,
    "max_output_tokens": 32768,
    "supports_cache": true,
    "lost_in_middle_risk": "low"
  },
  
  "capabilities": {
    "A1_overall_intelligence": 8.9,
    "A2_reasoning_depth": 9.8,
    "A3_instruction_following": 8.2,
    "A4_hallucination_resistance": 8.5,
    "B1_coding_quality": 7.3,
    "B2_coding_multilang": 7.0,
    "B3_context_window_score": 8.5,
    "B4_context_effective_score": 8.1,
    "B5_tool_calling_accuracy": 7.8,
    "B6_agentic_reliability": 8.0,
    "C1_visual_understanding": 0.0,
    "C2_format_adherence": 7.5,
    "C3_long_context_coherence": 8.0,
    "C4_architecture_awareness": 9.0,
    "D1_speed_score": 2.5,
    "D2_cost_score": 10.0,
    "D3_availability_score": 8.5
  },
  
  "benchmarks_raw": {
    "swe_bench_verified_pct": 73.3,
    "gpqa_diamond_pct": 78.3,
    "aime_2025_pct": 91.6,
    "humaneval_pct": 91.0,
    "mmlu_pct": 88.5,
    "aider_polyglot_pct": null,
    "arena_elo": 1380,
    "tokens_per_second": 40,
    "sources": ["artificialanalysis", "swebench.com", "deepseek.com"],
    "last_updated": "2026-04-10"
  },
  
  "operational": {
    "cost_per_M_input_usd": 0.0,
    "cost_per_M_output_usd": 0.0,
    "rate_limit_rpm": 20,
    "rate_limit_rpd": null,
    "rate_limit_tpm": 40000,
    "daily_free_requests": null,
    "monthly_free_requests": null,
    "tier": "free_api",
    "requires_account": "nvidia_ai_foundation",
    "requires_payment": false,
    "availability_30d_pct": 97.5,
    "latency_ttft_p50_ms": 2800,
    "latency_ttft_p99_ms": 8000
  },
  
  "tags": ["reasoning", "full-model", "free", "no-vision", "slow", "architecture"],
  "notes": "Modelo completo (no distilado). Razonamiento de clase mundial. Lento por tokens de thinking. No procesa imágenes. Ideal para tareas que requieren razonamiento profundo sin urgencia de tiempo.",
  "last_updated": "2026-04-10",
  "data_quality_score": 0.92
}
```

### 5.2 Categorías de Provider

```yaml
provider_categories:
  
  direct_api_paid:
    description: "API directa con pago por token o suscripción"
    examples: ["anthropic", "openai", "google-api", "mistral-api"]
    budget_impact: high
    rate_limit_risk: low
    
  plugin_browser:
    description: "Acceso via plugin de navegador con cuota limitada"
    examples: ["anthropic-plugin", "google-plugin", "gemini-plugin"]
    budget_impact: high
    rate_limit_risk: very_high
    cuota_per_use: single_use_recommended
    
  github_copilot_student:
    description: "Acceso via GitHub Copilot licencia estudiante"
    examples: ["github-copilot/claude-haiku-4.5", "github-copilot/gpt-4o", "github-copilot/gemini-3.1-pro"]
    budget_impact: low
    rate_limit_risk: medium
    notes: "Incluido en GitHub Student Developer Pack. claude-sonnet-4.5 NO funciona."
    
  github_copilot_free:
    description: "Acceso via GitHub Copilot tier gratuito"
    examples: ["github-copilot/claude-haiku-4.5"]
    budget_impact: none
    rate_limit_risk: medium
    
  free_api:
    description: "API gratuita con rate limits pero sin costo por token"
    examples: ["nvidia", "mistral-free", "opencode-zen"]
    budget_impact: none
    rate_limit_risk: medium
    
  opencode_go:
    description: "Suscripción OpenCode Go a $10/mes"
    examples: ["opencode-go/kimi-k2.5", "opencode-go/mimo-v2-pro", "opencode-go/glm-5.1"]
    budget_impact: flat_fee
    rate_limit_risk: low
    
  opencode_free:
    description: "Tier gratuito de OpenCode Zen"
    examples: ["opencode/gpt-5-nano", "opencode/big-pickle", "opencode/minimax-m2.5-free"]
    budget_impact: none
    rate_limit_risk: low
    
  openai_auth_free:
    description: "Acceso web de OpenAI sin suscripción activa"
    examples: ["openai/gpt-5.4", "openai/gpt-5.3-codex"]
    budget_impact: none
    rate_limit_risk: very_high
    notes: "Límites muy restrictivos. Usar solo en slots críticos de perfil Premium."
```

---

## 6. PERFILES DE CONFIGURACIÓN

### 6.1 Definición de Perfiles

El motor soporta tres perfiles que determinan qué categorías de providers son elegibles y con qué prioridad:

#### Perfil PREMIUM (P1)
```yaml
profile_id: "premium"
description: "Máxima calidad. Todos los providers disponibles. Modelos de pago en fases críticas."
provider_priority_order:
  - direct_api_paid
  - plugin_browser
  - github_copilot_student
  - openai_auth_free
  - opencode_go
  - free_api
  - opencode_free

constraints:
  single_use_models:
    - plugin_browser      # Claude, Gemini Pro → 1 uso por proyecto
    - openai_auth_free    # GPT-5.3-codex, gpt-5.4-mini-fast → 1 uso por SDD
  
  rule_no_same_provider_write_verify: true
  # El proveedor que escribe en apply ≠ el proveedor que verifica en verify
  
  max_cost_per_sdd_cycle_usd: null   # Sin límite de costo en Premium
```

#### Perfil MIXTO (P2)
```yaml
profile_id: "mixto"
description: "Balance inteligente. GitHub Copilot Student como protagonista. NVIDIA gratis para razonamiento."
provider_priority_order:
  - github_copilot_student
  - free_api
  - opencode_go
  - opencode_free
  - direct_api_paid      # Solo si no hay alternativa aceptable

constraints:
  excluded_providers:
    - plugin_browser        # Sin Claude/Gemini directo
    - openai_auth_free      # Sin OpenAI auth libre
  
  rule_no_same_provider_write_verify: true
  max_cost_per_sdd_cycle_usd: 0.10
```

#### Perfil FREE (P3)
```yaml
profile_id: "free"
description: "100% gratuito. NVIDIA + OpenCode Zen + GitHub Copilot Free/Student."
provider_priority_order:
  - free_api
  - github_copilot_free
  - github_copilot_student
  - opencode_go             # Si suscripción activa
  - opencode_free

constraints:
  excluded_providers:
    - direct_api_paid       # Sin APIs de pago
    - plugin_browser        # Sin plugins de pago
    - openai_auth_free      # Límites demasiado restrictivos para flujo continuo
  
  rule_no_same_provider_write_verify: true
  max_cost_per_sdd_cycle_usd: 0.0
```

### 6.2 Reglas Globales de Todos los Perfiles

```yaml
global_rules:
  
  fallback_chain_size: 4
  # Siempre 1 primario + 3 fallbacks por fase
  
  graceful_degradation: true
  # Si modelo 1 falla → 2, si 2 falla → 3, si 3 falla → 4
  
  min_quality_threshold_per_phase:
    sdd-orchestrator: 6.0   # Score mínimo compuesto
    sdd-init:         5.5
    sdd-explore:      7.0   # Alta exigencia: errores aquí se propagan
    sdd-propose:      8.0   # Máxima exigencia
    sdd-spec:         7.0
    sdd-design:       6.5
    sdd-tasks:        5.0   # Baja exigencia: tarea trivial
    sdd-apply:        7.5
    sdd-verify:       7.5   # Alta exigencia: debe superar al que escribe
    sdd-archive:      4.0   # Muy baja: velocidad > calidad
    sdd-onboard:      6.0
  
  diversity_rule:
    # El motor intenta que los 4 modelos de un fallback chain
    # no sean todos del mismo proveedor
    min_providers_in_chain: 2
    prefer_providers_in_chain: 3
```

---

## 7. CRITERIOS DETALLADOS POR FASE SDD

### 7.1 sdd-orchestrator

**Descripción:** El cerebro del pipeline. Lee el prompt del usuario, decide qué sub-agentes llamar y en qué orden. No escribe código, no diseña arquitectura. DELEGA.

**Carga cognitiva:** Media-alta (toma decisiones de ruteo)  
**Volumen de llamadas:** Alto (una por cada acción del pipeline)  
**Latencia requerida:** Baja (el pipeline se bloquea mientras el orquestador decide)

**Criterios y pesos:**

```yaml
sdd_orchestrator_criteria:
  
  A3_instruction_following:
    weight: 10.0   # CRÍTICO — debe obedecer reglas de sistema sin desviarse
    rationale: >
      El orquestador recibe un system prompt extenso con las reglas del pipeline.
      Si no sigue instrucciones exactamente, puede llamar al sub-agente equivocado,
      pasar parámetros incorrectos o romper el flujo de datos entre fases.
      Es la capacidad más importante aquí.
  
  B5_tool_calling_accuracy:
    weight: 9.5    # CRÍTICO — el orquestador usa herramientas para llamar sub-agentes
    rationale: >
      La función principal del orquestador es hacer function calls / tool calls precisas.
      Un error aquí invalida toda la cadena de sub-agentes.
  
  B6_agentic_reliability:
    weight: 9.0    # MUY ALTO — multi-step sin perder el hilo
    rationale: >
      El orquestador maneja sesiones largas con múltiples llamadas a herramientas.
      Debe mantener el contexto de qué se hizo y qué falta sin desviarse de la tarea.
  
  D1_speed_score:
    weight: 8.5    # ALTO — el pipeline se bloquea esperando
    rationale: >
      Cada llamada al orquestador bloquea el pipeline. Un orquestador lento
      multiplica su latencia por cada fase. Priorizar velocidad sobre profundidad.
      NO usar modelos de razonamiento (o1, R1) aquí: su "tiempo de pensar"
      es latencia pura sin beneficio para una tarea de ruteo.
  
  A1_overall_intelligence:
    weight: 7.5    # ALTO — necesita entender el contexto para decidir
    rationale: >
      Aunque el orquestador no razona profundo, necesita comprensión suficiente
      para interpretar el estado actual del pipeline y elegir el próximo paso.
  
  B3_context_window_score:
    weight: 9.0    # MUY ALTO — necesita mantener el historial de la sesión
    rationale: >
      El orquestador recibe el historial completo de la sesión SDD en cada llamada.
      Un proyecto mediano puede generar 20K-50K tokens de historial.
  
  D3_availability_score:
    weight: 8.0    # ALTO — si el orquestador falla, el pipeline muere
    rationale: >
      El orquestador es el único punto de fallo catastrófico del pipeline.
      Si falla sin fallback, todo el SDD se detiene.
  
  A2_reasoning_depth:
    weight: 4.0    # MEDIO — razonamiento profundo medio para rutear
    rationale: >
      El ruteo de herramientas con un razonamiento medio funciona perfectamente.
      Usar un modelo de razonamiento (o1, R1) aquí es overkill y agrega latencia.
  
  B1_coding_quality:
    weight: 3.5    # MEDIO —  escribe código muy pocas veces, debe de tener cierto grado de conocimiento de esta area.
    rationale: "El orquestador delega. no deberia escrir código directamente, solo cuando sea algo muy puntual y pequeño."
  
  C1_visual_understanding:
    weight: 1.5    # BAJO — solo si esta disponible sino, no es necesario de todo, pero si esta, si ayuda.
    rationale: "solo si el modelo lo admite, procesa imágenes."

  REGLA ESPECIAL — CONTEXTO MÍNIMO:
    min_context_window_tokens: 400000
    max_context_window_tokens: 1000000
    reason: >
      Un modelo con menos de 260K tokens de contexto no puede ingerir
      ni un proyecto básico con documentación. Exclusión estricta.
      lo recomendado de 1M es el mas optimo.
    recommended_minimum: 260000
    recommended: 1000000
```

**Score compuesto mínimo recomendado:** 7.5/10  
**Modelos de referencia (alta adecuación):** Gemini flash 2.5, Gemini flash 3, Gemini flash 3.1, (preferencias a modelos con 1M de capacidad de contexto)

---

### 7.2 sdd-init

**Descripción:** Bootstrap del contexto SDD. Lee el proyecto existente: archivos de configuración, package.json, estructura de carpetas, documentación, dependencias. Construye el mapa inicial del proyecto.

**Carga cognitiva:** Media (comprensión, no razonamiento)  
**Volumen de tokens de input:** Muy alto (puede ser > 100K tokens de código)  
**Latencia requerida:** Media (una sola llamada, puede tardar)

**Criterios y pesos:**

```yaml
sdd_init_criteria:
  
  B3_context_window_score:
    weight: 10.0   # CRÍTICO — la ventana define si puede leer el proyecto completo
    rationale: >
      El init necesita ingerir el proyecto COMPLETO en una sola llamada.
      Un proyecto mediano tiene 30K-200K tokens.
      Un proyecto enterprise puede superar los 500K tokens.
      Un modelo con 8K de contexto es inútil aquí aunque sea brillante.
      La ventana de contexto es el criterio discriminante primario.
  
  B4_context_effective_score:
    weight: 9.5    # CRÍTICO — ventana efectiva real (sin "Lost in the Middle")
    rationale: >
      Muchos modelos declaran 128K pero degradan su atención pasados los 32K.
      El "Lost in the Middle" hace que el modelo olvide lo leído al inicio
      cuando el contexto es muy largo. La ventana efectiva importa más que la nominal.
  
  C3_long_context_coherence:
    weight: 9.0    # MUY ALTO — mantener coherencia leyendo archivos dispersos
    rationale: >
      El init lee múltiples archivos de naturaleza muy diferente:
      JSON, TypeScript, Markdown, YAML. Debe mantener coherencia sobre
      qué importa y qué no importa del proyecto para el contexto SDD.
  
  A3_instruction_following:
    weight: 8.0    # ALTO — debe generar un resumen en formato específico
    rationale: >
      El output del init debe ser un documento estructurado de contexto
      en formato estándar para que las fases siguientes lo consuman correctamente.
  
  A4_hallucination_resistance:
    weight: 8.0    # ALTO — no puede inventar dependencias que no existen
    rationale: >
      Si el init alucina dependencias o patrones que no están en el código real,
      las fases posteriores tomarán decisiones basadas en información falsa.
  
  A1_overall_intelligence:
    weight: 6.5    # MEDIO — comprensión general del proyecto
    rationale: >
      Necesita entender qué es importante en el proyecto, no solo leerlo.
      Sin embargo, no necesita razonamiento profundo, solo buena comprensión.
  
  D1_speed_score:
    weight: 4.0    # BAJO — es una sola llamada, puede tardar
    rationale: >
      El init se hace una sola vez por sesión. 30 segundos más no afecta
      significativamente el flujo general del proyecto.
  
  B1_coding_quality:
    weight: 5.0    # MEDIO — necesita entender código para construir el mapa
    rationale: >
      El init lee código real. Un modelo que no entiende TypeScript/Python
      puede perder patrones críticos de arquitectura al mapear el proyecto.
  
  C1_visual_understanding:
    weight: 3.5    # BAJO-MEDIO — algunos proyectos tienen diagramas en la docs
    rationale: >
      Algunos proyectos incluyen diagramas de arquitectura en PNG/SVG.
      Un modelo con visión puede extraer más contexto. Útil pero no crítico.
  
  A2_reasoning_depth:
    weight: 3.0    # BAJO — comprensión, no razonamiento
    rationale: "El init comprende el proyecto, no decide sobre él."
  
  D2_cost_score:
    weight: 6.0    # MEDIO — el init consume muchos tokens por el contexto largo
    rationale: >
      Si el modelo cobra por token y el proyecto tiene 100K tokens,
      el costo del init puede ser significativo. Considerar modelos
      con cache o de bajo costo para proyectos grandes frecuentes.

  REGLA ESPECIAL — CONTEXTO MÍNIMO:
    min_context_window_tokens: 32000
    reason: >
      Un modelo con menos de 32K tokens de contexto no puede ingerir
      ni un proyecto básico con documentación. Exclusión estricta.
    recommended_minimum: 128000
```

**Score compuesto mínimo recomendado:** 6.5/10  
**Modelos de referencia (alta adecuación):** MiMo-V2-Pro (1M ctx), Kimi K2.5 (256K), Gemini Pro (1M+)

---

### 7.3 sdd-explore

**Descripción:** Análisis de impacto. Dada una intención de cambio, el explorador traza las dependencias del sistema: qué se rompe si toco X, qué módulos se ven afectados, cuál es el alcance real del cambio.

**Carga cognitiva:** Muy alta (razonamiento causal, análisis de dependencias)  
**Volumen de tokens:** Medio-alto (lee el mapa del init + código relevante)  
**Latencia requerida:** Media-alta (puede tardar, la calidad importa más)

**Criterios y pesos:**

```yaml
sdd_explore_criteria:
  
  A2_reasoning_depth:
    weight: 10.0   # CRÍTICO — el core de la exploración es razonamiento causal
    rationale: >
      La exploración requiere razonamiento encadenado: "Si modifico la interface A,
      el servicio B que la implementa debe cambiar, lo cual afecta al controlador C,
      lo cual cambia el contrato de la API D, lo cual requiere actualizar el cliente E."
      Esta cadena de 5+ pasos requiere razonamiento profundo, no velocidad.
  
  A4_hallucination_resistance:
    weight: 9.5    # CRÍTICO — no puede inventar dependencias
    rationale: >
      Si explore alucina una dependencia que no existe, el equipo de desarrollo
      desperdiciará tiempo en código innecesario. Si se pierde una dependencia real,
      el cambio romperá el sistema en producción.
  
  C4_architecture_awareness:
    weight: 9.0    # MUY ALTO — necesita entender patrones para rastrear dependencias
    rationale: >
      Un modelo sin conocimiento de arquitecturas de software puede perderse
      dependencias implícitas (ej: eventos en Event-Driven Architecture,
      contratos en Clean Architecture, interfaces en Hexagonal Architecture).
  
  B3_context_window_score:
    weight: 8.5    # ALTO — necesita leer múltiples archivos relacionados
    rationale: >
      El explorador necesita mantener en contexto: el mapa del init,
      el código de los módulos afectados, y la cadena de razonamiento.
      Un contexto corto puede truncar el análisis.
  
  B1_coding_quality:
    weight: 7.5    # ALTO — debe entender el código para trazar dependencias
    rationale: >
      No escribe código, pero necesita LEER y ENTENDER código complejos
      (TypeScript con generics, decorators, patrones de DI) para trazar
      dependencias correctamente.
  
  A1_overall_intelligence:
    weight: 7.0    # ALTO
    rationale: >
      La exploración requiere inteligencia general para contextualizar
      el impacto del cambio dentro del dominio de negocio del proyecto.
  
  C3_long_context_coherence:
    weight: 7.5    # ALTO — traza una cadena larga sin perder el hilo
    rationale: >
      El análisis de dependencias puede extenderse a 10+ módulos relacionados.
      El modelo debe mantener coherencia a lo largo de toda la exploración.
  
  D1_speed_score:
    weight: 2.5    # BAJO — calidad >> velocidad
    rationale: >
      Es preferible esperar 60 segundos de razonamiento a tener una exploración
      incompleta o incorrecta. Los errores aquí se propagan a todo el pipeline.
  
  C1_visual_understanding:
    weight: 2.0    # BAJO
    rationale: "Rara vez necesita procesar imágenes en esta fase."
  
  A3_instruction_following:
    weight: 6.0    # MEDIO — el output debe estar en formato específico
    rationale: >
      El output de explore debe ser un análisis estructurado con:
      módulos afectados, riesgos, scope del cambio. Formato es importante.

  REGLA ESPECIAL — PREFER_THINKING_MODELS:
    prefer_thinking_models: true
    reason: >
      Modelos con extended thinking (R1, Kimi K2-Thinking, Magistral, QwQ, o1/o3)
      generan cadenas de razonamiento internas antes de responder.
      Esto es exactamente lo que necesita explore: "pensar" antes de concluir.
    penalty_for_non_thinking: -1.5
    # Los modelos sin thinking mode reciben penalización de 1.5 puntos
```

**Score compuesto mínimo recomendado:** 7.5/10  
**Modelos de referencia (alta adecuación):** DeepSeek R1-0528, Kimi K2-Thinking, o3, Magistral Medium

---

### 7.4 sdd-propose

**Descripción:** La fase arquitectónica más crítica. Propone CÓMO resolver el problema: qué patrón de diseño aplicar, qué arquitectura usar, qué trade-offs existen, cuál es el approach elegido y por qué.

**Carga cognitiva:** Máxima del pipeline (decisión arquitectónica con consecuencias a largo plazo)  
**Volumen de tokens:** Medio (usa el output de explore como input)  
**Latencia requerida:** Alta (puede tardar minutos; la calidad es lo único que importa)

**Criterios y pesos:**

```yaml
sdd_propose_criteria:
  
  C4_architecture_awareness:
    weight: 10.0   # CRÍTICO — el core de propose es decidir arquitectura
    rationale: >
      El modelo debe conocer profundamente: SOLID, Clean Architecture, Hexagonal,
      DDD, CQRS, Event Sourcing, Microservices vs Monolito, patrones GoF,
      cuándo usar Repository vs Active Record, Dependency Injection frameworks,
      manejo de estado (Signals vs Redux vs Zustand), etc.
      Este es el criterio más discriminante de toda la fase.
  
  A2_reasoning_depth:
    weight: 10.0   # CRÍTICO — debe evaluar trade-offs entre opciones
    rationale: >
      Proponer arquitectura requiere comparar opciones:
      "¿Hexagonal o Clean Architecture? ¿Signals o Redux? ¿Event-driven o REST?"
      Este razonamiento comparativo requiere el nivel más alto de profundidad.
      Un modelo que elige la primera opción que se le ocurre sin evaluar
      trade-offs generará deuda técnica.
  
  A1_overall_intelligence:
    weight: 9.0    # MUY ALTO — inteligencia general para visión holística
    rationale: >
      La propuesta arquitectónica debe considerar el contexto completo del proyecto:
      el equipo, las tecnologías existentes, las restricciones de negocio,
      la scalabilidad futura. Requiere visión holística.
  
  A4_hallucination_resistance:
    weight: 9.5    # CRÍTICO — no puede proponer APIs o patrones que no existen
    rationale: >
      Si propose inventa un patrón ("usemos el FooPattern que es estándar en industria")
      que no existe, el equipo perderá días buscando documentación inexistente.
      Esta es la fase donde la alucinación tiene el mayor impacto negativo.
  
  A3_instruction_following:
    weight: 7.5    # ALTO — el output tiene formato específico
    rationale: >
      El output de propose debe incluir: intent, scope, approach, constraints,
      alternatives considered, decision rationale. Si el modelo no sigue
      este formato, spec no puede procesarlo correctamente.
  
  C3_long_context_coherence:
    weight: 7.0    # ALTO — debe procesar el output completo de explore
    rationale: >
      La propuesta debe ser coherente con el análisis de explore.
      Si explore identificó 8 módulos afectados, propose debe abordarlos todos.
  
  D1_speed_score:
    weight: 1.0    # MUY BAJO — la calidad es absolutamente prioritaria
    rationale: >
      Es preferible esperar 3-5 minutos de razonamiento profundo a tener
      una propuesta arquitectónica incorrecta. Los errores aquí son los más
      costosos de corregir (ver Tabla de Costo Relativo en sección 1.3).
  
  B1_coding_quality:
    weight: 4.0    # BAJO — propone, no implementa
    rationale: >
      La propuesta puede incluir pseudocódigo o ejemplos de interfaces,
      pero no código real. La calidad de coding no es el criterio principal.
  
  C1_visual_understanding:
    weight: 1.5    # MUY BAJO
    rationale: "Raramente necesita procesar imágenes en esta fase."

  REGLA ESPECIAL — MÁXIMA_CALIDAD_OBLIGATORIA:
    strategic_importance: maximum
    reason: >
      sdd-propose es la fase donde el costo de un error es máximo.
      El motor debe asignar siempre el modelo de mayor calidad disponible.
      Si el modelo primario tiene score < 8.0, el motor debe emitir una advertencia.
    warning_threshold: 8.0
    
  REGLA ESPECIAL — PREFER_THINKING_MODELS:
    prefer_thinking_models: true
    reason: "Ver sdd-explore. Aplica aquí con igual o mayor peso."
    thinking_bonus: +1.5
    
  REGLA ESPECIAL — DIFERENCIA_PROVEEDOR_VS_APPLY:
    rule: propose_provider != apply_provider
    reason: >
      Para maximizar la diversidad de perspectivas y reducir sesgos,
      el proveedor que propone la arquitectura debe ser diferente al que la implementa.
```

**Score compuesto mínimo recomendado:** 8.5/10 (el más alto de todo el pipeline)  
**Modelos de referencia (alta adecuación):** Claude Sonnet 4.6, DeepSeek R1-0528, o3, Gemini 2.5 Pro

---

### 7.5 sdd-spec

**Descripción:** Traducción de la propuesta arquitectónica a especificaciones técnicas formales en formato Given/When/Then. Define requirements, acceptance criteria, contratos de interfaces y planes de archivos.

**Carga cognitiva:** Media-alta (técnica, pero más formateo que razonamiento)  
**Volumen de tokens:** Medio (input: propose + design; output: Markdown estructurado)  
**Latencia requerida:** Media

**Criterios y pesos:**

```yaml
sdd_spec_criteria:
  
  C2_format_adherence:
    weight: 10.0   # CRÍTICO — la spec DEBE estar en formato estándar
    rationale: >
      La spec es el contrato entre las fases. Si no sigue exactamente el formato
      Given/When/Then, los agentes posteriores (tasks, apply) no pueden procesarla.
      Un modelo con alta inteligencia pero poca adherencia a formato produce
      specs hermosas pero inutilizables en el pipeline automatizado.
  
  A4_hallucination_resistance:
    weight: 9.5    # CRÍTICO — no puede inventar requirements que no se discutieron
    rationale: >
      Los requirements especificados en sdd-spec se implementarán en sdd-apply.
      Un requirement alucinado genera código innecesario. Un requirement
      faltante genera código incompleto. Ambos aumentan el costo del proyecto.
  
  B1_coding_quality:
    weight: 8.5    # ALTO — los criterios de aceptación deben ser técnicamente correctos
    rationale: >
      Los acceptance criteria son afirmaciones técnicas: "Given un usuario
      autenticado When hace POST /api/orders Then retorna 201 con order_id en body."
      El modelo debe conocer HTTP, tipos de datos, y contratos de API para
      escribir criterios correctos y testables.
  
  C4_architecture_awareness:
    weight: 8.0    # ALTO — la spec debe reflejar la arquitectura propuesta
    rationale: >
      Si propose decidió usar Hexagonal Architecture, la spec debe incluir
      criterios para los ports y adapters específicos. Si se eligió Event-Driven,
      los scenarios deben incluir la emisión de eventos.
  
  A3_instruction_following:
    weight: 9.0    # MUY ALTO — debe seguir el template de spec exactamente
    rationale: >
      La spec tiene una estructura fija: metadata, requirements, scenarios,
      plan de archivos, criterios de aceptación. El template no es opcional.
  
  B3_context_window_score:
    weight: 7.5    # ALTO — necesita leer el output completo de explore y propose
    rationale: >
      Para escribir una spec completa y coherente, el modelo debe tener
      en contexto: el análisis de explore, la propuesta de arquitectura,
      y posiblemente el diseño visual. Esto puede ser > 20K tokens de input.
  
  A2_reasoning_depth:
    weight: 5.0    # MEDIO — necesita algo de razonamiento para ser preciso
    rationale: >
      La spec requiere inferir qué casos edge existen y documentarlos.
      No es puro formateo; hay que pensar qué scenarios pueden ocurrir.
  
  D1_speed_score:
    weight: 5.5    # MEDIO — balance entre velocidad y calidad
    rationale: >
      La spec es una sola llamada, puede tardar 30-60 segundos.
      No es crítico que sea ultra-rápida.
  
  C1_visual_understanding:
    weight: 1.0    # MUY BAJO
    rationale: "No procesa imágenes en esta fase."
```

**Score compuesto mínimo recomendado:** 7.0/10  
**Modelos de referencia (alta adecuación):** Qwen3-Coder-480B, GLM-5.1, DevStral Medium, GPT-5.x

---

### 7.6 sdd-design

**Descripción:** Decisiones de arquitectura técnica visual: diagramas de componentes, estructura de carpetas, contratos de interfaces, mockups de UI, diagramas de secuencia y de entidad-relación.

**Carga cognitiva:** Alta (requiere comprensión espacial y visual + conocimiento técnico)  
**Volumen de tokens:** Medio  
**Latencia requerida:** Media

**Criterios y pesos:**

```yaml
sdd_design_criteria:
  
  C1_visual_understanding:
    weight: 10.0   # CRÍTICO — el design trabaja con mockups, wireframes, diagramas
    rationale: >
      Si el usuario provee wireframes o mockups de la UI como input,
      el modelo debe procesarlos para proponer la estructura de componentes.
      Un modelo sin capacidad visual está completamente ciego en esta fase
      cuando se trabaja con diseños existentes.
      EXCEPCIÓN: Si el proyecto es backend-only, el peso baja a 4.0.
  
  C4_architecture_awareness:
    weight: 9.5    # CRÍTICO — el design define la arquitectura de componentes
    rationale: >
      Las decisiones de design incluyen: qué componentes crear, cómo estructurar
      las carpetas, cómo separar presentación de lógica de negocio,
      cuáles son los contratos de interfaces entre capas.
      Sin conocimiento de arquitecturas, el diseño será amateur.
  
  A2_reasoning_depth:
    weight: 8.5    # MUY ALTO — debe razonar trade-offs de diseño
    rationale: >
      "¿Usamos un componente genérico o componentes especializados?
       ¿La lógica va en el hook o en el servicio?
       ¿Cómo estructuramos los eventos de estado?"
      Estas decisiones requieren razonamiento sobre consecuencias futuras.
  
  B1_coding_quality:
    weight: 8.0    # ALTO — genera interfaces, tipos y contratos de código
    rationale: >
      El output de design incluye: interfaces TypeScript, tipos de datos,
      contratos de API, estructuras de eventos. Deben ser técnicamente correctos.
  
  C2_format_adherence:
    weight: 7.5    # ALTO — genera diagramas Mermaid, estructuras de carpetas
    rationale: >
      El design produce diagramas en Mermaid/PlantUML, árboles de directorios
      en formato estándar, interfaces en TypeScript. El formato importa.
  
  A1_overall_intelligence:
    weight: 7.5    # ALTO — visión holística del sistema
    rationale: >
      El diseño debe ser coherente con la arquitectura propuesta (propose)
      y con los requisitos (spec). Requiere visión del sistema completo.
  
  A3_instruction_following:
    weight: 7.0    # ALTO — el output tiene formato específico
    rationale: >
      El output debe incluir: diagrama de componentes, estructura de carpetas,
      interfaces clave, contratos de API. Template estricto.
  
  B3_context_window_score:
    weight: 6.5    # MEDIO-ALTO
    rationale: >
      Necesita mantener en contexto la propuesta arquitectónica y la spec
      para que el diseño sea coherente. ~15-30K tokens de input típico.
  
  D1_speed_score:
    weight: 4.0    # BAJO — calidad >> velocidad en decisiones de diseño
    rationale: "Una mala decisión de diseño es costosa de revertir."

  REGLA ESPECIAL — VISUAL_MANDATORY_FOR_FRONTEND:
    condition: "project_type in ['frontend', 'fullstack', 'mobile']"
    min_visual_score: 6.0
    reason: >
      Para proyectos frontend/fullstack, un modelo sin capacidad visual
      pierde contexto crítico de los mockups del cliente.
      El motor debe filtrar modelos sin visión cuando el proyecto requiere
      procesamiento de imágenes de diseño.
```

**Score compuesto mínimo recomendado:** 7.5/10  
**Modelos de referencia (alta adecuación):** Gemini 3.1 Pro, Kimi K2.5 (MoonViT), Pixtral Large, phi-3.5-vision

---

### 7.7 sdd-tasks

**Descripción:** Partición de la spec en tareas atómicas implementables con numeración jerárquica. Genera el backlog estructurado del cambio.

**Carga cognitiva:** Baja (procesamiento de texto, partición de lista)  
**Volumen de tokens:** Bajo-medio  
**Latencia requerida:** Muy baja (pipeline bloqueado esperando la lista)

**Criterios y pesos:**

```yaml
sdd_tasks_criteria:
  
  D1_speed_score:
    weight: 10.0   # CRÍTICO — velocidad máxima para tarea trivial
    rationale: >
      Dividir una spec en tareas es la tarea de menor carga cognitiva del pipeline.
      No requiere razonamiento profundo. Usar un modelo lento (R1, o1) aquí
      es el antipatrón financiero más grande posible: 60 segundos de
      "razonamiento" para generar una lista de viñetas.
  
  C2_format_adherence:
    weight: 9.5    # CRÍTICO — el output es JSON con numeración jerárquica
    rationale: >
      Las tareas se generan en formato JSON estructurado con ID jerárquico
      (1.1, 1.2, 2.1, etc.), descripción, estimación y dependencias.
      El apply luego consume este JSON. Si el formato es incorrecto, falla.
  
  A3_instruction_following:
    weight: 9.0    # CRÍTICO — debe seguir el template de tasks exactamente
    rationale: >
      El template de tasks es estricto: cada tarea tiene estructura fija.
      El modelo debe seguirlo sin creatividad adicional.
  
  A4_hallucination_resistance:
    weight: 7.0    # ALTO — no puede inventar tareas no especificadas
    rationale: >
      Si tasks genera tareas que no están en la spec, apply perderá tiempo
      implementando funcionalidad no solicitada.
  
  B3_context_window_score:
    weight: 6.5    # MEDIO — necesita leer la spec completa
    rationale: >
      La spec puede ser extensa (5K-20K tokens). El modelo debe leerla completa
      para generar tareas que la cubran exhaustivamente.
  
  A1_overall_intelligence:
    weight: 4.5    # BAJO — tarea mecánica, no requiere alta inteligencia
    rationale: >
      Dividir "implementar autenticación JWT" en 5 tareas no requiere
      alta inteligencia, requiere seguir un proceso estándar.
  
  A2_reasoning_depth:
    weight: 1.5    # MUY BAJO — no hay razonamiento necesario
    rationale: >
      Un modelo de razonamiento profundo es un desperdicio absoluto aquí.
      La lista de tareas es mecánica.
  
  C1_visual_understanding:
    weight: 0.0    # IRRELEVANTE
    rationale: "No procesa imágenes."
  
  D2_cost_score:
    weight: 7.5    # ALTO — tarea trivial que no merece modelos caros
    rationale: >
      El principio del motor: la tarea de menor valor debe usar
      el modelo de menor costo. Eficiencia financiera máxima aquí.

  REGLA ESPECIAL — ANTI_THINKING_HARD:
    exclude_thinking_models: true
    reason: >
      El extended thinking de R1, o1, QwQ no aporta nada a generar una lista.
      Solo agrega latencia y costo. Exclusión estricta para esta fase.
    
  REGLA ESPECIAL — PREFER_SPEED:
    minimum_speed_score: 6.0
    reason: "El pipeline espera el JSON de tasks antes de proceder a apply."
```

**Score compuesto mínimo recomendado:** 5.5/10 (el más bajo del pipeline)  
**Modelos de referencia (alta adecuación):** Claude Haiku 4.5, GPT-5 Nano, MiniMax M2.5, Gemini Flash

---

### 7.8 sdd-apply

**Descripción:** Implementación del código real siguiendo las specs y el diseño. El agente más importante del pipeline en términos de output directo al usuario.

**Carga cognitiva:** Máxima (escritura de código complejo en múltiples archivos)  
**Volumen de tokens:** Alto (lee spec + design + tasks; genera múltiples archivos)  
**Latencia requerida:** Media (calidad >> velocidad, pero no puede ser extremadamente lento)

**Criterios y pesos:**

```yaml
sdd_apply_criteria:
  
  B1_coding_quality:
    weight: 10.0   # CRÍTICO — escribe el código real del producto
    rationale: >
      sdd-apply escribe el código que irá a producción.
      SWE-bench Verified es el benchmark más relevante aquí.
      La calidad del código impacta directamente en: mantenibilidad, 
      testabilidad, performance y seguridad del producto final.
  
  B2_coding_multilang:
    weight: 8.5    # MUY ALTO — proyectos reales usan múltiples lenguajes
    rationale: >
      Un proyecto real puede necesitar: TypeScript (frontend), Python (backend),
      SQL (queries), Bash (scripts), YAML (infra). El coder debe manejar todos.
  
  C4_architecture_awareness:
    weight: 9.0    # CRÍTICO — debe respetar la arquitectura de propose/design
    rationale: >
      El código escrito debe cumplir la arquitectura definida en propose y design.
      Si propose eligió Hexagonal Architecture, apply debe crear ports y adapters.
      Si design definió una interface específica, apply debe implementarla exactamente.
  
  B3_context_window_score:
    weight: 8.5    # MUY ALTO — necesita leer spec, design, tasks y código existente
    rationale: >
      apply necesita mantener en contexto: la spec con todos los requirements,
      el diseño con las interfaces, las tareas con la lista de archivos a crear,
      y el código existente de los archivos a modificar.
  
  C3_long_context_coherence:
    weight: 8.5    # MUY ALTO — coherencia entre múltiples archivos
    rationale: >
      apply genera múltiples archivos en una sesión. Los archivos deben ser
      coherentes entre sí: los tipos definidos en un archivo deben coincidir
      con su uso en otros. La incoherencia entre archivos es el bug más común.
  
  A4_hallucination_resistance:
    weight: 9.0    # CRÍTICO — no puede importar librerías que no existen
    rationale: >
      Si apply importa 'from non-existent-lib import SomeThing', el código
      no compila. Si usa una API de una librería que no existe, falla en runtime.
      Las alucinaciones en código son directamente bugs de producción.
  
  A2_reasoning_depth:
    weight: 7.0    # ALTO — debe razonar si el código respeta la arquitectura
    rationale: >
      Un buen aplicador no solo escribe código que "funciona", sino que
      razona si lo que está escribiendo es coherente con el blueprint de propose.
      Los modelos de razonamiento (R1) tienen esta capacidad de auto-validación.
  
  A3_instruction_following:
    weight: 8.0    # ALTO — debe seguir el formato de tareas exactamente
    rationale: >
      El apply recibe las tareas como JSON estructurado. Debe implementarlas
      exactamente como se especifican, sin omitir ninguna ni agregar extras.
  
  D1_speed_score:
    weight: 4.5    # MEDIO — calidad > velocidad, pero no puede ser extremo
    rationale: >
      apply genera mucho código. Un modelo ultra-lento (> 120s por tarea)
      hace el pipeline insostenible. Balance necesario.
  
  C1_visual_understanding:
    weight: 3.5    # BAJO-MEDIO
    rationale: >
      Para proyectos frontend, poder ver el mockup mientras se escribe el HTML/CSS
      reduce la cantidad de ajustes posteriores. Útil pero no crítico.

  REGLA ESPECIAL — ANTI_CONFIRMATION_BIAS:
    rule: apply_provider != verify_provider
    reason: >
      Si el mismo modelo escribe y audita el código, tiene puntos ciegos propios.
      Diferentes proveedores tienen diferentes patrones de error y evaluación.
    
  REGLA ESPECIAL — RAZONAMIENTO_EN_APLICACION:
    thinking_model_bonus: +1.0
    reason: >
      Un modelo que "piensa" antes de escribir código tiende a producir
      código más coherente con la arquitectura propuesta. R1 razona si lo que
      está escribiendo cumple el blueprint antes de generarlo.
      Bonus de +1.0 al score final para modelos con thinking mode.
```

**Score compuesto mínimo recomendado:** 7.8/10  
**Modelos de referencia (alta adecuación):** DeepSeek R1-0528, Qwen3-Coder-480B, Claude Sonnet 4.6, Codestral

---

### 7.9 sdd-verify

**Descripción:** Auditoría del código generado por apply. Verifica que cumple las specs, respeta la arquitectura y no introduce bugs, vulnerabilidades o violaciones de principios de diseño.

**Carga cognitiva:** Muy alta (análisis crítico y detección de errores sutiles)  
**Volumen de tokens:** Alto (lee spec + código generado)  
**Latencia requerida:** Media (puede tardar; la exhaustividad importa más)

**Criterios y pesos:**

```yaml
sdd_verify_criteria:
  
  A2_reasoning_depth:
    weight: 10.0   # CRÍTICO — debe razonar sobre corrección del código
    rationale: >
      verify necesita hacer análisis de correctitud formal:
      "¿Este código realmente hace lo que la spec dice que debe hacer?"
      "¿Hay edge cases no manejados?"
      "¿Las condiciones de race condition están cubiertas?"
      Este análisis requiere razonamiento profundo, no solo lectura superficial.
  
  B1_coding_quality:
    weight: 9.5    # CRÍTICO — debe entender profundamente el código que revisa
    rationale: >
      Para detectar: memory leaks, N+1 queries, SQL injection, type safety issues,
      violaciones de SOLID, acoplamiento incorrecto entre capas, el revisor
      debe tener igual o mayor expertise en código que el escritor.
  
  A4_hallucination_resistance:
    weight: 9.0    # CRÍTICO — no puede reportar bugs que no existen
    rationale: >
      Un falso positivo (reportar bug inexistente) desperdicia tiempo del equipo.
      Un falso negativo (no detectar bug real) es peor: llega a producción.
      La calibración del reviewer es crítica.
  
  C4_architecture_awareness:
    weight: 9.0    # CRÍTICO — verifica que se respetó la arquitectura de propose
    rationale: >
      El verification más importante no es "el código funciona" sino
      "el código respeta la arquitectura decidida en propose y design".
      Verificar violaciones de Hexagonal Architecture, SOLID, DDD, etc.
  
  B3_context_window_score:
    weight: 8.0    # ALTO — necesita leer spec + código completo juntos
    rationale: >
      El reviewer necesita: la spec (para verificar requirements), el diseño
      (para verificar arquitectura), y el código generado (para verificar implementación).
      Todo simultáneamente.
  
  A1_overall_intelligence:
    weight: 8.0    # ALTO — debe evaluar calidad global del código
    rationale: >
      Más allá de bugs específicos, el reviewer debe evaluar si el código es
      mantenible, legible, testeable y escalable. Requiere juicio experto.
  
  D1_speed_score:
    weight: 2.0    # MUY BAJO — exhaustividad > velocidad
    rationale: >
      Un review superficial es peor que ningún review. Es preferible esperar
      90 segundos a tener una auditoría incompleta.

  REGLA ESPECIAL — DIFERENTE_PROVEEDOR_DE_APPLY:
    rule: verify_provider != apply_provider
    reason: >
      El principio de separación de responsabilidades cognitivas:
      diferentes modelos tienen diferentes patrones de error y diferentes
      fortalezas de análisis. Si apply usa Qwen3-Coder, verify debe usar
      DeepSeek R1 u otro proveedor para maximizar la detección de errores.
    enforce: strict
    
  REGLA ESPECIAL — PREFER_THINKING_MODELS:
    prefer_thinking_models: true
    thinking_bonus: +1.5
    reason: >
      El extended thinking permite al reviewer "pensar en voz alta" sobre
      cada sección del código antes de emitir juicio. Produce reviews más exhaustivos.
```

**Score compuesto mínimo recomendado:** 8.0/10  
**Modelos de referencia (alta adecuación):** DeepSeek R1-0528, GPT-5.3-Codex, o3, Kimi K2-Thinking

---

### 7.10 sdd-archive

**Descripción:** Sincronización de delta specs a main specs y cierre formal del cambio. Genera el resumen del ciclo SDD para la memoria del sistema (Engram).

**Carga cognitiva:** Muy baja (compresión de texto, formateo)  
**Volumen de tokens:** Bajo  
**Latencia requerida:** Muy baja

**Criterios y pesos:**

```yaml
sdd_archive_criteria:
  
  D1_speed_score:
    weight: 10.0   # CRÍTICO — velocidad máxima para la tarea más trivial
    rationale: >
      Archive comprime los logs del ciclo SDD en un resumen de 2-3 párrafos.
      No requiere razonamiento. No requiere alta inteligencia.
      Usar R1, o1 o Claude Sonnet aquí es el antipatrón más grave del pipeline.
  
  C2_format_adherence:
    weight: 9.0    # MUY ALTO — el resumen debe seguir el template de Engram
    rationale: >
      El sistema de memoria (Engram) tiene un formato específico de ingesta.
      Si el resumen no sigue el formato, Engram no puede indexarlo correctamente.
  
  D2_cost_score:
    weight: 9.5    # CRÍTICO — la tarea de menor valor debe tener costo cero
    rationale: >
      El principio del motor: la tarea de menor valor cognitivo debe ejecutarse
      con el modelo de menor costo. Gastar créditos de Claude en archive es
      una violación directa del principio de eficiencia financiera.
  
  A3_instruction_following:
    weight: 8.0    # ALTO — debe seguir el template de cierre
    rationale: >
      El archive debe generar: resumen del cambio, lista de archivos modificados,
      lecciones aprendidas, métricas del ciclo. Template estricto.
  
  A4_hallucination_resistance:
    weight: 6.0    # MEDIO — el resumen debe ser factual
    rationale: >
      El resumen debe describir lo que REALMENTE se hizo, no inventar.
      Sin embargo, el riesgo es menor aquí porque es el último paso.
  
  A1_overall_intelligence:
    weight: 2.0    # MUY BAJO — no requiere inteligencia alta
    rationale: "Comprimir logs no requiere razonamiento avanzado."
  
  A2_reasoning_depth:
    weight: 0.5    # MÍNIMO
    rationale: "No hay razonamiento necesario en esta fase."

  REGLA ESPECIAL — ABSOLUTE_COST_MINIMUM:
    require_free_or_low_cost: true
    max_cost_per_M_input_usd: 0.10
    reason: >
      El archive es el candidato ideal para modelos gratuitos de bajo costo.
      Si todos los modelos disponibles son de pago, priorizar el de menor costo
      por encima de cualquier otro criterio.
```

**Score compuesto mínimo recomendado:** 4.0/10 (el más bajo junto con tasks)  
**Modelos de referencia (alta adecuación):** Claude Haiku 4.5, MiniMax M2.5-free, Big Pickle, GPT-5-Nano

---

### 7.11 sdd-onboard

**Descripción:** Guía end-to-end del workflow SDD para nuevos colaboradores. Genera documentación de onboarding adaptada al proyecto específico.

**Carga cognitiva:** Media (comprensión + síntesis + pedagogía)  
**Volumen de tokens:** Alto (lee documentación completa del proyecto)  
**Latencia requerida:** Media

**Criterios y pesos:**

```yaml
sdd_onboard_criteria:
  
  B3_context_window_score:
    weight: 9.5    # CRÍTICO — necesita leer toda la documentación del proyecto
    rationale: >
      El onboarding debe ser específico al proyecto: arquitectura real,
      convenciones reales, flujos reales. Para eso necesita leer todo.
      Un modelo con 8K de contexto no puede onboardear a nadie al proyecto real.
  
  A1_overall_intelligence:
    weight: 9.0    # MUY ALTO — debe sintetizar y explicar de forma pedagógica
    rationale: >
      El onboarding no es un dump de información. Debe explicar el proyecto
      de forma que un desarrollador nuevo pueda entenderlo progresivamente.
      Requiere síntesis inteligente y capacidad de adaptación al nivel del lector.
  
  A3_instruction_following:
    weight: 8.5    # MUY ALTO — el output tiene estructura específica
    rationale: >
      El documento de onboarding tiene secciones fijas: introducción al dominio,
      setup del entorno, primer flujo de trabajo, convenciones del equipo,
      guía de contribución. Template estricto.
  
  B1_coding_quality:
    weight: 7.5    # ALTO — incluye ejemplos de código reales del proyecto
    rationale: >
      El onboarding incluye snippets de código del proyecto como ejemplo.
      El modelo debe entender y presentar correctamente el código existente.
  
  C3_long_context_coherence:
    weight: 8.0    # ALTO — debe generar un documento largo y coherente
    rationale: >
      Un buen documento de onboarding tiene 2K-10K palabras con coherencia interna.
      El modelo debe mantener el hilo narrativo a través de múltiples secciones.
  
  A4_hallucination_resistance:
    weight: 8.0    # ALTO — no puede inventar convenciones del proyecto
    rationale: >
      Si el onboarding dice "el proyecto usa la convención X" y X no existe,
      el nuevo colaborador pasará días confundido buscando algo que no existe.
  
  D1_speed_score:
    weight: 4.5    # MEDIO — la calidad importa más que la velocidad
    rationale: "El onboarding se hace pocas veces; vale la pena esperar."
  
  C1_visual_understanding:
    weight: 4.0    # MEDIO — puede necesitar leer diagramas del proyecto
    rationale: >
      Si el proyecto tiene diagramas de arquitectura, el onboarding debe
      poder interpretarlos y referenciarlos correctamente.
```

**Score compuesto mínimo recomendado:** 7.0/10  
**Modelos de referencia (alta adecuación):** MiMo-V2-Pro (1M ctx), Kimi K2.5, GPT-5.x, Gemini Pro

---

## 8. SISTEMA DE PONDERACIÓN Y SCORING

### 8.1 Cálculo del Score Compuesto por Fase

Para cada par (modelo, fase), el motor calcula un **score compuesto** como suma ponderada:

```python
def calculate_phase_score(model: Model, phase: Phase) -> float:
    """
    Calcula el score compuesto de un modelo para una fase específica.
    
    Returns: float entre 0.0 y 10.0
    """
    criteria = PHASE_CRITERIA[phase.id]
    total_weight = sum(c.weight for c in criteria)
    
    weighted_sum = 0.0
    for criterion in criteria:
        model_score = getattr(model.capabilities, criterion.dimension_id)
        weighted_sum += model_score * criterion.weight
    
    base_score = weighted_sum / total_weight
    
    # Aplicar bonuses/penalizaciones de reglas especiales
    adjusted_score = apply_special_rules(model, phase, base_score)
    
    return min(10.0, max(0.0, adjusted_score))


def apply_special_rules(model: Model, phase: Phase, base_score: float) -> float:
    score = base_score
    rules = PHASE_RULES[phase.id]
    
    # Regla: Anti-thinking para orquestador y tasks
    if rules.get('exclude_thinking_models') and model.is_thinking_model:
        return -999.0  # Exclusión total
    
    # Regla: Bonus para thinking en explore/propose/verify
    if rules.get('prefer_thinking_models') and model.is_thinking_model:
        score += rules.get('thinking_bonus', 1.5)
    
    # Regla: Penalización por no-thinking en fases que lo requieren
    if rules.get('prefer_thinking_models') and not model.is_thinking_model:
        score += rules.get('penalty_for_non_thinking', -1.5)
    
    # Regla: Contexto mínimo
    if rules.get('min_context_window_tokens'):
        if model.context.window_nominal_tokens < rules['min_context_window_tokens']:
            return -999.0  # Exclusión total
    
    # Regla: Costo mínimo
    if rules.get('require_free_or_low_cost'):
        if model.operational.cost_per_M_input_usd > rules.get('max_cost_per_M_input_usd', 0.10):
            score -= 3.0  # Penalización severa pero no exclusión total
    
    return score
```

### 8.2 Tabla de Pesos por Fase (Resumen)

| Dimensión | Orchestrator | Init | Explore | Propose | Spec | Design | Tasks | Apply | Verify | Archive | Onboard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1_overall_intelligence | 7.5 | 6.5 | 7.0 | 9.0 | 6.0 | 7.5 | 4.5 | 7.5 | 8.0 | 2.0 | 9.0 |
| A2_reasoning_depth | 4.5 | 3.0 | 10.0 | 10.0 | 5.0 | 8.5 | 1.5 | 7.0 | 10.0 | 0.5 | 5.0 |
| A3_instruction_following | 10.0 | 8.0 | 6.0 | 7.5 | 9.0 | 7.0 | 9.0 | 8.0 | 7.0 | 8.0 | 8.5 |
| A4_hallucination_resistance | 7.0 | 8.0 | 9.5 | 9.5 | 9.5 | 7.0 | 7.0 | 9.0 | 9.0 | 6.0 | 8.0 |
| B1_coding_quality | 3.5 | 5.0 | 7.5 | 4.0 | 8.5 | 8.0 | 3.0 | 10.0 | 9.5 | 1.5 | 7.5 |
| B2_coding_multilang | 0.5 | 3.0 | 5.0 | 3.0 | 5.0 | 5.0 | 1.0 | 8.5 | 7.0 | 0.5 | 4.0 |
| B3_context_window | 8.5 | 10.0 | 8.5 | 6.5 | 7.5 | 6.5 | 6.5 | 8.5 | 8.0 | 3.0 | 9.5 |
| B4_context_effective | 7.5 | 9.5 | 7.0 | 5.5 | 6.5 | 5.5 | 5.0 | 7.0 | 7.0 | 2.5 | 8.5 |
| B5_tool_calling | 9.5 | 3.0 | 4.0 | 3.5 | 3.0 | 3.0 | 2.0 | 5.0 | 3.0 | 2.0 | 3.5 |
| B6_agentic_reliability | 9.0 | 4.0 | 5.0 | 5.0 | 4.5 | 4.5 | 3.0 | 7.5 | 5.5 | 2.5 | 6.0 |
| C1_visual_understanding | 1.5 | 3.5 | 2.0 | 1.5 | 1.0 | 10.0 | 0.0 | 3.5 | 2.5 | 0.5 | 4.0 |
| C2_format_adherence | 5.0 | 4.0 | 5.0 | 6.5 | 10.0 | 7.5 | 9.5 | 6.0 | 5.5 | 9.0 | 8.0 |
| C3_long_context_coherence | 7.5 | 9.0 | 7.5 | 7.0 | 6.5 | 6.0 | 4.5 | 8.5 | 7.5 | 3.5 | 8.0 |
| C4_architecture_awareness | 4.0 | 4.0 | 9.0 | 10.0 | 8.0 | 9.5 | 2.0 | 9.0 | 9.0 | 1.0 | 5.5 |
| D1_speed | 8.5 | 4.0 | 2.5 | 1.0 | 5.5 | 4.0 | 10.0 | 4.5 | 2.0 | 10.0 | 4.5 |
| D2_cost | 5.0 | 6.0 | 5.5 | 5.0 | 5.5 | 5.0 | 7.5 | 5.5 | 5.0 | 9.5 | 5.5 |
| D3_availability | 8.0 | 6.5 | 6.0 | 6.0 | 6.0 | 6.0 | 6.5 | 6.5 | 6.5 | 6.0 | 6.0 |

### 8.3 Score de Elegibilidad por Perfil

Además del score de aptitud para la fase, el motor calcula un **score de elegibilidad** basado en el perfil activo:

```python
def calculate_eligibility_score(model: Model, profile: Profile) -> float:
    """
    Score 0-1 que indica si el modelo es elegible para el perfil activo.
    0.0 = completamente inelegible
    1.0 = perfectamente elegible
    """
    # Verificar si el provider category está en el perfil
    if model.operational.tier not in profile.allowed_tiers:
        return 0.0
    
    # Verificar si el provider está explícitamente excluido
    if model.operational.tier in profile.excluded_providers:
        return 0.0
    
    # Calcular score de prioridad según el orden del perfil
    priority_index = profile.provider_priority_order.index(model.operational.tier)
    priority_score = 1.0 - (priority_index / len(profile.provider_priority_order))
    
    # Verificar cuotas (si el modelo las tiene)
    if model.operational.daily_free_requests:
        if model.operational.daily_free_requests < 10:
            priority_score *= 0.3  # Penalización severa por cuota muy baja
    
    return priority_score


def final_score(model: Model, phase: Phase, profile: Profile) -> float:
    """
    Score final combinado de aptitud y elegibilidad.
    """
    phase_score = calculate_phase_score(model, phase)
    eligibility = calculate_eligibility_score(model, profile)
    
    if eligibility == 0.0:
        return -999.0  # Completamente inelegible
    
    # El score final pondera aptitud (70%) y elegibilidad/prioridad (30%)
    return phase_score * 0.7 + (eligibility * 10) * 0.3
```

---

## 9. ALGORITMO DE SELECCIÓN

### 9.1 Flujo Principal del Motor

```python
def select_models_for_sdd(
    available_models: List[str],    # IDs de modelos que el usuario tiene acceso
    profile: Profile,               # PREMIUM, MIXTO o FREE
    project_config: ProjectConfig   # tipo de proyecto, restricciones especiales
) -> SDDConfiguration:
    """
    Genera la configuración completa de modelos para todas las fases SDD.
    """
    
    # 1. RESOLVER MODELOS: Buscar info de cada modelo en la BD
    resolved_models = []
    missing_models = []
    
    for model_id in available_models:
        model_data = database.get_model(model_id)
        if model_data:
            resolved_models.append(model_data)
        else:
            missing_models.append(model_id)
            # Log: modelo no encontrado en BD, se intentará con datos parciales
    
    # 2. FILTRAR POR ELEGIBILIDAD DEL PERFIL
    eligible_models = [
        m for m in resolved_models 
        if calculate_eligibility_score(m, profile) > 0.0
    ]
    
    # 3. PARA CADA FASE, SELECCIONAR EL FALLBACK CHAIN
    configuration = SDDConfiguration()
    
    for phase in SDD_PHASES:
        chain = select_fallback_chain(
            models=eligible_models,
            phase=phase,
            profile=profile,
            project_config=project_config,
            chain_size=4
        )
        configuration.phases[phase.id] = chain
    
    # 4. APLICAR REGLAS GLOBALES POST-SELECCIÓN
    configuration = apply_global_rules(configuration, profile)
    
    # 5. GENERAR WARNINGS Y RECOMENDACIONES
    warnings = generate_warnings(configuration, eligible_models)
    
    return configuration, warnings


def select_fallback_chain(
    models: List[Model],
    phase: Phase,
    profile: Profile,
    project_config: ProjectConfig,
    chain_size: int = 4
) -> List[ModelSlot]:
    """
    Selecciona el chain de fallback óptimo para una fase.
    """
    
    # Calcular score final para cada modelo en esta fase
    scored_models = []
    for model in models:
        score = final_score(model, phase, profile)
        if score > -999.0:  # No excluido
            # Verificar score mínimo de la fase
            if score >= PHASE_MIN_SCORES[phase.id]:
                scored_models.append((model, score))
    
    # Ordenar por score descendente
    scored_models.sort(key=lambda x: x[1], reverse=True)
    
    # Seleccionar top-N con restricción de diversidad de proveedores
    selected = []
    providers_used = []
    
    for model, score in scored_models:
        if len(selected) >= chain_size:
            break
        
        # Preferir diversidad de proveedores
        if len(selected) > 0 and len(providers_used) < 3:
            if model.provider in providers_used:
                # Este proveedor ya está: ver si hay uno diferente
                alternatives = [
                    (m, s) for m, s in scored_models 
                    if m.provider not in providers_used 
                    and (m, s) not in selected
                    and abs(s - score) < 1.5  # No sacrificar más de 1.5 pts de calidad
                ]
                if alternatives:
                    model, score = alternatives[0]
        
        selected.append(ModelSlot(
            position=len(selected) + 1,
            model=model,
            score=score,
            role="primary" if len(selected) == 0 else "fallback"
        ))
        if model.provider not in providers_used:
            providers_used.append(model.provider)
    
    # Si no hay suficientes modelos, emitir warning
    if len(selected) < chain_size:
        warnings.append(Warning(
            severity="medium",
            phase=phase.id,
            message=f"Solo {len(selected)} modelos disponibles de los {chain_size} requeridos"
        ))
    
    return selected
```

### 9.2 Reglas Globales Post-Selección

```python
def apply_global_rules(config: SDDConfiguration, profile: Profile) -> SDDConfiguration:
    """
    Aplica reglas que afectan a múltiples fases simultáneamente.
    """
    
    # REGLA 1: Anti-sesgo de confirmación (apply ≠ verify en proveedor)
    apply_primary = config.phases['sdd-apply'][0].model
    verify_primary = config.phases['sdd-verify'][0].model
    
    if apply_primary.provider == verify_primary.provider:
        # Buscar el mejor modelo de verify que sea de proveedor diferente
        alt_verify = find_best_alternative_provider(
            phase='sdd-verify',
            exclude_provider=apply_primary.provider,
            config=config
        )
        if alt_verify:
            config.phases['sdd-verify'][0] = alt_verify
            config.add_note("sdd-verify", "Proveedor ajustado por regla anti-sesgo de confirmación")
    
    # REGLA 2: Propose ≠ Apply en proveedor (para maximizar diversidad de perspectivas)
    propose_primary = config.phases['sdd-propose'][0].model
    apply_primary = config.phases['sdd-apply'][0].model
    
    if propose_primary.provider == apply_primary.provider:
        config.add_warning("Propuesta y aplicación usan el mismo proveedor. Considerar diversificar.")
    
    # REGLA 3: Validar que los 1-uso no aparezcan en múltiples fases (Premium)
    if profile.id == 'premium':
        single_use_models = [
            m for m in config.get_all_primary_models()
            if m.operational.tier == 'plugin_browser'
        ]
        
        providers_used = {}
        for model in single_use_models:
            phase = model.assigned_phase
            if model.provider in providers_used:
                config.add_warning(
                    f"ATENCIÓN: {model.provider} asignado como primario en múltiples fases "
                    f"({providers_used[model.provider]} y {phase}). "
                    f"Los plugins tienen 1 uso por proyecto. Revisa manualmente."
                )
            providers_used[model.provider] = phase
    
    return config
```

---

## 10. ARQUITECTURA DEL MOTOR

### 10.1 Componentes del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    SDD MODEL ENGINE                      │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────┐  │
│  │  MODEL INPUT  │    │   RESOLVER   │   │  EMBEDDER │  │
│  │  PARSER      │───▶│   (BD lookup)│──▶│  (vecDB)  │  │
│  └──────────────┘    └──────────────┘   └───────────┘  │
│                              │                  │        │
│                     ┌────────▼──────────────────▼────┐  │
│                     │    MODEL MATRIX BUILDER        │  │
│                     │  (scores + operational data)   │  │
│                     └────────────────────────────────┘  │
│                              │                          │
│  ┌──────────────┐   ┌────────▼──────────┐              │
│  │   PROFILE    │──▶│  SELECTION ENGINE │              │
│  │   CONFIG     │   │  (weighted scoring│              │
│  └──────────────┘   │   + global rules) │              │
│                     └────────────────────┘              │
│                              │                          │
│  ┌──────────────┐   ┌────────▼──────────┐              │
│  │   OUTPUT     │◀──│   CONFIGURATION   │              │
│  │   FORMATTER  │   │   GENERATOR       │              │
│  └──────────────┘   └───────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Pipeline de Procesamiento

```
INPUT: Lista de model_ids + profile + project_config
        │
        ▼
STEP 1: RESOLVER
  - Para cada model_id:
    a. Buscar en BD relacional (datos completos)
    b. Si no está → buscar en índice de embeddings por similitud
    c. Si tampoco → usar scraper para obtener datos básicos
    d. Calcular data_quality_score (0-1) para cada modelo
        │
        ▼
STEP 2: ENRIQUECER
  - Para modelos con data_quality_score < 0.5:
    a. Fetch de benchmarks desde fuentes primarias (APIs públicas)
    b. Normalizar métricas según fórmulas de sección 3.2
    c. Cachear resultados por 7 días
        │
        ▼
STEP 3: CALCULAR SCORES
  - Para cada par (modelo, fase):
    a. Calcular score de aptitud (weighted sum)
    b. Aplicar reglas especiales (bonuses/penalizaciones)
    c. Calcular score de elegibilidad (filtro de perfil)
    d. Calcular score final combinado
        │
        ▼
STEP 4: SELECCIONAR CHAINS
  - Para cada fase:
    a. Filtrar modelos por score mínimo
    b. Ordenar por score descendente
    c. Seleccionar top-4 con restricción de diversidad de proveedores
    d. Validar que hay al menos 1 modelo por fase
        │
        ▼
STEP 5: APLICAR REGLAS GLOBALES
  - Regla anti-sesgo: apply_provider ≠ verify_provider
  - Regla 1-uso: alertar sobre modelos de plugin usados en múltiples fases
  - Regla diversidad: mínimo 2 proveedores en el pipeline completo
        │
        ▼
STEP 6: GENERAR OUTPUT
  - Configuración en formato opencode.json
  - Tabla de scores por modelo/fase
  - Warnings y recomendaciones
  - Explicación del razonamiento (opcional)
```

### 10.3 Módulo de Embeddings

Para búsqueda por similitud cuando un modelo no está en la BD:

```python
# Esquema del vector de embedding para búsqueda de modelos
MODEL_EMBEDDING_SCHEMA = {
    "description": "Descripción textual del modelo y sus capacidades",
    "capabilities_vector": [
        # 17 dimensiones normalizadas → vector numérico
        "overall_intelligence_normalized",
        "reasoning_depth_normalized",
        "instruction_following_normalized",
        "hallucination_resistance_normalized",
        "coding_quality_normalized",
        "coding_multilang_normalized",
        "context_window_log_normalized",
        "context_effective_normalized",
        "tool_calling_normalized",
        "agentic_reliability_normalized",
        "visual_understanding_normalized",
        "format_adherence_normalized",
        "long_context_coherence_normalized",
        "architecture_awareness_normalized",
        "speed_normalized",
        "cost_inverse_normalized",
        "availability_normalized"
    ],
    "tags_vector": "one-hot encoding de tags del modelo"
}

# Cuando se busca un modelo desconocido:
# 1. Generar embedding de la descripción del modelo (nombre, familia, claims)
# 2. Buscar en la vecDB los k modelos más similares
# 3. Usar sus scores como aproximación para el modelo desconocido
# 4. Marcar como "estimated_scores" con data_quality_score bajo
```

---

## 11. ESQUEMA DE BASE DE DATOS

### 11.1 Tablas Principales

```sql
-- Tabla principal de modelos
CREATE TABLE models (
    model_id            VARCHAR(256) PRIMARY KEY,
    provider            VARCHAR(64) NOT NULL,
    provider_category   VARCHAR(64) NOT NULL,
    model_name          VARCHAR(256) NOT NULL,
    model_family        VARCHAR(128),
    model_type          VARCHAR(64),  -- 'reasoning', 'coder', 'general', 'vision', 'flash'
    is_thinking_model   BOOLEAN DEFAULT FALSE,
    is_moe              BOOLEAN DEFAULT FALSE,
    total_params_B      DECIMAL(10,2),
    active_params_B     DECIMAL(10,2),
    
    -- Context
    ctx_nominal_tokens  INTEGER,
    ctx_effective_tokens INTEGER,
    max_output_tokens   INTEGER,
    supports_cache      BOOLEAN DEFAULT FALSE,
    lost_in_middle_risk VARCHAR(16),  -- 'low', 'medium', 'high'
    
    -- Operational
    cost_input_per_M    DECIMAL(10,4),
    cost_output_per_M   DECIMAL(10,4),
    rate_limit_rpm      INTEGER,
    rate_limit_rpd      INTEGER,
    rate_limit_tpm      INTEGER,
    daily_free_requests INTEGER,
    monthly_free_req    INTEGER,
    tier                VARCHAR(64),
    requires_account    VARCHAR(128),
    requires_payment    BOOLEAN DEFAULT FALSE,
    availability_30d    DECIMAL(5,2),
    latency_ttft_p50_ms INTEGER,
    latency_ttft_p99_ms INTEGER,
    
    -- Metadata
    tags                TEXT[],
    notes               TEXT,
    data_quality_score  DECIMAL(3,2),
    last_updated        TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Tabla de scores de capacidades
CREATE TABLE model_capabilities (
    model_id                    VARCHAR(256) REFERENCES models(model_id),
    
    -- Grupo A: Inteligencia
    a1_overall_intelligence     DECIMAL(4,2),
    a2_reasoning_depth          DECIMAL(4,2),
    a3_instruction_following    DECIMAL(4,2),
    a4_hallucination_resistance DECIMAL(4,2),
    
    -- Grupo B: Técnicas
    b1_coding_quality           DECIMAL(4,2),
    b2_coding_multilang         DECIMAL(4,2),
    b3_context_window_score     DECIMAL(4,2),
    b4_context_effective_score  DECIMAL(4,2),
    b5_tool_calling_accuracy    DECIMAL(4,2),
    b6_agentic_reliability      DECIMAL(4,2),
    
    -- Grupo C: Especializadas
    c1_visual_understanding     DECIMAL(4,2),
    c2_format_adherence         DECIMAL(4,2),
    c3_long_context_coherence   DECIMAL(4,2),
    c4_architecture_awareness   DECIMAL(4,2),
    
    -- Grupo D: Operacionales
    d1_speed_score              DECIMAL(4,2),
    d2_cost_score               DECIMAL(4,2),
    d3_availability_score       DECIMAL(4,2),
    
    PRIMARY KEY (model_id)
);

-- Tabla de benchmarks raw
CREATE TABLE model_benchmarks (
    id                  SERIAL PRIMARY KEY,
    model_id            VARCHAR(256) REFERENCES models(model_id),
    benchmark_name      VARCHAR(128),   -- 'swe_bench_verified', 'gpqa_diamond', etc.
    score_value         DECIMAL(10,4),
    score_unit          VARCHAR(32),    -- 'percentage', 'elo', 'tps', 'ms'
    source              VARCHAR(128),
    measured_at         TIMESTAMP,
    notes               TEXT
);

-- Caché de scores calculados por fase
CREATE TABLE phase_scores_cache (
    model_id            VARCHAR(256) REFERENCES models(model_id),
    phase_id            VARCHAR(64),
    profile_id          VARCHAR(32),
    
    aptitude_score      DECIMAL(4,2),
    eligibility_score   DECIMAL(4,2),
    final_score         DECIMAL(4,2),
    
    rules_applied       JSONB,          -- Qué reglas especiales se aplicaron
    exclusion_reason    VARCHAR(256),   -- NULL si no fue excluido
    
    calculated_at       TIMESTAMP DEFAULT NOW(),
    valid_until         TIMESTAMP,      -- Cache TTL (24h para operacionales, 7d para benchmarks)
    
    PRIMARY KEY (model_id, phase_id, profile_id)
);

-- Historial de configuraciones generadas
CREATE TABLE generated_configurations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_session        VARCHAR(256),
    profile_id          VARCHAR(32),
    input_models        TEXT[],
    configuration       JSONB,
    warnings            JSONB,
    score_matrix        JSONB,
    generated_at        TIMESTAMP DEFAULT NOW()
);
```

---

## 12. LÓGICA DE FALLBACK Y GRACEFUL DEGRADATION

### 12.1 Tipos de Fallo y Respuestas

```yaml
fallback_triggers:
  
  http_429_rate_limit:
    action: immediate_fallback_to_next
    wait_before_retry: false
    note: "El modelo llegó a su límite. No esperar, ir al siguiente."
  
  http_503_unavailable:
    action: immediate_fallback_to_next
    wait_before_retry: false
    mark_as_degraded: true
    degraded_timeout_minutes: 30
  
  http_408_timeout:
    action: retry_once_then_fallback
    retry_after_seconds: 5
    max_retries: 1
  
  http_401_unauthorized:
    action: immediate_fallback_to_next
    alert: "Revisar credenciales del proveedor"
    skip_provider: true   # No intentar otros modelos del mismo proveedor
  
  empty_response:
    action: retry_once_then_fallback
    max_retries: 1
  
  malformed_output:
    action: retry_with_stricter_prompt_then_fallback
    max_retries: 1
    add_to_prompt: "IMPORTANTE: Tu respuesta DEBE estar en el formato exacto especificado."
  
  context_length_exceeded:
    action: immediate_fallback_to_larger_context_model
    note: "Saltar modelos con contexto menor, buscar el siguiente con más contexto"
```

### 12.2 Algoritmo de Fallback en Runtime

```python
async def execute_with_fallback(
    phase: Phase,
    prompt: str,
    configuration: SDDConfiguration
) -> tuple[str, Model]:
    """
    Ejecuta la fase con fallback automático.
    Returns: (respuesta, modelo_que_respondió)
    """
    chain = configuration.phases[phase.id]
    last_error = None
    
    for slot in chain:
        model = slot.model
        
        # Verificar si el modelo está marcado como degradado
        if is_model_degraded(model.model_id):
            continue
        
        try:
            response = await call_model(
                model=model,
                prompt=prompt,
                timeout_ms=PHASE_TIMEOUTS[phase.id]
            )
            
            # Validar que la respuesta tiene el formato esperado
            if not validate_response_format(response, phase):
                raise MalformedOutputError(f"Formato inválido para fase {phase.id}")
            
            return response, model
            
        except RateLimitError as e:
            log_warning(f"Rate limit en {model.model_id} para {phase.id}")
            last_error = e
            continue
            
        except ContextLengthExceededError as e:
            log_warning(f"Contexto insuficiente en {model.model_id} para {phase.id}")
            # Saltar modelos con contexto menor que el actual
            min_context = e.required_tokens
            chain = [s for s in chain if s.model.context.window_nominal_tokens >= min_context]
            last_error = e
            continue
            
        except UnavailableError as e:
            mark_model_degraded(model.model_id, duration_minutes=30)
            last_error = e
            continue
            
        except Exception as e:
            log_error(f"Error inesperado en {model.model_id}: {str(e)}")
            last_error = e
            continue
    
    # Todos los fallbacks fallaron
    raise PipelineFailureError(
        phase=phase.id,
        message=f"Todos los {len(chain)} modelos del chain fallaron",
        last_error=last_error
    )
```

---

## 13. REGLAS DE NEGOCIO Y RESTRICCIONES

### 13.1 Reglas Absolutas (No Negociables)

```yaml
absolute_rules:
  
  rule_1_thinking_models_excluded_from_orchestrator:
    phases: [sdd-orchestrator]
    condition: "model.is_thinking_model == true"
    action: exclude
    reason: >
      Los modelos de razonamiento profundo generan latencia de 15-90 segundos
      por "pensar" antes de hacer una llamada a herramienta.
      Esta latencia es inaceptable para el orquestador que se llama múltiples veces.
  
  rule_2_thinking_models_excluded_from_tasks_and_archive:
    phases: [sdd-tasks, sdd-archive]
    condition: "model.is_thinking_model == true AND model.speed_tps < 30"
    action: strong_penalization
    penalty: -3.0
    reason: >
      Tareas triviales (dividir spec en tickets, comprimir logs) no justifican
      el tiempo de razonamiento de estos modelos. El pipeline se bloquea innecesariamente.
  
  rule_3_minimum_context_for_init:
    phases: [sdd-init, sdd-onboard]
    condition: "model.ctx_nominal_tokens < 32000"
    action: exclude
    reason: "Un proyecto mínimo tiene > 10K tokens. 32K es el mínimo absoluto."
  
  rule_4_anti_confirmation_bias:
    phases: [sdd-apply, sdd-verify]
    condition: "apply_primary.provider == verify_primary.provider"
    action: adjust_verify_provider
    reason: >
      Diferentes proveedores tienen diferentes patrones de error.
      El que escribe el código NO puede ser el único en revisarlo.
  
  rule_5_no_visual_in_non_visual_phases:
    phases_with_visual_input: [sdd-design, sdd-init]
    rule: >
      Solo filtrar por visual_understanding en fases que explícitamente
      reciben imágenes como input. No penalizar modelos sin visión en
      fases donde el input es puramente textual.
  
  rule_6_data_quality_minimum:
    condition: "model.data_quality_score < 0.3"
    action: flag_as_estimated
    warning: >
      Este modelo tiene datos insuficientes (<30% de fuentes verificadas).
      Los scores son estimaciones. Usar con precaución.
```

### 13.2 Reglas de Preferencia (Negociables por Config)

```yaml
preference_rules:
  
  pref_1_thinking_bonus_in_critical_phases:
    phases: [sdd-explore, sdd-propose, sdd-verify]
    condition: "model.is_thinking_model == true"
    bonus: +1.5
    configurable: true
    default: enabled
  
  pref_2_diversity_of_providers:
    description: "Preferir chains con múltiples proveedores"
    min_providers: 2
    preferred_providers: 3
    configurable: true
    can_override: true  # Si no hay alternativas, se puede repetir proveedor
  
  pref_3_cost_efficiency_in_trivial_phases:
    phases: [sdd-tasks, sdd-archive]
    prefer_free_models: true
    configurable: true
    default: enabled
  
  pref_4_propose_apply_provider_diversity:
    rule: "propose_provider != apply_provider"
    type: soft_preference
    penalty_if_violated: -0.5
    configurable: true
```

---

## 14. EMBEDDINGS Y REPRESENTACIÓN SEMÁNTICA

### 14.1 Por qué Embeddings

El motor combina dos enfoques:

1. **Scoring matricial** (secciones anteriores): Para modelos conocidos en la BD con datos verificados
2. **Búsqueda por embedding**: Para modelos nuevos o no documentados, y para búsqueda semántica de alternativas

### 14.2 Esquema de Embedding por Fase

Cada **fase SDD** se representa como un vector de "requerimientos ideales":

```python
PHASE_IDEAL_VECTORS = {
    "sdd-orchestrator": {
        "description": "Modelo ideal para orquestar un pipeline de agentes de desarrollo de software. Velocidad máxima, tool calling perfecto, instruction following impecable. No debe razonar profundo, debe actuar rápido. Sin capacidad de escritura de código propia.",
        "capability_weights": [7.5, 3.0, 10.0, 7.0, 1.0, 0.5, 7.0, 5.0, 9.5, 9.0, 0.0, 5.0, 6.0, 4.0, 8.5, 5.0, 8.0],
        # Los pesos se usan para calcular similitud coseno ponderada
    },
    "sdd-propose": {
        "description": "Modelo ideal para proponer arquitecturas de software. Máximo razonamiento. Experto en SOLID, Hexagonal Architecture, DDD, patrones de diseño. Evalúa trade-offs. No alucina. Prefiere pensar antes de responder.",
        "capability_weights": [9.0, 10.0, 7.5, 9.5, 4.0, 3.0, 6.5, 5.5, 3.5, 5.0, 1.5, 6.5, 7.0, 10.0, 1.0, 5.0, 6.0],
    },
    # ... etc para cada fase
}
```

### 14.3 Búsqueda de Alternativas por Similitud

```python
def find_similar_model(
    unknown_model_description: str,
    phase: Phase,
    k: int = 5
) -> List[Model]:
    """
    Dado un modelo no en la BD, encontrar los k más similares
    para usar sus scores como estimación.
    """
    # 1. Generar embedding del modelo desconocido
    model_embedding = embed(unknown_model_description)
    
    # 2. Ajustar por los pesos de la fase (similitud ponderada)
    phase_weights = PHASE_IDEAL_VECTORS[phase.id]["capability_weights"]
    weighted_embedding = model_embedding * phase_weights
    
    # 3. Buscar en la vecDB
    similar_models = vector_db.search(
        query=weighted_embedding,
        k=k,
        filter={"data_quality_score": {"$gte": 0.6}}  # Solo modelos con buenos datos
    )
    
    # 4. Calcular scores estimados como promedio ponderado
    estimated_scores = {}
    for dim in CAPABILITY_DIMENSIONS:
        weighted_avg = sum(
            m.capabilities[dim] * similarity_score
            for m, similarity_score in similar_models
        ) / sum(s for _, s in similar_models)
        estimated_scores[dim] = weighted_avg
    
    return estimated_scores, data_quality_score=0.35  # Marcar como estimado
```

---

## 15. ACTUALIZACIÓN Y MANTENIMIENTO DE LA MATRIZ

### 15.1 Ciclos de Actualización

```yaml
update_cycles:
  
  daily_automated:
    frequency: "Cada 24 horas a las 00:00 UTC"
    updates:
      - availability_30d (recalcular con datos de las últimas 24h)
      - cost_per_M (verificar si el proveedor cambió precios)
      - rate_limit_rpm (verificar documentación del proveedor)
      - phase_scores_cache (invalidar cache de scores operacionales)
    source: "API pública de cada proveedor / OpenRouter / LiteLLM"
    
  weekly_automated:
    frequency: "Cada lunes a las 03:00 UTC"
    updates:
      - arena_elo (Chatbot Arena actualiza semanalmente)
      - tokens_per_second (Artificial Analysis)
      - latency_p50_p99 (Artificial Analysis)
    source: "Artificial Analysis API, LMSYS Arena"
  
  monthly_automated:
    frequency: "Primer lunes de cada mes"
    updates:
      - swe_bench_verified (cuando hay nuevas evaluaciones)
      - humaneval, mbpp
      - mmlu, gpqa_diamond
      - recalcular capability_scores desde benchmarks raw
    source: "Fuentes primarias de benchmarks"
  
  on_new_model_release:
    trigger: "Nuevo modelo detectado en listas de proveedores"
    process:
      1. Scrapear información básica del modelo (context, tipo, parámetros)
      2. Buscar benchmarks en fuentes primarias
      3. Si no hay datos: calcular scores estimados por embedding similarity
      4. Marcar data_quality_score según disponibilidad de datos
      5. Agregar a la BD con flag pending_verification
      6. Generar PR automático para revisión manual
  
  community_contribution:
    process:
      1. PR en repositorio del proyecto
      2. Formato estándar: JSON con model_id, benchmarks, fuentes
      3. Validación automática del schema
      4. Review manual por maintainers
      5. Merge → actualización inmediata en BD
```

### 15.2 Criterios para Agregar un Modelo Nuevo

Para que un modelo sea elegible en el motor, debe cumplir:

```yaml
minimum_data_requirements:
  
  tier_A_full_data:
    description: "Modelo completamente documentado"
    requirements:
      - Al menos 3 benchmarks primarios con fuentes verificadas
      - Información operacional completa (context, costo, rate limits)
      - data_quality_score >= 0.7
    treatment: "Scores calculados directamente de benchmarks"
  
  tier_B_partial_data:
    description: "Modelo con datos parciales"
    requirements:
      - Al menos 1 benchmark primario
      - Información básica (context, tipo)
      - data_quality_score entre 0.4 y 0.7
    treatment: "Scores combinados: benchmarks disponibles + estimación por embedding"
    warning_label: "⚠️ Datos parciales — scores pueden ser imprecisos"
  
  tier_C_estimated:
    description: "Modelo sin benchmarks verificados"
    requirements:
      - Información básica del proveedor (context, tipo, familia)
      - data_quality_score < 0.4
    treatment: "Scores completamente estimados por embedding similarity"
    warning_label: "⚠️ Datos estimados — usar con precaución"
    auto_exclude: "Excluir de selección primaria automáticamente"
```

---

## APÉNDICE A: Ejemplo de Output del Motor

```json
{
  "configuration_id": "cfg-2026-04-10-001",
  "profile": "premium",
  "generated_at": "2026-04-10T14:30:00Z",
  "phases": {
    "sdd-orchestrator": {
      "slots": [
        {
          "position": 1,
          "role": "primary",
          "model_id": "github-copilot/gpt-4o",
          "phase_score": 8.7,
          "score_breakdown": {
            "A3_instruction_following": {"raw": 9.1, "weight": 10.0, "contribution": 1.47},
            "B5_tool_calling_accuracy": {"raw": 9.0, "weight": 9.5, "contribution": 1.39},
            "D1_speed_score": {"raw": 8.0, "weight": 8.5, "contribution": 1.10}
          },
          "special_rules_applied": ["anti_thinking_models: NOT_THINKING = OK"],
          "justification": "Mejor score de instruction following + tool calling del stack disponible. No es thinking model → sin latencia adicional."
        },
        {
          "position": 2,
          "role": "fallback_1",
          "model_id": "nvidia/mistralai/mistral-large-3-675b-instruct-2512",
          "phase_score": 7.9
        },
        {
          "position": 3,
          "role": "fallback_2",
          "model_id": "opencode-go/glm-5.1",
          "phase_score": 7.2
        },
        {
          "position": 4,
          "role": "fallback_3",
          "model_id": "nvidia/meta/llama-3.3-70b-instruct",
          "phase_score": 6.8
        }
      ],
      "provider_diversity": 3,
      "warnings": []
    }
  },
  "global_warnings": [
    {
      "severity": "info",
      "message": "Regla anti-sesgo aplicada: verify provider ajustado de nvidia a openai para evitar mismo proveedor que apply"
    }
  ],
  "score_matrix": {
    "github-copilot/gpt-4o": {
      "sdd-orchestrator": 8.7,
      "sdd-init": 6.1,
      "sdd-propose": 7.2
    }
  }
}
```

---

## APÉNDICE B: Tags del Sistema de Clasificación

```yaml
model_tags:
  capability_tags:
    - reasoning          # Modelo de razonamiento profundo (R1, o1, QwQ, Magistral)
    - flash              # Modelo ultrarrápido optimizado para velocidad
    - coder              # Especializado en generación de código
    - vision             # Soporta input de imágenes
    - long-context       # Contexto > 128K tokens
    - ultra-context      # Contexto > 512K tokens
    - moe                # Arquitectura Mixture of Experts
    - agentic            # Optimizado para flujos agénticos
    - multimodal         # Texto + imagen + (posiblemente) audio
  
  operational_tags:
    - free               # Sin costo por token
    - paid               # Costo por token
    - subscription       # Incluido en suscripción
    - plugin             # Acceso via plugin de navegador (cuota limitada)
    - student-plan       # Disponible en GitHub Student Pack
    - slow               # < 20 TPS (modelos de razonamiento)
    - medium-speed       # 20-80 TPS
    - fast               # > 80 TPS
    - high-rate-limit    # Rate limit muy restrictivo (< 100 RPD)
  
  quality_tags:
    - top-tier           # Arena ELO > 1300
    - mid-tier           # Arena ELO 1100-1300
    - experimental       # Modelo en beta o sin benchmarks verificados
    - deprecated         # Modelo retirado o próximo a retirarse
    - community-verified # Datos verificados por la comunidad
```

---

*Este documento es la fuente de verdad para el motor de selección de modelos SDD. Toda implementación debe referenciar este documento como specification base. Las versiones del documento se versionan junto con la BD de modelos.*

*Contribuciones y correcciones via pull request al repositorio del proyecto.*

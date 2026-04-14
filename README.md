<div align="center">

![SDD Team Optimizer — Hero]([https://raw.githubusercontent.com/RamonsDka/ssd-optimizer-v1/master/public/panel.jpeg](https://i.ibb.co/Wvr4QGyJ/image1.jpg)

# SDD Team Optimizer

**Arquitecta tu equipo SDD perfecto en segundos.**  
Analizá tu lista de modelos LLM y obtené el equipo óptimo para cada fase del flujo Spec-Driven Development.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)

</div>

---

## ¿Qué es esto?

SDD Team Optimizer es una herramienta web que recibe tu lista de modelos de lenguaje y asigna automáticamente el modelo óptimo a cada una de las 10 fases del workflow **Spec-Driven Development (SDD)**:

> _Explorá → Proponé → Especificá → Diseñá → Planificá → Implementá → Verificá → Archivá_

El motor de scoring evalúa contexto, costo, capacidades y un fallback jerárquico para generar tres perfiles de equipo: **PREMIUM**, **BALANCED** y **ECONOMIC**.

---

## Features

| Feature | Descripción |
|---|---|
| 🧠 **Optimizer** | Pegás tu lista de modelos, obtenés 3 perfiles completos con scoring por fase |
| 🎯 **SDD Orchestrator** | Recomendación fija del modelo orquestador (Claude Opus 4.5 + 3 fallbacks) |
| 📊 **DataMatrix** | Grid 2×5 de las 10 fases SDD con primario + fallbacks clicables |
| 🪟 **ModelDetailModal** | Modal con score, reasoning, capacidades y specs del modelo |
| ⚖️ **ComparisonTable** | Comparación side-by-side de los 3 perfiles con export a texto |
| 🔄 **OpenRouter Sync** | Sincronización automática de modelos desde OpenRouter API |
| 🤖 **Gemini AI** | Categorización inteligente de modelos por tier y fortalezas |
| 📝 **Historial** | Persistencia de todas las optimizaciones realizadas |
| 🌐 **i18n** | Español / Inglés |
| 📋 **Copy & Export** | Copiá la lista de modelos o exportá el perfil completo en JSON |

---

## Stack técnico

```
Next.js 15 (App Router + Turbopack)
Tailwind CSS 4              — Kanagawa palette, 0px radius (Architectural Brutalism)
Prisma ORM + PostgreSQL 16  — modelo relacional completo
Gemini AI                   — categorización de modelos
OpenRouter API              — sync de catálogo de modelos
Docker Compose              — Next.js + PostgreSQL + Nginx
```

---

## Inicio rápido (Docker)

**Requisitos:** Docker + Docker Compose

```bash
# 1. Clonar el repo
git clone https://github.com/RamonsDka/ssd-optimizer-v1.git
cd ssd-optimizer-v1

# 2. Configurar variables de entorno
cp .env.example .env
# Editá .env y completá las API keys

# 3. Levantar el stack
docker compose up -d

# 4. Correr migraciones (primera vez)
docker exec sdd_optimizer_app npx prisma migrate deploy

# 5. Seed inicial (opcional)
docker exec sdd_optimizer_app npx ts-node prisma/seed.ts
```

Abrí **[http://localhost:8081](http://localhost:8081)** — el optimizer está listo.

---

## Desarrollo local

**Requisitos:** Node.js 22+, PostgreSQL 16

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Correr migraciones
npx prisma migrate dev

# Levantar dev server
npm run dev        # http://localhost:3000
```

---

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

| Variable | Descripción | Requerida |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | ✅ |
| `GEMINI_API_KEY` | API key de Google Gemini | ✅ |
| `OPENROUTER_API_KEY` | API key de OpenRouter | Opcional |
| `NEXT_PUBLIC_APP_URL` | URL pública del app | Opcional |

---

## Estructura del proyecto

```
ssd-optimizer-v1/
├── app/                    # App Router — páginas y API routes
│   ├── api/
│   │   ├── optimize/       # POST — motor principal de optimización
│   │   ├── models/         # GET/POST — CRUD de modelos
│   │   ├── sync/           # POST — sync OpenRouter
│   │   ├── history/        # GET — historial de runs
│   │   └── settings/       # GET/POST — configuración
│   ├── optimizer/          # Página principal del optimizer
│   ├── models/             # Catálogo de modelos
│   ├── history/            # Historial de optimizaciones
│   ├── profiles/           # Perfiles guardados
│   └── settings/           # Configuración y API keys
│
├── components/
│   ├── optimizer/          # DataMatrix, PhaseCard, ModelDetailModal...
│   ├── landing/            # Hero, AuthorSection, LanguageToggle
│   └── layout/             # Shell, Topbar, Sidebar
│
├── lib/
│   ├── optimizer/          # Parser, scoring engine, selector
│   ├── ai/                 # Cliente Gemini
│   ├── sync/               # OpenRouter sync
│   ├── db/                 # Prisma client singleton
│   ├── hooks/              # useCopyFeedback, useOptimizerPersistence
│   └── i18n/               # LanguageProvider, translations
│
├── prisma/
│   ├── schema.prisma       # Modelos: Model, OptimizationJob, PhaseRecommendation...
│   └── seed.ts             # Seed inicial de modelos
│
├── types/                  # Tipos TypeScript compartidos
├── Dockerfile              # Multi-stage build (node:22-alpine)
├── docker-compose.yml      # Stack completo con healthchecks
└── nginx.conf              # Reverse proxy → puerto 8081
```

---

## Arquitectura

```
┌─────────────────────────────────────────────┐
│              Nginx :8081                     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Next.js App :3000                  │
│  ┌────────────┐   ┌─────────────────────┐   │
│  │  App Router│   │    API Routes        │   │
│  │  (UI/UX)   │   │  /optimize          │   │
│  └────────────┘   │  /models            │   │
│                   │  /sync              │   │
│  ┌────────────────▼─────────────────┐   │   │
│  │         Scoring Engine            │   │   │
│  │  Parser → Selector → Fallbacks   │   │   │
│  └────────────────┬─────────────────┘   │   │
│                   │                     │   │
│  ┌────────────────▼──────┐             │   │
│  │    Gemini AI Client   │             │   │
│  └───────────────────────┘             │   │
└────────────────────────┬───────────────┘   │
                         │                   │
┌────────────────────────▼───────────────────┘
│           PostgreSQL :5434                  │
│  Models · OptimizationJobs · Selections     │
└─────────────────────────────────────────────┘
```

---

## Scripts disponibles

```bash
npm run dev          # Dev server con Turbopack
npm run build        # Build de producción (incluye prisma generate)
npm run start        # Producción local
npm run db:migrate   # Aplica migraciones en producción
```

---

## Licencia

MIT — hacé lo que quieras con esto. Si lo usás en algo copado, contame. 🤙

---

<div align="center">
  Hecho con <strong>Next.js 15</strong>, <strong>Prisma</strong> y demasiado café ☕<br/>
  by <a href="https://github.com/RamonsDka">RamonsDka</a>
</div>

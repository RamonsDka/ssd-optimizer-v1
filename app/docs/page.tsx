// ─── Documentation Page ───────────────────────────────────────────────────
// Server Component — no "use client" needed.
// Structured, colorful React page using the Kanagawa palette and 0px radius.

import Link from "next/link";
import {
  Terminal,
  ClipboardCopy,
  MousePointerClick,
  Rocket,
  Cpu,
  BookOpen,
  Layers,
  History,
  Settings,
  Github,
  Youtube,
  ChevronRight,
  Zap,
  Shield,
  Code2,
  Database,
} from "lucide-react";

// ─── Section component ─────────────────────────────────────────────────────
function Section({
  id,
  title,
  accent = "primary",
  children,
}: {
  id: string;
  title: string;
  accent?: "primary" | "pink" | "secondary" | "error";
  children: React.ReactNode;
}) {
  const accentMap = {
    primary: "border-primary text-primary",
    pink: "border-pink-500 text-pink-500",
    secondary: "border-secondary text-secondary",
    error: "border-error text-error",
  };

  return (
    <section id={id} className="py-12 border-b border-outline-variant/10 scroll-mt-20">
      <div className="flex items-center gap-4 mb-8">
        <div className={`w-1 h-10 bg-current ${accentMap[accent].split(" ")[0]}`} />
        <h2 className={`text-3xl font-black uppercase tracking-tighter ${accentMap[accent].split(" ")[1]}`}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ─── Step card ─────────────────────────────────────────────────────────────
function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-surface-container-low border border-outline-variant/30 hover:border-primary/40 transition-colors group">
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-primary font-mono text-4xl font-black leading-none">{number}</span>
        <span className="text-primary font-mono text-xs font-bold uppercase tracking-widest">PASO</span>
      </div>
      <div className="text-secondary mb-3 group-hover:text-primary transition-colors">{icon}</div>
      <h3 className="font-black uppercase tracking-tight text-on-surface text-lg mb-2">{title}</h3>
      <p className="text-on-surface-variant text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Feature badge ─────────────────────────────────────────────────────────
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-3 py-1 bg-primary/10 border border-primary/30 text-primary font-mono text-xs uppercase tracking-widest mr-2 mb-2">
      {children}
    </span>
  );
}

// ─── Code block ────────────────────────────────────────────────────────────
function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-surface-container-lowest border border-outline-variant/30 border-l-4 border-l-primary p-4 font-mono text-sm text-primary/80 overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function DocsPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-8 py-8">
      {/* Page header */}
      <div className="mb-12 border-l-4 border-primary pl-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={24} className="text-primary" />
          <span className="font-mono text-xs text-primary/60 uppercase tracking-widest">
            SDD Team Optimizer // Documentación Técnica
          </span>
        </div>
        <h1 className="text-5xl font-black uppercase tracking-tighter text-on-surface mb-4">
          DOCUMENTACIÓN
        </h1>
        <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
          Guía completa del <span className="text-primary font-semibold">SDD Team Optimizer</span> —
          la consola táctica para orquestar tu equipo perfecto de sub-agentes IA según el flujo Spec-Driven Development.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="mb-12 p-6 bg-surface-container-low border border-outline-variant/30 border-l-4 border-l-secondary">
        <h2 className="font-mono text-xs uppercase tracking-widest text-secondary mb-4">Tabla de Contenidos</h2>
        <ul className="space-y-2">
          {[
            { href: "#que-es", label: "¿Qué es SDD Team Optimizer?" },
            { href: "#guia-rapida", label: "Guía Rápida de 4 Pasos" },
            { href: "#arquitectura", label: "Arquitectura del Sistema" },
            { href: "#perfiles", label: "Perfiles de Optimización" },
            { href: "#fases-sdd", label: "Las 10 Fases SDD" },
            { href: "#tecnologia", label: "Stack Tecnológico" },
            { href: "#stack-local", label: "Instalación Local" },
            { href: "#creditos", label: "Créditos y Recursos" },
          ].map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-mono text-sm group"
              >
                <ChevronRight size={12} className="text-primary/40 group-hover:text-primary transition-colors" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Section 1: Qué es ────────────────────────────────────────────── */}
      <Section id="que-es" title="¿Qué es SDD Team Optimizer?" accent="primary">
        <p className="text-on-surface-variant text-lg leading-relaxed mb-6">
          El <span className="text-primary font-semibold">SDD Team Optimizer</span> es una consola ejecutiva
          de alta densidad que analiza el listado de modelos IA disponibles en tu instalación de{" "}
          <span className="text-secondary font-semibold">OpenCode</span> y recomienda el equipo óptimo
          de sub-agentes para ejecutar un ciclo completo de Spec-Driven Development.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-5 bg-surface-container border border-outline-variant/30 border-t-2 border-t-primary">
            <Zap size={20} className="text-primary mb-3" />
            <h3 className="font-black uppercase text-on-surface text-sm mb-2">VELOCIDAD TÁCTICA</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              Análisis y recomendación de equipo en segundos usando Gemini AI como motor de categorización.
            </p>
          </div>
          <div className="p-5 bg-surface-container border border-outline-variant/30 border-t-2 border-t-secondary">
            <Shield size={20} className="text-secondary mb-3" />
            <h3 className="font-black uppercase text-on-surface text-sm mb-2">3 PERFILES DE COSTO</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              Premium, Balanced y Economic — cada perfil prioriza diferente: máxima calidad vs. eficiencia de costo.
            </p>
          </div>
          <div className="p-5 bg-surface-container border border-outline-variant/30 border-t-2 border-t-pink-500">
            <Code2 size={20} className="text-pink-500 mb-3" />
            <h3 className="font-black uppercase text-on-surface text-sm mb-2">10 FASES SDD</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              Asignación inteligente de modelos a cada etapa del ciclo SDD: Explore, Propose, Spec, Design, Tasks, Apply, Verify, Archive, Init y Onboard.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Next.js 15</Badge>
          <Badge>React 19</Badge>
          <Badge>Gemini AI</Badge>
          <Badge>PostgreSQL</Badge>
          <Badge>Prisma ORM</Badge>
          <Badge>TypeScript 5.8</Badge>
          <Badge>Tailwind CSS 4</Badge>
        </div>
      </Section>

      {/* ── Section 2: Guía Rápida ────────────────────────────────────────── */}
      <Section id="guia-rapida" title="Guía Rápida de 4 Pasos" accent="pink">
        <p className="text-on-surface-variant mb-8 leading-relaxed">
          Para obtener tu recomendación de equipo solo necesitás el listado de modelos disponibles en tu OpenCode.
          Seguí estos 4 pasos:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StepCard
            number="01"
            icon={<Terminal size={24} />}
            title="Abrir tu terminal"
            description="Abrí una terminal en tu sistema operativo (bash, zsh, pwsh — cualquiera sirve)."
          />
          <StepCard
            number="02"
            icon={<ClipboardCopy size={24} />}
            title="Ejecutar opencode models"
            description="Ejecutá el comando 'opencode models' para obtener el listado completo de providers y modelos configurados."
          />
          <StepCard
            number="03"
            icon={<MousePointerClick size={24} />}
            title="Seleccionar el listado"
            description="Seleccioná todo el output que aparece en la terminal — desde el primer modelo hasta el último."
          />
          <StepCard
            number="04"
            icon={<Rocket size={24} />}
            title="Pegar y optimizar"
            description="Copiá con Ctrl+C, pegá en el Optimizer Console y presioná INICIALIZAR. En segundos tenés tu equipo SDD."
          />
        </div>
        <div className="p-6 bg-surface-container-lowest border-l-4 border-pink-500 text-on-surface-variant italic text-base">
          &ldquo;Con eso solo tenés que venir a la página, ir a Inicializar Optimizador y pegar el listado. En segundos tenés tu equipo SDD perfecto.&rdquo;
        </div>
        <div className="mt-6">
          <Link
            href="/optimizer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-primary-container text-on-primary-container font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all"
          >
            <Cpu size={16} />
            IR AL OPTIMIZER CONSOLE
          </Link>
        </div>
      </Section>

      {/* ── Section 3: Arquitectura ───────────────────────────────────────── */}
      <Section id="arquitectura" title="Arquitectura del Sistema" accent="primary">
        <p className="text-on-surface-variant mb-6 leading-relaxed">
          El sistema sigue una arquitectura de 3 capas: UI → API Routes → Base de Datos.
          El motor de inteligencia es Gemini AI, que categoriza los modelos y los asigna a las fases SDD.
        </p>
        <div className="space-y-3 mb-8">
          {[
            {
              layer: "Frontend",
              desc: "Next.js 15 App Router — React Server Components + Client Components para las consolas interactivas.",
              color: "text-primary border-primary",
            },
            {
              layer: "API Routes",
              desc: "/api/optimize → recibe el listado crudo, parsea, deduplica, llama a Gemini AI y retorna la recomendación estructurada.",
              color: "text-secondary border-secondary",
            },
            {
              layer: "Gemini AI",
              desc: "Motor de categorización y scoring. Clasifica cada modelo en tier (PREMIUM/BALANCED/ECONOMIC) y lo asigna a la fase SDD donde mejor aplica.",
              color: "text-pink-500 border-pink-500",
            },
            {
              layer: "PostgreSQL + Prisma",
              desc: "Persistencia de OptimizationJobs, ModelSelections, Models y Providers. Historial completo de cada optimización.",
              color: "text-error border-error",
            },
          ].map((item) => (
            <div key={item.layer} className={`flex gap-4 p-4 bg-surface-container border border-outline-variant/20 border-l-4 ${item.color.split(" ")[1]}`}>
              <div className="shrink-0">
                <Database size={16} className={item.color.split(" ")[0]} />
              </div>
              <div>
                <span className={`font-mono text-xs font-bold uppercase tracking-widest ${item.color.split(" ")[0]}`}>
                  {item.layer}
                </span>
                <p className="text-on-surface-variant text-sm mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <CodeBlock>{`// Flujo de datos principal
User Input (raw model list)
  → POST /api/optimize
  → parseModelList() — extrae IDs canónicos
  → Gemini AI categorization (batch)
  → scoreAndAssign() — asigna a fases SDD
  → save OptimizationJob to PostgreSQL
  → return TeamRecommendation { premium, balanced, economic }`}</CodeBlock>
      </Section>

      {/* ── Section 4: Perfiles ───────────────────────────────────────────── */}
      <Section id="perfiles" title="Perfiles de Optimización" accent="secondary">
        <p className="text-on-surface-variant mb-6 leading-relaxed">
          Cada optimización genera 3 perfiles simultáneos. Podés cambiar entre ellos sin re-procesar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              tier: "PREMIUM",
              color: "border-t-error text-error",
              badge: "bg-error/10 border-error/30 text-error",
              desc: "Prioriza modelos con el mayor context window y las capacidades más avanzadas. Más caro pero máxima precisión en cada fase.",
              examples: ["claude-opus-4", "gemini-2-pro", "gpt-4o"],
            },
            {
              tier: "BALANCED",
              color: "border-t-primary text-primary",
              badge: "bg-primary/10 border-primary/30 text-primary",
              desc: "El punto óptimo entre costo y rendimiento. Recomendado para la mayoría de los proyectos SDD del día a día.",
              examples: ["claude-sonnet-4", "gemini-flash", "gpt-4o-mini"],
            },
            {
              tier: "ECONOMIC",
              color: "border-t-secondary text-secondary",
              badge: "bg-secondary/10 border-secondary/30 text-secondary",
              desc: "Maximiza la cantidad de iteraciones por dólar. Ideal para exploración rápida y fases de menor complejidad.",
              examples: ["claude-haiku", "gemini-flash-lite", "deepseek-chat"],
            },
          ].map((profile) => (
            <div key={profile.tier} className={`p-5 bg-surface-container border border-outline-variant/30 border-t-4 ${profile.color.split(" ")[0]}`}>
              <span className={`inline-block px-2 py-0.5 border font-mono text-xs uppercase tracking-widest mb-3 ${profile.badge}`}>
                {profile.tier}
              </span>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-4">{profile.desc}</p>
              <div className="space-y-1">
                {profile.examples.map((ex) => (
                  <div key={ex} className="font-mono text-xs text-on-surface-variant/60">{ex}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Section 5: Fases SDD ─────────────────────────────────────────── */}
      <Section id="fases-sdd" title="Las 10 Fases SDD" accent="pink">
        <p className="text-on-surface-variant mb-6 leading-relaxed">
          El optimizer asigna el modelo más adecuado a cada una de las 10 fases del ciclo Spec-Driven Development:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { phase: "sdd-explore", label: "Exploración", desc: "Investigación inicial, análisis del problema, exploración de soluciones posibles." },
            { phase: "sdd-propose", label: "Propuesta", desc: "Redacción de la propuesta de cambio con intent, scope y approach." },
            { phase: "sdd-spec", label: "Especificación", desc: "Definición de requirements y scenarios en formato Given/When/Then." },
            { phase: "sdd-design", label: "Diseño Técnico", desc: "Decisiones de arquitectura, diagramas, contratos de interfaces." },
            { phase: "sdd-tasks", label: "Planificación de Tareas", desc: "Desglose del cambio en tasks implementables con numeración jerárquica." },
            { phase: "sdd-apply", label: "Implementación", desc: "Escritura del código real siguiendo specs y design. El agente más capaz aquí." },
            { phase: "sdd-verify", label: "Verificación", desc: "Validación de que el código cumple las specs — auditoría y testing." },
            { phase: "sdd-archive", label: "Archivo", desc: "Sincronización de delta specs a main specs y cierre del cambio." },
            { phase: "sdd-init", label: "Inicialización", desc: "Bootstrap del contexto SDD en un proyecto nuevo." },
            { phase: "sdd-onboard", label: "onboard", desc: "Guía end-to-end del workflow SDD para nuevos colaboradores." },
          ].map((item, i) => (
            <div key={item.phase} className="flex gap-3 p-4 bg-surface-container-low border border-outline-variant/20 hover:border-pink-500/30 transition-colors">
              <span className="font-mono text-2xl font-black text-pink-500/40 leading-none shrink-0 pt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="font-mono text-xs text-pink-500 uppercase tracking-widest mb-0.5">{item.phase}</div>
                <div className="font-black text-on-surface text-sm uppercase mb-1">{item.label}</div>
                <div className="text-on-surface-variant text-xs leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Section 6: Tecnología ─────────────────────────────────────────── */}
      <Section id="tecnologia" title="Stack Tecnológico" accent="primary">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: "Next.js 15", role: "Framework principal — App Router, Server Components, API Routes.", href: "https://nextjs.org" },
            { name: "React 19", role: "UI library — Hooks, Server/Client components, concurrent features.", href: "https://react.dev" },
            { name: "TypeScript 5.8", role: "Tipado estricto end-to-end, desde la API hasta los componentes.", href: "https://www.typescriptlang.org" },
            { name: "Tailwind CSS 4", role: "Sistema de diseño Kanagawa Dark — colores, tipografía, 0px radius.", href: "https://tailwindcss.com" },
            { name: "Motion (Framer)", role: "Animaciones de componentes, transiciones de página, AnimatePresence.", href: "https://motion.dev" },
            { name: "Gemini AI", role: "Motor de categorización de modelos y asignación de fases SDD.", href: "https://ai.google.dev" },
            { name: "Prisma ORM", role: "ORM type-safe sobre PostgreSQL — schema, migrations, seed.", href: "https://www.prisma.io" },
            { name: "lucide-react", role: "Iconografía táctica consistente en toda la interfaz.", href: "https://lucide.dev" },
          ].map((tech) => (
            <a
              key={tech.name}
              href={tech.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-4 bg-surface-container border border-outline-variant/20 hover:border-primary/40 transition-colors group"
            >
              <ChevronRight size={14} className="text-primary/40 group-hover:text-primary transition-colors mt-0.5 shrink-0" />
              <div>
                <div className="font-black text-on-surface text-sm uppercase tracking-tight group-hover:text-primary transition-colors">{tech.name}</div>
                <div className="text-on-surface-variant text-xs leading-relaxed">{tech.role}</div>
              </div>
            </a>
          ))}
        </div>
      </Section>

      {/* ── Section 7: Instalación Local ─────────────────────────────────── */}
      <Section id="stack-local" title="Instalación Local" accent="secondary">
        <p className="text-on-surface-variant mb-6 leading-relaxed">
          Para correr el proyecto localmente necesitás Node.js 20+, PostgreSQL, y una API key de Gemini.
        </p>
        <div className="space-y-4">
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2">1. Clonar e instalar</p>
            <CodeBlock>{`git clone <repo-url>
cd sdd-team-optimizer2
npm install`}</CodeBlock>
          </div>
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2">2. Configurar variables de entorno</p>
            <CodeBlock>{`# .env
DATABASE_URL="postgresql://user:pass@localhost:5432/sdd_optimizer"
GEMINI_API_KEY="your-gemini-api-key"`}</CodeBlock>
          </div>
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2">3. Base de datos</p>
            <CodeBlock>{`npm run db:generate   # Generar cliente Prisma
npm run db:push       # Aplicar schema a la DB
npm run db:seed       # Poblar con modelos iniciales`}</CodeBlock>
          </div>
          <div>
            <p className="font-mono text-xs text-secondary uppercase tracking-widest mb-2">4. Levantar el servidor</p>
            <CodeBlock>{`npm run dev           # http://localhost:3000`}</CodeBlock>
          </div>
        </div>
      </Section>

      {/* ── Section 8: Créditos ───────────────────────────────────────────── */}
      <Section id="creditos" title="Créditos y Recursos" accent="pink">
        <p className="text-on-surface-variant mb-6 leading-relaxed">
          Este proyecto existe gracias al flujo SDD definido por{" "}
          <span className="text-pink-500 font-semibold">Gentleman Programming</span>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href="https://github.com/gentleman-programming"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-5 bg-surface-container border border-pink-500/20 hover:border-pink-500/50 transition-colors group"
          >
            <Github size={20} className="text-pink-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <div className="font-black text-on-surface text-sm uppercase group-hover:text-pink-500 transition-colors">Gentleman Programming</div>
              <div className="text-on-surface-variant text-xs">Creador del flujo SDD — GitHub</div>
            </div>
          </a>
          <a
            href="https://www.youtube.com/@GentlemanProgramming"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-5 bg-surface-container border border-pink-500/20 hover:border-pink-500/50 transition-colors group"
          >
            <Youtube size={20} className="text-pink-500 group-hover:scale-110 transition-transform shrink-0" />
            <div>
              <div className="font-black text-on-surface text-sm uppercase group-hover:text-pink-500 transition-colors">@GentlemanProgramming</div>
              <div className="text-on-surface-variant text-xs">Canal YouTube — tutoriales SDD</div>
            </div>
          </a>
        </div>
        <div className="flex gap-4 flex-wrap">
          <Link
            href="/"
            className="px-6 py-3 border border-outline-variant text-on-surface font-mono text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-all"
          >
            ← Volver al inicio
          </Link>
          <Link
            href="/optimizer"
            className="px-6 py-3 bg-primary-container text-on-primary-container font-mono text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all"
          >
            Ir al Optimizer →
          </Link>
        </div>
      </Section>
    </div>
  );
}

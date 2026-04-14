// ─── Translations — SDD Team Optimizer ────────────────────────────────────────
// All UI-facing strings in the application, keyed by section.
// To add a new language, duplicate the `en` object and translate.

export type Language = "es" | "en";

const translations = {
  // ─── Common / Shared ────────────────────────────────────────────────────────
  common: {
    appName: { es: "SDD OPTIMIZER", en: "SDD OPTIMIZER" },
    step: { es: "PASO", en: "STEP" },
    scroll: { es: "Scroll", en: "Scroll" },
    refresh: { es: "Refresh", en: "Refresh" },
    language: { es: "Language", en: "Language" },
    info: { es: "Info", en: "Info" },
    models: { es: "Models", en: "Models" },
    settings: { es: "Settings", en: "Settings" },
    profile: { es: "Profile", en: "Profile" },
    links: { es: "Links", en: "Links" },
    tip: { es: "TIP:", en: "TIP:" },
  },

  // ─── Navigation (Topbar + Sidebar) ──────────────────────────────────────────
  nav: {
    home: { es: "Inicio", en: "Home" },
    optimizer: { es: "Arquitecto", en: "Optimizer" },
    history: { es: "Historial", en: "History" },
    models: { es: "Modelos", en: "Models" },
    docs: { es: "Documentación", en: "Docs" },
    settings: { es: "Configuración", en: "Settings" },
    profiles: { es: "Perfiles", en: "Profiles" },
    queryHistoryPlaceholder: {
      es: "QUERY HISTORY...",
      en: "QUERY HISTORY...",
    },
    runCommand: {
      es: "Ejecutar Comando",
      en: "Run Command",
    },
  },

  // ─── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: {
    architectLabel: { es: "ARCHITECT 01", en: "ARCHITECT 01" },
    status: { es: "Status: Optimizing", en: "Status: Optimizing" },
    adminLabel: { es: "SYS ADMIN", en: "SYS ADMIN" },
    adminLevel: { es: "Lvl 4 — Admin Panel", en: "Lvl 4 — Admin Panel" },
    projectGitHub: { es: "Project GitHub", en: "Project GitHub" },
  },

  // ─── Landing Hero ──────────────────────────────────────────────────────────
  hero: {
    titleLine1: { es: "ARQUITECTA TU", en: "ARCHITECT YOUR" },
    titleLine2: {
      es: "EQUIPO SDD PERFECTO",
      en: "PERFECT SDD TEAM",
    },
    description: {
      es: "Optimiza la orquestación de tus sub-agentes en segundos. Lógica de alta densidad, latencia reducida, precisión táctica.",
      en: "Optimize your sub-agent orchestration in seconds. High-density logic, reduced latency, tactical precision.",
    },
    ctaOptimizer: {
      es: "INICIALIZAR OPTIMIZADOR",
      en: "INITIALIZE OPTIMIZER",
    },
    ctaDocs: {
      es: "VER DOCUMENTACIÓN",
      en: "VIEW DOCUMENTATION",
    },
  },

  // ─── Landing Page Sections ─────────────────────────────────────────────────
  landing: {
    acknowledgements: { es: "AGRADECIMIENTOS", en: "ACKNOWLEDGEMENTS" },
    acknowledgementsDesc: {
      es: "El SDD OPTIMIZER es un módulo central dentro del ecosistema Gentle-AI, diseñado para agilizar flujos de trabajo arquitectónicos complejos para ingenieros digitales.",
      en: "The SDD OPTIMIZER is a core module within the Gentle-AI ecosystem, designed to streamline complex architectural workflows for digital engineers.",
    },
    quote: {
      es: "Muchas gracias a Gentleman Programming por el flujo de trabajo SDD. Esta interfaz se apoya en hombros de gigantes.",
      en: "Many thanks to Gentleman Programming for the SDD workflow. This interface stands on the shoulders of giants.",
    },
    guide: { es: "GUÍA", en: "GUIDE" },
    guideDesc: {
      es: "CON ESTOS PASOS PODRÁS SACAR UN LISTADO DE TODOS LOS PROVIDERS + MODELOS DE LENGUAJE-IA QUE TIENES CONFIGURADO EN TU OPENCODE.",
      en: "WITH THESE STEPS YOU CAN GET A LISTING OF ALL THE PROVIDERS + LANGUAGE-MODELS THAT YOU HAVE CONFIGURED IN YOUR OPENCODE.",
    },
    step1: { es: "abrir tu terminal", en: "open your terminal" },
    step2: {
      es: "ejecutar el comando 'opencode models'",
      en: "run the command 'opencode models'",
    },
    step3: {
      es: "el listado que te salga selecionalo todo",
      en: "select all the output that appears",
    },
    step4: {
      es: "copiar todo con ctrl C o copiar",
      en: "copy everything with Ctrl+C or copy",
    },
    bottomQuote: {
      es: "listo con eso solo tienes que venir a la página y en la sección inicializar optimizador solo pegar el listado.",
      en: "ready with that you just have to come to the page and in the initialize optimizer section just paste the listing.",
    },
  },

  // ─── Guide Steps (Optimizer) ───────────────────────────────────────────────
  guideSteps: {
    title: {
      es: "¿Cómo Usar el Optimizer?",
      en: "How to Use the Optimizer?",
    },
    subtitle: {
      es: "Seguí estos 4 pasos antes de pegar tu listado de modelos",
      en: "Follow these 4 steps before pasting your model list",
    },
    step1Title: { es: "Abrir tu terminal", en: "Open your terminal" },
    step1Desc: {
      es: "Abrí una terminal en tu sistema operativo (bash, zsh, pwsh — cualquiera sirve).",
      en: "Open a terminal on your operating system (bash, zsh, pwsh — any will do).",
    },
    step2Title: {
      es: "Ejecutar opencode models",
      en: "Run opencode models",
    },
    step2Desc: {
      es: "Corré el comando 'opencode models' para obtener el listado de providers y modelos configurados.",
      en: "Run the command 'opencode models' to get the list of configured providers and models.",
    },
    step3Title: {
      es: "Seleccionar el listado",
      en: "Select the listing",
    },
    step3Desc: {
      es: "Seleccioná todo el output que aparece en la terminal — desde el primer modelo hasta el último.",
      en: "Select all the output that appears in the terminal — from the first model to the last.",
    },
    step4Title: {
      es: "Pegar y optimizar",
      en: "Paste and optimize",
    },
    step4Desc: {
      es: "Copiá con Ctrl+C, pegá en el campo de texto de arriba y presioná INICIALIZAR EQUIPO.",
      en: "Copy with Ctrl+C, paste in the text field above and press INITIALIZE TEAM.",
    },
    tipText: {
      es: "El listado de modelos puede ser largo — no importa. El optimizer parsea y deduplica automáticamente. Solo copiá el output completo del comando.",
      en: "The model list can be long — it doesn't matter. The optimizer parses and deduplicates automatically. Just copy the full command output.",
    },
  },

  // ─── Help Info Modal ───────────────────────────────────────────────────────
  helpInfo: {
    title: { es: "System Info", en: "System Info" },
    optimizer: {
      es: "OPTIMIZER",
      en: "OPTIMIZER",
    },
    optimizerDesc: {
      es: "Ingresa tu listado de modelos vía 'opencode models' y recibe la orquestación ideal de sub-agentes.",
      en: "Enter your model list via 'opencode models' and receive the ideal sub-agent orchestration.",
    },
    models: { es: "MODELS", en: "MODELS" },
    modelsDesc: {
      es: "Catálogo completo de providers y modelos sincronizado desde OpenRouter.",
      en: "Complete catalog of providers and models synced from OpenRouter.",
    },
    aiDiscovery: { es: "AI DISCOVERY", en: "AI DISCOVERY" },
    aiDiscoveryDesc: {
      es: "Categorización automática de modelos vía Gemini AI cuando la API key está configurada.",
      en: "Automatic model categorization via Gemini AI when the API key is configured.",
    },
    sync: { es: "SYNC", en: "SYNC" },
    syncDesc: {
      es: "Sincronización en tiempo real con OpenRouter para mantener el catálogo actualizado.",
      en: "Real-time synchronization with OpenRouter to keep the catalog updated.",
    },
    settings: { es: "SETTINGS", en: "SETTINGS" },
    settingsDesc: {
      es: "Panel de diagnóstico del sistema. Stats, feature flags, acciones de mantenimiento.",
      en: "System diagnostic panel. Stats, feature flags, maintenance actions.",
    },
  },

  // ─── Footer (Shell) ────────────────────────────────────────────────────────
  footer: {
    repo: { es: "Repo", en: "Repo" },
  },

  // ─── Profiles Page ─────────────────────────────────────────────────────────
  profiles: {
    title: { es: "PERFIL DE USUARIO", en: "USER PROFILE" },
    subtitle: {
      es: "Preferencias de usuario // Configuración personal",
      en: "User preferences // Personal configuration",
    },
    languageSection: { es: "Idioma", en: "Language" },
    languageDesc: {
      es: "Seleccioná el idioma de la interfaz.",
      en: "Select the interface language.",
    },
    tierSection: { es: "Tier Predeterminado", en: "Default Tier" },
    tierDesc: {
      es: "El tier por defecto para nuevas optimizaciones.",
      en: "The default tier for new optimizations.",
    },
    tierPremium: { es: "Premium", en: "Premium" },
    tierPremiumDesc: { es: "Máxima calidad y capacidad de contexto. Ideal para fases críticas.", en: "Maximum quality and context capacity. Ideal for critical phases." },
    tierBalanced: { es: "Balanced", en: "Balanced" },
    tierBalancedDesc: { es: "Balance entre costo y rendimiento. Recomendado para la mayoría.", en: "Balance between cost and performance. Recommended for most." },
    tierEconomic: { es: "Economic", en: "Economic" },
    tierEconomicDesc: { es: "Menor costo, respuestas rápidas. Ideal para tareas simples.", en: "Lowest cost, fast responses. Ideal for simple tasks." },
    themeSection: { es: "Tema", en: "Theme" },
    themeDesc: {
      es: "Seleccioná el tema visual de la interfaz.",
      en: "Select the visual theme of the interface.",
    },
    themeDark: { es: "Oscuro", en: "Dark" },
    themeLight: { es: "Claro", en: "Light" },
    themeLightSoon: { es: "Claro (próximamente)", en: "Light (coming soon)" },
    apiKeysSection: { es: "API Keys", en: "API Keys" },
    apiKeysDesc: {
      es: "Almacená tus claves de API para integraciones externas. Las claves se guardan solo en tu navegador.",
      en: "Store your API keys for external integrations. Keys are saved only in your browser.",
    },
    geminiApiKey: { es: "Gemini API Key", en: "Gemini API Key" },
    openrouterApiKey: {
      es: "OpenRouter API Key",
      en: "OpenRouter API Key",
    },
    saveButton: { es: "GUARDAR", en: "SAVE" },
    savedToast: { es: "Preferencias guardadas.", en: "Preferences saved." },
    infoNote: {
      es: "Las preferencias se guardan localmente en tu navegador. Las API Keys ingresadas aquí son placeholders — para producción, configúralas como variables de entorno del servidor.",
      en: "Preferences are saved locally in your browser. API Keys entered here are placeholders — for production, configure them as server environment variables.",
    },
  },

  // ─── Optimizer Console ─────────────────────────────────────────────────────
  optimizer: {
    title: { es: "OPTIMIZER CONSOLE", en: "OPTIMIZER CONSOLE" },
    subtitle: {
      es: "SDD Team Optimizer // Análisis de Modelos → Recomendación de Equipo",
      en: "SDD Team Optimizer // Model Analysis → Team Recommendation",
    },
    resultRecovered: { es: "RESULTADO RECUPERADO", en: "RESULT RECOVERED" },
    resultRecoveredDesc: {
      es: "Generado el {date}. Navegá entre páginas sin perder esta sesión.",
      en: "Generated on {date}. Navigate between pages without losing this session.",
    },
    clearButton: { es: "Limpiar", en: "Clear" },
    clearTooltip: {
      es: "Limpiar resultado y comenzar desde cero",
      en: "Clear result and start from scratch",
    },
    profileTitle: {
      es: "Seleccionar Arquitectura de Optimización",
      en: "Select Optimization Architecture",
    },
    comparisonTitle: {
      es: "Comparación de Perfiles",
      en: "Profile Comparison",
    },
    phaseMappingTitle: {
      es: "Mapeo Arquitectónico de Fases",
      en: "Architectural Phase Mapping",
    },
    // InputModule
    inputLabel: { es: "Raw Model Manifest", en: "Raw Model Manifest" },
    inputTypoSupport: { es: "Soporta typos", en: "Typo support" },
    inputDetected: { es: "Detectados:", en: "Detected:" },
    inputPlaceholder: {
      es: "coloca aqui tus providers/IAs\n(ej: gpt-4o, claude-3-opus, llama3-70b)\n\nTip: Ctrl+Enter para optimizar",
      en: "paste your providers/AIs here\n(e.g.: gpt-4o, claude-3-opus, llama3-70b)\n\nTip: Ctrl+Enter to optimize",
    },
    inputClear: { es: "[ limpiar ]", en: "[ clear ]" },
    inputButton: { es: "Ejecutar Optimización", en: "Run Optimization" },
    inputProcessing: { es: "Procesando...", en: "Processing..." },
    // ErrorBanner
    errorTitle: { es: "Error de optimización", en: "Optimization error" },
    // ProfileSelector
    premiumDesc: { es: "Máxima profundidad arquitectónica usando modelos SOTA Tier-1. Sin compromisos en capacidad de razonamiento.", en: "Maximum architectural depth using SOTA Tier-1 models. No compromises in reasoning capacity." },
    balancedDesc: { es: "Ratio óptimo entre eficiencia de costo e inteligencia. Recomendado para flujos SDD estándar.", en: "Optimal ratio between cost efficiency and intelligence. Recommended for standard SDD workflows." },
    economicDesc: { es: "Enfoque en velocidad y conservación de tokens. Ideal para automatización de alta frecuencia y baja complejidad.", en: "Focus on speed and token conservation. Ideal for high-frequency, low-complexity automation." },
    costLabel: { es: "Costo", en: "Cost" },
    latencyLabel: { es: "Latencia", en: "Latency" },
    avgLabel: { es: "promedio", en: "avg" },
    // ComparisonTable
    advancedComparison: { es: "COMPARACIÓN AVANZADA // MATRIX DE PERFILES", en: "ADVANCED COMPARISON // PROFILE MATRIX" },
    unresolvedWarn: { es: "modelos sin resolver", en: "models unresolved" },
    colProfile: { es: "Perfil", en: "Profile" },
    colCost: { es: "Costo/1M (suma)", en: "Cost/1M (sum)" },
    colCtx: { es: "Ctx Promedio", en: "Avg Context" },
    colPhases: { es: "Fases Cubiertas", en: "Phases Covered" },
    colTopModel: { es: "Modelo Principal (Init)", en: "Primary Model (Init)" },
    colCoverage: { es: "Cobertura", en: "Coverage" },
    generatedAt: { es: "Generado:", en: "Generated:" },
    inputAnalyzed: { es: "modelos analizados", en: "models analyzed" },
    // PhaseCard
    roster: { es: "roster", en: "roster" },
    rosterTooltip: { es: "Ver todos los modelos de esta fase", en: "View all models for this phase" },
    fallbacks: { es: "Fallbacks", en: "Fallbacks" },
    noFallbacks: { es: "— Sin fallbacks disponibles —", en: "— No fallbacks available —" },
    // PhaseDetailModal
    phaseDetail: { es: "PHASE DETAIL", en: "PHASE DETAIL" },
    assignedModel: { es: "Modelo Asignado (Click Origin)", en: "Assigned Model (Click Origin)" },
    globalRoster: { es: "Roster Global", en: "Global Roster" },
    models: { es: "modelo", en: "model" },
    modelsPlural: { es: "modelos", en: "models" },
    noData: { es: "[ NO HAY DATOS EN PHASE RECOMMENDATIONS PARA ESTA FASE ]", en: "[ NO DATA IN PHASE RECOMMENDATIONS FOR THIS PHASE ]" },
    page: { es: "Página", en: "Page" },
    of: { es: "de", en: "of" },
    previous: { es: "Anterior", en: "Previous" },
    next: { es: "Siguiente", en: "Next" },
  },

  // ─── History Page ───────────────────────────────────────────────────────────
  history: {
    title: { es: "SYS LOGS", en: "SYS LOGS" },
    subtitle: { es: "Optimization History // {count} jobs registrados", en: "Optimization History // {count} registered jobs" },
    emptyTitle: { es: "[ HISTORY LOG :: EMPTY ]", en: "[ HISTORY LOG :: EMPTY ]" },
    emptyDesc: { es: "No hay optimizaciones registradas todavía", en: "No optimizations registered yet" },
    colInput: { es: "Modelos de entrada", en: "Input models" },
    colModels: { es: "Modelos", en: "Models" },
    colStatus: { es: "Estado", en: "Status" },
    colDate: { es: "Fecha", en: "Date" },
    page: { es: "Página", en: "Page" },
    of: { es: "de", en: "of" },
    previous: { es: "Anterior", en: "Previous" },
    next: { es: "Siguiente", en: "Next" },
  },

  // ─── Models Page ────────────────────────────────────────────────────────────
  models: {
    title: { es: "MODELS DIRECTORY", en: "MODELS DIRECTORY" },
    subtitle: { es: "Directorio global de proveedores //", en: "Global provider directory //" },
    available: { es: "modelos disponibles", en: "models available" },
    searchPlaceholder: { es: "BUSCAR ID...", en: "ID SEARCH..." },
    allTiers: { es: "TODOS LOS TIERS", en: "ALL TIERS" },
    noModels: { es: "[ NO MODELS FOUND ]", en: "[ NO MODELS FOUND ]" },
    noModelsDesc: { es: "Ajusta los filtros o verifica la conexión a la base de datos", en: "Adjust filters or verify database connection" },
    sysReady: { es: "SISTEMA LISTO", en: "SYS READY" },
    contextWindow: { es: "Context Window", en: "Context Window" },
    tokens: { es: "Tokens", en: "Tokens" },
    costPer1M: { es: "Cost/1M", en: "Cost/1M" },
    capabilityScore: { es: "Capability Score", en: "Capability Score" },
    advancedMetrics: { es: "ADVANCED METRICS // COMPARISON MATRIX", en: "ADVANCED METRICS // COMPARISON MATRIX" },
    colModelId: { es: "MODEL ID", en: "MODEL ID" },
    colTier: { es: "TIER", en: "TIER" },
    colContext: { es: "CONTEXT WINDOW", en: "CONTEXT WINDOW" },
    colCost: { es: "COST/1M", en: "COST/1M" },
    colStrengths: { es: "STRENGTHS", en: "STRENGTHS" },
    colScore: { es: "SCORE", en: "SCORE" },
    showing: { es: "Mostrando 10/{total} — usa el buscador para filtrar", en: "Showing 10/{total} — use search to filter" },
  },

  // ─── Settings Page ──────────────────────────────────────────────────────────
  settings: {
    title: { es: "SYS SETTINGS", en: "SYS SETTINGS" },
    subtitle: { es: "System Configuration // Diagnostic & Admin Panel", en: "System Configuration // Diagnostic & Admin Panel" },
    refresh: { es: "Refresh", en: "Refresh" },
    loading: { es: "Cargando configuración...", en: "Loading configuration..." },
    environment: { es: "Environment", en: "Environment" },
    buildInfo: { es: "Build Information", en: "Build Information" },
    application: { es: "Application", en: "Application" },
    version: { es: "Version", en: "Version" },
    stack: { es: "Stack", en: "Stack" },
    dbStats: { es: "Database Stats", en: "Database Stats" },
    featureFlags: { es: "Feature Flags", en: "Feature Flags" },
    recommendedToolkit: { es: "Recommended Toolkit", en: "Recommended Toolkit" },
    systemActions: { es: "System Actions", en: "System Actions" },
    systemMaintenance: { es: "System Maintenance", en: "System Maintenance" },
    adminOnly: { es: "Admin Only", en: "Admin Only" },
    adminOnlyDesc: { es: "Acciones destructivas. Confirmación requerida en operaciones irreversibles.", en: "Destructive actions. Confirmation required for irreversible operations." },
    deploymentRecs: { es: "Deployment Recommendations", en: "Deployment Recommendations" },
    envVars: { es: "Required Environment Variables", en: "Required Environment Variables" },
    clearPersistence: { es: "Clear Local Persistence", en: "Clear Local Persistence" },
    clearPersistenceDesc: { es: "Elimina todas las claves de localStorage (resultados guardados, preferencias de UI).", en: "Removes all localStorage keys (saved results, UI preferences)." },
    clearing: { es: "Limpiando...", en: "Clearing..." },
    cleared: { es: " claves eliminadas de localStorage.", en: " keys removed from localStorage." },
    triggerSync: { es: "Trigger Catalog Sync", en: "Trigger Catalog Sync" },
    triggerSyncDesc: { es: "Sincroniza el catálogo de modelos desde OpenRouter vía /api/sync.", en: "Syncs the model catalog from OpenRouter via /api/sync." },
    syncing: { es: "Sincronizando...", en: "Syncing..." },
    syncCompleted: { es: "Sync completado.", en: "Sync completed." },
    clearHistory: { es: "Clear History", en: "Clear History" },
    clearHistoryDesc: { es: "Elimina todos los jobs de optimización y sus selecciones de modelos.", en: "Deletes all optimization jobs and their model selections." },
    resetModels: { es: "Reset AI Models", en: "Reset AI Models" },
    resetModelsDesc: { es: "Elimina todos los modelos descubiertos por IA. Conserva el seed manual.", en: "Deletes all AI-discovered models. Keeps the manual seed." },
    forceSync: { es: "Force Sync", en: "Force Sync" },
    forceSyncDesc: { es: "Fuerza sincronización con OpenRouter vía /api/admin/force-sync.", en: "Force synchronization with OpenRouter via /api/admin/force-sync." },
    yesConfirm: { es: "Sí, confirmar", en: "Yes, confirm" },
    executing: { es: "Ejecutando...", en: "Executing..." },
    confirmPrompt: { es: "⚠ Esta acción es irreversible. ¿Confirmar?", en: "⚠ This action is irreversible. Confirm?" },
    required: { es: "[required]", en: "[required]" },
    optional: { es: "[optional]", en: "[optional]" },
    openrouterNotConfigured: { es: "⚠ OPENROUTER_API_KEY no configurada — Catalog Sync deshabilitado.", en: "⚠ OPENROUTER_API_KEY not configured — Catalog Sync disabled." },
    statModels: { es: "Modelos", en: "Models" },
    statProviders: { es: "Providers", en: "Providers" },
    statJobs: { es: "Jobs", en: "Jobs" },
    statAIDiscovered: { es: "AI Discovered", en: "AI Discovered" },
    recAuth: { es: "Agregar Auth Guard al Admin Panel", en: "Add Auth Guard to Admin Panel" },
    recAuthDesc: { es: "Las acciones de mantenimiento no tienen control de acceso. Implementar middleware JWT o NextAuth antes de un deploy en producción.", en: "Maintenance actions have no access control. Implement JWT middleware or NextAuth before production deploy." },
    recEnvVars: { es: "Variables de entorno en plataforma de CI/CD", en: "Environment variables in CI/CD platform" },
    recEnvVarsDesc: { es: "Mover DATABASE_URL, GEMINI_API_KEY y OPENROUTER_API_KEY a secretos de Vercel/Railway. Nunca commitear el archivo .env.", en: "Move DATABASE_URL, GEMINI_API_KEY and OPENROUTER_API_KEY to Vercel/Railway secrets. Never commit the .env file." },
    recMigrations: { es: "Implementar Migrations automáticas en CI", en: "Implement automatic Migrations in CI" },
    recMigrationsDesc: { es: "Ejecutar prisma migrate deploy como parte del pipeline de build para garantizar que el esquema esté actualizado en cada deploy.", en: "Run prisma migrate deploy as part of the build pipeline to ensure the schema is up to date on each deploy." },
    recRateLimit: { es: "Rate Limiting en /api/optimize", en: "Rate Limiting on /api/optimize" },
    recRateLimitDesc: { es: "El endpoint de optimización llama a Gemini AI. Sin rate limit, un usuario puede generar costos elevados. Usar Upstash Redis + @upstash/ratelimit.", en: "The optimization endpoint calls Gemini AI. Without rate limiting, a user can generate high costs. Use Upstash Redis + @upstash/ratelimit." },
    recLogging: { es: "Logging estructurado con Pino o Winston", en: "Structured logging with Pino or Winston" },
    recLoggingDesc: { es: "Reemplazar console.log/error con un logger estructurado. Facilita debug en producción y permite integración con Datadog o Grafana Loki.", en: "Replace console.log/error with structured logging. Makes production debugging easier and enables Datadog or Grafana Loki integration." },
    recCache: { es: "Caché de resultados con Redis", en: "Result caching with Redis" },
    recCacheDesc: { es: "El mismo input al optimizer siempre produce el mismo resultado. Cachear la respuesta de Gemini por 1h reduciría latencia y costos de API.", en: "Same optimizer input always produces the same result. Caching Gemini responses for 1h would reduce latency and API costs." },
    priorityHigh: { es: "Alta", en: "High" },
    priorityMedium: { es: "Media", en: "Medium" },
    priorityLow: { es: "Baja", en: "Low" },
  },
} as const;

export type TranslationKey = keyof typeof translations;
export type TranslationSection = keyof typeof translations;

/**
 * Get a translated string for a given section and key.
 * Usage: t('hero', 'titleLine1') → "ARQUITECTA TU" (if lang is 'es')
 */
export function t(
  section: TranslationSection,
  key: string,
  lang: Language = "es",
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionData = translations[section] as any;
  if (!sectionData || !sectionData[key]) {
    // Fallback to Spanish if key not found in current language
    return sectionData?.[key]?.[lang] ?? sectionData?.[key]?.["es"] ?? key;
  }
  return sectionData[key][lang] ?? sectionData[key]["es"] ?? key;
}

/**
 * Get all translations for a given section.
 * Usage: useTranslations('nav') → { home: { es: 'Home', en: 'Home' }, ... }
 */
export function getTranslations(section: TranslationSection) {
  return translations[section];
}

export default translations;
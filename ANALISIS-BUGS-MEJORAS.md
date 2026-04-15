# ANÁLISIS COMPLETO: BUGS, MEJORAS Y NUEVAS FEATURES

**Fecha**: 2026-04-14  
**Autor**: RamonsDk-Dev + Kiro AI  
**Estado**: Análisis completo - Listo para implementación

---

## RESUMEN EJECUTIVO

Este documento analiza **5 bugs críticos**, propone **3 nuevas features** y recomienda **mejoras de UX** para el SDD Team Optimizer V2.

**Tiempo total estimado**: 25-33 horas  
**Prioridad máxima**: Bugs de sesión + Motor V2

---

## 1. BUGS CRÍTICOS

### 🔴 Bug #1: Falta de Aislamiento de Sesiones (CRÍTICO)

**Severidad**: CRÍTICA  
**Impacto**: Múltiples usuarios comparten estado  
**Páginas afectadas**: Todas

**Problema**:  
Las sesiones NO son propietarias del usuario. Si Usuario A hace cambios, Usuario B los ve.

**Causa raíz**:
- Uso de localStorage sin identificador único
- No hay session ID por navegador
- Los datos se guardan globalmente

**Solución propuesta**: Session ID basado en cookies

```typescript
// lib/session/session-manager.ts
import { v4 as uuidv4 } from 'uuid';

export function getOrCreateSessionId(): string {
  let sessionId = getCookie('sdd_session_id');
  
  if (!sessionId) {
    sessionId = uuidv4();
    setCookie('sdd_session_id', sessionId, 30); // 30 días
  }
  
  return sessionId;
}

export function getSessionKey(key: string): string {
  const sessionId = getOrCreateSessionId();
  return `${sessionId}:${key}`;
}
```

**Ventajas**:
- ✅ Sin backend adicional
- ✅ Cada navegador = sesión única
- ✅ Persiste entre recargas
- ✅ No requiere login

**Implementación**:
1. Crear session-manager.ts
2. Actualizar useOptimizerPersistence
3. Migrar datos existentes
4. Testing

**Tiempo estimado**: 1.5 horas

---

### 🟡 Bug #2: Nombres de Modelos Cortados en DataMatrix

**Severidad**: MEDIA  
**Impacto**: UX degradada  
**Página afectada**: /optimizer

**Problema**:  
Los nombres largos se cortan (ej: "Gemini 2.5 Flash P…")

**Solución A**: Tooltip on hover (RÁPIDA)
```tsx
<div className="truncate" title={model.name}>
  {model.name}
</div>
```

**Solución B**: Texto en múltiples líneas (MEJOR)
```tsx
<div className="text-sm leading-tight break-words">
  {model.name}
</div>
```

**Solución C**: Sistema de vistas múltiples (IDEAL)
- Grid: Vista actual
- List: Lista vertical con nombres completos
- Table: Tabla expandida
- Compact: Solo íconos + tooltip

**Recomendación**: Implementar B (corto plazo) + C (mediano plazo)

**Tiempo estimado**: 1 hora

---

### 🟡 Bug #3: Nombres Cortados en /models

**Severidad**: MEDIA  
**Impacto**: UX degradada  
**Página afectada**: /models

**Problema**: Mismo que Bug #2

**Solución**: Aplicar misma estrategia (Solución B + C)

**Tiempo estimado**: 0.5 horas

---

### 🟠 Bug #4.1: Clear History y Reset AI Models no funcionan

**Severidad**: MEDIA  
**Impacto**: Funcionalidad rota  
**Página afectada**: /settings

**Problema**:  
Quedan providers y modelos sin eliminar después de ejecutar Clear/Reset

**Causa**:  
Relaciones de FK en Prisma sin onDelete: Cascade

**Solución**:

```prisma
model Model {
  id          String   @id
  providerId  String
  provider    Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  selections  ModelSelection[] @relation(onDelete: Cascade)
  arenaScores LMArenaScore[]   @relation(onDelete: Cascade)
}
```

**Implementación**:
1. Actualizar schema.prisma
2. Crear migración
3. Actualizar API routes
4. Testing

**Tiempo estimado**: 0.5 horas

---

### 🟢 Bug #5: Secciones Innecesarias

**Severidad**: BAJA  
**Impacto**: Confusión de usuario  

**Problemas**:
1. "Recommended Toolkit" en /settings - No es necesario
2. "API Keys" en /profiles - Inseguro guardar API keys en navegador

**Solución**: Eliminar ambas secciones

**Tiempo estimado**: 0.5 horas

---

## 2. NUEVAS FEATURES

### 🚀 Feature #1: Formulario de Requisitos Avanzados

**Descripción**:  
Agregar opciones debajo de "OPTIMIZER CONSOLE" para control fino de la optimización

**Componentes**:

#### 1. Model Usage Limits
```
Provider: [Anthropic ▼]  Model: [Claude Sonnet 4.6 ▼]
Max uses: [1 ▼] (1, 2, 3, Unlimited)
[+ Add Limit]
```

#### 2. Phase Preferences
```
Provider: [Google ▼]  Model: [Gemini 3.1 Pro ▼]
Prefer for phase: [sdd-apply ▼]
[+ Add Preference]
```

#### 3. Model Exclusions
```
Provider: [OpenAI ▼]  Model: [GPT-4o ▼]
Exclude from phase: [sdd-init ▼]
[+ Add Exclusion]
```

#### 4. Account Tier Selection
```
Provider: [Anthropic ▼]
Account: [⚪ Free  ⚫ Pro  ⚫ Team  ⚫ Max]
Rate limit: [50 req/min] (auto-calculated)
[+ Add Provider]
```

**Estructura de datos**:

```typescript
interface AdvancedOptions {
  modelLimits: Array<{
    providerId: string;
    modelId: string;
    maxUses: number;
  }>;
  
  phasePreferences: Array<{
    providerId: string;
    modelId: string;
    phase: SddPhase;
    priority: number;
  }>;
  
  modelExclusions: Array<{
    providerId: string;
    modelId: string;
    phase: SddPhase;
  }>;
  
  accountTiers: Array<{
    providerId: string;
    tier: 'free' | 'pro' | 'team' | 'max';
    rateLimit: number;
  }>;
}
```

**Tiempo estimado**: 3 horas

---

### 🚀 Feature #2: Recrear Consulta desde /history

**Descripción**:  
Click en log → Redirige a /optimizer con consulta recreada

**Flujo**:
1. Usuario en /history
2. Click en log en "SYS LOGS"
3. Modal muestra detalles
4. Botón "🔄 Recreate Query"
5. Redirige a /optimizer
6. Pre-llena InputModule + Advanced Options

**Implementación**:

```typescript
// app/history/page.tsx
function LogDetailModal({ log }) {
  const router = useRouter();
  
  const handleRecreate = () => {
    sessionStorage.setItem('recreate_query', JSON.stringify({
      modelList: log.userInput,
      advancedOptions: log.advancedOptions,
      timestamp: log.createdAt
    }));
    
    router.push('/optimizer');
  };
  
  return (
    <Modal>
      <button onClick={handleRecreate}>
        🔄 Recreate Query
      </button>
    </Modal>
  );
}
```

**Tiempo estimado**: 2 horas

---

### 🚀 Feature #3: Agregar SDD Personalizado

**Descripción**:  
Botón "+ Add Custom SDD" para agregar fase personalizada

**Modal**:
```
Phase Name: sdd-custom-deployment
Display Name: Deployment & Infrastructure
Description: Deploy application to cloud...

Category Weights (must sum to 1.0):
- Expert:              [0.3] 30%
- Coding:              [0.4] 40%
- Instruction Follow:  [0.2] 20%
- Multi-Turn:          [0.1] 10%
Total: 1.0 ✅

[Cancel]  [Add Phase]
```

**Estructura**:

```typescript
interface CustomSddPhase {
  id: string;
  displayName: { es: string; en: string };
  description: string;
  categoryWeights: Record<LMArenaCategory, number>;
  createdAt: Date;
  isCustom: true;
}
```

**Tiempo estimado**: 3 horas

---

## 3. MEJORAS DE UX

### 💡 Mejora #1: Sistema de Vistas Múltiples

**Páginas**: /optimizer, /models

**Modos**:
- Grid: Vista actual (recuadros)
- List: Lista vertical con nombres completos
- Table: Tabla expandida
- Compact: Solo íconos + tooltip

**Persistencia**: localStorage con session key

**Tiempo estimado**: 2 horas

---

### 💡 Mejora #2: Nuevas Opciones en /settings

**Agregar**:
- 🌐 Language & Region
- 🎨 Appearance (Theme, View Mode)
- 🔄 Data Sync (LM Arena status)
- 📊 Advanced Scoring (Confidence threshold)
- 💾 Data Management (Export/Import)

**Tiempo estimado**: 2 horas

---

## 4. RECOMENDACIONES TÉCNICAS

### 🎯 Recomendación #1: Rate Limits por Account Tier

```typescript
export const RATE_LIMITS = {
  anthropic: {
    free: 5,
    pro: 50,
    team: 100,
    max: 500
  },
  openai: {
    free: 3,
    plus: 50,
    pro: 5000
  },
  google: {
    free: 15,
    pro: 60
  }
};
```

**Uso**: Penalizar modelos si usuario tiene tier bajo

---

### 🎯 Recomendación #2: Migración de Datos Existentes

```typescript
export function migrateLegacyData() {
  const sessionId = getOrCreateSessionId();
  
  const keysToMigrate = [
    'optimizer_result',
    'optimizer_history',
    'user_preferences'
  ];
  
  for (const key of keysToMigrate) {
    const oldData = localStorage.getItem(key);
    if (oldData) {
      const newKey = `${sessionId}:${key}`;
      localStorage.setItem(newKey, oldData);
      localStorage.removeItem(key);
    }
  }
}
```

---

## 5. PLAN DE IMPLEMENTACIÓN

### FASE 0: Corrección de Bugs (3-4h)

- [ ] Bug #1: Session Manager (1.5h)
- [ ] Bug #2 & #3: Nombres cortados (1h)
- [ ] Bug #4.1: Clear/Reset (0.5h)
- [ ] Bug #5: Limpieza (0.5h)

### FASE 1: Infraestructura Motor V2 (4-5h)

- [ ] Actualizar schema DB (1h)
- [ ] Crear LMArenaClient (2h)
- [ ] Crear CategoryMapper (1h)
- [ ] Setup Cron Job (1h)

### FASE 2: Scoring Engine V2 (4-5h)

- [ ] Nueva fórmula (2h)
- [ ] Integrar Advanced Options (2h)
- [ ] Tests V1 vs V2 (1h)

### FASE 3: Nuevas Features (6-8h)

- [ ] Advanced Options UI (3h)
- [ ] Recreate Query (2h)
- [ ] Custom SDD Phases (3h)

### FASE 4: Mejoras UX (3-4h)

- [ ] Vistas múltiples (2h)
- [ ] Opciones /settings (2h)

### FASE 5: Embedding Service (3-4h)

- [ ] Integrar transformers (2h)
- [ ] Categorización (2h)

### FASE 6: Testing y Deploy (2-3h)

- [ ] Tests integración (1h)
- [ ] Deploy staging (0.5h)
- [ ] Deploy producción (0.5h)

---

## RESUMEN DE TIEMPOS

| Fase | Duración | Prioridad |
|---|---|---|
| Fase 0: Bugs | 3-4h | 🔴 Alta |
| Fase 1: Infraestructura | 4-5h | 🔴 Alta |
| Fase 2: Scoring V2 | 4-5h | 🔴 Alta |
| Fase 3: Features | 6-8h | 🟡 Media |
| Fase 4: UX | 3-4h | 🟡 Media |
| Fase 5: Embeddings | 3-4h | 🟢 Baja |
| Fase 6: Testing | 2-3h | 🔴 Alta |
| **TOTAL** | **25-33h** | |

---

## DECISIÓN: ¿QUÉ HACEMOS ESTA NOCHE?

### Opción A: Solo Bugs (3-4h)
- Fase 0 completa
- Aplicación funcional sin bugs críticos

### Opción B: Bugs + Infraestructura (7-9h)
- Fase 0 + Fase 1
- Base sólida para Motor V2

### Opción C: Bugs + Infraestructura + Scoring (11-14h)
- Fase 0 + Fase 1 + Fase 2
- Motor V2 funcional

**¿Cuál opción prefieres?**

---

**Última actualización**: 2026-04-14 20:20

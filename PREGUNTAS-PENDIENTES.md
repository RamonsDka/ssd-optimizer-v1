# PREGUNTAS PENDIENTES PARA AFINAR EL PRD

**Fecha**: 2026-04-14
**Estado**: Esperando respuestas del usuario

---

## 1. BUGS ACTUALES DE LA WEB

**Necesito la lista completa de errores que tiene la aplicación actualmente.**

Por favor, llena esta plantilla para cada bug:

### Bug #1: [Nombre descriptivo]
- **Severidad**: [ ] Crítico [ ] Alto [ ] Medio [ ] Bajo
- **Página afectada**: [Landing / Optimizer / Models / etc]
- **Comportamiento esperado**: [Qué debería pasar]
- **Comportamiento actual**: [Qué pasa realmente]
- **Pasos para reproducir**:
  1. [Paso 1]
  2. [Paso 2]
  3. [Paso 3]
- **Screenshot/Error**: [Si aplica]

### Bug #2: [Nombre descriptivo]
[Repetir plantilla]

---

## 2. FLUJO DE LA APLICACIÓN - CONFIRMACIÓN

**¿Este flujo es correcto?**

### Flujo Usuario:
1. Usuario entra a / (Landing page)
2. Click en "Optimizer" → Navega a /optimizer
3. Ingresa lista de modelos en InputModule
   - Ejemplo: "claude-sonnet-4-6, gpt-5.4, gemini-3-pro"
4. Click en botón "Optimize"
5. API /api/optimize procesa:
   - Parsea input
   - Busca modelos en DB (datos de OpenRouter)
   - Ejecuta Scoring Engine V1
   - Genera 3 perfiles (Premium/Balanced/Economic)
   - Devuelve JSON con recomendaciones
6. UI actualiza y muestra:
   - ProfileSelector (tabs para cambiar entre perfiles)
   - DataMatrix (grid 10 fases × modelo recomendado)
   - ComparisonTable (tabla comparativa)
7. Usuario hace click en una fase → Abre PhaseDetailModal
   - Muestra detalles del modelo primary
   - Muestra 3 fallbacks
   - Muestra warnings si aplica

**¿Es correcto? ¿Falta algo? ¿Hay otros flujos importantes?**

---

## 3. ALCANCE PARA "ESTA NOCHE"

Dijiste: "todo esto lo haremos esta noche asi mismo en sistema de fases"

**Necesito clarificar QUÉ vamos a hacer esta noche:**

### Opción A: Solo PRD + Planificación
- [ ] Afinar PRD al 100%
- [ ] Crear sistema de tareas detallado
- [ ] Definir fases de implementación
- [ ] Preparar contratos TypeScript
- **Tiempo estimado**: 2-3 horas

### Opción B: PRD + Bugs + Infraestructura Base
- [ ] Afinar PRD
- [ ] Corregir bugs actuales
- [ ] Crear LMArenaClient básico
- [ ] Actualizar schema de DB
- **Tiempo estimado**: 4-6 horas

### Opción C: Implementación Completa Motor V2
- [ ] Todo lo anterior
- [ ] Implementar Scoring Engine V2
- [ ] Integrar con UI
- [ ] Testing
- **Tiempo estimado**: 8-12 horas

**¿Cuál opción prefieres? ¿O algo intermedio?**

**¿Cuántas horas tenés disponibles esta noche?** [Respuesta: _____]

---

## 4. PRIORIDADES

**Ordena estas tareas por prioridad (1 = más urgente, 5 = menos urgente):**

- [ ] Corregir bugs actuales de la web
- [ ] Implementar Motor V2 con LM Arena
- [ ] Mejorar UI/UX existente
- [ ] Agregar tests
- [ ] Documentación

---

## 5. CATEGORÍAS DE LM ARENA - INVESTIGACIÓN

**Problema detectado**: La API de LM Arena solo devuelve 20 modelos por categoría en el endpoint público.

**Opciones:**

### Opción A: Usar solo categoría "text" (Overall)
- ✅ Más simple
- ✅ Cubre todos los modelos
- ❌ Menos granularidad

### Opción B: Usar múltiples categorías (expert, coding, math, etc)
- ✅ Más preciso
- ✅ Pesos por fase
- ❌ Más complejo
- ⚠️ Solo 20 modelos por categoría en API pública

### Opción C: Scraping de arena.ai (no recomendado)
- ✅ Acceso a todos los datos
- ❌ Frágil (cambios en HTML)
- ❌ Posible violación de ToS

**¿Cuál opción prefieres?** [Respuesta: _____]

**Mi recomendación**: Opción B, pero necesitamos investigar si hay un endpoint que devuelva MÁS de 20 modelos.

---

## 6. PESOS DE CATEGORÍAS - VALIDACIÓN

**¿Estos pesos te parecen correctos?**

### Para sdd-explore (Exploración):
- Expert: 40%
- Creative Writing: 30%
- Multi-Turn: 20%
- Longer Query: 10%

**¿Correcto?** [ ] Sí [ ] No [ ] Ajustar a: _____

### Para sdd-apply (Implementación):
- Coding: 70%
- Instruction Following: 20%
- Expert: 10%

**¿Correcto?** [ ] Sí [ ] No [ ] Ajustar a: _____

### Para sdd-design (Diseño Técnico):
- Expert: 40%
- Creative Writing: 25%
- Multi-Turn: 20%
- Instruction Following: 15%

**¿Correcto?** [ ] Sí [ ] No [ ] Ajustar a: _____

---

## 7. OPENROUTER SYNC - ESTRATEGIA

**Actualmente tienes OpenRouter sync. ¿Qué hacemos con él?**

### Opción A: Mantener ambos (OpenRouter + LM Arena)
- OpenRouter: Metadata (precio, context, lista completa)
- LM Arena: Scores de calidad
- **Ventaja**: Mejor cobertura
- **Desventaja**: Más complejo

### Opción B: Solo LM Arena
- **Ventaja**: Más simple
- **Desventaja**: Solo 288 modelos evaluados

### Opción C: Híbrido inteligente
- OpenRouter descubre modelos nuevos
- LM Arena valida calidad
- Si modelo no está en LM Arena → usar embedding local

**¿Cuál prefieres?** [Respuesta: _____]

**Mi recomendación**: Opción C (híbrido inteligente)

---

## 8. DESCRIPCIÓN DE PÁGINAS

**¿Necesitas que documente cómo funciona cada página?**

Páginas detectadas:
- / - Landing
- /optimizer - Optimizer principal
- /models - [¿Qué hace?]
- /profiles - [¿Qué hace?]
- /history - [¿Qué hace?]
- /docs - [¿Qué hace?]
- /settings - [¿Qué hace?]

**¿Quieres que investigue y documente cada una?** [ ] Sí [ ] No [ ] Solo las importantes

---

## 9. TESTING

**¿Qué nivel de testing quieres?**

- [ ] Sin tests (implementar rápido)
- [ ] Tests básicos (solo funciones críticas)
- [ ] Tests completos (unit + integration)
- [ ] Tests E2E (Playwright)

---

## 10. DEPLOYMENT

**¿Cómo quieres manejar el deploy del Motor V2?**

### Opción A: Feature Flag
- V1 y V2 coexisten
- Toggle en Settings para cambiar
- **Ventaja**: Rollback fácil
- **Desventaja**: Más código

### Opción B: Reemplazo directo
- V2 reemplaza V1 completamente
- **Ventaja**: Más limpio
- **Desventaja**: Sin rollback

### Opción C: Gradual (A/B testing)
- 50% usuarios ven V1, 50% ven V2
- **Ventaja**: Validación real
- **Desventaja**: Complejo

**¿Cuál prefieres?** [Respuesta: _____]

---

## RESPONDE ESTAS PREGUNTAS

Por favor, copia este documento y llena las respuestas. Una vez que tenga todo, actualizaré el PRD al 100% y crearemos el plan de implementación detallado.

**Tiempo estimado para responder**: 10-15 minutos

---

**Última actualización**: 2026-04-14 19:40

# 🚀 LevelUp AI Microservice - Guía de Pruebas

## ✅ Estado Actual del Microservicio

El microservicio está **funcionando correctamente** con las siguientes características implementadas:

### 🎯 **Características Principales Implementadas:**

1. **✅ Integración con Google Gemini AI**
   - Prompts inteligentes personalizados basados en perfiles de usuario
   - Validación robusta de respuestas JSON
   - Manejo de errores mejorado

2. **✅ Endpoints Personalizados Avanzados:**
   - Generación de planes de entrenamiento personalizados
   - Generación de planes dietéticos personalizados  
   - Generación de recetas individuales (como el proyecto de referencia)
   - Sistema de recomendaciones inteligentes

3. **✅ Arquitectura Modular NestJS**
   - Separación de responsabilidades
   - Configuración flexible de proveedores de IA
   - Integración con Supabase para persistencia

---

## 🔗 **URLs del Microservicio:**

- **Servidor:** http://localhost:3005
- **Documentación API:** http://localhost:3005/api/ai/docs
- **Health Check:** http://localhost:3005/api/ai/health

---

## 🧪 **Pruebas Rápidas con curl:**

### 1. **Health Check:**
```bash
curl -X GET http://localhost:3005/api/ai/health
```

### 2. **Generar Receta Personalizada (Inspirado en el proyecto de referencia):**
```bash
curl -X POST http://localhost:3005/api/ai/diet/recipe/user/123/desayuno
```

### 3. **Generar Plan de Entrenamiento Personalizado:**
```bash
curl -X POST http://localhost:3005/api/ai/workout/personalized \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "goal": "muscle_gain",
    "difficulty": "intermediate", 
    "daysPerWeek": 4,
    "duration": 60,
    "equipment": ["dumbbells", "barbell"],
    "targetMuscles": ["chest", "back", "legs"]
  }'
```

### 4. **Generar Plan Dietético Personalizado:**
```bash
curl -X POST http://localhost:3005/api/ai/diet/personalized \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "calories": 2200,
    "goal": "lose_weight",
    "restrictions": ["no_dairy", "vegetarian"],
    "mealsPerDay": 4,
    "targetProtein": 120
  }'
```

---

## 🎨 **Características Únicas Implementadas:**

### 🧠 **Construcción Inteligente de Prompts:**
- Personalización basada en edad, peso, altura, género
- Consideración de condiciones médicas
- Restricciones dietéticas específicas
- Preferencias de equipamiento y tipos de ejercicio

### 🔧 **Validación Robusta:**
- Extracción y validación de JSON de respuestas de IA
- Manejo de errores específicos y descriptivos
- Estructura de datos consistente

### 📊 **Endpoints Especializados:**
- `/workout/personalized` - Entrenamientos con perfil de usuario
- `/diet/personalized` - Dietas con perfil de usuario  
- `/diet/recipe/user/:userId/:mealType` - Recetas individuales (como el proyecto de referencia)

---

## 🔧 **Configuración Actual:**

### **Variables de Entorno Activas:**
```bash
NODE_ENV=development
PORT=3001 (Servidor en 3005)
GEMINI_API_KEY=✅ Configurado
SUPABASE_URL=✅ Configurado  
SUPABASE_SERVICE_KEY=✅ Configurado
DEFAULT_AI_PROVIDER=gemini
```

### **Módulos Integrados:**
- ✅ ExternalApisModule (Gemini + OpenAI opcional)
- ✅ WorkoutModule (Entrenamientos)
- ✅ DietModule (Nutrición + Recetas) 
- ✅ RecommendationModule (IA inteligente)
- ✅ SupabaseModule (Persistencia)

---

## 🚀 **Siguiente Paso Recomendado:**

**Prueba la funcionalidad principal:**
1. Visita la documentación: http://localhost:3005/api/ai/docs
2. Prueba el endpoint de recetas: `/diet/recipe/user/:userId/:mealType`
3. Verifica que responde con JSON válido como el proyecto de referencia

El microservicio está **listo para producción** con integración completa de IA! 🎉
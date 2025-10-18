# 🏋️‍♂️ **Guía Completa para Generar Workouts con IA**

## 🚀 **Estado del Microservicio:**
- ✅ **Servidor corriendo en:** http://localhost:3005
- ✅ **Documentación:** http://localhost:3005/api/ai/docs
- ✅ **Health Check:** http://localhost:3005/api/ai/health

---

## 📋 **Endpoints Disponibles para Workouts:**

### **1. Workout Básico** 
`POST /api/ai/workout`

### **2. Workout Personalizado (Recomendado)** 
`POST /api/ai/workout/personalized`

### **3. Obtener Workout por ID**
`GET /api/ai/workout/:id`

### **4. Regenerar Workout**
`POST /api/ai/workout/:id/regenerate`

---

## 💻 **Ejemplos de Requests:**

### **🎯 Request Básico (curl):**
```bash
curl -X POST http://localhost:3005/api/ai/workout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "goal": "muscle_gain",
    "difficulty": "intermediate",
    "daysPerWeek": 4,
    "duration": 60,
    "equipment": ["dumbbells", "barbell"],
    "targetMuscles": ["chest", "back", "legs"]
  }'
```

### **🧠 Request Personalizado con IA (Recomendado):**
```bash
curl -X POST http://localhost:3005/api/ai/workout/personalized \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user456", 
    "goal": "weight_loss",
    "difficulty": "beginner",
    "daysPerWeek": 3,
    "duration": 45,
    "equipment": ["bodyweight"],
    "targetMuscles": ["full_body"],
    "preferences": "Low impact exercises preferred"
  }'
```

### **📱 Request JavaScript (Fetch):**
```javascript
const response = await fetch('http://localhost:3005/api/ai/workout/personalized', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: "user789",
    goal: "strength",
    difficulty: "advanced",
    daysPerWeek: 5,
    duration: 75,
    equipment: ["barbell", "dumbbells", "pull_up_bar"],
    targetMuscles: ["chest", "back", "shoulders", "legs"],
    preferences: "Focus on powerlifting movements"
  })
});

const workout = await response.json();
console.log(workout);
```

### **🐍 Request Python:**
```python
import requests

url = "http://localhost:3005/api/ai/workout/personalized"
payload = {
    "userId": "user999",
    "goal": "endurance", 
    "difficulty": "intermediate",
    "daysPerWeek": 4,
    "duration": 50,
    "equipment": ["treadmill", "bicycle"],
    "targetMuscles": ["cardio"],
    "preferences": "High intensity interval training"
}

response = requests.post(url, json=payload)
workout = response.json()
print(workout)
```

---

## 📊 **Parámetros del Request:**

| Campo | Tipo | Requerido | Descripción | Opciones |
|-------|------|-----------|-------------|----------|
| `userId` | string | ✅ | ID del usuario | Cualquier string |
| `goal` | string | ✅ | Objetivo del entrenamiento | `muscle_gain`, `weight_loss`, `strength`, `endurance` |
| `difficulty` | string | ✅ | Nivel de dificultad | `beginner`, `intermediate`, `advanced` |
| `daysPerWeek` | number | ✅ | Días de entrenamiento por semana | 1-7 |
| `duration` | number | ✅ | Duración en minutos | 15-180 |
| `equipment` | array | ❌ | Equipamiento disponible | `["dumbbells", "barbell", "bodyweight", "machines"]` |
| `targetMuscles` | array | ❌ | Grupos musculares objetivo | `["chest", "back", "legs", "shoulders", "arms"]` |
| `preferences` | string | ❌ | Preferencias adicionales | Texto libre |

---

## 🎯 **Respuesta Esperada:**

```json
{
  "success": true,
  "data": {
    "id": "workout_12345",
    "name": "Muscle Building Intermediate Plan",
    "description": "4-day intermediate muscle building program...",
    "difficulty": "intermediate",
    "goal": "muscle_gain",
    "daysPerWeek": 4,
    "estimatedDuration": 60,
    "exercises": [
      {
        "name": "Barbell Bench Press",
        "sets": 4,
        "reps": "8-10",
        "weight": "70-80% 1RM",
        "restTime": "2-3 min",
        "instructions": "Keep your back flat on the bench...",
        "targetMuscles": ["chest", "triceps", "shoulders"],
        "equipment": "barbell"
      },
      {
        "name": "Bent-Over Barbell Row",
        "sets": 4,
        "reps": "8-10", 
        "weight": "65-75% 1RM",
        "restTime": "2-3 min",
        "instructions": "Keep your core tight and pull to your lower chest...",
        "targetMuscles": ["back", "biceps"],
        "equipment": "barbell"
      }
    ]
  },
  "message": "Workout plan generated successfully"
}
```

---

## 🔥 **Diferencias entre Endpoints:**

### **`/workout` (Básico):**
- Generación estándar sin perfil de usuario
- Usa solo los parámetros del request
- Respuesta rápida

### **`/workout/personalized` (Inteligente):**
- ✨ **Usa IA avanzada de Gemini**
- ✨ **Considera el perfil completo del usuario desde la base de datos**
- ✨ **Prompts personalizados basados en condiciones médicas, preferencias, etc.**
- ✨ **Validación robusta de respuestas JSON**
- ✨ **Como el proyecto de referencia que compartiste**

---

## 🛠️ **Para Probar Ahora:**

1. **Abrir la documentación:** http://localhost:3005/api/ai/docs
2. **Probar con Swagger UI** (interfaz visual)
3. **O usar curl** con los ejemplos de arriba

¡El microservicio está listo para generar workouts increíbles con IA! 🚀💪
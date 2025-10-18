# 📋 Instrucciones para Probar el Microservicio

## 🚀 Iniciar el Servidor

En una terminal, ejecuta:

```bash
npm run start:dev
```

El servidor estará disponible en: `http://localhost:3005`

---

## 🧪 Queries para Probar el Microservicio

### 🏋️ **1. Generar Rutina de Entrenamiento**

#### Ganar Músculo - Intermedio
```bash
curl -X POST "http://localhost:3005/api/ai/workout" \
-H "Content-Type: application/json" \
-d '{
  "goal": "gain_muscle",
  "difficulty": "intermediate",
  "daysPerWeek": 4,
  "duration": 45,
  "equipment": ["dumbbells", "barbell"],
  "targetMuscles": ["chest", "back"],
  "userId": "12345678-1234-1234-1234-123456789012"
}'
```

#### Perder Peso - Principiante
```bash
curl -X POST "http://localhost:3005/api/ai/workout" \
-H "Content-Type: application/json" \
-d '{
  "goal": "lose_weight",
  "difficulty": "beginner",
  "daysPerWeek": 3,
  "duration": 30,
  "equipment": [],
  "userId": "12345678-1234-1234-1234-123456789012"
}'
```

#### Entrenamiento de Fuerza - Avanzado
```bash
curl -X POST "http://localhost:3005/api/ai/workout" \
-H "Content-Type: application/json" \
-d '{
  "goal": "strength_training",
  "difficulty": "advanced",
  "daysPerWeek": 5,
  "duration": 60,
  "equipment": ["barbell", "dumbbells", "bench"],
  "targetMuscles": ["legs", "back", "chest"],
  "userId": "12345678-1234-1234-1234-123456789012"
}'
```

---

### 🍽️ **2. Generar Recetas Personalizadas**

#### Desayuno
```bash
curl -X POST "http://localhost:3005/api/ai/diet/recipe/user/12345678-1234-1234-1234-123456789012/desayuno" \
-H "Content-Type: application/json"
```

#### Almuerzo
```bash
curl -X POST "http://localhost:3005/api/ai/diet/recipe/user/12345678-1234-1234-1234-123456789012/almuerzo" \
-H "Content-Type: application/json"
```

#### Cena
```bash
curl -X POST "http://localhost:3005/api/ai/diet/recipe/user/12345678-1234-1234-1234-123456789012/cena" \
-H "Content-Type: application/json"
```

#### Merienda
```bash
curl -X POST "http://localhost:3005/api/ai/diet/recipe/user/12345678-1234-1234-1234-123456789012/merienda" \
-H "Content-Type: application/json"
```

---

### 🥗 **3. Generar Plan de Dieta Completo**

```bash
curl -X POST "http://localhost:3005/api/ai/diet" \
-H "Content-Type: application/json" \
-d '{
  "userId": "12345678-1234-1234-1234-123456789012",
  "goal": "lose_weight",
  "calories": 1800,
  "mealsPerDay": 4,
  "restrictions": ["gluten_free"],
  "preferredFoods": ["chicken", "vegetables", "rice"]
}'
```

---

### 💡 **4. Generar Recomendaciones**

```bash
curl -X POST "http://localhost:3005/api/ai/recommendation" \
-H "Content-Type: application/json" \
-d '{
  "userId": "12345678-1234-1234-1234-123456789012",
  "currentWorkoutPlan": {
    "name": "Plan Actual",
    "exercises": []
  },
  "currentDietPlan": {
    "name": "Dieta Actual",
    "meals": []
  },
  "recentProgress": {
    "weight": 75,
    "workoutsCompleted": 12,
    "caloriesConsumed": 1900
  }
}'
```

---

### 🔍 **5. Verificar Estado del Servidor**

```bash
curl -X GET "http://localhost:3005/api/ai/health"
```

---

## 📊 Valores Válidos

### Goals (Objetivos de Entrenamiento):
- `lose_weight` - Perder peso
- `gain_muscle` - Ganar músculo
- `improve_endurance` - Mejorar resistencia
- `maintain_fitness` - Mantener fitness
- `strength_training` - Entrenamiento de fuerza
- `flexibility` - Flexibilidad

### Difficulty (Dificultad):
- `beginner` - Principiante
- `intermediate` - Intermedio
- `advanced` - Avanzado
- `expert` - Experto

### Equipment (Equipamiento):
- `dumbbells` - Mancuernas
- `barbell` - Barra
- `bench` - Banco
- `kettlebells` - Pesas rusas
- `resistance_bands` - Bandas de resistencia
- `pull_up_bar` - Barra de dominadas
- `treadmill` - Cinta de correr
- `stationary_bike` - Bicicleta estática

### Meal Types (Tipos de Comida):
- `desayuno` - Breakfast
- `almuerzo` - Lunch
- `cena` - Dinner
- `merienda` - Snack

---

## 🎯 Tips

- **Formato bonito**: Si tienes `jq` instalado, puedes formatear las respuestas:
  ```bash
  curl -s [COMANDO] | jq '.'
  ```

- **Guardar respuesta**: Para guardar la respuesta en un archivo:
  ```bash
  curl [COMANDO] > respuesta.json
  ```

- **Ver solo datos específicos**: Ejemplo para rutinas:
  ```bash
  curl -s [COMANDO] | jq '.data | {name, exercises: .exercises | length}'
  ```

---

## 📚 Documentación Completa

Para ver toda la documentación de la API, visita:
```
http://localhost:3005/api/ai/docs
```

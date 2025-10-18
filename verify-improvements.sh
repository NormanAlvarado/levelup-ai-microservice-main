#!/bin/bash

echo "🚀 === VERIFICACIÓN COMPLETA DEL SISTEMA MEJORADO ==="
echo ""

# Verificar servidor
echo "🔍 Verificando servidor..."
if ! curl -s -f "http://localhost:3005/api/ai/health" > /dev/null; then
    echo "❌ Servidor no disponible en http://localhost:3005"
    echo "💡 Por favor, ejecuta: npm run start:dev"
    exit 1
fi
echo "✅ Servidor funcionando"
echo ""

# Función para extraer y mostrar datos de JSON
extract_recipe_data() {
    local json="$1"
    echo "$json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    recipe = data.get('data', {})
    print(f'📝 Nombre: {recipe.get(\"name\", \"N/A\")}')
    print(f'🏷️ Categoría: {recipe.get(\"category\", \"N/A\")}')
    print(f'🥗 Ingredientes: {len(recipe.get(\"ingredients\", []))} items')
    print(f'📋 Pasos: {len(recipe.get(\"steps\", []))} pasos')
    print(f'⏱️ Tiempo: {recipe.get(\"prepTime\", \"N/A\")} min')
    print(f'👥 Porciones: {recipe.get(\"servings\", \"N/A\")}')
    if 'nutritionalInfo' in recipe:
        nutrition = recipe['nutritionalInfo']
        print(f'🍎 Calorías: {nutrition.get(\"calories\", \"N/A\")}')
        print(f'🥩 Proteína: {nutrition.get(\"protein\", \"N/A\")}g')
    # Validar estructura
    required = ['name', 'description', 'category', 'ingredients', 'steps']
    missing = [field for field in required if field not in recipe or not recipe[field]]
    if missing:
        print(f'❌ Campos faltantes: {missing}')
    else:
        print('✅ Estructura JSON completa')
except Exception as e:
    print(f'❌ Error parseando JSON: {e}')
"
}

extract_workout_data() {
    local json="$1"
    echo "$json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    workout = data.get('data', {})
    print(f'📝 Nombre: {workout.get(\"name\", \"N/A\")}')
    print(f'📄 Descripción: {workout.get(\"description\", \"N/A\")[:50]}...')
    print(f'🏋️ Ejercicios: {len(workout.get(\"exercises\", []))} ejercicios')
    
    if workout.get('exercises'):
        exercises = workout['exercises'][:3]  # Primeros 3
        print('💪 Primeros ejercicios:')
        for i, ex in enumerate(exercises, 1):
            print(f'   {i}. {ex.get(\"name\", \"N/A\")}')
            print(f'      Series: {ex.get(\"sets\", \"N/A\")}, Reps: {ex.get(\"reps\", \"N/A\")}')
    
    # Validar estructura
    required = ['name', 'description', 'exercises']
    missing = [field for field in required if field not in workout or not workout[field]]
    if missing:
        print(f'❌ Campos faltantes: {missing}')
    else:
        print('✅ Estructura JSON completa')
except Exception as e:
    print(f'❌ Error parseando JSON: {e}')
"
}

# Probar recetas
echo "🍽️ === PRUEBA 1: RECETAS MEJORADAS ==="
echo "Generando receta de desayuno..."

RECIPE_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/ai/diet/recipe/user/12345678-1234-1234-1234-123456789012/desayuno" \
    -H "Content-Type: application/json" \
    --max-time 30)

if [ $? -eq 0 ] && [ ! -z "$RECIPE_RESPONSE" ]; then
    echo "✅ Respuesta recibida"
    extract_recipe_data "$RECIPE_RESPONSE"
else
    echo "❌ Error al generar receta"
    echo "Respuesta: $RECIPE_RESPONSE"
fi

echo ""
echo "🏋️ === PRUEBA 2: RUTINAS MEJORADAS ==="
echo "Generando rutina de entrenamiento..."

WORKOUT_RESPONSE=$(curl -s -X POST "http://localhost:3005/api/ai/workout" \
    -H "Content-Type: application/json" \
    -d '{
        "goal": "ganar_musculo",
        "difficulty": "intermedio",
        "daysPerWeek": 4,
        "duration": 45,
        "equipment": ["mancuernas", "barra"],
        "targetMuscles": ["pecho", "espalda"],
        "userId": "12345678-1234-1234-1234-123456789012"
    }' \
    --max-time 30)

if [ $? -eq 0 ] && [ ! -z "$WORKOUT_RESPONSE" ]; then
    echo "✅ Respuesta recibida"
    extract_workout_data "$WORKOUT_RESPONSE"
else
    echo "❌ Error al generar rutina"
    echo "Respuesta: $WORKOUT_RESPONSE"
fi

echo ""
echo "🎉 === VERIFICACIÓN COMPLETADA ==="
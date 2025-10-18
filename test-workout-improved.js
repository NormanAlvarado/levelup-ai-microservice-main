/**
 * Script de prueba mejorada para rutinas de entrenamiento
 * Prueba el nuevo patrón mejorado para generar JSON válido
 */

const axios = require('axios');
require('dotenv').config();

const baseURL = 'http://localhost:3005/api/ai';

// Datos de prueba para generar rutina
const testWorkoutData = {
  goal: 'ganar_musculo',
  difficulty: 'intermedio',
  daysPerWeek: 4,
  duration: 45,
  equipment: ['mancuernas', 'barra', 'banco'],
  targetMuscles: ['pecho', 'espalda', 'brazos'],
  preferences: 'Enfocar en ejercicios compuestos',
  userId: '12345678-1234-1234-1234-123456789012'
};

async function testWorkoutGeneration() {
  console.log('🏋️ === PRUEBA MEJORADA - RUTINA DE ENTRENAMIENTO ===');
  console.log('📋 Datos de la rutina:');
  console.log(`   - Objetivo: ${testWorkoutData.goal}`);
  console.log(`   - Dificultad: ${testWorkoutData.difficulty}`);
  console.log(`   - Días/semana: ${testWorkoutData.daysPerWeek}`);
  console.log(`   - Duración: ${testWorkoutData.duration} min`);
  console.log(`   - Equipamiento: ${testWorkoutData.equipment.join(', ')}`);
  console.log('');

  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${baseURL}/workout`, testWorkoutData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Respuesta exitosa en ${duration}ms`);
    
    const responseWrapper = response.data;
    const workout = responseWrapper.data || responseWrapper;
    
    console.log('📊 Estructura de la rutina generada:');
    console.log(`📝 Nombre: ${workout.name}`);
    console.log(`📄 Descripción: ${workout.description}`);
    console.log(`🏋️ Ejercicios: ${workout.exercises?.length || 0} ejercicios`);
    
    // Validar estructura
    const requiredFields = ['name', 'description', 'exercises'];
    const missingFields = requiredFields.filter(field => !(field in workout));
    
    if (missingFields.length > 0) {
      console.log(`❌ Campos faltantes: ${missingFields.join(', ')}`);
    } else {
      console.log(`✅ Todos los campos requeridos están presentes`);
    }
    
    // Mostrar algunos ejercicios como ejemplo
    if (workout.exercises && workout.exercises.length > 0) {
      console.log('\n💪 Primeros ejercicios:');
      workout.exercises.slice(0, 3).forEach((exercise, index) => {
        console.log(`   ${index + 1}. ${exercise.name}`);
        console.log(`      - Series: ${exercise.sets}, Reps: ${exercise.reps}`);
        console.log(`      - Descanso: ${exercise.restTime}`);
        console.log(`      - Músculos: ${exercise.targetMuscles?.join(', ') || 'no especificado'}`);
      });
      
      if (workout.exercises.length > 3) {
        console.log(`   ... y ${workout.exercises.length - 3} ejercicios más`);
      }
    }
    
    // Validar que el JSON sea válido
    try {
      JSON.stringify(workout);
      console.log(`\n✅ JSON válido y serializable`);
    } catch (error) {
      console.log(`\n❌ Error de serialización JSON: ${error.message}`);
    }
    
  } catch (error) {
    console.log('❌ Error generando rutina:');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.log(`   Error de red: ${error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

async function checkServer() {
  try {
    const response = await axios.get(`${baseURL}/health`, { timeout: 5000 });
    console.log('✅ Servidor funcionando');
    return true;
  } catch (error) {
    console.log('❌ Servidor no disponible');
    return false;
  }
}

async function main() {
  console.log('🚀 === INICIANDO PRUEBA DE RUTINA MEJORADA ===\n');
  
  const serverOk = await checkServer();
  if (!serverOk) {
    console.log('💡 Asegúrate de que el servidor esté ejecutándose');
    process.exit(1);
  }
  
  console.log('');
  await testWorkoutGeneration();
  console.log('\n🎉 === PRUEBA COMPLETADA ===');
}

main().catch(error => {
  console.error('💥 Error:', error.message);
  process.exit(1);
});
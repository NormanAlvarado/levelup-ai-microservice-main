/**
 * Script de prueba para la nueva funcionalidad de generación de recetas
 * Prueba el patrón mejorado para obligar a Gemini a generar JSON válido
 */

const axios = require('axios');
require('dotenv').config();

const baseURL = 'http://localhost:3005/api/ai';

// Perfil de usuario de prueba
const testUserProfile = {
  age: 28,
  weight: 70,
  height: 175,
  gender: 'masculino',
  activityLevel: 'moderado',
  fitnessGoals: ['perder_peso', 'ganar_musculo'],
  medicalConditions: ['ninguna'],
  preferences: {
    dietaryRestrictions: ['ninguna']
  }
};

async function testRecipeGeneration() {
  console.log('🧪 === PRUEBA DE GENERACIÓN DE RECETAS ===');
  console.log('📋 Perfil de usuario de prueba:');
  console.log(JSON.stringify(testUserProfile, null, 2));
  console.log('\n');

  const mealTypes = ['desayuno', 'almuerzo', 'cena', 'merienda'];
  
  for (const mealType of mealTypes) {
    console.log(`🍽️ === Probando: ${mealType.toUpperCase()} ===`);
    
    try {
      const startTime = Date.now();
      
      // El endpoint requiere userId como parámetro de ruta (UUID válido)
      const testUserId = '12345678-1234-1234-1234-123456789012';
      
      const response = await axios.post(`${baseURL}/diet/recipe/user/${testUserId}/${mealType}`, {}, {
        timeout: 30000, // 30 segundos de timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Respuesta exitosa en ${duration}ms`);
      console.log(`📊 Estructura de la receta generada:`);
      
      // La respuesta viene envuelta en un objeto con success y data
      const responseWrapper = response.data;
      const recipe = responseWrapper.data || responseWrapper;
      
      // Validar estructura
      const requiredFields = ['name', 'description', 'category', 'ingredients', 'steps', 'nutritionalInfo', 'prepTime', 'servings'];
      const missingFields = requiredFields.filter(field => !(field in recipe));
      
      if (missingFields.length > 0) {
        console.log(`❌ Campos faltantes: ${missingFields.join(', ')}`);
      } else {
        console.log(`✅ Todos los campos requeridos están presentes`);
      }
      
      // Mostrar información de la receta
      console.log(`📝 Nombre: ${recipe.name}`);
      console.log(`📄 Descripción: ${recipe.description}`);
      console.log(`🏷️ Categoría: ${recipe.category}`);
      console.log(`🥗 Ingredientes: ${recipe.ingredients?.length || 0} items`);
      console.log(`📋 Pasos: ${recipe.steps?.length || 0} pasos`);
      console.log(`⏱️ Tiempo de preparación: ${recipe.prepTime} minutos`);
      console.log(`👥 Porciones: ${recipe.servings}`);
      
      if (recipe.nutritionalInfo) {
        console.log(`🍎 Información nutricional:`);
        console.log(`   - Calorías: ${recipe.nutritionalInfo.calories}`);
        console.log(`   - Proteína: ${recipe.nutritionalInfo.protein}g`);
        console.log(`   - Carbohidratos: ${recipe.nutritionalInfo.carbs}g`);
        console.log(`   - Grasas: ${recipe.nutritionalInfo.fat}g`);
        console.log(`   - Fibra: ${recipe.nutritionalInfo.fiber}g`);
      }
      
      // Mostrar primeros ingredientes y pasos como ejemplo
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        console.log(`\n📦 Primeros ingredientes:`);
        recipe.ingredients.slice(0, 3).forEach((ingredient, index) => {
          console.log(`   ${index + 1}. ${ingredient.quantity} ${ingredient.unit} de ${ingredient.name}`);
        });
      }
      
      if (recipe.steps && recipe.steps.length > 0) {
        console.log(`\n👨‍🍳 Primeros pasos:`);
        recipe.steps.slice(0, 3).forEach((step, index) => {
          console.log(`   ${index + 1}. ${step}`);
        });
      }
      
      // Validar que el JSON sea válido
      try {
        JSON.stringify(recipe);
        console.log(`✅ JSON válido y serializable`);
      } catch (error) {
        console.log(`❌ Error de serialización JSON: ${error.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Error generando receta para ${mealType}:`);
      
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        console.log(`   Error de red: ${error.message}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log(`\n${'='.repeat(50)}\n`);
    
    // Pausa de 2 segundos entre pruebas para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function checkServerHealth() {
  console.log('🔍 Verificando estado del servidor...');
  
  try {
    const response = await axios.get(`${baseURL}/health`, { timeout: 5000 });
    console.log(`✅ Servidor funcionando - Status: ${response.status}`);
    return true;
  } catch (error) {
    console.log(`❌ Servidor no disponible: ${error.message}`);
    console.log(`💡 Asegúrate de que el servidor esté ejecutándose en ${baseURL}`);
    return false;
  }
}

async function main() {
  console.log('🚀 === INICIANDO PRUEBAS DE RECETAS ===\n');
  
  // Verificar servidor
  const serverOk = await checkServerHealth();
  if (!serverOk) {
    console.log('\n💡 Para iniciar el servidor ejecuta: npm run start:dev');
    process.exit(1);
  }
  
  console.log('');
  
  // Ejecutar pruebas
  await testRecipeGeneration();
  
  console.log('🎉 === PRUEBAS COMPLETADAS ===');
}

// Ejecutar pruebas
main().catch(error => {
  console.error('💥 Error fatal en las pruebas:', error.message);
  process.exit(1);
});
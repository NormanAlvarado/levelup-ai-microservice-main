# 🔧 **Configuración para Plan Gratuito de Gemini AI**

## 🆓 **Limitaciones del Plan Gratuito:**

- ✅ **Requests por minuto:** 15 RPM
- ✅ **Requests por día:** 1,500 RPD  
- ✅ **Tokens por minuto:** 1 millón TPM
- ✅ **Tokens por request:** Máximo 32,768 tokens de input + output

## 🎯 **Modelos Disponibles en Plan Gratuito:**

1. **`gemini-1.5-flash-latest`** ← **Recomendado (Actual)**
2. **`gemini-1.5-flash`**
3. **`gemini-pro`** 
4. **`gemini-pro-vision`**

## ⚙️ **Configuraciones Aplicadas:**

```typescript
// Modelo actualizado para plan gratuito
private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// Tokens reducidos para plan gratuito
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 800,  // Reducido de 2000
}
```

## 🧪 **Tests Recomendados:**

### **1. Test Manual de Gemini API:**
```bash
# Prueba directa con curl
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyBuaJt3y77fKLlaOKQ1dsuCuWHvA0p1uog" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Say hello in JSON format: {\"message\": \"Hello from Gemini!\"}"
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 100
    }
  }'
```

### **2. Test del Microservicio (Una vez que Gemini funcione):**
```bash
# Health check
curl -X GET http://localhost:3005/api/ai/health

# Test de receta simple
curl -X POST "http://localhost:3005/api/ai/diet/recipe/user/a7f021f7-ded5-4e0a-b57c-427e9d04f61d/desayuno"

# Test de workout básico
curl -X POST http://localhost:3005/api/ai/workout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a7f021f7-ded5-4e0a-b57c-427e9d04f61d",
    "goal": "gain_muscle",
    "difficulty": "beginner",
    "daysPerWeek": 3,
    "duration": 30,
    "equipment": ["bodyweight"],
    "targetMuscles": ["full_body"]
  }'
```

## 🚨 **Posibles Problemas y Soluciones:**

### **Problema 1: Cuota Excedida**
```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded"
  }
}
```
**Solución:** Esperar o usar otro API key

### **Problema 2: Modelo No Disponible**
```json
{
  "error": {
    "code": 404,
    "message": "Model not found"
  }
}
```
**Solución:** Cambiar a `gemini-pro` o `gemini-1.5-flash`

### **Problema 3: API Key Inválida**
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid"
  }
}
```
**Solución:** Verificar que la API key sea correcta

## 🛠️ **Próximos Pasos:**

1. **Probar manualmente** la API de Gemini con curl
2. **Verificar** que la respuesta sea correcta
3. **Ajustar el modelo** si es necesario
4. **Probar el microservicio** con requests simples
5. **Escalar** a requests más complejos

## 📋 **Checklist de Debugging:**

- [ ] ✅ API Key de Gemini válida
- [ ] ✅ Modelo disponible en plan gratuito
- [ ] ✅ Tokens dentro del límite
- [ ] ✅ Formato de request correcto
- [ ] ✅ Microservicio respondiendo a health check
- [ ] 🔄 Tests manuales de Gemini API
- [ ] 🔄 Tests del microservicio

**¿Comenzamos probando manualmente la API de Gemini?** 🚀
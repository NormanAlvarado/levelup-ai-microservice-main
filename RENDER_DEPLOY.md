# Render Deployment Guide

## Configuración de Variables de Entorno en Render

Cuando despliegues en Render, asegúrate de configurar estas variables de entorno:

### Variables Requeridas:

```
# Puerto (Render lo asigna automáticamente)
PORT=10000

# API Keys
GEMINI_API_KEY=tu_clave_api_de_gemini
OPENAI_API_KEY=tu_clave_api_de_openai

# Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase

# Node Environment
NODE_ENV=production
```

### Opcional:
```
AI_SERVICE_PORT=10000
```

## Pasos para Desplegar en Render:

1. **Crea un nuevo Web Service** en Render Dashboard
2. **Conecta tu repositorio** de GitHub/GitLab
3. **Configura el servicio:**
   - **Name**: levelup-ai-microservice
   - **Environment**: Docker
   - **Region**: Selecciona la más cercana a tus usuarios
   - **Branch**: main
   - **Dockerfile Path**: ./Dockerfile (por defecto)

4. **Configura las Variables de Entorno** (ver arriba)

5. **Deploy** - Render construirá y desplegará automáticamente

## URLs después del despliegue:

- API Base: `https://tu-app.onrender.com/api/ai`
- Health Check: `https://tu-app.onrender.com/api/ai/health`
- Swagger Docs: `https://tu-app.onrender.com/api/ai/docs`

## Notas Importantes:

- Render ejecuta los contenedores como **root** por defecto ✅
- El puerto se asigna automáticamente via variable `PORT`
- El primer despliegue puede tardar 5-10 minutos
- Los servicios gratuitos se duermen después de 15 minutos de inactividad
- El Dockerfile está configurado para usar `--legacy-peer-deps` para resolver conflictos de dependencias

## CORS Configuration:

Si necesitas añadir el dominio de producción de Render, actualiza `src/main.ts`:

```typescript
origin: [
  'http://localhost:3000',
  'https://tu-frontend.onrender.com',  // Añade tu dominio
  // ... otros orígenes
],
```

## Health Check Endpoint:

Render puede usar el endpoint de health check para verificar que el servicio está funcionando:

```
GET https://tu-app.onrender.com/api/ai/health
```

Configura en Render:
- **Health Check Path**: `/api/ai/health`

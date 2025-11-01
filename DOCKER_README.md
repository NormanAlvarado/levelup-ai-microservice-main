# 🐳 Docker Setup - LevelUp AI Microservice

Este proyecto está configurado para ejecutarse en Docker y desplegarse en Render.

## 📋 Requisitos Previos

- Docker Desktop instalado
- Credenciales de API (Gemini, OpenAI, Supabase)

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.docker.example .env.docker

# Editar con tus credenciales reales
nano .env.docker  # o usa tu editor favorito
```

### 2. Construir e Iniciar

**Opción A: Usando el script de utilidades (Recomendado)**

```bash
# Construir e iniciar en un solo comando
./docker-utils.sh all

# Ver logs
./docker-utils.sh logs

# Ver otros comandos disponibles
./docker-utils.sh help
```

**Opción B: Comandos manuales de Docker**

```bash
# Construir la imagen
docker build -t levelup-ai-microservice .

# Iniciar el contenedor
docker run -d -p 3001:3001 \
  --env-file .env.docker \
  --name levelup-ai \
  levelup-ai-microservice

# Ver logs
docker logs -f levelup-ai
```

## 🔗 Endpoints Disponibles

Una vez que el contenedor esté corriendo:

- **Health Check**: http://localhost:3001/api/ai/health
- **API Documentation (Swagger)**: http://localhost:3001/api/ai/docs
- **API Base URL**: http://localhost:3001/api/ai

## 🛠️ Comandos Útiles

### Script de Utilidades (`docker-utils.sh`)

```bash
./docker-utils.sh build      # Construir imagen
./docker-utils.sh start      # Iniciar contenedor
./docker-utils.sh stop       # Detener contenedor
./docker-utils.sh restart    # Reiniciar contenedor
./docker-utils.sh logs       # Ver logs en tiempo real
./docker-utils.sh shell      # Entrar al contenedor
./docker-utils.sh status     # Ver estado
./docker-utils.sh clean      # Limpiar todo
./docker-utils.sh all        # Construir e iniciar
```

### Comandos Docker Directos

```bash
# Ver contenedores en ejecución
docker ps

# Ver todos los contenedores
docker ps -a

# Detener contenedor
docker stop levelup-ai

# Eliminar contenedor
docker rm levelup-ai

# Ver logs
docker logs levelup-ai
docker logs -f levelup-ai  # Tiempo real

# Entrar al contenedor
docker exec -it levelup-ai sh

# Reiniciar contenedor
docker restart levelup-ai

# Ver uso de recursos
docker stats levelup-ai
```

## 🔧 Solución de Problemas

### El contenedor no inicia

1. Verifica que `.env.docker` existe y tiene valores válidos
2. Revisa los logs: `docker logs levelup-ai`
3. Asegúrate de que el puerto 3001 no esté en uso

### Error de variables de entorno

```
Error: Config validation error: "SUPABASE_URL" must be a valid uri
```

**Solución**: Asegúrate de que `.env.docker` contiene URLs válidas:
- `SUPABASE_URL` debe ser como `https://xxxxx.supabase.co`
- Las API keys deben ser válidas

### Puerto en uso

```bash
# Encuentra qué proceso usa el puerto 3001
lsof -i :3001

# Detén cualquier contenedor en ese puerto
docker stop $(docker ps -q --filter "publish=3001")
```

## 📦 Estructura del Dockerfile

El Dockerfile usa **multi-stage build** para optimizar el tamaño:

1. **Stage Builder**: Instala dependencias y compila TypeScript
2. **Stage Production**: Solo runtime con archivos compilados

Características:
- ✅ Node.js 18 Alpine (imagen ligera)
- ✅ `--legacy-peer-deps` para resolver conflictos de dependencias
- ✅ Health check integrado
- ✅ Ejecuta como root (compatible con Render)
- ✅ Escucha en `0.0.0.0` (necesario para contenedores)

## 🌐 Desplegar en Render

Para desplegar en Render, consulta [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)

## 📝 Notas Importantes

- El proyecto usa `--legacy-peer-deps` debido a conflictos entre `@nestjs/axios@3.1.3` y `@nestjs/common@11.x`
- El compilado de TypeScript genera archivos en `dist/src/`, por eso el CMD usa `dist/src/main.js`
- El contenedor escucha en el puerto definido por la variable `PORT` (default: 3001)

## 🔄 Workflow de Desarrollo

```bash
# 1. Hacer cambios en el código
# 2. Reconstruir imagen
./docker-utils.sh build

# 3. Reiniciar contenedor
./docker-utils.sh restart

# 4. Ver logs
./docker-utils.sh logs
```

## 🧹 Limpieza

```bash
# Limpiar este proyecto específicamente
./docker-utils.sh clean

# Limpiar todo Docker (¡cuidado!)
docker system prune -a
docker volume prune
```

## 💡 Tips

1. **Desarrollo Local**: Para desarrollo, usa `npm run start:dev` directamente (sin Docker)
2. **Docker para Testing**: Usa Docker para probar el ambiente de producción localmente
3. **Variables de Entorno**: Nunca subas `.env.docker` al repositorio (ya está en `.gitignore`)
4. **Logs**: Usa `docker logs -f` para ver logs en tiempo real durante debugging

#!/bin/bash
# Script de utilidades para Docker - LevelUp AI Microservice

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

IMAGE_NAME="levelup-ai-microservice"
CONTAINER_NAME="levelup-ai"
PORT="3001"

echo -e "${BLUE}🐳 LevelUp AI Microservice - Docker Utilities${NC}\n"

# Función para construir la imagen
build() {
    echo -e "${YELLOW}📦 Construyendo imagen Docker...${NC}"
    docker build -t $IMAGE_NAME .
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al construir la imagen${NC}"
        exit 1
    fi
}

# Función para iniciar el contenedor
start() {
    echo -e "${YELLOW}🚀 Iniciando contenedor...${NC}"
    
    # Verificar si existe .env.docker
    if [ ! -f .env.docker ]; then
        echo -e "${RED}❌ Error: No se encontró el archivo .env.docker${NC}"
        echo -e "${YELLOW}💡 Crea uno basado en .env.docker.example${NC}"
        echo -e "   cp .env.docker.example .env.docker"
        echo -e "   # Luego edita .env.docker con tus credenciales reales"
        exit 1
    fi
    
    # Detener contenedor si existe
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null
    
    # Iniciar nuevo contenedor
    docker run -d \
        -p $PORT:$PORT \
        --env-file .env.docker \
        --name $CONTAINER_NAME \
        $IMAGE_NAME
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Contenedor iniciado exitosamente${NC}"
        echo -e "${BLUE}📍 Accede a:${NC}"
        echo -e "   Health Check: http://localhost:$PORT/api/ai/health"
        echo -e "   API Docs:     http://localhost:$PORT/api/ai/docs"
        echo -e "   API Base:     http://localhost:$PORT/api/ai"
    else
        echo -e "${RED}❌ Error al iniciar el contenedor${NC}"
        exit 1
    fi
}

# Función para ver logs
logs() {
    echo -e "${YELLOW}📋 Mostrando logs...${NC}"
    docker logs -f $CONTAINER_NAME
}

# Función para detener el contenedor
stop() {
    echo -e "${YELLOW}🛑 Deteniendo contenedor...${NC}"
    docker stop $CONTAINER_NAME
    echo -e "${GREEN}✅ Contenedor detenido${NC}"
}

# Función para reiniciar el contenedor
restart() {
    echo -e "${YELLOW}🔄 Reiniciando contenedor...${NC}"
    stop
    start
}

# Función para limpiar todo
clean() {
    echo -e "${YELLOW}🧹 Limpiando contenedores e imágenes...${NC}"
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null
    docker rmi $IMAGE_NAME 2>/dev/null
    echo -e "${GREEN}✅ Limpieza completada${NC}"
}

# Función para entrar al contenedor
shell() {
    echo -e "${YELLOW}🐚 Entrando al contenedor...${NC}"
    docker exec -it $CONTAINER_NAME sh
}

# Función para ver el estado
status() {
    echo -e "${YELLOW}📊 Estado del contenedor:${NC}"
    docker ps -a | grep $CONTAINER_NAME
}

# Función de ayuda
help() {
    echo "Uso: ./docker-utils.sh [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  build    - Construir la imagen Docker"
    echo "  start    - Iniciar el contenedor"
    echo "  stop     - Detener el contenedor"
    echo "  restart  - Reiniciar el contenedor"
    echo "  logs     - Ver logs en tiempo real"
    echo "  shell    - Entrar al contenedor (shell interactivo)"
    echo "  status   - Ver estado del contenedor"
    echo "  clean    - Limpiar contenedor e imagen"
    echo "  all      - Construir e iniciar (build + start)"
    echo "  help     - Mostrar esta ayuda"
}

# Procesar comandos
case "$1" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    shell)
        shell
        ;;
    status)
        status
        ;;
    clean)
        clean
        ;;
    all)
        build
        start
        ;;
    help|*)
        help
        ;;
esac

#!/bin/bash

# Скрипт для одновременного запуска бэкенда и фронтенда

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Порты
BACKEND_PORT=3010
FRONTEND_PORT=5173

# Функция проверки порта
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Порт $port занят${NC}"
        lsof -Pi :$port -sTCP:LISTEN | grep LISTEN
        return 1
    else
        echo -e "${GREEN}✅ Порт $port свободен${NC}"
        return 0
    fi
}

# Функция для обработки сигнала завершения
cleanup() {
    echo -e "\n${YELLOW}Остановка процессов...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Установить обработчик сигналов
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}🚀 Запуск бэкенда и фронтенда...${NC}\n"

# Проверка портов
echo -e "${BLUE}🔍 Проверка портов...${NC}"
check_port $BACKEND_PORT
BACKEND_PORT_FREE=$?
check_port $FRONTEND_PORT
FRONTEND_PORT_FREE=$?

if [ $BACKEND_PORT_FREE -ne 0 ] || [ $FRONTEND_PORT_FREE -ne 0 ]; then
    echo -e "\n${YELLOW}⚠️  Некоторые порты заняты. Попытка остановить процессы...${NC}"
    if [ $BACKEND_PORT_FREE -ne 0 ]; then
        echo -e "${YELLOW}Останавливаю процесс на порту $BACKEND_PORT...${NC}"
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
        sleep 1
    fi
    if [ $FRONTEND_PORT_FREE -ne 0 ]; then
        echo -e "${YELLOW}Останавливаю процесс на порту $FRONTEND_PORT...${NC}"
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
        sleep 1
    fi
    echo ""
fi

# Запуск бэкенда
echo -e "${BLUE}📦 Запуск бэкенда на порту $BACKEND_PORT...${NC}"
cd backend
# Установить правильный exchange для RabbitMQ
export RABBITMQ_UPDATES_EXCHANGE=mms3_updates
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Небольшая задержка перед запуском фронтенда
sleep 2

# Проверка, что бэкенд запустился
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Бэкенд не запустился! Проверьте логи: tail -f /tmp/backend.log${NC}"
    exit 1
fi

# Запуск фронтенда
echo -e "${BLUE}🎨 Запуск фронтенда на порту $FRONTEND_PORT...${NC}"
cd frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Небольшая задержка для запуска
sleep 3

# Проверка статуса портов после запуска
echo -e "\n${BLUE}📊 Статус портов после запуска:${NC}"
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Бэкенд работает на порту $BACKEND_PORT${NC}"
    echo -e "   URL: http://localhost:$BACKEND_PORT"
else
    echo -e "${RED}❌ Бэкенд не запустился на порту $BACKEND_PORT${NC}"
fi

# Проверяем фактический порт фронтенда (может быть другой, если 5173 занят)
FRONTEND_ACTUAL_PORT=$(grep -oP "Local:\s+http://localhost:\K\d+" /tmp/frontend.log 2>/dev/null | head -1 || echo "$FRONTEND_PORT")
if [ -n "$FRONTEND_ACTUAL_PORT" ] && lsof -Pi :$FRONTEND_ACTUAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Фронтенд работает на порту $FRONTEND_ACTUAL_PORT${NC}"
    echo -e "   URL: http://localhost:$FRONTEND_ACTUAL_PORT"
else
    echo -e "${YELLOW}⚠️  Фронтенд запускается... (проверьте логи)${NC}"
fi

echo -e "\n${GREEN}✅ Процессы запущены!${NC}"
echo -e "${YELLOW}Бэкенд PID: $BACKEND_PID${NC}"
echo -e "${YELLOW}Фронтенд PID: $FRONTEND_PID${NC}"
echo -e "\n${BLUE}Логи бэкенда: tail -f /tmp/backend.log${NC}"
echo -e "${BLUE}Логи фронтенда: tail -f /tmp/frontend.log${NC}"
echo -e "\n${YELLOW}Нажмите Ctrl+C для остановки${NC}\n"

# Ждать завершения процессов
wait $BACKEND_PID $FRONTEND_PID

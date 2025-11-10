#!/bin/bash

# API Testing Script
# Тестирование API чат-приложения

BASE_URL="http://localhost:3001"
PHONE="79123456789"
NAME="Test User"

echo "🧪 Testing Chat Application API"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test health check
echo "1️⃣  Testing health check..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check OK${NC}"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Request verification code
echo "2️⃣  Requesting verification code..."
REQUEST_CODE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/request-code" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$PHONE\",\"name\":\"$NAME\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$REQUEST_CODE_RESPONSE" | tail -n1)
BODY=$(echo "$REQUEST_CODE_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Code request successful${NC}"
    echo "$BODY" | jq .
    echo ""
    echo -e "${YELLOW}📱 Check server console for verification code${NC}"
    echo -e "${YELLOW}Enter the 4-digit code from console:${NC}"
    read -p "Code: " CODE
else
    echo -e "${RED}❌ Code request failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
    exit 1
fi
echo ""

# Verify code and get token
echo "3️⃣  Verifying code..."
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/verify-code" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)
BODY=$(echo "$VERIFY_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Code verification successful${NC}"
    TOKEN=$(echo "$BODY" | jq -r .token)
    USER_ID=$(echo "$BODY" | jq -r .user.userId)
    echo "Token: $TOKEN"
    echo "User ID: $USER_ID"
else
    echo -e "${RED}❌ Code verification failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
    exit 1
fi
echo ""

# Get current user
echo "4️⃣  Getting current user info..."
ME_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$ME_RESPONSE" | tail -n1)
BODY=$(echo "$ME_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ User info retrieved${NC}"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Failed to get user info (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
fi
echo ""

# Get user dialogs
echo "5️⃣  Getting user dialogs..."
DIALOGS_RESPONSE=$(curl -s "$BASE_URL/api/dialogs?page=1&limit=10" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$DIALOGS_RESPONSE" | tail -n1)
BODY=$(echo "$DIALOGS_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Dialogs retrieved${NC}"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Failed to get dialogs (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
fi
echo ""

# Create new dialog
echo "6️⃣  Creating new dialog..."
CREATE_DIALOG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dialogs" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Dialog","memberIds":[]}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CREATE_DIALOG_RESPONSE" | tail -n1)
BODY=$(echo "$CREATE_DIALOG_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Dialog created${NC}"
    DIALOG_ID=$(echo "$BODY" | jq -r .dialog._id)
    echo "Dialog ID: $DIALOG_ID"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Failed to create dialog (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
    exit 1
fi
echo ""

# Send message
echo "7️⃣  Sending message to dialog..."
SEND_MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dialog/$DIALOG_ID/messages" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Hello! This is a test message.","type":"text"}' \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SEND_MESSAGE_RESPONSE" | tail -n1)
BODY=$(echo "$SEND_MESSAGE_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Message sent${NC}"
    MESSAGE_ID=$(echo "$BODY" | jq -r .message._id)
    echo "Message ID: $MESSAGE_ID"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Failed to send message (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
fi
echo ""

# Get messages
echo "8️⃣  Getting dialog messages..."
GET_MESSAGES_RESPONSE=$(curl -s "$BASE_URL/api/dialog/$DIALOG_ID/messages" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$GET_MESSAGES_RESPONSE" | tail -n1)
BODY=$(echo "$GET_MESSAGES_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Messages retrieved${NC}"
    echo "$BODY" | jq .
else
    echo -e "${RED}❌ Failed to get messages (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq .
fi
echo ""

# Mark as read
if [ ! -z "$MESSAGE_ID" ]; then
    echo "9️⃣  Marking message as read..."
    MARK_READ_RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages/$MESSAGE_ID/status/read" \
        -H "Authorization: Bearer $TOKEN" \
        -w "\n%{http_code}")

    HTTP_CODE=$(echo "$MARK_READ_RESPONSE" | tail -n1)
    BODY=$(echo "$MARK_READ_RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Message marked as read${NC}"
        echo "$BODY" | jq .
    else
        echo -e "${RED}❌ Failed to mark as read (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | jq .
    fi
    echo ""
fi

echo ""
echo "================================"
echo -e "${GREEN}✨ API Testing Complete!${NC}"
echo ""
echo "Summary:"
echo "- Token: $TOKEN"
echo "- User ID: $USER_ID"
echo "- Dialog ID: $DIALOG_ID"
echo "- Message ID: $MESSAGE_ID"


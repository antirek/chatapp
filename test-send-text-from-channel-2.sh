#!/bin/sh

curl -X 'POST' \
  'http://localhost:3010/api/channels/whatsapp/W0002/message' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "phone": "79123456709",
  "text": "У нас вероятно проблема",
  "name": "Силов Сил 9"
}'
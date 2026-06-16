#!/bin/bash
echo "🧠 Starting Nom AI by Nomin Methdam..."
kill $(lsof -t -i:3000) 2>/dev/null
pkill bore 2>/dev/null
cd ~/ai-web
nohup node server.js > server.log 2>&1 &
sleep 3
nohup bore local 3000 --to bore.pub --port nom-ai > bore.log 2>&1 &
sleep 4
echo "✅ Nom AI Live! http://bore.pub:nom-ai"
echo "👤 nomin / 🔑 nomin"

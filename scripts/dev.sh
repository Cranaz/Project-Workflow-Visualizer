#!/bin/bash
set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
if [ -n "${OLLAMA_MODELS}" ]; then
  IFS=',' read -ra MODEL_LIST <<< "${OLLAMA_MODELS}"
elif [ -n "${OLLAMA_MODEL}" ]; then
  MODEL_LIST=("${OLLAMA_MODEL}" "qwen3.5:397b-cloud" "deepseek-v3.2:cloud" "glm-5:cloud" "kimi-k2.5:cloud")
else
  MODEL_LIST=("qwen3.5:397b-cloud" "deepseek-v3.2:cloud" "glm-5:cloud" "kimi-k2.5:cloud")
fi
MODEL="${MODEL_LIST[0]}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Project Workflow Visualizer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Ollama is already running
if curl -s --max-time 2 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
  echo "✅ Ollama already running at ${OLLAMA_HOST}"
  OLLAMA_STARTED=false
else
  echo "🚀 Starting Ollama server..."
  ollama serve > /tmp/ollama.log 2>&1 &
  OLLAMA_PID=$!
  OLLAMA_STARTED=true

  # Wait up to 15 seconds for Ollama to be ready
  echo "⏳ Waiting for Ollama to be ready..."
  ATTEMPTS=0
  until curl -s --max-time 1 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -ge 15 ]; then
      echo "⚠️  Ollama did not start in time — continuing without AI"
      OLLAMA_STARTED=false
      break
    fi
    sleep 1
  done

  if [ "$OLLAMA_STARTED" = true ]; then
    echo "✅ Ollama started (PID: $OLLAMA_PID)"
  fi
fi

# Check if model is available
if curl -s --max-time 2 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
  if curl -s "${OLLAMA_HOST}/api/tags" | grep -q "$MODEL"; then
    echo "✅ Model ${MODEL} is available"
  else
    echo "⬇️  Model ${MODEL} not found — pulling now..."
    echo "   (This may take a while on first run)"
    ollama pull "$MODEL"
    echo "✅ Model pulled successfully"
  fi
fi

echo ""
echo "🌐 Starting Next.js dev server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  if [ "$OLLAMA_STARTED" = true ] && [ -n "$OLLAMA_PID" ]; then
    echo "   Stopping Ollama (PID: $OLLAMA_PID)..."
    kill $OLLAMA_PID 2>/dev/null || true
  fi
  exit 0
}

trap cleanup INT TERM

# Start Next.js
npx next dev &
NEXT_PID=$!
wait $NEXT_PID

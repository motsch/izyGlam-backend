#!/usr/bin/env bash
# wait-for-it.sh (version légère)

host="$1"
shift
port="$1"
shift

while ! nc -z "$host" "$port"; do
  echo "⏳ Attente de $host:$port..."
  sleep 1
done

echo "✅ $host:$port est prêt !"

exec "$@"

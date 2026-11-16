#!/bin/bash
# Startar en tillfallig dev-server mot fejkad Supabase och kor klicktestet.
cd "$(dirname "$0")/.."
VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=anon npx vite --port 5199 >/tmp/gymbanan-e2e-vite.log 2>&1 &
VP=$!
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:5199/ && break; sleep 0.5; done
node e2e/passflow.cjs; CODE=$?
kill $VP 2>/dev/null; pkill -f "vite --port 5199" 2>/dev/null
exit $CODE

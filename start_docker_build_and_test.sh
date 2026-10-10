#!/bin/bash
# Uses Compose Watch for hot-reloading backend source while keeping the
# exact same release image build as production.
docker compose -f dev-compose.yaml up --watch --build
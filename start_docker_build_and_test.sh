#!/bin/bash
docker build --no-cache --build-arg APP_VERSION=dev -t notbench352/inqress:dev .
docker run -v ./backend/data:/app/data -p 7000:8000 --rm notbench352/inqress:dev
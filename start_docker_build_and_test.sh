#!/bin/bash
docker build --no-cache --build-arg APP_VERSION=dev -t inqress:dev .
docker run -v ./backend/data:/app/data -p 8000:8000 --rm inqress:dev
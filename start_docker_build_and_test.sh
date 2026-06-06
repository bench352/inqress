#!/bin/bash
docker build --no-cache -t inqress:test .
docker run -v ./backend/data:/app/data -p 8000:8000 --rm inqress:test
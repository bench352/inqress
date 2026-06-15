#!/usr/bin/env bash
set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

readonly CONFIG_DIR="$HOME/.inqress"
readonly CONFIG_FILE="$CONFIG_DIR/config.yaml"

container_name="inqress"
skip_setup=false
org_name=""
country_code=""
admin_username=""
admin_password=""
smtp_host=""
smtp_port="465"
smtp_username=""
smtp_password=""
smtp_display_email=""
smtp_wait="5"

info()  { printf "${CYAN}%s${NC}\n" "$*"; }
success() { printf "${GREEN}✓ %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
error() { printf "${RED}✗ %s${NC}\n" "$*" >&2; }
bold()  { printf "${BOLD}%s${NC}\n" "$*"; }

yaml_quote() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}

prompt_required() {
  local prompt="$1" var_name="$2"
  local val=""
  while [ -z "$val" ]; do
    read -r -p "$prompt: " val
    if [ -z "$val" ]; then
      error "This field is required."
    fi
  done
  printf -v "$var_name" '%s' "$val"
}

prompt_optional() {
  local prompt="$1" var_name="$2" default="${3:-}"
  local val=""
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " val
  else
    read -r -p "$prompt: " val
  fi
  if [ -z "$val" ]; then
    printf -v "$var_name" '%s' "$default"
  else
    printf -v "$var_name" '%s' "$val"
  fi
}

check_prerequisites() {
  if ! command -v docker &> /dev/null; then
    error "Docker is not installed."
    echo "  Install Docker first: https://docs.docker.com/get-docker/"
    exit 1
  fi
  if ! docker info &> /dev/null; then
    error "Docker daemon is not running."
    echo "  Start Docker and try again."
    exit 1
  fi
  success "Docker is installed and running."
}

check_existing_config() {
  if [ -f "$CONFIG_FILE" ]; then
    warn "Existing configuration found at $CONFIG_FILE"
    local choice=""
    read -r -p "Overwrite and re-run setup? [y/N]: " choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then
      skip_setup=true
    fi
  fi
}

prompt_organization_name() {
  echo ""
  bold "Organization name"
  echo "  Shown on tickets, emails, and the dashboard. Optional."
  prompt_optional "  Organization name" org_name ""
}

prompt_country_code() {
  echo ""
  bold "Default country code"
  echo "  ISO 3166-1 alpha-2 code for phone number lookup (e.g., HK, US, GB)."
  local val=""
  while true; do
    read -r -p "  Country code: " val
    val="${val^^}"
    if [[ "$val" =~ ^[A-Z]{2}$ ]]; then
      country_code="$val"
      break
    fi
    error "Enter a valid 2-letter country code (e.g., HK, US, GB)."
  done
}

prompt_admin_credentials() {
  echo ""
  bold "Admin credentials"
  echo "  Used to log in to the web dashboard."
  prompt_required "  Username" admin_username
  while true; do
    read -s -r -p "  Password (input hidden): " admin_password
    echo ""
    if [ -z "$admin_password" ]; then
      error "Password cannot be empty."
      continue
    fi
    read -s -r -p "  Confirm password: " admin_password_confirm
    echo ""
    if [ "$admin_password" != "$admin_password_confirm" ]; then
      error "Passwords do not match."
    else
      break
    fi
  done
}

prompt_smtp_config() {
  echo ""
  bold "Email SMTP configuration"
  echo "  Required for email ticket delivery. Skip to configure later."
  local choice=""
  read -r -p "  Configure SMTP? [Y/n]: " choice
  if [[ "$choice" =~ ^[Nn]$ ]]; then
    smtp_host=""
    smtp_port="465"
    smtp_username=""
    smtp_password=""
    smtp_display_email=""
    smtp_wait="5"
    return
  fi
  prompt_required "  SMTP host (e.g., smtp.gmail.com)" smtp_host
  prompt_optional "  SMTP port" smtp_port "465"
  prompt_required "  SMTP username" smtp_username
  while true; do
    read -s -r -p "  SMTP password (input hidden): " smtp_password
    echo ""
    if [ -z "$smtp_password" ]; then
      error "Password cannot be empty."
    else
      break
    fi
  done
  prompt_optional "  Sender's display name (shown as From)" smtp_display_email ""
  prompt_optional "  Wait between deliveries (seconds)" smtp_wait "5"
}

prompt_container_name() {
  echo ""
  bold "Docker container name"
  prompt_optional "  Container name" container_name "inqress"
}

generate_config() {
  echo ""
  info "Generating configuration..."
  mkdir -p "$CONFIG_DIR"

  {
    echo "server:"
    echo "  host: 0.0.0.0"
    echo "  port: 8000"
    echo "  debug: false"
    echo ""
    echo "app:"
    if [ -n "$org_name" ]; then
      echo '  organization_name: "'"$(yaml_quote "$org_name")"'"'
    else
      echo "  organization_name:"
    fi
    echo '  default_country_code: "'"$(yaml_quote "$country_code")"'"'
    echo ""
    echo "auth:"
    echo '  admin_username: "'"$(yaml_quote "$admin_username")"'"'
    echo '  admin_password: "'"$(yaml_quote "$admin_password")"'"'
    echo ""
    echo "email_smtp:"
    if [ -n "$smtp_host" ]; then
      echo '  host: "'"$(yaml_quote "$smtp_host")"'"'
      echo "  port: $smtp_port"
      echo '  username: "'"$(yaml_quote "$smtp_username")"'"'
      echo '  password: "'"$(yaml_quote "$smtp_password")"'"'
      if [ -n "$smtp_display_email" ]; then
        echo '  display_email: "'"$(yaml_quote "$smtp_display_email")"'"'
      else
        echo "  display_email:"
      fi
      echo "  wait_between_delivery_second: $smtp_wait"
    else
      echo "  host: \"\""
      echo "  port: 465"
      echo "  username: \"\""
      echo "  password: \"\""
      echo "  display_email:"
      echo "  wait_between_delivery_second: 5"
    fi
  } > "$CONFIG_FILE"

  success "Configuration saved to $CONFIG_FILE"
}

run_docker() {
  echo ""
  info "Starting Docker container..."

  if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
      warn "Container '$container_name' is already running."
      echo "  Stop it first: docker stop $container_name"
    else
      warn "Container '$container_name' already exists (stopped)."
      echo "  Remove it first: docker rm $container_name"
    fi
    exit 1
  fi

  docker run -d \
    --restart unless-stopped \
    --name "$container_name" \
    -v "$CONFIG_DIR:/app/data" \
    -p 8000:8000 \
    bench352/inqress:latest

  echo ""
  success "Container started successfully!"
  echo ""
  bold "  Dashboard:  http://localhost:8000"
  bold "  Container:  $container_name"
  echo ""
  echo "  View logs:   docker logs -f $container_name"
  echo "  Stop:        docker stop $container_name"
  echo "  Restart:     docker restart $container_name"
  echo ""
}

main() {
  echo ""
  bold "╔══════════════════════════════════════════════════════╗"
  bold "║         InQRess — Interactive Installer              ║"
  bold "║   Open-source QR Ticketing & Check-in System         ║"
  bold "╚══════════════════════════════════════════════════════╝"
  echo ""

  check_prerequisites
  check_existing_config

  if [ "$skip_setup" = false ]; then
    prompt_organization_name
    prompt_country_code
    prompt_admin_credentials
    prompt_smtp_config
    prompt_container_name
    generate_config
  else
    echo ""
    info "Using existing configuration."
  fi

  run_docker
}

main

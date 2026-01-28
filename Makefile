# CHECK24 Login Testing - Makefile
# Convenience-Wrapper für npm-Scripts

.PHONY: help install setup test clean dev docker

help: ## Zeigt diese Hilfe an
	@echo "CHECK24 Login Testing - Verfügbare Befehle:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## Installiert alle Dependencies
	npm install
	npx playwright install chromium

setup: ## Führt das Setup-Script aus
	./setup.sh

test: ## Führt alle Tests aus
	npm run test:playwright

test-login: ## Führt nur Login-Tests aus
	npm run test:login

test-headed: ## Führt Tests mit sichtbarem Browser aus
	npm run test:headed

dev: ## Startet alle Services (API + Worker + Web)
	npm run dev

dev-api: ## Startet nur den API-Server
	npm run dev:api

dev-worker: ## Startet nur den Worker
	npm run dev:worker

dev-web: ## Startet nur das Web-Dashboard
	npm run dev:web

build: ## Baut das Projekt für Production
	npm run build:web

docker-build: ## Baut das Docker-Image
	docker-compose build

docker-up: ## Startet Docker-Container
	docker-compose up -d

docker-down: ## Stoppt Docker-Container
	docker-compose down

docker-logs: ## Zeigt Docker-Logs
	docker-compose logs -f

clean: ## Räumt Build-Artefakte und Cache auf
	rm -rf node_modules
	rm -rf .next
	rm -rf dist
	rm -rf test-results
	rm -rf playwright-report

clean-data: ## Löscht Datenbank (VORSICHT!)
	rm -rf data/*.db

lint: ## Führt ESLint aus
	npm run lint

format: ## Formatiert Code mit Prettier
	npm run format

.DEFAULT_GOAL := help

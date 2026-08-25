PYTHON ?= python3

.PHONY: test syntax ci build run logs health

syntax:
	$(PYTHON) -m py_compile app.py

test:
	pytest

ci: syntax test
	docker build -t rich-tutor-ci .

build:
	docker compose build

run:
	docker compose up -d

logs:
	docker compose logs -f rich-tutor

health:
	curl -fsS http://127.0.0.1:5085/health && echo

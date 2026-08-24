FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data \
    && useradd --create-home --uid 10001 richapp \
    && chown -R richapp:richapp /app

USER richapp

EXPOSE 5085

CMD ["gunicorn", "--workers", "1", "--bind", "0.0.0.0:5085", "--timeout", "120", "app:app"]

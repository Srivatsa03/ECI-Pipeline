# ECI Pipeline API.
#
# Ships the whole Python project, not just the web layer, because
# POST /api/pipeline/run executes the pipeline stages in-process.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# psycopg2 and lxml need a toolchain; drop it again in the same layer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpq-dev libxml2-dev libxslt1-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

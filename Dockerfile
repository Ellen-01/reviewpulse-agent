FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
    python -m pip install -r requirements.txt && \
    useradd --create-home --uid 10001 reviewpulse

COPY . .

USER reviewpulse
EXPOSE 7860

CMD ["python", "-m", "api.run"]

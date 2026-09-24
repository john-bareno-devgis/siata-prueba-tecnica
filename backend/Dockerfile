# python:3.12-slim es multi-arch nativo (amd64 + arm64), sin necesidad de
# fijar platform ni depender de emulación.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

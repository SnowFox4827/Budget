# Frontend service — Flask static server + API reverse-proxy (pure Python, no nginx)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY app ./app

EXPOSE 80

CMD ["python", "app.py"]

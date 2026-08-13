# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install Flask
RUN pip install --no-cache-dir flask

# Copy application files
COPY . /app

# Expose port 5000
EXPOSE 5000

# Run directly using Python
CMD ["python", "app.py"]

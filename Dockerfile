# Use a lightweight Python image
FROM python:3.11-slim

# Set environment variables for production
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/


RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    poppler-utils \
    libgl1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create a non-root user (Hugging Face Requirement)
RUN useradd -m -u 1000 user
USER user
WORKDIR $HOME/app

# Install system dependencies (using sudo-less approach or pre-installing)
# Note: Hugging Face builders allow some apt installs if needed, but slim is usually fine
COPY --chown=user:user requirements.txt .

# Install dependencies (CPU-only Torch to save space)
RUN pip install --no-cache-dir --user torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --user -r requirements.txt

# Copy application code
COPY --chown=user:user . .

# Hugging Face Spaces uses port 7860 by default
EXPOSE 7860

# Run the application
# We bind to 0.0.0.0 and port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
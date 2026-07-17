FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system plandelta && useradd --system --gid plandelta plandelta
WORKDIR /app
COPY pyproject.toml ./
COPY plandelta_vision ./plandelta_vision
RUN python -m pip install --upgrade pip && python -m pip install .
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /data /home/plandelta/.paddlex \
    && chown --recursive plandelta:plandelta /home/plandelta \
    && chmod 0777 /data

USER plandelta
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "plandelta_vision.main:app", "--host", "0.0.0.0", "--port", "8000"]

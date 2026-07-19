FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 plandelta \
    && useradd \
      --uid 1000 \
      --gid plandelta \
      --no-create-home \
      --home-dir /home/plandelta \
      --shell /usr/sbin/nologin \
      plandelta
WORKDIR /app
COPY pyproject.toml ./
RUN mkdir plandelta_vision \
    && printf '__version__ = "0.2.0"\n' > plandelta_vision/__init__.py \
    && python -m pip install . \
    && rm -rf plandelta_vision
COPY plandelta_vision ./plandelta_vision
RUN python -m pip install --no-deps --force-reinstall .
COPY models ./models
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /data /home/plandelta/.paddlex \
    && chown --recursive plandelta:plandelta /data /home/plandelta \
    && chmod 0770 /data

USER plandelta
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "plandelta_vision.main:app", "--host", "0.0.0.0", "--port", "8000"]

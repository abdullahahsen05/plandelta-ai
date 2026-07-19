FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/home/plandelta/.cache/fastembed

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 plandelta \
    && useradd \
      --uid 1000 \
      --gid plandelta \
      --create-home \
      --home-dir /home/plandelta \
      --shell /usr/sbin/nologin \
      plandelta

WORKDIR /app
COPY pyproject.toml ./
RUN mkdir plandelta_agent \
    && printf '__version__ = "0.2.0"\n' > plandelta_agent/__init__.py \
    && python -m pip install --upgrade pip \
    && python -m pip install . \
    && rm -rf plandelta_agent
COPY plandelta_agent ./plandelta_agent
RUN python -m pip install --no-deps --force-reinstall .

RUN mkdir -p /home/plandelta/.cache/fastembed \
    && chown --recursive plandelta:plandelta /home/plandelta

USER plandelta
EXPOSE 8100
CMD ["python", "-m", "uvicorn", "plandelta_agent.main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1", "--no-access-log"]

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system plandelta && useradd --system --gid plandelta plandelta
WORKDIR /app
COPY pyproject.toml ./
COPY plandelta_vision ./plandelta_vision
RUN python -m pip install --upgrade pip && python -m pip install .

USER plandelta
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "plandelta_vision.main:app", "--host", "0.0.0.0", "--port", "8000"]

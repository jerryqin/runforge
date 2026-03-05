# ── 构建阶段 ────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# 只复制依赖文件，利用 Docker 层缓存
COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── 运行阶段 ────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# 时区
ENV TZ=Asia/Shanghai
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 从构建阶段复制已安装的依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Stage 1: build whisper.cpp's whisper-server from pinned source
FROM debian:bookworm-slim AS whisper-build

RUN apt-get update && \
    apt-get install -y --no-install-recommends git build-essential cmake ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ARG WHISPER_CPP_TAG=v1.9.1
RUN git clone --depth 1 --branch ${WHISPER_CPP_TAG} https://github.com/ggml-org/whisper.cpp /src

RUN cmake -S /src -B /src/build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DWHISPER_BUILD_TESTS=OFF && \
    cmake --build /src/build --target whisper-server -j"$(nproc)"

# Stage 2: runtime
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=whisper-build /src/build/bin/whisper-server /usr/local/bin/whisper-server
COPY shim/server.js /app/server.js
COPY web/ /app/web/

ENV PORT=8081 \
    OW_MODEL=small \
    MODELS_DIR=/data/models

EXPOSE 8081

CMD ["node", "/app/server.js"]

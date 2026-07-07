# OpenWhispr STT Server

Headless, self-hosted speech-to-text server. Wraps [whisper.cpp](https://github.com/ggml-org/whisper.cpp)'s
`whisper-server` with a small zero-dependency Node shim that adds:

- **Bearer-token auth** (timing-safe compare)
- **OpenAI-compatible API**: `POST /v1/audio/transcriptions` (also `POST /audio/transcriptions`) —
  multipart `file` (+ optional `language`, `prompt`, `response_format`), returns `{"text": "..."}`
- **Raw whisper.cpp passthrough**: `POST /inference` (for clients that speak whisper.cpp's native API,
  e.g. the OpenWhispr desktop app's LAN mode)
- **Health**: `GET /health` (unauthenticated) — `{status, model, ready}`
- **Mobile PWA recorder** at `/` — record in Safari/Chrome, transcribe, copy
- **Automatic model download**: fetches the selected GGML model from HuggingFace into `MODELS_DIR`
  on first start

All transcription runs locally — audio never leaves the machine.

## Environment variables

| Variable          | Default        | Purpose                                              |
| ----------------- | -------------- | ---------------------------------------------------- |
| `OW_TOKEN`        | (required)     | Bearer token for the API                             |
| `OW_MODEL`        | `small`        | GGML model: `tiny`, `base`, `small`, `medium`, `large-v3-turbo` |
| `PORT`            | `8081`         | HTTP listen port                                     |
| `WHISPER_PORT`    | `8178`         | Loopback port for the whisper-server child           |
| `MODELS_DIR`      | `/data/models` | Where GGML models are stored (mount a volume here)   |
| `OW_LANGUAGE`     | `auto`         | Default transcription language                       |
| `WHISPER_THREADS` | (unset)        | Thread count for whisper.cpp                         |

## Build & run

```bash
docker build -t openwhispr-server .
docker run -p 8081:8081 -v openwhispr-models:/data \
  -e OW_TOKEN=changeme -e OW_MODEL=small openwhispr-server
```

## Example

```bash
curl -H "Authorization: Bearer changeme" \
  -F file=@recording.m4a \
  http://localhost:8081/v1/audio/transcriptions
# → {"text":" Hello world."}
```

This directory is the Docker build context for the
[openwhispr StartOS package](../README.md) in this repository.

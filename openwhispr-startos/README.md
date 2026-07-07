# openwhispr-startos

[StartOS](https://start9.com/) package for a fully local, self-hosted speech-to-text service —
whisper.cpp with an iPhone keyboard integration (via the [Diction](https://github.com/omachala/diction)
gateway), a mobile web recorder (PWA), and an OpenAI-compatible transcription API.

Inspired by (and API-compatible with) the [OpenWhispr](https://github.com/bitcoinRph/openwhispr)
desktop dictation app, whose local engine is the same whisper.cpp `whisper-server`.

## Architecture

One StartOS service, two images, two daemons sharing the service's network namespace:

```
iPhone Diction keyboard ──WS/REST──> [diction-gateway :8080] ──http localhost──┐
iPhone Safari PWA / iOS Shortcut ──REST──> [whisper shim + server :8081] <─────┘
OpenWhispr desktop / Open WebUI ──REST──> :8081
                     whisper.cpp whisper-server (loopback :8178, child of shim)
```

- **`server/`** — the speech-to-text engine image (Docker build context):
  whisper.cpp `whisper-server` (built from source, pinned tag) plus a zero-dependency Node shim
  providing bearer-token auth, `POST /v1/audio/transcriptions` (OpenAI-compatible),
  `POST /inference` (native whisper.cpp passthrough), `GET /health`, GGML model auto-download,
  and the mobile PWA recorder. See [server/README.md](./server/README.md).
- **`gateway`** — pinned [`ghcr.io/omachala/diction-gateway`](https://github.com/omachala/diction)
  image (MIT). Speaks the Diction iOS keyboard's WebSocket streaming protocol and forwards audio to
  the local engine (`CUSTOM_BACKEND_URL=http://localhost:8081`, auth header held server-side).
  Optional LLM cleanup can point at a local Ollama (`LLM_BASE_URL`/`LLM_MODEL`).
- **`startos/`** — the package definition: manifest (two images), two daemons with health checks,
  two interfaces (Web Recorder UI + Keyboard API), token generation on install, and actions
  (Get API Credentials, Select Whisper Model, Configure AI Cleanup).

All transcription runs locally with open Whisper GGML models (downloaded once from HuggingFace into
the service volume). Audio never leaves the server.

## Privacy / exposure notes

- The engine API (`:8081`) requires `Authorization: Bearer <token>` for all transcription endpoints.
- The Diction gateway (`:8080`) is unauthenticated in self-hosted mode (upstream's cloud auth is
  subscription-JWS based, not API-key based) — expose it on LAN/Tailscale/Tor only.

## Building

Requirements: docker, [start-cli](https://github.com/Start9Labs/start-cli), npm, make
(see the [packaging environment setup](https://github.com/bitcoinRph/ai-service-packaging)).

```bash
npm ci
npm run check     # TypeScript check
make              # build openwhispr.s9pk (x86_64)
make install      # or sideload the .s9pk via the StartOS UI
```

Notes:

- `x86_64` only: the published Diction gateway image is linux/amd64. (The gateway is open-source Go —
  building it from source for aarch64 is a possible future enhancement.)
- The whisper.cpp version is pinned via `ARG WHISPER_CPP_TAG` in [server/Dockerfile](./server/Dockerfile).
- First service start downloads the selected Whisper model (75 MB – 1.6 GB) into the `main` volume.

## Usage

See [instructions.md](./instructions.md) (also shown in the StartOS UI): Diction keyboard setup,
PWA install, an iOS Shortcut recipe, remote access options (LAN / Tailscale / Tor), OpenWhispr
desktop and Open WebUI integration, and optional Ollama-powered cleanup.

## License

[MIT](./LICENSE)

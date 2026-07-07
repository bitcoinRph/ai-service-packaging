# OpenWhispr STT Server

Private speech-to-text on your Start9 server, powered by [whisper.cpp](https://github.com/ggml-org/whisper.cpp).
**Everything runs locally** — Whisper models are downloaded once to your server, and your audio never
leaves it. No cloud transcription service is ever contacted.

First steps:

1. Run the **Get API Credentials** action and copy your API token.
2. Start the service. On first start it downloads the selected Whisper model (75 MB – 1.6 GB).
   Transcription becomes available when the download finishes (watch the service logs, or check
   `GET /health` on the Web Recorder address).
3. Optionally run **Select Whisper Model** to trade speed for accuracy (default: `small`).

## 1. iPhone keyboard (recommended) — dictate in any app

Get Wispr Flow–style dictation directly inside Telegram, iMessage, or any other app — for example to
talk to your Hermes Agent — backed entirely by your own server:

1. Install **Diction** from the App Store (free, iOS 17+).
2. In the Diction app: **Preferences → Mode → Self-Hosted**, and enter this service's **Keyboard API**
   address (shown on the service's Interfaces page).
3. iOS **Settings → General → Keyboard → Keyboards → Add New Keyboard → Diction**, then enable
   **Allow Full Access** (required for the keyboard to reach your server).
4. In any app, switch to the Diction keyboard, tap the mic, and dictate. The audio goes to your
   Start9, is transcribed by whisper.cpp, and the text is typed into the field.

The Diction gateway on this service runs open-source ([MIT](https://github.com/omachala/diction)).
It talks to the local whisper engine over localhost and holds your API token internally — you don't
need to enter the token in the Diction app.

> **Note**: the gateway endpoint itself accepts unauthenticated requests (Diction's self-hosted mode
> has no API-key slot — its cloud auth is subscription-based). Keep the Keyboard API address on your
> LAN, Tailscale, or Tor — don't port-forward it to the public internet. The transcription engine's
> own API (Web Recorder address) always requires your token.

## 2. Web Recorder (PWA)

1. Open the **Web Recorder** address in Safari on your iPhone.
2. Tap **Share → Add to Home Screen** to install it like an app.
3. On first use, paste your API token (from **Get API Credentials**) — it's remembered on the device.
4. Tap the mic to record, tap again to transcribe, then **Copy** and paste anywhere — e.g. into your
   Telegram or iMessage chat with Hermes.

## 3. iOS Shortcut (hands-free, Action Button / Back Tap)

Create a Shortcut that records, transcribes on your server, and copies the text:

1. **Record Audio** (tap to stop).
2. **Get Contents of URL**:
   - URL: `<Web Recorder address>/v1/audio/transcriptions`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer <your token>`
   - Request Body: **Form**, add field `file` (type File) = **Recorded Audio**
3. **Get Dictionary Value** — key `text`.
4. **Copy to Clipboard**.

Bind the Shortcut to the Action Button or Back Tap, dictate, then paste into any chat.

## 4. Reaching your server from your iPhone

- **At home (LAN)**: use the `.local` address. The Diction app and Shortcuts accept plain `http` on
  private networks; for the Web Recorder in Safari (microphone requires a secure context), use the
  `https` LAN address after installing your Start9 root CA on the iPhone.
- **Away from home**: **Tailscale is recommended** — install it on the iPhone and on StartOS, then use
  the Tailscale address everywhere (works for Diction, PWA, Shortcuts, and the desktop app).
- **Tor**: the `.onion` addresses work for the Web Recorder and Shortcuts through Orbot, but not for
  the Diction app or the OpenWhispr desktop app.

## 5. Other clients (all local)

- **OpenWhispr desktop app**: Settings → transcription mode **Self-Hosted**, base URL = the Web
  Recorder address, API key = your token. (Or "LAN" mode pointing at the same address — it uses the
  native whisper.cpp `/inference` endpoint.)
- **Open WebUI**: Admin Settings → Audio → Speech-to-Text → OpenAI-compatible, URL = `<Web Recorder
  address>/v1`, API key = your token. Voice input in Open WebUI then uses this server instead of
  OpenAI.
- **Anything that speaks the OpenAI transcription API**: `POST <Web Recorder address>/v1/audio/transcriptions`
  with `Authorization: Bearer <token>` and a multipart `file` field.

## 6. Optional: AI cleanup with your local Ollama

If you run Ollama on StartOS, run the **Configure AI Cleanup (optional)** action and enter your
Ollama endpoint (e.g. `http://<ollama-host>:11434/v1`) and a model name (e.g. `llama3.2`). The
Diction keyboard's "enhance" mode will then polish transcripts using your local LLM — still no cloud.

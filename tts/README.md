# Natural voice engine (runs on the device)

These files let the Quest Board speak with a natural-sounding AI voice, generated entirely
on the tablet. Nothing is sent to any server.

- `piper-bundle.js` — [@mintplex-labs/piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web) 1.0.4 (MIT),
  bundled with [onnxruntime-web](https://github.com/microsoft/onnxruntime) 1.18.0 (MIT).
  Patched to run single-threaded (GitHub Pages can't enable multi-threading) and to allow overriding the voice download address.
- `ort-wasm*.wasm` — onnxruntime-web 1.18.0 (MIT).
- `piper_phonemize.*` — [@diffusionstudio/piper-wasm](https://www.npmjs.com/package/@diffusionstudio/piper-wasm) 1.0.0 (MIT package; built from
  rhasspy/piper-phonemize and espeak-ng — see those projects for their licences).

Voices are [Piper](https://github.com/rhasspy/piper) voice models, downloaded once from Hugging Face
(`diffusionstudio/piper-voices`) and stored on the device. Each voice has its own licence, listed on its model card.

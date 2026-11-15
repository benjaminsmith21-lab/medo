// Runs the Kokoro voice off the main thread, so the board never freezes while it thinks.
import { KokoroTTS, env } from './kokoro.web.js';

let tts = null, loading = null, queue = Promise.resolve();

self.onmessage = (e) => {
  const d = e.data || {};
  if (d.type === 'load') {
    if (tts) { postMessage({ type: 'ready' }); return; }
    if (loading) return;
    env.wasmPaths = d.wasm;
    loading = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => {
        if (p && p.status === 'progress' && /\.onnx$/.test(p.file || '') && p.progress != null)
          postMessage({ type: 'progress', pct: Math.round(p.progress) });
      },
    }).then((t) => { tts = t; postMessage({ type: 'ready' }); })
      .catch((err) => { loading = null; postMessage({ type: 'error', msg: String((err && err.message) || err).slice(0, 120) }); });
    return;
  }
  if (d.type === 'say') {
    // one sentence at a time: the model can't run two at once
    queue = queue.then(async () => {
      try {
        const a = await tts.generate(d.text, { voice: d.voice });
        postMessage({ type: 'audio', id: d.id, blob: a.toBlob() });
      } catch (err) {
        postMessage({ type: 'fail', id: d.id });
      }
    });
  }
};

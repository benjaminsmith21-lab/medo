// Runs the Kokoro voice off the main thread, so the board never freezes while it thinks.
import { KokoroTTS, env } from './kokoro.web.js';

// Saved clips are kept on the device, so make them small: trim the silence at each end
// (keeping a short natural pause) and store 16-bit sound instead of 32-bit.
function wav16(a, sr) {
  const th = 0.008, pad = Math.round(sr * 0.12);
  let s = 0, e = a.length - 1;
  while (s < e && Math.abs(a[s]) < th) s++;
  while (e > s && Math.abs(a[e]) < th) e--;
  s = Math.max(0, s - pad); e = Math.min(a.length - 1, e + pad);
  const n = Math.max(0, e - s + 1), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, a[s + i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

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
        postMessage({ type: 'audio', id: d.id, blob: wav16(a.audio, a.sampling_rate) });
      } catch (err) {
        postMessage({ type: 'fail', id: d.id });
      }
    });
  }
};

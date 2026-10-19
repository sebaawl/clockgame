import { CLOCK_CLICK } from './clock-click.js';
import { BUTTON_AUDIO, TRANSITION_AUDIO } from './ui-audio.js';

// Clock feedback and UI use the real recordings supplied by the user.
export function createFeedback(getPreferences) {
  let context;
  let master;
  let recording;
  let successBuffer;
  const uiBuffers = new Map();
  const media = new Map();
  let lastUI = -Infinity;
  const voices = [];

  function vibrate(pattern) {
    if (!getPreferences().vibration || typeof navigator.vibrate !== 'function') return;
    try { navigator.vibrate(pattern); } catch { /* Browser-dependent. */ }
  }
  function unlock() {
    if (!getPreferences().sound) return null;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      // iOS otherwise routes Web Audio through the silent/ringer category.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      context ||= new Audio();
      if (!master) {
        master = context.createDynamicsCompressor();
        master.threshold.value = -20;
        master.knee.value = 12;
        master.ratio.value = 4;
        master.attack.value = .003;
        master.release.value = .09;
        master.connect(context.destination);
        const bytes = Uint8Array.from(atob(CLOCK_CLICK), char => char.charCodeAt(0));
        const pcm = new DataView(bytes.buffer);
        recording = context.createBuffer(1, bytes.length / 2, 22050);
        const samples = recording.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
      }
      if (context.state !== 'closed') context.resume().catch(() => {});
      return context;
    } catch { return null; }
  }
  function foley({ rate = .7, cutoff = 1200, volume = .25, length = .065 } = {}, delay = 0) {
    const audio = unlock();
    if (!audio) return;
    try {
      const now = audio.currentTime;
      while (voices.length && (voices[0].end <= now || voices.length >= 6)) {
        const old = voices.shift();
        if (old.end > now) {
          old.gain.gain.cancelScheduledValues(now);
          old.gain.gain.setTargetAtTime(0, now, .004);
          old.source.stop(now + .02);
        }
      }
      const source = audio.createBufferSource();
      const lowpass = audio.createBiquadFilter();
      const soften = audio.createBiquadFilter();
      const highpass = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = recording;
      source.playbackRate.value = rate;
      lowpass.type = soften.type = 'lowpass';
      lowpass.frequency.value = cutoff;
      soften.frequency.value = cutoff;
      lowpass.Q.value = soften.Q.value = .55;
      highpass.type = 'highpass';
      highpass.frequency.value = 80;
      highpass.Q.value = .5;
      const start = now + delay;
      const duration = Math.min(length, recording.duration / rate);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + .003);
      gain.gain.setValueAtTime(volume, start + duration * .5);
      gain.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(highpass).connect(lowpass).connect(soften).connect(gain).connect(master);
      voices.push({ source, gain, end: start + duration });
      source.onended = () => { source.disconnect(); highpass.disconnect(); lowpass.disconnect(); soften.disconnect(); gain.disconnect(); };
      source.start(start, 0, duration * rate);
    } catch { /* Optional audio never blocks play. */ }
  }
  function recordedWebAudio(name, delay = 0) {
    const audio = unlock();
    if (!audio) return;
    try {
      if (!uiBuffers.has(name)) {
        const bytes = Uint8Array.from(atob(name === 'button' ? BUTTON_AUDIO : TRANSITION_AUDIO), char => char.charCodeAt(0));
        const pcm = new DataView(bytes.buffer);
        const buffer = audio.createBuffer(1, bytes.length / 2, 22050);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
        uiBuffers.set(name, buffer);
      }
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      source.buffer = uiBuffers.get(name);
      gain.gain.value = name === 'button' ? .24 : .15;
      source.connect(gain).connect(master);
      const now = audio.currentTime;
      // Repeated navigation replaces its previous sound rather than stacking.
      for (let i = voices.length - 1; i >= 0; i--) {
        const old = voices[i];
        if (old.name === name || old.end <= now) {
          if (old.end > now) { old.gain.gain.setTargetAtTime(0, now, .006); old.source.stop(now + .025); }
          voices.splice(i, 1);
        }
      }
      voices.push({ name, source, gain, end: now + delay + source.buffer.duration });
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(now + delay);
    } catch { /* Optional feedback never blocks navigation. */ }
  }
  function recorded(name) {
    if (!getPreferences().sound) return;
    try {
      // Media playback works with the iPhone silent switch and standalone files.
      if (!media.has(name)) {
        const raw = Uint8Array.from(atob(name === 'button' ? BUTTON_AUDIO : TRANSITION_AUDIO), c => c.charCodeAt(0));
        const wav = new Uint8Array(44 + raw.length);
        const view = new DataView(wav.buffer);
        const text = (offset, value) => [...value].forEach((c, i) => { wav[offset + i] = c.charCodeAt(0); });
        text(0, 'RIFF'); view.setUint32(4, 36 + raw.length, true); text(8, 'WAVE');
        text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 22050, true); view.setUint32(28, 44100, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        text(36, 'data'); view.setUint32(40, raw.length, true);
        const input = new DataView(raw.buffer);
        const level = name === 'button' ? .4 : .24;
        for (let i = 0; i < raw.length; i += 2) view.setInt16(44 + i, Math.round(input.getInt16(i, true) * level), true);
        let binary = '';
        for (const byte of wav) binary += String.fromCharCode(byte);
        const player = new window.Audio('data:audio/wav;base64,' + btoa(binary));
        player.preload = 'auto';
        player.setAttribute('playsinline', '');
        media.set(name, player);
      }
      const player = media.get(name);
      player.currentTime = 0;
      // Start both samples inside the gesture: timers lose iOS playback permission.
      player.play()?.catch(() => recordedWebAudio(name));
    } catch { recordedWebAudio(name); }
  }
  function prime() {
    const audio = unlock();
    if (!audio) return;
    try {
      const source = audio.createBufferSource();
      source.buffer = audio.createBuffer(1, 1, audio.sampleRate);
      source.connect(audio.destination);
      source.start();
      source.onended = () => source.disconnect();
    } catch {}
  }
  for (const event of ['pointerdown', 'touchend', 'keydown']) {
    document.addEventListener(event, () => {
      if (!context || context.state !== 'running') prime();
    }, { capture: true, passive: true });
  }
  function success() {
    if (getPreferences().successSound === false) return;
    const audio = unlock();
    if (!audio) return;
    try {
      if (!successBuffer) {
        const duration = .26;
        successBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
        const samples = successBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          const t = i / audio.sampleRate;
          const envelope = Math.min(1, t / .012) * Math.exp(-t * 18) * (1 - t / duration);
          samples[i] = (Math.sin(2 * Math.PI * 660 * t) + .23 * Math.sin(2 * Math.PI * 990 * t)) * envelope * .16;
        }
      }
      const source = audio.createBufferSource();
      source.buffer = successBuffer;
      source.connect(master);
      source.onended = () => source.disconnect();
      source.start();
    } catch { /* Optional tone never blocks a solve. */ }
  }
  const profiles = {
    felt: { rate: .65, cutoff: 850, volume: .4, length: .075 },
    wood: { rate: .5, cutoff: 1000, volume: .4, length: .085 },
    clock: { rate: .85, cutoff: 1800, volume: .22, length: .065 },
  };
  function tick() { foley(profiles[getPreferences().soundPreset] || profiles.felt); }
  function ui(kind = 'press') {
    if (kind === 'success') { success(); return; }
    if (!getPreferences().sound || performance.now() - lastUI < 35) return;
    lastUI = performance.now();
    if (kind === 'slide') {
      // Keep the mode-selector sound exactly as approved.
      foley({ rate: .48, cutoff: 650, volume: .32, length: .085 });
      foley({ rate: .6, cutoff: 800, volume: .13, length: .05 }, .065);
    } else if (kind === 'loss') {
      foley({ rate: .45, cutoff: 900, volume: .22, length: .075 });
    } else {
      recorded('button');
      if (['open', 'close', 'transition'].includes(kind)) recorded('transition', .025);
    }
  }
  return {
    tap() { vibrate(8); tick(); },
    interrupt() { vibrate([24, 30, 58]); },
    unlock, ui, success, preview: tick,
    mute() { for (const player of media.values()) { player.pause(); player.currentTime = 0; } if (context?.state === 'running') context.suspend().catch(() => {}); },
  };
}

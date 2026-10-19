import menuOne from './assets/menu-theme-1.ogg?inline';
import menuTwo from './assets/menu-theme-2.ogg?inline';
import gameOne from './assets/game-theme-1.ogg?inline';
import gameTwo from './assets/game-theme-2.ogg?inline';

// One persistent graph keeps playlist playback and settings transitions smooth.
export function createMusic(getPreferences) {
  let context, filter, master, active = null;
  let newGame = false;
  let requested = null, submerged = false, hidden = false, previous = '';
  const tracks = Object.fromEntries(Object.entries({ menu: [menuOne, menuTwo], game: [gameOne, gameTwo] }).map(([name, urls]) => {
    const audio = new Audio();
    // Keep the chosen theme throughout this menu visit or game.
    audio.loop = true;
    audio.preload = 'none';
    audio.dataset.music = name;
    audio.hidden = true;
    document.body.append(audio);
    return [name, { audio, urls, gain: null, timer: null }];
  }));
  function chooseTrack(track) {
    const index = Math.floor(Math.random() * track.urls.length);
    track.audio.src = track.urls[index];
    track.audio.dataset.variant = String(index + 1);
    track.audio.load();
  }
  function ramp(param, value, seconds = .08) {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  }
  function apply() {
    if (!context) return;
    const prefs = getPreferences();
    const volume = prefs.sound && !hidden ? prefs.musicVolume : 0;
    const next = volume > 0 ? requested : null;
    const key = `${next}:${volume}:${submerged}`;
    if (key === previous) return;
    previous = key;
    ramp(master.gain, volume);
    ramp(filter.frequency, submerged ? 440 : 20000, .1);
    for (const [name, track] of Object.entries(tracks)) {
      clearTimeout(track.timer);
      ramp(track.gain.gain, name === next ? 1 : 0);
      if (name === next) {
        if (track.audio.paused) track.audio.play().catch(() => { previous = ''; });
      } else if (!track.audio.paused) {
        track.timer = setTimeout(() => { if (active !== name) track.audio.pause(); }, 420);
      }
    }
    active = next;
  }
  function unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext();
        filter = context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 20000; filter.Q.value = .7;
        master = context.createGain(); master.gain.value = 0;
        filter.connect(master); master.connect(context.destination);
        for (const track of Object.values(tracks)) {
          track.gain = context.createGain(); track.gain.gain.value = 0;
          context.createMediaElementSource(track.audio).connect(track.gain);
          track.gain.connect(filter);
        }
      }
      hidden = document.hidden;
      context.resume().catch(() => {});
      // Retry a blocked play on the next real interaction, without restarting a loop.
      previous = ''; apply();
    } catch { /* Audio remains optional on unsupported browsers. */ }
  }
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) {
      for (const track of Object.values(tracks)) track.audio.pause();
      previous = ''; apply();
    } else { previous = ''; apply(); }
  });
  window.addEventListener('clocking:pause', () => {
    hidden = true; previous = ''; apply();
    for (const track of Object.values(tracks)) track.audio.pause();
  });
  window.addEventListener('pagehide', () => { for (const track of Object.values(tracks)) track.audio.pause(); });
  return {
    sync(state, settingsOpen = false) {
      const next = state === 'menu' ? 'menu' : ['lost', 'won'].includes(state) ? null : 'game';
      if (next && (requested !== next || (next === 'game' && newGame))) chooseTrack(tracks[next]);
      if (next === 'game') newGame = false;
      requested = next;
      submerged = settingsOpen && requested === 'game';
      apply();
    },
    startRun() { newGame = true; },
    refresh() { previous = ''; apply(); },
  };
}

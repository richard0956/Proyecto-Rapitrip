let audio: AudioContext | null = null;

/**
 * Aviso de propuesta nueva con la app abierta: vibra y suena un «din-don» corto (generado, sin archivos). Los navegadores solo
 * dejan sonar después de que la persona tocó la pantalla al menos una vez; si aún no lo hizo, solo vibra. Devuelve si sonó.
 */
export async function playOfferAlert(): Promise<boolean> {
  try {
    navigator.vibrate?.([220, 120, 220]);
  } catch {
    // Sin vibración (iPhone o escritorio): solo el sonido.
  }
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return false;
    audio ??= new Context();
    if (audio.state === "suspended") await audio.resume();
    if (audio.state !== "running") return false;
    const start = audio.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.18, 1320],
    ] as const) {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start + offset);
      volume.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.32);
      tone.connect(volume).connect(audio.destination);
      tone.start(start + offset);
      tone.stop(start + offset + 0.34);
    }
    return true;
  } catch {
    return false;
  }
}

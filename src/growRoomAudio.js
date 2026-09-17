// src/growRoomAudio.js
// Tarea 34 del paquete E, re-derivada el 2026-09-14 sobre 0ee4555 (VERIFICACION §3 fila 5): el paquete la colgaba
// de cinco lineas que CREABAN T30/T31/T33, y esas tareas entraron con otros nombres, asi que la tarea quedo sin
// anclaje. Lo que si sigue en pie es el diseño de sintesis: ni un archivo de audio en public/, todo son osciladores
// y buffers, la misma tecnica que startStreetAmbience() usa para el viento de calle.
//
// Lo que NO hace, a proposito: crear un AudioContext. main.js ya tiene uno (streetAmbienceContext, el del viento)
// y un segundo contexto es un segundo hilo de audio, un segundo permiso de autoplay y dos relojes que no se hablan.
// Este modulo recibe ESE contexto y le cuelga un bus propio; el viento sigue en su gain de siempre (.026 al
// destino) y lo unico que este modulo le hace es ducearlo bajo techo, porque hoy sopla adentro del galpon.
//
// Cuatro voces, tres estados y dos cues:
//   balastro  dos sierras a 100 y 120,5 Hz por un lowpass de 340 Hz: baten a 20,5 Hz, que es como suena un cuarto
//             de balastros HPS y no una nota. Arrancan al construir y lo que sube y baja es la ganancia (0,016 en
//             ~0,18 s al entrar, a 0 al salir). Un fondo: no le tapa nada al juego.
//   agua      un buffer de ruido de 2 s en loop por un bandpass a 1400 Hz, gateado por un gain: mantener el boton
//             no crea nodos, solo abre la ganancia; soltar la cierra con una cola corta. Sigue a growPour, la sesion
//             de riego de I, la misma que T31 lee para el chorro de gotas.
//   tijera    dos clicks cuadrados 2400->1500 y 2750->1700 Hz de 45/40 ms, en los DOS picos del gesto trim de T30
//             (|sin(2 pi t)| con dos beats: 0,25 y 0,75 de 0,30 s = 0,075 y 0,225 s). El primero cae en el mismo
//             instante en que T33 suelta el cogollo (HARVEST_CUT_DELAY): se oye cerrar la tijera cuando se ve.
//   plantar   un golpe grave 190->62 Hz de 190 ms cuando la mano llega al fondo del gesto plant (attack 0,30 s).
//   viento    el gain de startStreetAmbience, inyectado: base afuera, 0 adentro, rampa de 0,25 s. Construido bajo
//             techo se corta al instante (el jugador que entro sin clickear no oye medio segundo de viento).
// El nivel es la perilla `sound` de growFxState: 0 apaga el bus con rampa corta, devuelve el viento a hoy y hace que
// los cues no fabriquen nodos; los setters son idempotentes (devuelven false sin reprogramar nada) porque el bucle
// de animate los llama cada frame con el estado derivado.
import { TOOL_GESTURES } from './growthAnimation.js';

export const HUM_GAIN = 0.016;
export const HUM_FREQUENCIES = Object.freeze([100, 120.5]);
export const HUM_CUTOFF = 340;
export const HUM_RAMP = 0.18;
export const POUR_GAIN = 0.045;
export const POUR_BAND = 1400;
export const POUR_Q = 0.7;
export const POUR_ATTACK = 0.05;
export const POUR_RELEASE = 0.09;
export const WIND_DUCK = 0.25;
export const LEVEL_RAMP = 0.05;
export const SNIP_TIMES = Object.freeze([0.25, 0.75].map(k => TOOL_GESTURES.trim.duration * k));
export const SNIP_CLICKS = Object.freeze([
  Object.freeze({ type: 'square', from: 2400, to: 1500, duration: 0.045, gain: 0.035 }),
  Object.freeze({ type: 'square', from: 2750, to: 1700, duration: 0.04, gain: 0.03 }),
]);
export const PLANT_DELAY = TOOL_GESTURES.plant.attack;
export const PLANT_THUD = Object.freeze({ type: 'sine', from: 190, to: 62, duration: 0.19, gain: 0.06 });

function makeNoiseBuffer(context, seconds) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = value * 0.62 + (Math.random() * 2 - 1) * 0.38;
    data[i] = value;
  }
  return buffer;
}

const isContext = context => !!context && ['createGain', 'createOscillator', 'createBiquadFilter', 'createBuffer', 'createBufferSource'].every(name => typeof context[name] === 'function');
const level01 = value => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; };

export function createGrowRoomAudio(context, { windGain = null, level = 1, room = false, outside = true } = {}) {
  if (!isContext(context)) return null;
  const now = () => context.currentTime || 0;
  const targets = { level: level01(level), room: !!room, outside: !!outside, pour: false };
  const windBase = windGain ? windGain.gain.value : null;
  const windTarget = () => (targets.level > 0 && !targets.outside ? 0 : windBase);

  const master = context.createGain();
  master.gain.value = targets.level;
  master.connect(context.destination);

  const humGain = context.createGain();
  humGain.gain.value = 0;
  const humFilter = context.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = HUM_CUTOFF;
  humFilter.connect(humGain).connect(master);
  for (const frequency of HUM_FREQUENCIES) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    oscillator.connect(humFilter);
    oscillator.start(0);
  }

  const pourSource = context.createBufferSource();
  pourSource.buffer = makeNoiseBuffer(context, 2);
  pourSource.loop = true;
  const pourFilter = context.createBiquadFilter();
  pourFilter.type = 'bandpass';
  pourFilter.frequency.value = POUR_BAND;
  pourFilter.Q.value = POUR_Q;
  const pourGain = context.createGain();
  pourGain.gain.value = 0;
  pourSource.connect(pourFilter).connect(pourGain).connect(master);
  pourSource.start(0);

  // Initial state without a ramp: the wind is cut where it should not blow, the hum rises like walking in.
  if (windGain) windGain.gain.value = windTarget();
  if (targets.room) humGain.gain.setTargetAtTime(HUM_GAIN, now(), HUM_RAMP);

  const applyWind = () => { if (windGain) windGain.gain.setTargetAtTime(windTarget(), now(), WIND_DUCK); };

  function blip({ type, from, to, duration, gain, delay = 0 }) {
    const start = now() + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  return {
    context,
    setLevel(value) {
      const next = level01(value);
      if (next === targets.level) return false;
      targets.level = next;
      master.gain.setTargetAtTime(next, now(), LEVEL_RAMP);
      applyWind();
      return true;
    },
    setRoom(inRoom) {
      inRoom = !!inRoom;
      if (inRoom === targets.room) return false;
      targets.room = inRoom;
      humGain.gain.setTargetAtTime(inRoom ? HUM_GAIN : 0, now(), HUM_RAMP);
      return true;
    },
    setOutside(outsideNow) {
      outsideNow = !!outsideNow;
      if (outsideNow === targets.outside) return false;
      targets.outside = outsideNow;
      applyWind();
      return true;
    },
    pour(active) {
      active = !!active;
      if (active === targets.pour) return false;
      targets.pour = active;
      pourGain.gain.setTargetAtTime(active ? POUR_GAIN : 0, now(), active ? POUR_ATTACK : POUR_RELEASE);
      return true;
    },
    plant() {
      if (targets.level <= 0) return 0;
      blip({ ...PLANT_THUD, delay: PLANT_DELAY });
      return 1;
    },
    snip() {
      if (targets.level <= 0) return 0;
      SNIP_CLICKS.forEach((click, i) => blip({ ...click, delay: SNIP_TIMES[i] }));
      return SNIP_CLICKS.length;
    },
    // Live values of the four gains, for __robinweedQA.audio() and the rig (AudioParam.value follows the automation).
    voices() {
      return { master: master.gain.value, hum: humGain.gain.value, pour: pourGain.gain.value, wind: windGain ? windGain.gain.value : null };
    },
    // What was last asked of each gain: deterministic, so a test or the rig can read the state without waiting a ramp.
    targets() {
      return { ...targets, hum: targets.room ? HUM_GAIN : 0, pourGain: targets.pour ? POUR_GAIN : 0, wind: windTarget() };
    },
  };
}

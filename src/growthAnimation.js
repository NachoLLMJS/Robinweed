// Matematica determinista de las animaciones del galpon de Stockdealer.
// Modulo puro: sin THREE, sin DOM, sin Date.now(). Todo valor entra por argumento, asi que la coreografia
// entera del cultivo se assertea con node:test y no hace falta una GPU para saber si esta bien.
//
// Nace con la Tarea 32 del paquete E (crecimiento visible y balanceo). Las Tareas 30/31/33/34/36 AGREGAN
// sus bloques al final de este archivo; nadie reescribe el de otro.
import { clamp01, damp, easeOutBack, easeOutCubic, easeInCubic, easeInOutSine, lerp } from './easing.js';

// ── Tarea 32: crecimiento visible y brisa ───────────────────────────────────

export const GROWTH_MORPH_SECONDS = 0.62;
export const BREEZE_SPEED = 1.35;

// Amplitud del balanceo por etapa, en unidades LOCALES de la geometria (el GLB de cada etapa mide 1.0 de
// alto en su propio espacio y el root lo escala a su targetHeight, asi que 0.018 en una vegetativa de
// 1,36 m son ~2,4 cm en pantalla). Las etapas 0 y 1 son solo una maceta: quietas, porque doblarlas
// moveria la maceta misma.
export const STAGE_SWAY = Object.freeze([0, 0, 0.010, 0.015, 0.018, 0.019]);

// El targetHeight que loadPlantStage() le da a cada etapa GLB. Sirve para que una etapa nueva arranque
// del tamano de la anterior en vez de aparecer de golpe. Un test lo re-deriva de main.js.
export const STAGE_HEIGHT = Object.freeze([0.5, 0.5, 0.72, 1.36, 1.52, 1.55]);

// Piso del morph cuando la perilla ?fx=2 (la lupa) exagera: por debajo de esto la planta no "crece",
// brota de la nada y se ve roto.
export const MIN_START_SCALE = 0.12;

export function swayAmplitudeForStage(stage) {
  return STAGE_SWAY[stage] ?? 0;
}

// exaggeration es la perilla fina `plantSway` de growFxState.js: 1 = el envio (la curva calibrada tal
// cual), 1.6 = la lupa de ?fx=2, 0 = apagada. Nunca invierte el morph ni baja del piso.
export function growStartScale(previousStage, stage, exaggeration = 1) {
  if (stage <= 1 || previousStage == null || previousStage >= stage) return 1;
  const start = clamp01(STAGE_HEIGHT[previousStage] / STAGE_HEIGHT[stage]);
  if (exaggeration === 1) return start;
  return Math.max(MIN_START_SCALE, clamp01(1 - (1 - start) * Math.max(0, exaggeration)));
}

export function growScale(startScale, progress) {
  if (startScale >= 1) return 1;
  return lerp(startScale, 1, easeOutBack(clamp01(progress), 1.28));
}

// Cada maceta respira en su propia fase: sin el desfase por indice las 14 plantas del galpon se mecerian
// como un solo objeto y se leeria como una textura animada, no como plantas.
export function breezePhase(timeSeconds, potIndex) {
  return timeSeconds * BREEZE_SPEED + potIndex * 1.37;
}

// ── Tarea 30: el gesto de la herramienta, uno por accion ────────────────────
// Hoy plantar, regar y cortar comparten UN solo movimiento: useTool() pone `toolKick=1` sin mirar el slot y
// el bucle lo gasta con una sola curva, `-sin(toolKick*PI)*.55` sobre rotation.x. El mismo giro seco de
// muneca de 0,55 rad y ~294 ms para las tres acciones. La herramienta ocupa un cuarto de pantalla y esta
// siempre a la vista: es la animacion que mas veces por sesion mira el jugador, y no dice nada.
//
// Cada gesto es una envolvente de dos tramos —ataque con easeOutCubic, vuelta con easeInOutSine— que
// multiplica tres canales independientes:
//   pitch  la punta de la herramienta baja (rotation.x, negativo = mira al piso)
//   roll   la herramienta se ladea (rotation.z), que es como se lee "estoy volcando la regadera"
//   push   se adelanta y baja en el espacio de la camara, o sea el brazo se estira hacia la maceta
// `beats` parte el roll en N golpes dentro de la MISMA envolvente: por eso el tijeretazo son dos cortes y
// no uno, sin necesidad de una segunda maquina de estados.
//
// duration/attack en segundos, pitch/roll en radianes, push en unidades de mundo.
export const TOOL_GESTURES = Object.freeze({
  swap: Object.freeze({ duration: 0.34, attack: 0.34, pitch: 0.30, roll: 0.00, push: 0.00, beats: 1 }),
  plant: Object.freeze({ duration: 0.62, attack: 0.30, pitch: 0.74, roll: -0.20, push: 0.13, beats: 1 }),
  water: Object.freeze({ duration: 0.40, attack: 0.26, pitch: 0.26, roll: 0.46, push: 0.05, beats: 1 }),
  trim: Object.freeze({ duration: 0.30, attack: 0.22, pitch: 0.20, roll: -0.34, push: 0.17, beats: 2 }),
});

// Cualquier tiempo por encima de la duracion mas larga deja la pose plana. Se usa como valor inicial para
// que la herramienta arranque en reposo y no con medio gesto a medio camino.
export const TOOL_GESTURE_REST = 9;

// exaggeration es la perilla fina `toolGesture` de growFxState.js: 0 = apagada (pose plana), 1 = el envio,
// 1.6 = la lupa de ?fx=2. Escala las AMPLITUDES y nunca los tiempos, asi que la comparacion 0/1/2 que hace
// Jose es sobre la forma del gesto y no sobre su velocidad.
export function toolGesturePose(gesture, elapsed, exaggeration = 1) {
  const spec = TOOL_GESTURES[gesture] || TOOL_GESTURES.swap;
  const t = clamp01(elapsed / spec.duration);
  const amount = t < spec.attack
    ? easeOutCubic(t / spec.attack)
    : 1 - easeInOutSine((t - spec.attack) / (1 - spec.attack));
  const chop = spec.beats > 1 ? Math.abs(Math.sin(Math.PI * spec.beats * t)) : 1;
  const gain = Math.max(0, exaggeration) * amount;
  // `noNegativeZero` no es cosmetica: con gain=0 (reposo, o la perilla en 0) `-0.74 * 0` da -0, y ese -0 viaja
  // hasta el hook toolPose() de QA, donde se lee como un gesto torcido que no existe.
  return {
    pitch: noNegativeZero(-spec.pitch * gain),
    roll: noNegativeZero(spec.roll * gain * chop),
    push: noNegativeZero(spec.push * gain),
    amount,
    done: t >= 1,
  };
}

function noNegativeZero(value) {
  return value === 0 ? 0 : value;
}

// ── Tarea 35a: los dos extractores dejan de estar clavados ──────────────────
// El galpon tiene dos extractores de 1,45 m colgados alto contra las paredes largas y son la unica
// maquinaria a la vista. Estan quietos, asi que el galpon se lee como una foto.
//
// El paquete decia "el GLB no tiene animacion, asi que el aspa hay que ponerla por codigo" y mandaba
// colgar un rotor de 4 paletas DELANTE de la rejilla. Medido vivo hoy sobre el juego, falta la mitad
// del dato: `exhaust-fan.glb` no trae animacion (animations 0, skins 0), pero SI trae las aspas
// modeladas, y es UNA sola malla de 11.619 triangulos con UN material. Union-find sobre la malla
// soldada por posicion da 2 componentes (11.579 + 40): las aspas estan fusionadas a la carcasa, no hay
// nodo que rotar ni forma limpia de recortarlas. Un rotor suelto delante de la rejilla se fotografio y
// se ven OCHO aspas, las nuevas girando y las viejas quietas.
//
// Por eso el rotor lleva TAPA: un disco opaco del tono de la garganta que esconde las aspas fusionadas,
// y las aspas moviles van delante de esa tapa, todavia por detras de la rejilla. Lo unico que se ve
// dentro de la carcasa es lo que gira.
//
// Las cotas salen de medir el prop vivo, no de aritmetica sobre el GLB: caja de mundo 0,7904 x 1,45 x
// 1,4503 con el origen del wrapper en su BASE (normalizeAsset apoya el modelo en y=0 y centra x/z), cara
// frontal a 0,3952 y rejilla a 0,346. El eje del rotor es el +Z LOCAL del wrapper, que en los dos
// ventiladores ya apunta a la sala: asi no hace falta aritmetica de mundo que se rompa el dia que un
// extractor vaya en otra pared.

export const FAN_SPEED = 15;             // rad/s del envio: 2,39 vueltas/s, ~9,5 pasadas de aspa por segundo
export const FAN_BLADES = 4;
export const FAN_HUB_RADIUS = 0.085;
export const FAN_BLADE_TIP = 0.53;
export const FAN_BLADE_ROOT_HALF = 0.05; // media cuerda en la raiz
export const FAN_BLADE_TIP_HALF = 0.115; // media cuerda en la punta: el aspa se ensancha hacia afuera
export const FAN_BLADE_SWEEP = 0.26;     // rad de flecha: la punta va atrasada respecto de la raiz
export const FAN_BLADE_PITCH = 0.36;     // rad de calaje: sin esto es una paleta plana y no muerde el aire
export const FAN_PLATE_RADIUS = 0.56;    // la tapa tiene que cubrir el disco que barren las aspas del GLB
export const FAN_PLATE_DEPTH = 0.235;
export const FAN_BLADE_DEPTH = 0.285;
export const FAN_ROTOR_LIFT = 0.725;     // medido: el wrapper del GLB apoya en su base
export const FAN_HALF_SIZE = 0.725;      // medido: media altura y medio ancho del marco
export const FAN_GUARD_DEPTH = 0.346;    // medido: la rejilla frontal
export const FAN_PLATE_COLOR = 0x161a16;
export const FAN_BLADE_COLOR = 0x7d8479;
export const FAN_HUB_COLOR = 0x4a5047;

// exaggeration es la perilla fina `fanSpin` de growFxState.js: 0 = apagada, 1 = el envio, 1.6 = la lupa
// de ?fx=2. El modulo evita que el angulo crezca sin techo y que un dt gigante de alt-tab lo saque de
// rango; sumar y envolver es exacto para cualquier tamano de paso, asi que no depende del frame rate.
export function fanAngle(previous, dt, exaggeration = 1) {
  const next = (previous + dt * FAN_SPEED * Math.max(0, exaggeration)) % (Math.PI * 2);
  return next < 0 ? next + Math.PI * 2 : next;
}

// Los cuatro vertices de un aspa en el marco LOCAL del rotor (z = eje, hacia la sala). Raiz angosta en
// el cubo, punta ancha, con flecha y calaje: es lo que separa un aspa de extractor de una paleta.
export function fanBladeQuad(index, blades = FAN_BLADES) {
  const base = (index / blades) * Math.PI * 2;
  const span = FAN_BLADE_TIP - FAN_HUB_RADIUS;
  const rise = Math.sin(FAN_BLADE_PITCH);
  const corners = [
    [FAN_HUB_RADIUS, -FAN_BLADE_ROOT_HALF],
    [FAN_BLADE_TIP, -FAN_BLADE_TIP_HALF],
    [FAN_BLADE_TIP, FAN_BLADE_TIP_HALF],
    [FAN_HUB_RADIUS, FAN_BLADE_ROOT_HALF],
  ];
  return corners.map(([radius, chord]) => {
    const angle = base + FAN_BLADE_SWEEP * ((radius - FAN_HUB_RADIUS) / span);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
      cos * radius - sin * chord,
      sin * radius + cos * chord,
      FAN_BLADE_DEPTH + rise * chord,
    ];
  });
}

// ── Tarea 31: el chorro mientras se mantiene el boton ───────────────────────
// Regar es la accion mas repetida del juego. Desde el paquete I mantener el boton abre una sesion
// (beginPour/holdPour/releasePour) que dura 2-4 segundos con recurso real, barra, franja verde,
// inundacion y veredicto al soltar... pero `spray()` se llama UNA sola vez, en el beginPour de useTool,
// y `holdPour` no lo vuelve a llamar nunca. El gesto dura segundos y el agua dura 0,59 s.
//
// Esto es SOLO el caudal: cuantas gotas emitir este frame. No decide nada de la mecanica —la humedad, el
// veredicto y la inundacion siguen siendo de wateringSession.js/moistureState.js— y no hay un segundo
// mantener-y-soltar en ningun lado (B-5 de la VERIFICACION 2026-09-14).
//
// La densidad no se invento: una gota vive 1/POUR_DROP_DECAY = 0,588 s, asi que emitir a POUR_DROP_RATE
// deja rate/decay ~= 14 gotas en el aire, que es exactamente el puff que el juego ya dibuja hoy en el
// primer frame. El chorro no es mas denso que lo que ya se ve: es lo mismo, sostenido.
export const POUR_BURST = 14;            // el puff de hoy, en gotas: el arranque del chorro
export const POUR_DROP_RATE = 24;        // gotas/s con la perilla en 1 -> 24/1,7 = 14,1 vivas en regimen
export const POUR_DROP_DECAY = 1.7;      // 1/s: la caida de opacidad de la gota, tal cual esta hoy en el bucle
export const POUR_DROPS_PER_FRAME = 3;   // tope duro por frame: cada gota es un draw call
export const POUR_DROPS_ALIVE = 40;      // tope duro de gotas vivas; el pico de ?fx=2 (36,6) queda debajo

// carry es el resto fraccionario del frame anterior: a 60 fps cada frame quiere 0,4 gotas y sin
// arrastrar el resto `floor()` daria CERO siempre. exaggeration es la perilla fina `pourStream`.
// alive son las particulas que ya estan en escena. Lo que un tope recorta se TIRA (carry 0): si se
// arrastrara, el frame siguiente a un alt-tab pagaria la deuda de golpe con una cascada.
export function pourDrops(carry = 0, dt = 0, exaggeration = 1, alive = 0) {
  const rate = POUR_DROP_RATE * Math.max(0, exaggeration > 0 ? exaggeration : 0);
  const held = carry > 0 ? carry : 0;
  if (!(rate > 0) || !(dt > 0)) return { carry: 0, drops: 0 };
  const room = Math.max(0, POUR_DROPS_ALIVE - (alive > 0 ? alive : 0));
  const budget = Math.min(POUR_DROPS_PER_FRAME, room);
  const wanted = held + dt * rate;
  if (!Number.isFinite(wanted)) return { carry: 0, drops: 0 };
  const due = Math.floor(wanted);
  const drops = Math.min(budget, due);
  return { carry: drops < due ? 0 : wanted - drops, drops };
}

// ── Tarea 33 RECORTADA: el cogollo se desprende ─────────────────────────────
// Hoy la planta madura desaparece en UN frame. El jugador da el tijeretazo y los cogollos que estuvo
// mirando crecer se evaporan junto con el tallo, sin transicion: lo unico que le dice que cosecho es un
// toast y un numero del HUD.
//
// Lo que NO entra (recorte medido, §3 fila 7 de la VERIFICACION 2026-09-14): el contador escalonado de
// 0,94 s del HUD que mandaba el paquete original. Hay un toast encima diciendo GRADE A · 24% THC, el HUD
// esta abajo a la derecha fuera del foco, y escalonar `state.buds` lo desfasaria contra el sistema de
// lotes que puso el paquete I, que suma en el acto. La aritmetica de la cosecha queda intacta.
//
// El vuelo arranca con un retardo igual al pico del PRIMER tijeretazo del gesto `trim` de la Tarea 30
// (t=0.25 de 0.30 s): el cogollo se suelta CUANDO la tijera cierra, no cuando el jugador aprieta.
export const HARVEST_FLIGHT_SECONDS = 0.58;
export const HARVEST_STAGGER_SECONDS = 0.09;
export const HARVEST_CUT_DELAY = TOOL_GESTURES.trim.duration * 0.25; // 0.075 s: el primer corte
export const HARVEST_END_SCALE = 0.22;
export const HARVEST_ARC = 0.18;   // el salto del corte, en metros; mas alto se lee como un globo
export const HARVEST_SPIN = 5.2;   // rad/s de volteo con la perilla en 1
// Tope duro de vuelos concurrentes. No es decorativo: es lo unico que acota el coste de esta tarea, y el
// paquete original no tenia ninguno (clonaba N cogollos por cosecha, sin techo). Con 4, el ultimo vuelo
// termina a los 0.925 s, o sea que la cosecha entera cabe en menos de un segundo.
export const HARVEST_FLIGHTS_MAX = 4;

export function harvestFlightProgress(elapsed, index = 0) {
  return clamp01((elapsed - HARVEST_CUT_DELAY - index * HARVEST_STAGGER_SECONDS) / HARVEST_FLIGHT_SECONDS);
}

// `to` se recalcula en mundo cada frame por el que llama, porque el destino viaja con la camara.
// exaggeration es la perilla fina `harvestCut` de growFxState.js: 0 = apagada, 1 = el envio, 1.6 = la
// lupa de ?fx=2. Como en las Tareas 30, 32 y 35a, escala AMPLITUDES y nunca tiempos: la comparacion que
// hace Jose entre 0, 1 y 2 es sobre la forma del salto, no sobre su velocidad.
export function harvestFlightPoint(from, to, progress, exaggeration = 1) {
  const t = clamp01(progress);
  // Salida lenta (easeInCubic: se suelta, no sale disparado) con llegada rapida (easeOutCubic).
  const eased = easeInCubic(t) * 0.35 + easeOutCubic(t) * 0.65;
  const arc = Math.sin(Math.PI * t) * HARVEST_ARC * Math.max(0, exaggeration);
  return {
    x: lerp(from.x, to.x, eased),
    y: lerp(from.y, to.y, eased) + arc,
    z: lerp(from.z, to.z, eased),
    // La escala usa easeInCubic sola: el cogollo conserva su tamano casi todo el trayecto y recien se
    // achica al final, cuando ya esta lejos. Con la curva mezclada se encogia en la mano del jugador.
    scale: lerp(1, HARVEST_END_SCALE, easeInCubic(t)),
  };
}

// ── Tarea 36a RECORTADA: la silueta cae por sed ─────────────────────────────
// La premisa del paquete original ("una planta sedienta y una lista se ven exactamente igual") es falsa
// desde el paquete I: growPaintPlant tiñe el follaje en cuatro bandas de humedad cada frame. Lo que NO
// existe es la SILUETA: el color ya esta ocupado señalando cuatro estados y la forma es el canal libre.
// Una planta seca al lado de una regada tiene que distinguirse a 2-3 m por como cae, no por el tinte.
//
// El input es pot.moisture, el recurso de moistureState.js, y el umbral es goodBandMin del preset: el
// mismo numero desde el que I deja de contar el tiempo como bien cuidado. NUNCA un thirstFor(wateredAt)
// (§3 fila 8 de la VERIFICACION 2026-09-14): seria un segundo modelo de sequedad en paralelo, y una
// maceta con moisture 95 y wateredAt viejo se veria caida y verde a la vez. Asi la silueta, el tinte y el
// careScore cuentan la misma historia: la planta que se cae es la que esta perdiendo puntos.
//
// Unidades: fraccion de la altura de la planta. Los seis GLB de etapa miden 1,0 de alto en su propio
// espacio y estan centrados en x/z (medido sobre los accessors POSITION: y de -0,5 a 0,5, x/z en ±0,43).
// En vegetative/flowering/mature la maceta ocupa del 0 al 30 % de la altura con r <= 0,28 y el follaje va
// del 30 % arriba con puntas en r 0,43-0,47: la mascara de T32 (pBase = 30 %) sirve tal cual. En
// sprout.glb la maceta sube hasta el 80 % (borde en 50-80 % con r 0,5): el brote NO cae, se le doblaria
// la maceta y no la planta. Sus hojas miden 2 cm; ahi el aviso es el tinte.
//
// Los tres terminos que main.js interpola en PLANT_BREEZE_CHUNK, sobre el slot uPlantLife.z que T32 dejo
// en 0 (cero geometria, cero materiales, cero draw calls: son cuatro lineas mas de vertex shader):
//   copa     el apice se hunde DROOP_CROWN, pesado con pMask² (la curva que T32 habia dejado en el slot)
//   hojas    cada vertice baja DROOP_LEAF x su distancia al tallo: la punta cae, la base de la hoja no,
//            que es como se lee "la hoja cuelga" y no "la planta se encoge"
//   plegado  x/z se cierran DROOP_FOLD hacia el tallo: la copa se angosta
// Los dos ultimos van con una mascara propia que arranca en pBase y llena DROOP_MASK_SPAN mas arriba:
// toda la copa cae, no solo el ultimo tercio, y la maceta sigue sin enterarse.
export const STAGE_DROOP = Object.freeze([0, 0, 0, 1, 1, 1]);
export const DROOP_CROWN = 0.04;      // 4 % de la altura: 5,4 cm en una vegetativa de 1,36 m
export const DROOP_LEAF = 0.35;       // en r 0,45 son 0,16 de altura: la punta de arriba baja ~27 cm contando la copa
export const DROOP_FOLD = 0.15;       // la copa se cierra un 15 %; con la lupa (x1,6) un 24 %, nunca colapsa
export const DROOP_MASK_SPAN = 0.3;   // del 30 % al 60 % de la altura
export const DROOP_SWAY_LOSS = 0.6;   // una planta laxa no ondea: el sway de T32 baja hasta el 40 %
export const WILT_RATE = 2.4;         // 1/s: el 90 % de la recuperacion al regar entra en ln(10)/2,4 = 0,96 s

// 0..1 a partir de la humedad y del preset. smoothstep para que el arranque en goodBandMin no tenga codo
// y el final en 0 tampoco: la humedad drena continua, la silueta tambien, sin saltos al cruzar de banda.
// Inundada (> MOISTURE_MAX) no cae: eso lo dice el tinte azul de I. goodBandMin 0 (legacy: la tierra no
// se seca) nunca cae. moisture ausente o NaN cuenta como tierra a 0, igual que moistureBand(pot.moisture??0).
export function thirstFor(moisture, config) {
  const onset = config?.goodBandMin;
  if (!(onset > 0)) return 0;
  const wet = moisture > 0 ? moisture : 0;
  const t = clamp01(1 - wet / onset);
  return t * t * (3 - 2 * t);
}

// El wilt es la sed AMORTIGUADA: al soltar el boton de regar pot.moisture salta y la planta tiene que
// levantarse, no teletransportarse. previous null = primer frame: arranca EN el objetivo, asi una partida
// restaurada con la tierra seca abre con la planta ya caida y no con un bajon de un segundo. La tasa es
// fija: la perilla ?fx escala amplitudes, nunca tiempos (misma doctrina que T30/T32/T33).
export function wiltStep(previous, target, dt) {
  const goal = clamp01(target);
  if (previous == null || !Number.isFinite(previous)) return goal;
  return clamp01(damp(previous, goal, WILT_RATE, dt));
}

export function droopForStage(stage) {
  return STAGE_DROOP[stage] ?? 0;
}

// Espejo en JS de las lineas GLSL de main.js, para asertar la geometria sin GPU. yFraction = altura del
// vertice sobre la planta (0 base de la maceta, 1 apice), reach = distancia al tallo en alturas de planta,
// wilt = uPlantLife.z (sed amortiguada x perilla). dy en alturas de planta, positivo = baja; fold es el
// factor que multiplica x/z.
export function droopOffset(yFraction, reach, wilt) {
  const base = 0.30;                                   // pBase de T32
  const mask = smoothstep(base, 1, yFraction);         // pMask de T32
  const wiltMask = smoothstep(base, base + DROOP_MASK_SPAN, yFraction);
  const sag = wilt > 0 ? wilt : 0;
  return {
    dy: sag * (DROOP_CROWN * mask * mask + DROOP_LEAF * (reach > 0 ? reach : 0) * wiltMask),
    fold: 1 - sag * wiltMask * DROOP_FOLD,
  };
}

// Multiplica la amplitud de brisa de T32. Satura en wilt 1: la lupa (?fx=2) no congela la planta.
export function wiltedSway(wilt) {
  return 1 - DROOP_SWAY_LOSS * clamp01(wilt);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ── Tarea 35b: motas de polvo en los conos de luz, SOLO en ?fx=2 ─────────────
// La otra mitad de la Tarea 35 (la primera son los extractores, mas arriba). El paquete pedia 13 motas
// lima por estacion x 8 = 104 puntos en UN THREE.Points, en espiral entre y=1,28 y 2,88 dentro de un
// radio de 0,18-0,80 alrededor de cada lampara: un draw call, algo que flota en el aire de cada cono.
//
// Lo que la VERIFICACION 2026-09-14 (§3 fila 9, §5.2) midio y cambia la entrega: el galpon YA tiene su
// item de "aire vivo", la neblina (MIST: 260 puntos aditivos cada 9 s sobre los rieles a y=0,95, perilla
// ?galpon default 2). El polvo compite en el mismo volumen y a la misma altura. Por eso la perilla fina
// `dust` va APAGADA en el envio (?fx=1) y encendida, calibrada y SIN lupa (1, no 1,6), solo en ?fx=2:
// Jose lo compara contra la neblina jugando y decide si se queda, si reemplaza o si se va. La excepcion
// esta declarada en growFxState.js (FX_COMPARE_ONLY), gemela de la del sonido (FX_UNMAGNIFIED).
//
// La espiral NO es la del paquete tal cual. El haz que se DIBUJA (growShaftGeometry, lightZoneState.js)
// mide 0,46 de medio ancho en el panel (y=3,06) y 1,48 en la mesa (y=0,86): una mota a r=0,80 a 5 cm de
// la lampara caeria en el aire, fuera del haz visible, y se leeria como una chispa suelta. Asi que el
// camino es un CONO: el radio base (0,18-0,78) vale en el pie de la subida y se pellizca a DUST_TOP_PINCH
// de si mismo en el techo. Medido contra el haz dibujado (barrido a 0,05 s, perillas 1 y 1,6): la mota mas
// lejana llega al 0,70 del ancho, radio maximo 0,78 en el pie y 0,31 en el techo (el haz mide 0,54 ahi).
//
// La subida usa `%` para envolver, y un `%` a secas hace "pop": la mota desaparece arriba y reaparece
// abajo. dustMoteWindow apaga el brillo en el primer y el ultimo DUST_FADE de la subida, y anula ahi
// mismo el bamboleo, que es lo que mantiene y dentro de [1,28, 2,88] con cualquier perilla.
//
// exaggeration es la perilla fina `dust` de growFxState.js: 0 = apagada, 1 = el envio del 2. Como en
// T30/T32/T33/T36a escala AMPLITUD (el bamboleo alrededor del riel, y en main.js la opacidad) y nunca
// tiempos: el riel —angulo, subida, parpadeo— es identico con 0, 1 y 1,6. Satura en DUST_WOBBLE_CAP para
// que ninguna perilla saque una mota del haz.

export const DUST_PER_STATION = 13;
export const DUST_BUDGET = 128;          // el buffer: 104 usados, el tope del plan
export const DUST_Y_MIN = 1.28;          // 42 cm sobre la mesa (0,86)
export const DUST_Y_SPAN = 1.6;          // hasta 2,88: 5 cm bajo la SpotLight (2,93), 18 cm bajo el panel (3,06)
export const DUST_RADIUS_MIN = 0.18;
export const DUST_RADIUS_MAX = 0.78;     // en el pie de la subida; con el bamboleo tope queda en 0,79 < 0,81
export const DUST_TOP_PINCH = 0.4;       // en el techo el radio es el 40 % del de abajo: 0,31 < 0,54 del haz
export const DUST_WOBBLE = 0.04;         // m de bamboleo con la perilla en 1
export const DUST_WOBBLE_CAP = 1.6;      // la perilla satura ahi: 6,4 cm por eje como mucho (5,7 cm en 3D con la perilla en 1)
export const DUST_FADE = 0.12;           // fraccion de la subida en la que la mota se enciende abajo y se apaga arriba
export const DUST_RISE_RATE = 0.045;     // m/s minimo: una subida de 1,6 m tarda 17-36 s
export const DUST_RISE_SPREAD = 0.05;
export const DUST_SPIN_RATE = 0.10;      // rad/s minimo: una vuelta cada 24-63 s
export const DUST_SPIN_SPREAD = 0.16;
export const DUST_SIZE = 0.016;          // ~3,4 px a 2 m en un canvas de 840 de alto
export const DUST_OPACITY = 0.55;
export const DUST_COLOR = 0xc4ff7e;      // lima, un paso mas claro que la luz de cultivo (0xb6ff74): una mota iluminada

// Azar determinista por indice, como drop01 de la neblina: dos cargas dan la misma nube y el test la mide.
function dustHash(x) {
  const v = Math.sin(x) * 43758.5453;
  return v - Math.floor(v);
}

function dustSeed(index) {
  return { a: dustHash(index * 3.11 + 0.5), b: dustHash(index * 7.37 + 1.7), c: dustHash(index * 5.13 + 4.2) };
}

// 0..1 a lo largo de la subida. No toma la perilla: es el reloj de la mota.
export function dustMoteClimb(index, timeSeconds) {
  const { b, c } = dustSeed(index);
  const rise = (c * DUST_Y_SPAN + timeSeconds * (DUST_RISE_RATE + b * DUST_RISE_SPREAD)) % DUST_Y_SPAN;
  return (rise < 0 ? rise + DUST_Y_SPAN : rise) / DUST_Y_SPAN;
}

// 0 en el pie y en el techo de la subida, 1 en el medio: apaga el brillo y el bamboleo en los bordes.
export function dustMoteWindow(up) {
  return smoothstep(0, DUST_FADE, up) * (1 - smoothstep(1 - DUST_FADE, 1, up));
}

// La mota `index` (GLOBAL: estacion x 13 + i, asi dos estaciones no repiten la nube) en el instante t,
// en mundo, alrededor de la lampara de `station`.
export function dustMotePosition(index, timeSeconds, station, exaggeration = 1) {
  const { a, b, c } = dustSeed(index);
  const up = dustMoteClimb(index, timeSeconds);
  const angle = a * Math.PI * 2 + timeSeconds * (DUST_SPIN_RATE + c * DUST_SPIN_SPREAD);
  const gain = Math.min(DUST_WOBBLE_CAP, Math.max(0, exaggeration));
  const wobble = DUST_WOBBLE * gain * dustMoteWindow(up);
  const radius = (DUST_RADIUS_MIN + b * (DUST_RADIUS_MAX - DUST_RADIUS_MIN)) * (1 - (1 - DUST_TOP_PINCH) * up)
    + wobble * Math.sin(timeSeconds * 1.3 + a * 7);
  return {
    x: station.x + Math.cos(angle) * radius,
    y: DUST_Y_MIN + up * DUST_Y_SPAN + wobble * Math.sin(timeSeconds * 0.9 + b * 5),
    z: station.z + Math.sin(angle) * radius,
  };
}

// Brillo 0..1 de la mota: un parpadeo lento (una mota que gira recoge la luz y la suelta) por la ventana
// de la subida. main.js lo escribe como color de vertice gris; el lima lo pone el material.
export function dustMoteGlow(index, timeSeconds) {
  const { a } = dustSeed(index);
  const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(timeSeconds * 1.7 + a * 12.9));
  return twinkle * dustMoteWindow(dustMoteClimb(index, timeSeconds));
}

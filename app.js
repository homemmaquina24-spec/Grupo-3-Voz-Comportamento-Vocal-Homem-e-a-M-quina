"use strict";

/*
 * ============================================================
 * VOZ DA MÁQUINA
 * Grupo 3 — Voz & Comportamento Vocal
 * ============================================================
 *
 * Arquitetura:
 *
 * Máquina
 *   ↓
 * Voice Engine
 *   ↓
 * Speech Preparation
 *   ↓
 * Voice Profile
 *   ↓
 * Provider Adapter
 *   ↓
 * Provider de voz
 *
 * IMPORTANTE:
 *
 * O provider NÃO controla a personalidade vocal da Máquina.
 *
 * A nossa lógica controla:
 * - ritmo
 * - pausas
 * - intensidade
 * - ênfase
 * - segmentação
 * - pronúncia
 * - estados
 * - interrupção
 * - eventos
 *
 * O provider fornece o áudio da voz.
 * ============================================================
 */


/* ============================================================
 * 1. ESTADOS OFICIAIS
 * ============================================================
 */

const VOICE_STATES = Object.freeze({

  IDLE: "IDLE",

  LISTENING: "LISTENING",

  THINKING: "THINKING",

  SPEAKING: "SPEAKING",

  INTERRUPTED: "INTERRUPTED",

  ERROR: "ERROR"

});


/* ============================================================
 * 2. EVENTOS OFICIAIS
 * ============================================================
 */

const VOICE_EVENTS = Object.freeze({

  LISTEN_START: "listen.start",
  LISTEN_END: "listen.end",

  THINKING_START: "thinking.start",
  THINKING_PAUSE: "thinking.pause",
  THINKING_END: "thinking.end",

  VOICE_START: "voice.start",
  VOICE_SEGMENT: "voice.segment",
  VOICE_PAUSE: "voice.pause",
  VOICE_END: "voice.end",

  VOICE_INTERRUPTED: "voice.interrupted",

  ERROR: "error"

});


/* ============================================================
 * 3. PERFIS DAS QUATRO VOZES
 * ============================================================
 *
 * Uma Máquina.
 * Quatro manifestações vocais.
 *
 * Núcleo é a voz padrão.
 * ============================================================
 */

const VOICE_PROFILES = Object.freeze({

  nucleus: Object.freeze({
    id: "V01",
    name: "Núcleo",
    providerVoice: "Duarte",
    language: "pt-PT",

    description:
      "Masculina, profunda, calma, segura, inteligente e próxima.",

    default: true
  }),

  iris: Object.freeze({
    id: "V02",
    name: "Íris",
    providerVoice: "Raquel",
    language: "pt-PT",

    description:
      "Feminina, suave, inteligente, próxima e atenta.",

    default: false
  }),

  vertex: Object.freeze({
    id: "V03",
    name: "Vértice",
    providerVoice: "Antônio",
    language: "pt-BR",

    description:
      "Masculina, firme, precisa, analítica e controlada.",

    default: false
  }),

  echoes: Object.freeze({
    id: "V04",
    name: "Ecos",
    providerVoice: "Francisca",
    language: "pt-BR",

    description:
      "Feminina, serena, grave, reservada e misteriosa.",

    default: false
  })

});


/* ============================================================
 * 4. CONFIGURAÇÃO ATUAL
 * ============================================================
 */

const VoiceConfig = {

  preferredVoice: "nucleus",

  automaticVoiceSwitching: true,

  provider: "freetts",

  naturalnessPriority: true

};


/* ============================================================
 * 5. PRONUNCIATION DICTIONARY
 * ============================================================
 *
 * Não vamos inventar pronúncias.
 *
 * Os termos entram aqui somente depois de serem validados
 * através de áudio real.
 * ============================================================
 */

const PronunciationDictionary = {

  entries: new Map(),

  add(entry) {

    if (!entry || !entry.original) {
      throw new Error(
        "Entrada de pronúncia inválida."
      );
    }

    this.entries.set(
      entry.original,
      {
        original: entry.original,
        spoken: entry.spoken || entry.original,
        context: entry.context || "",
        voices: entry.voices || [],
        validated: Boolean(entry.validated)
      }
    );
  },

  get(text) {

    return this.entries.get(text);

  },

  prepare(text) {

    let result = text;

    for (const entry of this.entries.values()) {

      if (!entry.validated) {
        continue;
      }

      result = result.split(entry.original)
        .join(entry.spoken);
    }

    return result;
  }

};


/* ============================================================
 * 6. SPEECH PREPARATION
 * ============================================================
 *
 * Texto
 * ↓
 * análise
 * ↓
 * segmentação
 * ↓
 * ritmo
 * ↓
 * pausas
 * ↓
 * intensidade
 * ↓
 * ênfase
 * ↓
 * pronúncia
 *
 * Esta camada NÃO gera áudio.
 * ============================================================
 */

const SpeechPreparation = {

  prepare(text, intent = "normal") {

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      throw new Error(
        "Não existe texto válido para preparar."
      );
    }

    const pronunciationText =
      PronunciationDictionary.prepare(text.trim());

    const segments =
      this.segmentText(pronunciationText);

    return {

      originalText: text,

      text: pronunciationText,

      intent,

      segments,

      rhythm: this.determineRhythm(
        pronunciationText,
        intent
      ),

      intensity: this.determineIntensity(
        pronunciationText,
        intent
      )

    };
  },


  segmentText(text) {

    /*
     * Segmentação por ideias.
     *
     * Não fazemos uma pausa entre cada palavra.
     */

    const matches = text.match(
      /[^.!?…]+[.!?…]*/g
    );

    if (!matches) {
      return [text.trim()];
    }

    return matches
      .map(segment => segment.trim())
      .filter(Boolean);
  },


  determineRhythm(text, intent) {

    if (intent === "reflection") {
      return "slow";
    }

    if (intent === "important") {
      return "controlled";
    }

    if (text.length > 180) {
      return "controlled";
    }

    return "natural";
  },


  determineIntensity(text, intent) {

    if (intent === "important") {
      return "medium-high";
    }

    if (intent === "reflection") {
      return "low";
    }

    return "medium";
  }

};


/* ============================================================
 * 7. PROVIDER ADAPTER
 * ============================================================
 *
 * Esta camada separa o Voice Engine do provider.
 *
 * O restante do sistema não precisa saber como o provider
 * funciona internamente.
 * ============================================================
 */

class VoiceProviderAdapter {

  constructor(name) {

    this.name = name;

  }


  async synthesize(request) {

    throw new Error(
      `Provider "${this.name}" ainda não foi ligado.`
    );

  }


  stop() {

    return false;

  }

}


/* ============================================================
 * 8. FREE TTS ADAPTER
 * ============================================================
 *
 * Estrutura preparada.
 *
 * A implementação real da API será adicionada depois,
 * sem alterar Voice Engine, estados ou preparação vocal.
 * ============================================================
 */

class FreeTTSAdapter extends VoiceProviderAdapter {

  constructor() {

    super("freetts");

  }


  async synthesize(request) {

    /*
     * Ponto de integração do FreeTTS.
     *
     * request terá:
     *
     * {
     *   text,
     *   voice,
     *   language,
     *   rhythm,
     *   intensity,
     *   segments
     * }
     *
     * A API real será ligada aqui.
     */

    throw new Error(
      "FreeTTS ainda não está conectado ao endpoint de áudio."
    );

  }


  stop() {

    /*
     * A interrupção real será implementada aqui.
     */

    return true;

  }

}


/* ============================================================
 * 9. EVENT BUS
 * ============================================================
 *
 * Permite que Grupo 3 comunique estados semanticamente
 * ao Grupo 2.
 *
 * Grupo 3 NÃO diz:
 *
 *     "deixa o núcleo vermelho"
 *
 * Grupo 3 diz:
 *
 *     "listen.start"
 *
 * Grupo 2 decide a representação visual.
 * ============================================================
 */

class VoiceEventBus {

  constructor() {

    this.listeners = new Map();

  }


  on(event, callback) {

    if (!this.listeners.has(event)) {

      this.listeners.set(
        event,
        new Set()
      );

    }

    this.listeners
      .get(event)
      .add(callback);

  }


  emit(event, payload = {}) {

    const callbacks =
      this.listeners.get(event);

    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {

      try {

        callback({
          event,
          ...payload
        });

      } catch (error) {

        console.error(
          "Erro no listener:",
          error
        );

      }

    }

  }

}


/* ============================================================
 * 10. VOICE ENGINE
 * ============================================================
 */

class VoiceEngine {

  constructor({

    provider,

    eventBus,

    config

  }) {

    this.provider = provider;

    this.eventBus = eventBus;

    this.config = config;

    this.state = VOICE_STATES.IDLE;

    this.currentVoice =
      config.preferredVoice;

    this.currentAudio = null;

    this.requestId = 0;

  }


  getState() {

    return this.state;

  }


  getVoiceProfile() {

    return VOICE_PROFILES[
      this.currentVoice
    ];

  }


  setState(state) {

    this.state = state;

    updateInterface({
      state: this.state,
      voice: this.getVoiceProfile().name,
      provider: this.provider.name
    });

  }


  emit(event, payload = {}) {

    this.eventBus.emit(
      event,
      payload
    );

    logEvent(
      event,
      payload
    );

  }


  async speak(
    text,
    intent = "normal"
  ) {

    const requestId =
      ++this.requestId;

    try {

      if (
        !text ||
        !text.trim()
      ) {
        return;
      }


      /*
       * Se a Máquina estiver falando,
       * uma nova fala substitui a anterior
       * somente através do fluxo de interrupção.
       */

      if (
        this.state ===
        VOICE_STATES.SPEAKING
      ) {

        this.interrupt();

      }


      this.setState(
        VOICE_STATES.THINKING
      );

      this.emit(
        VOICE_EVENTS.THINKING_START
      );


      const prepared =
        SpeechPreparation.prepare(
          text,
          intent
        );


      this.emit(
        VOICE_EVENTS.THINKING_END
      );


      if (
        requestId !== this.requestId
      ) {
        return;
      }


      const profile =
        this.getVoiceProfile();


      this.setState(
        VOICE_STATES.SPEAKING
      );


      this.emit(
        VOICE_EVENTS.VOICE_START,
        {
          voice: profile.id,
          voiceName: profile.name
        }
      );


      /*
       * Cada segmento representa uma ideia,
       * não uma palavra.
       */

      for (
        let index = 0;
        index < prepared.segments.length;
        index++
      ) {

        if (
          requestId !== this.requestId
        ) {
          return;
        }


        const segment =
          prepared.segments[index];


        this.emit(
          VOICE_EVENTS.VOICE_SEGMENT,
          {
            index,
            total:
              prepared.segments.length,
            text: segment,
            rhythm:
              prepared.rhythm,
            intensity:
              prepared.intensity
          }
        );


        /*
         * Aqui será chamada a síntese real.
         *
         * Por enquanto a arquitetura está pronta,
         * mas não fingimos que existe áudio.
         */

        await this.synthesizeSegment({

          text: segment,

          profile,

          preparation: prepared

        });


        if (
          index <
          prepared.segments.length - 1
        ) {

          this.emit(
            VOICE_EVENTS.VOICE_PAUSE,
            {
              reason:
                "segment-transition"
            }
          );

        }

      }


      if (
        requestId !== this.requestId
      ) {
        return;
      }


      this.emit(
        VOICE_EVENTS.VOICE_END
      );


      this.setState(
        VOICE_STATES.IDLE
      );


    } catch (error) {

      console.error(
        "Voice Engine:",
        error
      );


      this.setState(
        VOICE_STATES.ERROR
      );


      this.emit(
        VOICE_EVENTS.ERROR,
        {
          message:
            "Não foi possível concluir a fala."
        }
      );


      this.setState(
        VOICE_STATES.IDLE
      );

    }

  }


  async synthesizeSegment(request) {

    /*
     * Ponto único onde o Voice Engine pede
     * áudio ao provider.
     */

    return this.provider.synthesize(
      request
    );

  }


  interrupt() {

    this.requestId++;


    this.provider.stop();


    this.emit(
      VOICE_EVENTS.VOICE_INTERRUPTED
    );


    this.setState(
      VOICE_STATES.INTERRUPTED
    );


    /*
     * Depois da interrupção,
     * a Máquina passa imediatamente para escuta.
     */

    this.startListening();

  }


  startListening() {

    this.setState(
      VOICE_STATES.LISTENING
    );


    this.emit(
      VOICE_EVENTS.LISTEN_START
    );

  }


  stopListening() {

    this.emit(
      VOICE_EVENTS.LISTEN_END
    );


    this.setState(
      VOICE_STATES.IDLE
    );

  }

}


/* ============================================================
 * 11. INSTÂNCIAS PRINCIPAIS
 * ============================================================
 */

const eventBus =
  new VoiceEventBus();


const provider =
  new FreeTTSAdapter();


const voiceEngine =
  new VoiceEngine({

    provider,

    eventBus,

    config: VoiceConfig

  });


/* ============================================================
 * 12. EVENTOS DE TESTE
 * ============================================================
 */

eventBus.on(
  VOICE_EVENTS.VOICE_START,
  event => {

    console.log(
      "Máquina começou a falar:",
      event
    );

  }
);


eventBus.on(
  VOICE_EVENTS.VOICE_SEGMENT,
  event => {

    console.log(
      "Segmento vocal:",
      event
    );

  }
);


eventBus.on(
  VOICE_EVENTS.VOICE_PAUSE,
  event => {

    console.log(
      "Pausa vocal:",
      event
    );

  }
);


eventBus.on(
  VOICE_EVENTS.VOICE_END,
  event => {

    console.log(
      "Máquina terminou de falar."
    );

  }
);


eventBus.on(
  VOICE_EVENTS.LISTEN_START,
  event => {

    console.log(
      "Máquina está ouvindo."
    );

  }
);


eventBus.on(
  VOICE_EVENTS.VOICE_INTERRUPTED,
  event => {

    console.log(
      "Fala interrompida."
    );

  }
);


/* ============================================================
 * 13. INTERFACE DE TESTE
 * ============================================================
 */

const speechInput =
  document.getElementById(
    "speech-input"
  );


const speakButton =
  document.getElementById(
    "speak-button"
  );


const stopButton =
  document.getElementById(
    "stop-button"
  );


if (speakButton) {

  speakButton.addEventListener(
    "click",
    async () => {

      const text =
        speechInput.value.trim();


      if (!text) {
        return;
      }


      await voiceEngine.speak(
        text
      );

    }
  );

}


if (stopButton) {

  stopButton.addEventListener(
    "click",
    () => {

      voiceEngine.interrupt();

    }
  );

}


/* ============================================================
 * 14. FUNÇÕES DA INTERFACE
 * ============================================================
 */

function updateInterface({

  state,
  voice,
  provider

}) {

  const stateElement =
    document.getElementById(
      "voice-state"
    );

  const voiceElement =
    document.getElementById(
      "voice-profile"
    );

  const providerElement =
    document.getElementById(
      "voice-provider"
    );


  if (stateElement) {
    stateElement.textContent =
      state;
  }


  if (voiceElement) {
    voiceElement.textContent =
      voice;
  }


  if (providerElement) {
    providerElement.textContent =
      provider;
  }

}


function logEvent(
  event,
  payload
) {

  const log =
    document.getElementById(
      "event-log"
    );


  if (!log) {
    return;
  }


  const time =
    new Date()
      .toLocaleTimeString();


  const line =
    `[${time}] ${event}`;


  const details =
    Object.keys(payload).length
      ? ` ${JSON.stringify(payload)}`
      : "";


  if (
    log.textContent ===
    "Aguardando..."
  ) {

    log.textContent = "";

  }


  log.textContent +=
    `${line}${details}\n`;


  log.scrollTop =
    log.scrollHeight;

}


/* ============================================================
 * 15. ESTADO INICIAL
 * ============================================================
 */

updateInterface({

  state:
    voiceEngine.getState(),

  voice:
    voiceEngine
      .getVoiceProfile()
      .name,

  provider:
    provider.name

});


console.log(
  "Voz da Máquina — Voice Engine inicializado."
);

/*
 * ============================================================
 * GRUPO 3 — VOZ DA MÁQUINA
 * Voice Engine — Fundação
 * ============================================================
 *
 * PRINCÍPIO:
 * A Máquina controla o comportamento vocal.
 * O provider apenas fornece a voz.
 *
 * Pipeline:
 *
 * Texto
 *   ↓
 * Análise
 *   ↓
 * Intenção
 *   ↓
 * Segmentação
 *   ↓
 * Ritmo
 *   ↓
 * Pausas
 *   ↓
 * Intensidade / Ênfase
 *   ↓
 * Pronúncia
 *   ↓
 * Perfil da Voz
 *   ↓
 * Provider
 *   ↓
 * Áudio
 *
 * FreeTTS não decide:
 * - ritmo
 * - pausas
 * - intensidade
 * - pronúncia
 * - comportamento
 * - estados
 * ============================================================
 */


/* ============================================================
   ESTADOS OFICIAIS
   ============================================================ */

const VOICE_STATES = Object.freeze({
  IDLE: "IDLE",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  SPEAKING: "SPEAKING",
  INTERRUPTED: "INTERRUPTED",
  ERROR: "ERROR"
});


/* ============================================================
   EVENTOS OFICIAIS
   ============================================================ */

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
   PERFIS OFICIAIS DA MÁQUINA
   ============================================================ */

const VOICE_PROFILES = Object.freeze({

  nucleus: Object.freeze({
    id: "V01",
    name: "Núcleo",

    gender: "masculine",

    providerVoice: "Pedro Pinto",
    providerLanguage: "pt-PT",

    role: "default",

    characteristics: Object.freeze({
      depth: "deep",
      brightness: "moderate",
      roughness: "low",
      softness: "moderate",
      presence: "secure",
      proximity: "close",
      resonance: "controlled",
      naturalness: "high",
      age: "adult"
    }),

    behavior: Object.freeze({
      rhythm: "moderate-variable",
      speed: "conversational-controlled",
      intensity: "controlled",
      pauses: "meaningful"
    })
  }),


  iris: Object.freeze({
    id: "V02",
    name: "Íris",

    gender: "feminine",

    providerVoice: "Ana Andrade",
    providerLanguage: "pt-PT",

    role: "attention",

    characteristics: Object.freeze({
      depth: "moderate",
      brightness: "soft",
      roughness: "low",
      softness: "high",
      presence: "warm",
      proximity: "close",
      resonance: "light",
      naturalness: "high",
      age: "adult"
    }),

    behavior: Object.freeze({
      rhythm: "fluid-variable",
      speed: "conversational",
      intensity: "soft-controlled",
      pauses: "short-meaningful"
    })
  }),


  vertex: Object.freeze({
    id: "V03",
    name: "Vértice",

    gender: "masculine",

    providerVoice: "Marcos Batista",
    providerLanguage: "pt-BR",

    role: "analysis",

    characteristics: Object.freeze({
      depth: "moderate-deep",
      brightness: "controlled",
      roughness: "low",
      softness: "low-moderate",
      presence: "firm",
      proximity: "clear",
      resonance: "controlled",
      naturalness: "high",
      age: "adult"
    }),

    behavior: Object.freeze({
      rhythm: "organized-variable",
      speed: "controlled",
      intensity: "stable",
      pauses: "structuring"
    })
  }),


  echoes: Object.freeze({
    id: "V04",
    name: "Ecos",

    gender: "feminine",

    providerVoice: "Aline Dos Santos",
    providerLanguage: "pt-BR",

    providerVariant: "AWS",

    role: "special",

    characteristics: Object.freeze({
      depth: "grave",
      brightness: "low-moderate",
      roughness: "low",
      softness: "moderate",
      presence: "serene",
      proximity: "close",
      resonance: "deep-controlled",
      naturalness: "high",
      age: "adult"
    }),

    behavior: Object.freeze({
      rhythm: "slow-when-needed",
      speed: "moderate-slow-contextual",
      intensity: "low-moderate",
      pauses: "intentional"
    })
  })

});


/* ============================================================
   CONFIGURAÇÃO DA VOZ
   ============================================================ */

class VoiceConfig {

  constructor() {

    this.preferredVoice = "nucleus";

    this.automaticVoiceSwitching = true;

    /*
     * O provider atual é FreeTTS.
     * O restante do comportamento pertence à Máquina.
     */
    this.provider = "freetts";

    this.naturalnessPriority = true;
  }


  getPreferredProfile() {

    return VOICE_PROFILES[this.preferredVoice]
      || VOICE_PROFILES.nucleus;
  }
}


/* ============================================================
   DICIONÁRIO DE PRONÚNCIA
   ============================================================ */

class PronunciationDictionary {

  constructor() {

    this.entries = new Map();
  }


  add(original, spoken, options = {}) {

    if (!original || !spoken) {
      return false;
    }

    this.entries.set(original, {
      original,
      spoken,
      context: options.context || "general",
      voices: options.voices || null,
      validated: options.validated === true
    });

    return true;
  }


  get(text) {

    return this.entries.get(text) || null;
  }


  prepare(text, voiceProfile = null) {

    if (!text) {
      return "";
    }

    let result = text;

    for (const entry of this.entries.values()) {

      if (!entry.validated) {
        continue;
      }

      if (
        entry.voices &&
        voiceProfile &&
        !entry.voices.includes(voiceProfile.id)
      ) {
        continue;
      }

      /*
       * Substituição apenas na representação falada.
       * O texto visual original nunca é alterado.
       */
      result = result.split(entry.original).join(entry.spoken);
    }

    return result;
  }
}


/* ============================================================
   DICIONÁRIO INICIAL
   ============================================================ */

const pronunciationDictionary =
  new PronunciationDictionary();

/*
 * Não adicionamos pronúncias oficiais sem validação de áudio.
 *
 * Quando uma palavra for testada e validada, poderá entrar aqui.
 */


/* ============================================================
   PREPARAÇÃO DA FALA
   ============================================================ */

class SpeechPreparation {

  prepare(text, intent = "normal", voiceProfile = null) {

    const cleanText = this.normalizeText(text);

    if (!cleanText) {
      return {
        text: "",
        intent,
        segments: []
      };
    }

    const spokenText =
      pronunciationDictionary.prepare(
        cleanText,
        voiceProfile
      );

    const segments =
      this.segmentText(spokenText);

    const preparedSegments =
      segments.map((segment, index) => {

        return {
          index,
          text: segment.text,

          rhythm: this.determineRhythm(
            segment.text,
            intent,
            voiceProfile
          ),

          intensity: this.determineIntensity(
            segment.text,
            intent,
            voiceProfile
          ),

          emphasis: this.determineEmphasis(
            segment.text,
            intent
          ),

          pauseAfter: this.determinePauseAfter(
            segment.text,
            index,
            segments.length,
            intent
          )
        };
      });


    return {
      text: spokenText,
      intent,

      voice: voiceProfile
        ? voiceProfile.id
        : "V01",

      segments: preparedSegments
    };
  }


  normalizeText(text) {

    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }


  /*
   * Segmentação por ideias/frases.
   *
   * Não divide palavra por palavra.
   */
  segmentText(text) {

    const matches =
      text.match(/[^.!?…]+[.!?…]*/g);

    if (!matches) {

      return [{
        text: text.trim()
      }];
    }

    return matches
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => ({
        text: part
      }));
  }


  determineRhythm(text, intent, voiceProfile) {

    const length = text.length;

    /*
     * O ritmo depende do contexto.
     * Não existe uma velocidade fixa por voz.
     */

    if (intent === "reflection" || intent === "contemplation") {
      return "slower";
    }

    if (intent === "important") {
      return "controlled";
    }

    if (intent === "analysis" || intent === "explanation") {

      if (length > 140) {
        return "structured-slow";
      }

      return "controlled";
    }

    if (intent === "question") {
      return "conversational";
    }

    if (length < 45) {
      return "natural-short";
    }

    if (length > 180) {
      return "structured";
    }

    return "conversational";
  }


  determineIntensity(text, intent) {

    if (
      intent === "important" ||
      intent === "determination"
    ) {
      return "present";
    }

    if (
      intent === "reflection" ||
      intent === "contemplation"
    ) {
      return "soft";
    }

    if (intent === "error") {
      return "clear";
    }

    /*
     * Perguntas não precisam automaticamente
     * de maior intensidade.
     */
    if (intent === "question") {
      return "natural";
    }

    return "natural";
  }


  determineEmphasis(text, intent) {

    const emphasis = [];

    /*
     * Ênfase é deliberadamente rara.
     * Nesta fase identificamos apenas situações
     * em que ela pode ser necessária.
     */

    if (
      intent === "important" ||
      intent === "determination"
    ) {
      emphasis.push("key-idea");
    }

    /*
     * Frases muito curtas normalmente não precisam
     * de uma ênfase adicional.
     */

    return emphasis;
  }


  determinePauseAfter(
    text,
    index,
    total,
    intent
  ) {

    const trimmed = text.trim();

    /*
     * Última frase:
     * não precisamos criar uma pausa artificial.
     */
    if (index === total - 1) {
      return "natural-end";
    }


    /*
     * Reticências carregam mais reflexão.
     */
    if (trimmed.endsWith("…")) {
      return "medium";
    }


    /*
     * Perguntas recebem uma transição natural.
     */
    if (trimmed.endsWith("?")) {
      return "short";
    }


    /*
     * Ideias importantes/contemplativas:
     * pausa um pouco mais perceptível.
     */
    if (
      intent === "reflection" ||
      intent === "contemplation"
    ) {
      return "medium";
    }


    /*
     * Frases normais:
     * pausa curta entre ideias.
     */
    return "short";
  }
}


/* ============================================================
   PROVIDER BASE
   ============================================================ */

class VoiceProviderAdapter {

  constructor(name) {

    this.name = name;
  }


  async synthesize() {

    throw new Error(
      "O provider de voz ainda não foi implementado."
    );
  }


  async stop() {

    return false;
  }
}


/* ============================================================
   FREETTS ADAPTER
   ============================================================ */

class FreeTTSAdapter extends VoiceProviderAdapter {

  constructor() {

    super("FreeTTS");
  }


  async synthesize(segment, voiceProfile) {

    /*
     * IMPORTANTE:
     *
     * Não inventamos aqui endpoint, autenticação
     * ou formato de resposta da API.
     *
     * A integração real será feita quando o endpoint
     * oficial utilizado pelo projeto estiver definido.
     */

    throw new Error(
      "FreeTTS ainda não está conectado ao endpoint de áudio."
    );
  }


  async stop() {

    /*
     * Quando o player real estiver integrado,
     * este método interromperá o áudio imediatamente.
     */

    return true;
  }
}


/* ============================================================
   EVENT BUS
   ============================================================ */

class VoiceEventBus {

  constructor() {

    this.listeners = new Map();
  }


  on(eventName, callback) {

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    this.listeners
      .get(eventName)
      .push(callback);
  }


  emit(eventName, payload = {}) {

    const callbacks =
      this.listeners.get(eventName) || [];

    callbacks.forEach(callback => {

      try {
        callback(payload);
      } catch (error) {

        console.error(
          "Erro no listener:",
          eventName,
          error
        );
      }
    });
  }
}


/* ============================================================
   VOICE ENGINE
   ============================================================ */

class VoiceEngine {

  constructor(provider, eventBus, config) {

    this.provider = provider;
    this.eventBus = eventBus;
    this.config = config;

    this.state = VOICE_STATES.IDLE;

    this.currentVoice =
      config.getPreferredProfile();

    this.currentAudio = null;

    this.requestId = 0;

    this.preparation =
      new SpeechPreparation();
  }


  setState(nextState) {

    this.state = nextState;

    updateInterface();
  }


  selectVoice(profileId) {

    if (!VOICE_PROFILES[profileId]) {
      return false;
    }

    this.currentVoice =
      VOICE_PROFILES[profileId];

    updateInterface();

    return true;
  }


  chooseVoice(intent = "normal") {

    /*
     * Núcleo continua sendo a voz padrão.
     *
     * A troca automática só acontece quando houver
     * benefício contextual real.
     */

    if (!this.config.automaticVoiceSwitching) {

      return this.currentVoice;
    }


    /*
     * Nesta fase não fazemos trocas automáticas
     * artificiais.
     *
     * Mantemos a voz atual para preservar continuidade.
     */

    return this.currentVoice;
  }


  async speak(text, intent = "normal") {

    const requestId =
      ++this.requestId;


    if (!text || !String(text).trim()) {
      return;
    }


    /*
     * Se a Máquina já estiver a falar,
     * interrompemos antes de iniciar uma nova fala.
     */
    if (this.state === VOICE_STATES.SPEAKING) {

      await this.interrupt();
    }


    const voiceProfile =
      this.chooseVoice(intent);


    try {

      /*
       * ======================================================
       * THINKING
       * ======================================================
       */

      this.setState(
        VOICE_STATES.THINKING
      );

      this.eventBus.emit(
        VOICE_EVENTS.THINKING_START,
        {
          voice: voiceProfile.id,
          voiceName: voiceProfile.name,
          intent
        }
      );


      const prepared =
        this.preparation.prepare(
          text,
          intent,
          voiceProfile
        );


      /*
       * Se outra ação interrompeu este pedido,
       * abandonamos sem continuar.
       */
      if (requestId !== this.requestId) {
        return;
      }


      this.eventBus.emit(
        VOICE_EVENTS.THINKING_END,
        {
          voice: voiceProfile.id
        }
      );


      /*
       * ======================================================
       * SPEAKING
       * ======================================================
       */

      this.setState(
        VOICE_STATES.SPEAKING
      );

      this.eventBus.emit(
        VOICE_EVENTS.VOICE_START,
        {
          voice: voiceProfile.id,
          voiceName: voiceProfile.name,
          intent,
          provider: this.provider.name
        }
      );


      for (
        let index = 0;
        index < prepared.segments.length;
        index++
      ) {

        /*
         * Pedido cancelado/interrompido.
         */
        if (requestId !== this.requestId) {
          return;
        }


        const segment =
          prepared.segments[index];


        /*
         * Evento semântico enviado para o Grupo 2.
         *
         * Grupo 2 decide como representar visualmente:
         * - cor normal da Máquina
         * - pulsação
         * - intensidade
         * - pausa
         *
         * O Grupo 3 não manda "fica vermelho", etc.
         */
        this.eventBus.emit(
          VOICE_EVENTS.VOICE_SEGMENT,
          {
            index: segment.index,
            total: prepared.segments.length,

            text: segment.text,

            voice: voiceProfile.id,

            rhythm: segment.rhythm,

            intensity: segment.intensity,

            emphasis: segment.emphasis,

            pauseAfter: segment.pauseAfter
          }
        );


        /*
         * ====================================================
         * PROVIDER
         * ====================================================
         */

        const audio =
          await this.synthesizeSegment(
            segment,
            voiceProfile,
            requestId
          );


        if (requestId !== this.requestId) {
          return;
        }


        /*
         * O áudio real será guardado aqui quando
         * o adapter estiver ligado ao provider.
         */
        this.currentAudio = audio;


        /*
         * Se o provider devolver um objeto de áudio
         * reproduzível, podemos aguardar o final dele.
         */
        await this.playAudioIfAvailable(
          audio,
          requestId
        );


        if (requestId !== this.requestId) {
          return;
        }


        /*
         * ====================================================
         * PAUSA ENTRE SEGMENTOS
         * ====================================================
         */

        if (
          index <
          prepared.segments.length - 1
        ) {

          this.eventBus.emit(
            VOICE_EVENTS.VOICE_PAUSE,
            {
              duration:
                segment.pauseAfter,

              index: segment.index
            }
          );

          await this.waitForPause(
            segment.pauseAfter,
            requestId
          );
        }
      }


      if (requestId !== this.requestId) {
        return;
      }


      /*
       * ======================================================
       * VOICE END
       * ======================================================
       *
       * Este evento só acontece depois de o áudio
       * terminar realmente.
       */

      this.eventBus.emit(
        VOICE_EVENTS.VOICE_END,
        {
          voice: voiceProfile.id
        }
      );


      this.currentAudio = null;

      this.setState(
        VOICE_STATES.IDLE
      );

    } catch (error) {

      if (requestId !== this.requestId) {
        return;
      }


      console.error(
        "Voice Engine error:",
        error
      );


      this.setState(
        VOICE_STATES.ERROR
      );


      this.eventBus.emit(
        VOICE_EVENTS.ERROR,
        {
          message:
            "Não consegui concluir a fala agora.",

          error: error.message,

          voice: voiceProfile.id
        }
      );


      this.currentAudio = null;


      /*
       * Recuperação para IDLE.
       */
      this.setState(
        VOICE_STATES.IDLE
      );
    }
  }


  async synthesizeSegment(
    segment,
    voiceProfile,
    requestId
  ) {

    if (requestId !== this.requestId) {
      return null;
    }


    return await this.provider.synthesize(
      segment,
      voiceProfile
    );
  }


  async playAudioIfAvailable(
    audio,
    requestId
  ) {

    if (!audio) {
      return;
    }


    if (requestId !== this.requestId) {
      return;
    }


    /*
     * Preparação para diferentes tipos de retorno
     * do futuro adapter.
     */

    if (
      typeof audio.play === "function"
    ) {

      await audio.play();

      if (
        typeof audio.addEventListener ===
        "function"
      ) {

        await new Promise(resolve => {

          const finish = () => {
            resolve();
          };

          audio.addEventListener(
            "ended",
            finish,
            { once: true }
          );

          audio.addEventListener(
            "error",
            finish,
            { once: true }
          );
        });
      }
    }
  }


  async waitForPause(
    pauseType,
    requestId
  ) {

    if (requestId !== this.requestId) {
      return;
    }


    let duration = 0;


    switch (pauseType) {

      case "short":
        duration = 180;
        break;

      case "medium":
        duration = 420;
        break;

      case "long":
        duration = 700;
        break;

      case "natural-end":
      default:
        duration = 0;
        break;
    }


    if (duration <= 0) {
      return;
    }


    await new Promise(resolve => {

      setTimeout(resolve, duration);
    });
  }


  async interrupt() {

    /*
     * Invalidamos imediatamente o pedido atual.
     */
    ++this.requestId;


    try {

      await this.provider.stop();

    } catch (error) {

      console.warn(
        "Não foi possível parar o provider:",
        error
      );
    }


    this.currentAudio = null;


    this.eventBus.emit(
      VOICE_EVENTS.VOICE_INTERRUPTED,
      {
        voice:
          this.currentVoice.id
      }
    );


    this.setState(
      VOICE_STATES.INTERRUPTED
    );


    /*
     * Depois da interrupção:
     *
     * INTERRUPTED
     *      ↓
     * LISTENING
     */

    this.startListening();
  }


  startListening() {

    this.setState(
      VOICE_STATES.LISTENING
    );


    this.eventBus.emit(
      VOICE_EVENTS.LISTEN_START,
      {
        voice:
          this.currentVoice.id
      }
    );
  }


  stopListening() {

    if (
      this.state !== VOICE_STATES.LISTENING
    ) {
      return;
    }


    this.eventBus.emit(
      VOICE_EVENTS.LISTEN_END,
      {
        voice:
          this.currentVoice.id
      }
    );


    this.setState(
      VOICE_STATES.IDLE
    );
  }


  thinkingPause() {

    if (
      this.state !== VOICE_STATES.THINKING
    ) {
      return;
    }


    this.eventBus.emit(
      VOICE_EVENTS.THINKING_PAUSE,
      {
        voice:
          this.currentVoice.id
      }
    );
  }


  stop() {

    ++this.requestId;

    this.currentAudio = null;

    this.provider.stop();

    this.eventBus.emit(
      VOICE_EVENTS.VOICE_INTERRUPTED,
      {
        voice:
          this.currentVoice.id
      }
    );

    this.setState(
      VOICE_STATES.IDLE
    );
  }
}


/* ============================================================
   INSTÂNCIAS PRINCIPAIS
   ============================================================ */

const voiceConfig =
  new VoiceConfig();

const eventBus =
  new VoiceEventBus();

const freeTTSAdapter =
  new FreeTTSAdapter();

const voiceEngine =
  new VoiceEngine(
    freeTTSAdapter,
    eventBus,
    voiceConfig
  );


/* ============================================================
   ELEMENTOS DA INTERFACE
   ============================================================ */

const stateElement =
  document.getElementById(
    "voice-state"
  );

const profileElement =
  document.getElementById(
    "voice-profile"
  );

const providerElement =
  document.getElementById(
    "voice-provider"
  );

const inputElement =
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

const eventLog =
  document.getElementById(
    "event-log"
  );


/* ============================================================
   INTERFACE
   ============================================================ */

function updateInterface() {

  if (stateElement) {

    stateElement.textContent =
      voiceEngine.state;
  }


  if (profileElement) {

    profileElement.textContent =
      voiceEngine.currentVoice.name;
  }


  if (providerElement) {

    providerElement.textContent =
      `${voiceEngine.provider.name} Adapter`;
  }
}


/* ============================================================
   LOG DE EVENTOS
   ============================================================ */

function logEvent(
  eventName,
  payload = {}
) {

  if (!eventLog) {
    return;
  }


  const time =
    new Date()
      .toLocaleTimeString();


  const line =
    `[${time}] ${eventName}\n` +
    `${JSON.stringify(
      payload,
      null,
      2
    )}\n`;


  if (
    eventLog.textContent ===
    "Aguardando..."
  ) {

    eventLog.textContent = "";
  }


  eventLog.textContent +=
    line + "\n";


  eventLog.scrollTop =
    eventLog.scrollHeight;
}


/* ============================================================
   LIGAÇÃO DOS EVENTOS AO LOG
   ============================================================ */

Object.values(
  VOICE_EVENTS
).forEach(eventName => {

  eventBus.on(
    eventName,
    payload => {

      logEvent(
        eventName,
        payload
      );

      updateInterface();
    }
  );
});


/* ============================================================
   BOTÃO FALAR
   ============================================================ */

if (speakButton) {

  speakButton.addEventListener(
    "click",
    async () => {

      const text =
        inputElement
          ? inputElement.value.trim()
          : "";


      if (!text) {
        return;
      }


      await voiceEngine.speak(
        text,
        "normal"
      );
    }
  );
}


/* ============================================================
   BOTÃO PARAR
   ============================================================ */

if (stopButton) {

  stopButton.addEventListener(
    "click",
    () => {

      voiceEngine.stop();
    }
  );
}


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

updateInterface();


console.log(
  "Grupo 3 — Voz da Máquina iniciado."
);

console.log(
  "Voz atual:",
  voiceEngine.currentVoice.name
);

console.log(
  "Provider:",
  voiceEngine.provider.name
);

/**
 * Prompt templates for each generation type.
 * Rules:
 *  - Always requests JSON only
 *  - Rich, detailed output
 *  - Fixed schema per type
 *  - No extra text / explanation
 */

export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

export interface NPCMeta {
  name?: string;
  genre?: string;
  role?: string;
  userPrompt?: string;
}

export interface QuestMeta {
  title?: string;
  genre?: string;
  difficulty?: string;
  userPrompt?: string;
}

export interface ItemMeta {
  name?: string;
  genre?: string;
  rarity?: string;
  userPrompt?: string;
}

export interface LoreMeta {
  topic?: string;
  genre?: string;
  tone?: string;
  userPrompt?: string;
}

export interface WeaponMeta {
  name?: string;
  genre?: string;
  weaponClass?: string;
  element?: string;
  style?: string;
  userPrompt?: string;
}

export interface EnemyMeta {
  name?: string;
  genre?: string;
  enemyType?: string;
  difficulty?: string;
  userPrompt?: string;
}

export type PromptMeta = NPCMeta | QuestMeta | ItemMeta | LoreMeta | WeaponMeta | EnemyMeta;

// ---------------------------------------------------------------------------
// Helper — appends the user's personal prompt directive (narrative + visual)
// ---------------------------------------------------------------------------
function visualHint(userPrompt?: string): string {
  if (!userPrompt || !userPrompt.trim()) return "";
  return `\n\nPROMPT PERSONAL DEL USUARIO — PRIORIDAD MÁXIMA: el siguiente texto describe la historia, ambientación, época, atmósfera y contexto que el usuario quiere. DEBES integrarlo en TODOS los campos relevantes del JSON (historia, apariencia, lore, ambientación, tono narrativo, descripción, etc.) y hacer que el contenido generado gire completamente alrededor de estas indicaciones: "${userPrompt.trim()}"`;
}

// ---------------------------------------------------------------------------
// Prompt builders — each returns a single string for the AI model
// ---------------------------------------------------------------------------

export function buildPrompt(type: GenerationType, meta: PromptMeta): string {
  switch (type) {
    case "npc":    return npcPrompt(meta as NPCMeta);
    case "quest":  return questPrompt(meta as QuestMeta);
    case "item":   return itemPrompt(meta as ItemMeta);
    case "lore":   return lorePrompt(meta as LoreMeta);
    case "weapon": return weaponPrompt(meta as WeaponMeta);
    case "enemy":  return enemyPrompt(meta as EnemyMeta);
  }
}

function npcPrompt(m: NPCMeta): string {
  const name  = m.name  || "un personaje aleatorio";
  const genre = m.genre || "fantasía";
  const role  = m.role  || "aldeano";
  return `Eres un escritor creativo senior de videojuegos de rol. Genera un NPC extremadamente rico y detallado de ${genre} llamado ${name} con rol de ${role}. TODO EN ESPAÑOL. Sé muy detallado, evocador y cinematográfico. IMPORTANTE: los campos de texto largo deben tener VARIOS PÁRRAFOS separados por \\n\\n, mínimo 2-3 párrafos por campo extenso.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","role":"string","race":"string","age":"string","appearance":"MÚLTIPLES PÁRRAFOS con \\n\\n entre ellos — párrafo 1: descripción física completa (altura, complexión, rasgos faciales únicos, color de cabello/ojos/piel, cicatrices con su historia). Párrafo 2: ropa pieza a pieza con colores, materiales, desgaste, grabados, accesorios y calzado. Párrafo 3: olores característicos, forma de moverse, postura habitual y gestos involuntarios que delatan emociones (220-260 palabras totales)","personality":"MÚLTIPLES PÁRRAFOS con \\n\\n — párrafo 1: virtudes dominantes y filosofía de vida. Párrafo 2: defectos que lo humanizan, miedos irracionales y manías. Párrafo 3: cómo reacciona bajo presión y cómo trata a distintos tipos de personas (100-120 palabras totales)","backstory":"MÚLTIPLES PÁRRAFOS con \\n\\n — párrafo 1: lugar de nacimiento y familia con descripción del entorno. Párrafo 2: evento traumático o catalizador que lo marcó y decisiones cruciales y sus consecuencias. Párrafo 3: relaciones amorosas o de amistad importantes y pérdidas. Párrafo 4: cómo llegó a su situación actual y qué ganó y perdió por el camino (260-300 palabras totales)","secret":"párrafo único extenso: secreto oscuro completo con a quién afectaría si se revela y por qué lo guarda con tanto celo (60-70 palabras)","motivation":"párrafo único: deseo profundo, el miedo que lo impulsa o paraliza y qué está dispuesto a sacrificar (60-70 palabras)","dialogue":"TRES diálogos numerados separados por \\n\\n, cada uno con su contexto entre paréntesis y la frase del personaje — deben sonar como diálogos reales de videojuego AAA (100-120 palabras totales)","combat_style":"dos párrafos con \\n\\n: tácticas y armas en el primero, debilidades y fortalezas en el segundo (50-60 palabras)","relationships":"tres relaciones separadas por \\n\\n, cada una con nombre, vínculo y tensión narrativa (70-80 palabras totales)"}`;
}

function questPrompt(m: QuestMeta): string {
  const title      = m.title      || "una aventura";
  const genre      = m.genre      || "fantasía";
  const difficulty = m.difficulty || "media";
  return `Eres un diseñador de narrativa de videojuegos de rol con experiencia en Baldur's Gate y The Witcher. Genera una misión compleja y cinematográfica de ${genre} titulada "${title}" con dificultad ${difficulty}. TODO EN ESPAÑOL. IMPORTANTE: los campos de texto largo deben tener VARIOS PÁRRAFOS separados por \\n\\n.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","type":"string","difficulty":"string","synopsis":"DOS PÁRRAFOS con \\n\\n — párrafo 1: contexto del mundo y por qué importa esta misión. Párrafo 2: qué está en juego si falla el jugador y el gancho narrativo (130-150 palabras totales)","objective":"DOS PÁRRAFOS con \\n\\n — párrafo 1: objetivo principal con contexto y urgencia moral. Párrafo 2: consecuencias de fracasar (80-90 palabras totales)","location":"DOS PÁRRAFOS con \\n\\n — párrafo 1: arquitectura y clima del lugar. Párrafo 2: sonidos, peligros ambientales e historia del sitio (80-90 palabras totales)","npcs_involved":["NPC1: nombre — rol en misión — motivación oculta completa (40-50 palabras)","NPC2: nombre — rol en misión — motivación oculta completa (40-50 palabras)"],"enemies":["Enemigo 1: nombre — comportamiento detallado y tácticas en combate (40-50 palabras)","Enemigo 2: nombre — comportamiento detallado y tácticas en combate (40-50 palabras)"],"steps":["Paso 1: descripción ambiental + qué debe hacer el jugador + decisión disponible (50-60 palabras)","Paso 2: encuentro o desafío específico con detalle de mecánica (50-60 palabras)","Paso 3: escalada de tensión con revelación parcial (50-60 palabras)","Paso 4: clímax narrativo con consecuencias de elección (50-60 palabras)"],"twist":"DOS PÁRRAFOS con \\n\\n — el giro y por qué subvierte expectativas en el primero; implicaciones morales en el segundo (80-90 palabras totales)","moral_dilemma":"DOS PÁRRAFOS con \\n\\n — descripción del dilema en el primero; las dos opciones y sus consecuencias narrativas distintas en el segundo (70-80 palabras totales)","reward":"recompensas completas con cantidades, objetos únicos con nombre propio y consecuencias narrativas (50-60 palabras)","failure_consequences":"qué ocurre en el mundo si la misión fracasa, con consecuencias en cadena (40-50 palabras)"}`;
}

function itemPrompt(m: ItemMeta): string {
  const name   = m.name   || "un objeto mágico";
  const genre  = m.genre  || "fantasía";
  const rarity = m.rarity || "raro";
  return `Eres un maestro artesano y escritor de lore para videojuegos de rol. Genera un objeto ${rarity} de ${genre} llamado "${name}" con historia rica y mecánicas únicas. TODO EN ESPAÑOL. IMPORTANTE: los campos de texto largo deben tener VARIOS PÁRRAFOS separados por \\n\\n.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","rarity":"string","appearance":"DOS PÁRRAFOS con \\n\\n — párrafo 1: forma, dimensiones, materiales con texturas y colores, grabados o runas. Párrafo 2: cómo reacciona a la luz, sonido al agitarse, sensación al tacto, temperatura y peso percibido (120-140 palabras totales)","lore":"TRES PÁRRAFOS con \\n\\n — párrafo 1: quién lo creó, en qué época y con qué propósito. Párrafo 2: sus propietarios más famosos y qué les ocurrió. Párrafo 3: leyendas populares que lo rodean y si fue destruido o maldecido alguna vez (140-160 palabras totales)","effect":"DOS PÁRRAFOS con \\n\\n — párrafo 1: efecto principal con valores numéricos y condiciones de activación. Párrafo 2: tiempo de recarga o usos por día, efectos secundarios y limitaciones (70-80 palabras totales)","passive":"párrafo con bonificación pasiva permanente y cómo afecta al portador a largo plazo (40-50 palabras)","requirements":"requisitos para equiparlo: nivel, clase, estadísticas mínimas, rituales si aplica (35-40 palabras)","curse":"párrafo completo con la maldición oculta que el jugador descubre tarde, cuándo se manifiesta y cómo eliminarla (40-50 palabras)","value":0,"weight":"string","crafting_material":"materiales necesarios y proceso general de fabricación con dónde obtener cada componente (40-50 palabras)"}`;
}

function lorePrompt(m: LoreMeta): string {
  const topic = m.topic || "el mundo";
  const genre = m.genre || "fantasía";
  const tone  = m.tone  || "épico";
  return `Eres el escritor principal de lore de un videojuego de rol de gran presupuesto, al nivel de The Elder Scrolls o Dark Souls. Genera una entrada de historia/lore ${tone} de ${genre} sobre "${topic}". TODO EN ESPAÑOL. CRÍTICO: cada campo de texto largo DEBE tener MÚLTIPLES PÁRRAFOS separados por \\n\\n. Sé extenso, profundo y literario — este es el campo donde MÁS texto se espera.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","era":"nombre de la era o período histórico con fechas aproximadas","region":"nombre y descripción del territorio: geografía, clima general y por qué es importante (40-50 palabras)","overview":"DOS PÁRRAFOS con \\n\\n — párrafo 1: quién dejó este registro y por qué importa. Párrafo 2: contexto general del lore y su relevancia actual (130-150 palabras totales)","history":"CUATRO O CINCO PÁRRAFOS con \\n\\n — párrafo 1: el origen y los primeros tiempos. Párrafo 2: el primer gran conflicto o evento que definió todo. Párrafo 3: el apogeo, el poder en su máximo esplendor. Párrafo 4: la caída o giro trágico. Párrafo 5: el estado actual y las heridas que quedaron (350-420 palabras totales)","factions":["Facción 1 — TRES SECCIONES: [Nombre e ideología completa]. [Métodos y símbolo]. [Situación actual y tensiones internas] (80-100 palabras)","Facción 2 — TRES SECCIONES: [Nombre e ideología completa]. [Métodos y símbolo]. [Situación actual y tensiones internas] (80-100 palabras)","Facción 3 — TRES SECCIONES: [Nombre e ideología completa]. [Métodos y símbolo]. [Situación actual y tensiones internas] (80-100 palabras)"],"key_figures":["Figura 1: nombre y título — descripción física breve — rol histórico decisivo — legado que dejó al mundo (60-70 palabras)","Figura 2: nombre y título — descripción física breve — rol histórico decisivo — legado que dejó al mundo (60-70 palabras)","Figura 3: nombre y título — descripción física breve — rol histórico decisivo — legado que dejó al mundo (60-70 palabras)"],"important_events":["Evento 1: nombre — fecha — descripción de lo que ocurrió — consecuencia que aún se siente hoy (50-60 palabras)","Evento 2: nombre — fecha — descripción de lo que ocurrió — consecuencia que aún se siente hoy (50-60 palabras)","Evento 3: nombre — fecha — descripción de lo que ocurrió — consecuencia que aún se siente hoy (50-60 palabras)"],"geography":"DOS PÁRRAFOS con \\n\\n — párrafo 1: territorios y paisajes, ciudades y fortalezas. Párrafo 2: lugares míticos, ruinas y lo que el viajero siente al recorrerlos (130-150 palabras totales)","magic_or_power":"DOS PÁRRAFOS con \\n\\n — párrafo 1: qué es el sistema de poder y cómo funciona mecánicamente. Párrafo 2: su origen, quién puede usarlo, a qué coste físico o espiritual (110-130 palabras totales)","myths_and_prophecies":"TRES MITOS O PROFECÍAS separados por \\n\\n, cada uno narrado en voz de bardo o crónica antigua, con nombre propio del mito (130-150 palabras totales)","secret":"DOS PÁRRAFOS con \\n\\n — párrafo 1: la verdad oculta que desmiente la historia oficial. Párrafo 2: cómo los poderosos la han enterrado y qué ocurriría si se revelara (100-120 palabras totales)","impact":"DOS PÁRRAFOS con \\n\\n — párrafo 1: cicatrices físicas en el territorio y divisiones sociales vigentes. Párrafo 2: objetos o ruinas que quedaron y por qué el jugador debería importarle descubrirlo (90-110 palabras totales)"}`;
}

function weaponPrompt(m: WeaponMeta): string {
  const name        = m.name        || "un arma legendaria";
  const genre       = m.genre       || "fantasía";
  const weaponClass = m.weaponClass || "espada";
  const element     = m.element     || "ninguno";
  const style       = m.style       || "una mano";
  return `Eres el herrero legendario y cronista de armas de un videojuego de rol épico. Genera un ${weaponClass} de ${genre} para combate ${style} llamado "${name}" con elemento ${element}. TODO EN ESPAÑOL. IMPORTANTE: los campos de texto largo deben tener VARIOS PÁRRAFOS separados por \\n\\n.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","class":"string","element":"string","style":"string","appearance":"DOS PÁRRAFOS con \\n\\n — párrafo 1: longitud, forma de hoja o cabeza, material y acabado de empuñadura, grabados rúnicos o decorativos. Párrafo 2: cómo reacciona el elemento al activarse (brillos, llamas, escarcha), estado de conservación, peso, equilibrio y sonido al blandirla (130-150 palabras totales)","damage":"rango con tipos separados y multiplicadores especiales (ej: 85-120 físico + 40 fuego, x1.5 contra no-muertos)","speed":"velocidad con descripción del estilo de swing y animación","range":"alcance en metros y área de efecto si aplica","special_ability":"DOS PÁRRAFOS con \\n\\n — párrafo 1: nombre de la habilidad y mecánica completa de activación con efecto y duración. Párrafo 2: tiempo de recarga y consecuencia narrativa de usarla en exceso (90-100 palabras totales)","passive":"DOS EFECTOS separados por \\n\\n, cada uno con nombre, condición de activación y valor numérico (60-70 palabras totales)","lore":"TRES PÁRRAFOS con \\n\\n — párrafo 1: quién la forjó y en qué circunstancias extremas. Párrafo 2: batallas legendarias y héroes o villanos que la empuñaron y qué les costó. Párrafo 3: maldiciones o bendiciones acumuladas y dónde estuvo perdida o escondida (150-170 palabras totales)","crafting_material":"lista de materiales con descripción de dónde se obtiene cada uno (50-60 palabras)","requirements":"nivel, clase o juramento necesario para empuñarla sin consecuencias (30-35 palabras)","value":0}`;
}

function enemyPrompt(m: EnemyMeta): string {
  const name       = m.name       || "un enemigo temible";
  const genre      = m.genre      || "fantasía";
  const enemyType  = m.enemyType  || "bestia";
  const difficulty = m.difficulty || "medio";
  return `Eres el director creativo de bestias y antagonistas de un videojuego de rol oscuro y épico. Genera un enemigo ${difficulty} de tipo ${enemyType} en género ${genre} llamado "${name}". TODO EN ESPAÑOL. IMPORTANTE: los campos de texto largo deben tener VARIOS PÁRRAFOS separados por \\n\\n.${visualHint(m.userPrompt)}
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","difficulty":"string","hp":0,"armor":0,"speed":"string","appearance":"DOS PÁRRAFOS con \\n\\n — párrafo 1: tamaño, forma, extremidades, textura de piel o escamas, colores y patrones, ojos y boca. Párrafo 2: sonidos que emite, olor, cómo se mueve y qué sensación visceral provoca verlo por primera vez (150-170 palabras totales)","personality":"DOS PÁRRAFOS con \\n\\n — párrafo 1: nivel de inteligencia, comportamiento social (solitario o en manada). Párrafo 2: cómo selecciona víctimas, qué lo enfurece o calma y si tiene consciencia de su crueldad (70-80 palabras totales)","lore":"TRES PÁRRAFOS con \\n\\n — párrafo 1: de dónde viene y cómo fue creado o evolucionó. Párrafo 2: su papel en el ecosistema o mitología del mundo y civilizaciones que lo temieron. Párrafo 3: por qué apareció ahora en el juego y qué quiere (130-150 palabras totales)","attack_style":"DOS PÁRRAFOS con \\n\\n — párrafo 1: estilo de combate base con patrones de ataque en secuencia. Párrafo 2: cómo escala la agresividad con el daño recibido y tácticas para aislar al jugador (90-100 palabras totales)","abilities":["Habilidad 1 con nombre propio: mecánica completa, efecto con números, duración y condición de activación (50-60 palabras)","Habilidad 2 con nombre propio: mecánica completa, efecto con números, duración y condición de activación (50-60 palabras)","Habilidad 3 con nombre propio (solo si es jefe o difícil): mecánica completa (40-50 palabras)"],"weakness":"DOS PÁRRAFOS con \\n\\n — párrafo 1: las debilidades específicas y cómo explotarlas en combate. Párrafo 2: por qué existen según la mitología del mundo (60-70 palabras totales)","resistance":"resistencias con explicación narrativa de su origen en la mitología (40-50 palabras)","drops":"botín detallado con probabilidades, descripción de cada objeto y al menos un drop único con nombre propio y su lore (60-70 palabras)","encounter_tips":"DOS O TRES consejos de diseño narrativo para crear un encuentro memorable, separados por \\n\\n (60-70 palabras totales)"}`;
}

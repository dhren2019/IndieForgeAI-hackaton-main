/**
 * Fallback generator — returns a handcrafted valid object
 * when the model fails or produces invalid output.
 * 
 * Each pool has multiple entries so repeated fallbacks look varied.
 */

import type { GenerationType } from "./parser";


export function getFallback(
  type: GenerationType,
  meta: Record<string, unknown>
): Record<string, unknown> {
  const pool = FALLBACKS[type];
  const base = pool[Math.floor(Math.random() * pool.length)];

  // Merge user-supplied name/title if available
  const merged = { ...base };
  if (type === "npc"    && meta.name)  merged.name  = meta.name;
  if (type === "quest"  && meta.title) merged.title = meta.title;
  if (type === "item"   && meta.name)  merged.name  = meta.name;
  if (type === "lore"   && meta.topic) merged.title = meta.topic;
  if (type === "weapon" && meta.name)  merged.name  = meta.name;
  if (type === "enemy"  && meta.name)  merged.name  = meta.name;

  return merged;
}

const FALLBACKS: Record<GenerationType, Record<string, unknown>[]> = {
  npc: [
    {
      name: "Aldric el Errante",
      role: "Mercader",
      race: "Humano",
      age: "52 años",
      appearance: "Hombre corpulento con barba gris, cicatriz en la mejilla izquierda y capa de comerciante desgastada",
      personality: "Jovial y locuaz en público, pero oculta una melancolía profunda y desconfianza hacia los guardias",
      backstory: "Antiguo soldado reconvertido en mercader tras perder a su unidad en la Batalla de las Mareas Negras",
      secret: "Vendió reliquias prohibidas al Gremio Carmesí para saldar una deuda de sangre",
      motivation: "Reunir suficiente oro para comprar el silencio de quienes conocen su pasado",
      dialogue: "¡Ah, un viajero! Todo tiene su precio, amigo, incluso los secretos que prefieres no escuchar.",
      combat_style: "Lucha sucia con cuchillo oculto y polvo cegador en los ojos del rival",
    },
    {
      name: "Sylla Sombra-de-Noche",
      role: "Asesina",
      race: "Elfa",
      age: "134 años (aparenta 25)",
      appearance: "Mujer esbelta de cabello plateado corto, ojos violeta y tatuajes rúnicos en los brazos",
      personality: "Fría y calculadora, habla poco, observa todo y jamás revela sus emociones reales",
      backstory: "Criada desde niña por el Culto del Velo Silente, nunca eligió esta vida pero es lo único que sabe hacer",
      secret: "Perdona siempre a los niños en sus contratos, algo que su gremio nunca debe descubrir",
      motivation: "Encontrar y eliminar al maestro del culto que mató a su familia antes de reclutarla",
      dialogue: "Nunca estuve aquí. Y tú nunca me viste. ¿Entendido?",
      combat_style: "Dagas envenenadas, movimientos de sombras, golpe mortal al cuello desde la oscuridad",
    },
    {
      name: "Torben Yunque-de-Hierro",
      role: "Capitán de la Guardia",
      race: "Enano",
      age: "89 años",
      appearance: "Enano robusto con armadura plateada muy pulida, barba trenzada con anillos de bronce y mirada severa",
      personality: "Estricto, recto y de principios inquebrantables, aunque carga con una culpa silenciosa",
      backstory: "Lleva 40 años protegiendo la ciudad, sobrevivió tres asedios y enterró a dos generaciones de guardias",
      secret: "Acepta pequeños sobornos para financiar la medicina de su hermana enferma",
      motivation: "Que su ciudad prospere y que nadie descubra la grieta moral que hay en su honor",
      dialogue: "Declara tu propósito o aparta del camino. No tengo paciencia para ambigüedades.",
      combat_style: "Escudo y maza, combate frontal y resistente, usa el terreno para atrapar enemigos",
    },
  ],

  quest: [
    {
      title: "La Reliquia Robada",
      type: "Recuperación",
      difficulty: "Media",
      objective: "Recuperar el Amuleto del Sol robado de las bóvedas del templo antes del próximo eclipse",
      description: "El sumo sacerdote encargó en secreto su traslado, pero algo salió mal y ahora la reliquia está en manos equivocadas",
      reward: "500 monedas de oro + reputación con la Orden del Sol + mapa de la cripta sagrada",
      location: "Subterráneos de Polvolandia, bajo el mercado de especias",
      enemies: ["Ladrón de Gremio Carmesí", "Golem Custodio de Bóveda"],
      twist: "El ladrón resulta ser el aprendiz del propio sacerdote, que lo envió a robarla para venderla a un coleccionista extranjero",
      steps: ["Interrogar a los comerciantes del mercado", "Infiltrarse en los subterráneos", "Recuperar la reliquia sin matar al aprendiz"],
    },
    {
      title: "Silenciar la Torre del Campanario",
      type: "Eliminación",
      difficulty: "Difícil",
      objective: "Destruir la campana maldita antes de que suene medianoche y despierte a los muertos de la ciudad",
      description: "Una entidad antigua habita la campana y cada tañido convierte a los oyentes en sus sirvientes",
      reward: "Martillo legendario Rompe-Maldiciones + gratitud eterna de la ciudad",
      location: "Catedral de la Aguja de Hierro, torre norte",
      enemies: ["Guardián Espectral del Campanario", "Feligreses Poseídos"],
      twist: "La campana está poseída por un alma inocente atrapada, destruirla la liberará pero causará un terremoto",
      steps: ["Investigar la catedral de día", "Encontrar el sello de silencio en la cripta", "Usar el sello antes de tocar la campana"],
    },
    {
      title: "La Caravana de las Tierras Grises",
      type: "Escolta",
      difficulty: "Media",
      objective: "Proteger la caravana mercante a través del territorio bandido hasta la ciudad de Muro de Sal",
      description: "Cargamentos de medicina para los refugiados, pero alguien filtró la ruta a los bandidos del Clan del Cuervo",
      reward: "Materiales de fabricación raros + fragmento de mapa antiguo + favor del gremio de mercaderes",
      location: "Camino de las Cenizas, Sector 7 de las Llanuras Áridas",
      enemies: ["Bandidos del Clan del Cuervo", "Explorador Traidor"],
      twist: "El informante que filtró la ruta es uno de los propios guardias de la caravana, contratado por un rival comercial",
      steps: ["Escoltar la caravana por el paso norte", "Detectar al traidor entre los guardias", "Negociar o eliminar al líder bandido"],
    },
  ],

  item: [
    {
      name: "Hoja Rompe-Velos",
      type: "Espada",
      rarity: "Legendaria",
      description: "Espada de acero lunar con filo negro que absorbe la luz, incrustada con cristales de sombra que susurran al portador",
      lore: "Forjada por el herrero ciego Mordecai el Último en las profundidades del Abismo Plateado durante la Era de los Velos",
      effect: "Revela criaturas ocultas en un radio de 10 metros; +15 de daño a no-muertos; 10% de probabilidad de destierro instantáneo",
      requirements: "Requiere Fuerza 16 y afinidad arcana básica",
      value: 4500,
      weight: "3.2 kg",
    },
    {
      name: "Moneda de la Suerte del Mercader",
      type: "Amuleto",
      rarity: "Rara",
      description: "Moneda antigua con el perfil de un dios sonriente en una cara y una balanza en la otra, siempre cálida al tacto",
      lore: "Se dice que perteneció al primer comerciante que fundó el Gremio de Oro, quien nunca perdió un negocio en su vida",
      effect: "Precios de tienda reducidos un 12%; +5% de probabilidad de calidad superior en botín",
      requirements: "Sin requisitos especiales",
      value: 800,
      weight: "0.1 kg",
    },
    {
      name: "Capa Teje-Tormentas",
      type: "Armadura ligera",
      rarity: "Épica",
      description: "Capa de seda eléctrica que chisporrotea levemente, deja un rastro de estática en el aire al moverse",
      lore: "Tejida con fibras de rayo capturadas durante la Gran Tormenta del Milenio por las monjas del Convento Eléctrico",
      effect: "Inmune a electricidad; velocidad de carrera +20%; redirige 15% del daño eléctrico recibido como ataque",
      requirements: "Requiere Destreza 14",
      value: 2200,
      weight: "0.8 kg",
    },
  ],

  lore: [
    {
      title: "La Guerra del Desgarramiento",
      era: "Era de las Cenizas, Año 412",
      region: "Continente de Valdros",
      summary: "Conflicto centenario entre el Trono de Brasa y el Consejo del Velo que partió el continente en siete fragmentos, exterminó dos razas completas y cerró para siempre las Puertas del Amanecer",
      factions: ["Trono de Brasa — imperio militarista que cree en la pureza del fuego sagrado", "Consejo del Velo — alianza de magos que controlan el flujo del tiempo y la memoria"],
      key_figures: ["Emperatriz Valdris la Inmortal, fundadora del Trono de Brasa", "Archimago Serath el Olvidado, último presidente del Consejo"],
      secret: "Ambas facciones fueron manipuladas por la Entidad de los Sellos, un ser primordial que buscaba romper el candado que lo mantuvo dormido 10,000 años",
      impact: "El mundo aún sufre las cicatrices: zonas de gravedad rota, mares de cristal y ciudades flotantes abandonadas",
    },
    {
      title: "Las Estrellas Huecas",
      era: "Era Pre-Colapso",
      region: "Observatorios de las Cumbres Blancas",
      summary: "Astrónomos de la antigua academia descubrieron que las estrellas no son luz sino agujeros en la realidad a través de los cuales algo observa, estudia y espera pacientemente a sus presas",
      factions: ["Orden del Ojo Ciego — suprimen el conocimiento para proteger la cordura colectiva", "Gremio de Cartógrafos Estelares — mapean los agujeros esperando comunicarse"],
      key_figures: ["Astrónomo Primero Keleth el Contemplativo", "Hereje Myra de las Tres Lunas"],
      secret: "Los agujeros respiran lentamente, cada siglo se abren un poco más, y lo que hay al otro lado ya puede sentir nuestros pensamientos más fuertes",
      impact: "Mirar directamente las estrellas durante demasiado tiempo provoca sueños proféticos y, eventualmente, locura visionaria",
    },
  ],

  weapon: [
    {
      name: "Grandespada Colmillo-de-Ceniza",
      class: "Espada",
      element: "Fuego",
      style: "Dos manos",
      damage: "85-120 físico + 40 fuego",
      speed: "Lenta (1.2 ataques/segundo)",
      range: "Alcance largo 2.4m",
      special_ability: "Los enemigos golpeados quedan en llamas durante 3 segundos causando 15 de daño por segundo; carga completa crea una ola de fuego en línea recta",
      passive: "En combate prolongado acumula calor: cada 5 golpes consecutivos aumenta el daño de fuego un 25%",
      lore: "Forjada en el corazón de un volcán activo y maldecida para nunca saciarse de batalla; su portador siente hambre constante de pelea",
      crafting_material: "Mineral volcánico negro, corazón de dragón y 40 cristales de calor",
      value: 3800,
    },
    {
      name: "Arco Susurro-de-Escarcha",
      class: "Arco",
      element: "Hielo",
      style: "A distancia",
      damage: "45-70 físico + 30 escarcha",
      speed: "Media (1.8 disparos/segundo)",
      range: "Alcance muy largo 35m",
      special_ability: "Los golpes críticos congelan al enemigo completamente durante 1.5 segundos; disparar en ráfaga rápida de 3 flechas consume una carga de escarcha",
      passive: "Las flechas dejan un rastro de hielo que ralentiza a enemigos que lo crucen un 40%",
      lore: "Tallado del hueso de la última Drake de Invierno, nunca falla su marca y llora lágrimas de hielo cuando cae el sol",
      crafting_material: "Hueso de drake, tendones de araña de hielo y plumas de ave ártica legendaria",
      value: 2900,
    },
    {
      name: "Báculo Pulso-del-Vacío",
      class: "Báculo mágico",
      element: "Oscuro",
      style: "Mágico",
      damage: "60-90 arcano",
      speed: "Media (1.5 lanzamientos/segundo)",
      range: "Alcance medio 18m",
      special_ability: "Cada lanzamiento drena 5 HP del portador pero triplica el daño; modo vacío: consume toda la vida para lanzar una explosión de aniquilación en área",
      passive: "Al matar un enemigo, recupera 20 HP automáticamente del alma absorbida",
      lore: "Reliquia de los Eruditos del Vacío, zumba con gritos reprimidos de las almas que ha consumido a lo largo de siglos",
      crafting_material: "Cristal oscuro de abismo, alma sellada en ámbar y fragmento de estrella muerta",
      value: 5200,
    },
  ],

  enemy: [
    {
      name: "Acechador Carmesí",
      type: "Bestia",
      difficulty: "Media",
      hp: 320,
      armor: 15,
      speed: "Muy rápido",
      attack_style: "Embosca desde el sigilo con combinaciones de garras rápidas, se retira a las sombras entre ataques",
      abilities: ["Camuflaje de Depredador — invisible durante 8 segundos en zonas sin luz directa", "Carga Devastadora — embiste a máxima velocidad causando aturdimiento de 2 segundos"],
      weakness: "Vulnerable al fuego; pierde el camuflaje si recibe daño arcano; detestable olfato a ajo negro",
      resistance: "Inmune a veneno y hemorragia; resistente un 50% al daño físico frontal",
      drops: "Piel Carmesí (70%), Núcleo de Bestia (30%), Garra Iridiscente (5% raro)",
      description: "Predador de seis patas con piel camaleónica y tendones como cables de acero; sus ojos reflejan el miedo de las presas",
      lore: "Evolucionó en las cavernas de las Minas Olvidadas, caza en solitario y marca su territorio con cicatrices en los árboles",
    },
    {
      name: "Revenant del Velo",
      type: "No-muerto",
      difficulty: "Difícil",
      hp: 580,
      armor: 35,
      speed: "Medio con teletransporte",
      attack_style: "Se teletransporta detrás del objetivo y desencadena una explosión de drenaje de alma, inmune al daño físico estándar",
      abilities: ["Teletransporte del Vacío — aparece detrás del enemigo más cercano cada 6 segundos", "Drenaje de Alma — reduce la vida máxima del objetivo un 10% permanentemente hasta el final del combate"],
      weakness: "Luz sagrada cancela el teletransporte; sal bendita crea barrera que no puede cruzar",
      resistance: "Inmune a daño físico no sagrado; resistente 75% a veneno y fuego",
      drops: "Fragmento de Ecto (90%), Moneda Maldita (60%), Armadura Rota del General (15%)",
      description: "General caído resucitado por ritos prohibidos, aún viste su armadura destrozada y recuerda fragmentos de su vida mortal",
      lore: "Fue el mejor estratega del reino antes de que un nigromante lo arrancara del descanso eterno para servir como arma viviente",
    },
    {
      name: "Señor de las Brasas Moloch",
      type: "Demonio",
      difficulty: "Jefe",
      hp: 2400,
      armor: 60,
      speed: "Lento pero imparable",
      attack_style: "Erupciones de área, pilares de lava, carga de colisión; en fase de furia activa un escudo de fuego constante",
      abilities: ["Erupción del Averno — lava en área de 8m de radio con 3 segundos de advertencia", "Furia Infernal — por debajo del 30% HP duplica velocidad y daño durante 45 segundos"],
      weakness: "Hielo en la boca (punto débil visible); detener las erupciones tapando los agujeros del suelo",
      resistance: "Inmune a fuego, veneno y quemaduras; resistente 80% a daño físico",
      drops: "Corazón de Demonio (100%), Corona de Brasas (100%), Fragmento de Runa Rara (35%), Cristal de Fuego Eterno (10%)",
      description: "Señor de los Planos de las Cenizas, un coloso de obsidiana y lava que desprende calor suficiente para derretir armaduras de acero",
      lore: "Invocado cuando los mortales rompen el Sello de la Llama; fue aprisionado hace 3,000 años por los Doce Paladines del Alba",
    },
  ],
};

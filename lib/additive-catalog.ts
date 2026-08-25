/**
 * Catálogo de aditivos (aditivos_supermercado.pdf).
 * Cada código E es una entrada individual, ordenado por número en la guía.
 */

export type AdditiveVerdict = "ok" | "caution" | "avoid";

export interface AdditiveEntry {
  id: string;
  /** Nombre para mostrar, p. ej. "E200 — Sorbato de potasio" */
  name: string;
  category: string;
  verdict: AdditiveVerdict;
  summary: string;
  eCode?: number;
  keywords?: string[];
}

function e(
  code: number,
  shortName: string,
  category: string,
  verdict: AdditiveVerdict,
  summary: string,
  keywords: string[] = []
): AdditiveEntry {
  return {
    id: `e${code}`,
    name: `E${code} — ${shortName}`,
    eCode: code,
    category,
    verdict,
    summary,
    keywords: [shortName.toLowerCase(), ...keywords],
  };
}

function text(
  id: string,
  name: string,
  category: string,
  verdict: AdditiveVerdict,
  summary: string,
  keywords: string[] = []
): AdditiveEntry {
  return {
    id,
    name,
    category,
    verdict,
    summary,
    keywords: [name.toLowerCase(), ...keywords],
  };
}

/** Entradas con código E (una por número). */
const E_ENTRIES: AdditiveEntry[] = [
  // Colorantes naturales — tranquilos
  e(100, "Curcumina", "Colorantes", "ok", "Colorante natural. Tranquilo."),
  e(160, "Carotenos", "Colorantes", "ok", "Colorante natural. Tranquilo.", ["caroteno", "beta-caroteno"]),
  e(162, "Betanina (remolacha)", "Colorantes", "ok", "Colorante natural de remolacha. Tranquilo.", ["betanina", "remolacha"]),

  // Colorantes azoicos — ojo
  e(102, "Tartrazina", "Colorantes", "caution", 'Colorante azoico. Aviso "puede afectar a la atención" en niños.', ["tartrazina", "tartrazine"]),
  e(104, "Amarillo de quinoleína", "Colorantes", "caution", "Colorante azoico. Precaución en niños."),
  e(110, "Amarillo ocaso FCF", "Colorantes", "caution", "Colorante azoico. Precaución en niños.", ["amarillo ocaso", "sunset yellow"]),
  e(122, "Rojo azorubina", "Colorantes", "caution", "Colorante azoico. Precaución en niños."),
  e(124, "Rojo cochinilla A", "Colorantes", "caution", "Colorante azoico. Precaución en niños."),
  e(129, "Rojo allura AC", "Colorantes", "caution", "Colorante azoico. Precaución en niños.", ["rojo allura", "allura red"]),

  // Evitar
  e(171, "Dióxido de titanio", "Colorantes", "avoid", "Prohibido en la UE desde 2022. No debería aparecer.", ["dioxido de titanio", "titanio"]),

  // Antioxidantes / ácidos — tranquilos o buena señal
  e(170, "Carbonato cálcico", "Antiaglomerantes", "ok", "Antiaglomerante mineral. Tranquilo.", ["carbonato calcico"]),
  e(270, "Ácido láctico", "Acidulantes", "ok", "Acidulante natural. Tranquilo.", ["acido lactico"]),
  e(296, "Ácido málico", "Acidulantes", "ok", "Acidulante de fruta. Tranquilo.", ["acido malico"]),
  e(300, "Ácido ascórbico (vitamina C)", "Antioxidantes", "ok", "Antioxidante. Buena señal en fiambres (reduce nitrosaminas).", ["acido ascorbico", "vitamina c"]),
  e(301, "Ascorbato de sodio", "Antioxidantes", "ok", "Antioxidante. Buena señal en fiambres.", ["ascorbato"]),
  e(306, "Tocoferoles (vitamina E)", "Antioxidantes", "ok", "Antioxidante natural (vitamina E). Tranquilo.", ["tocoferol", "vitamina e"]),
  e(307, "Alfa-tocoferol", "Antioxidantes", "ok", "Antioxidante natural (vitamina E). Tranquilo."),
  e(308, "Gamma-tocoferol", "Antioxidantes", "ok", "Antioxidante natural (vitamina E). Tranquilo."),
  e(309, "Delta-tocoferol", "Antioxidantes", "ok", "Antioxidante natural (vitamina E). Tranquilo."),
  e(315, "Eritorbatos", "Antioxidantes", "ok", "Antioxidante. Buena señal en fiambres.", ["eritorbato", "eritorbato"]),

  // Evitar — BHA/BHT, galato
  e(310, "Galato de propilo", "Conservantes", "avoid", "En grasas y aperitivos. Mismo debate que BHA/BHT.", ["galato de propilo"]),
  e(320, "BHA (butilhidroxianisol)", "Conservantes", "avoid", "Posible cancerígeno. Cambiar de marca si hay opción.", ["bha", "butilhidroxianisol"]),
  e(321, "BHT (butilhidroxitolueno)", "Conservantes", "avoid", "Posible cancerígeno. Cambiar de marca si hay opción.", ["bht", "butilhidroxitolueno"]),

  // Emulgentes
  e(322, "Lecitinas", "Emulgentes", "ok", "Emulgente muy usado, sin problema.", ["lecitina"]),
  e(407, "Carragenano", "Emulgentes", "caution", "Investigación reciente sobre microbiota intestinal.", ["carragenano", "carragenina", "carrageenan"]),
  e(432, "Polisorbato 20", "Emulgentes", "caution", "Emulgente con debate sobre microbiota intestinal.", ["polisorbato 20"]),
  e(433, "Polisorbato 80", "Emulgentes", "caution", "Emulgente con debate sobre microbiota intestinal.", ["polisorbato 80"]),
  e(434, "Polisorbato 40", "Emulgentes", "caution", "Emulgente con debate sobre microbiota intestinal.", ["polisorbato 40"]),
  e(435, "Polisorbato 60", "Emulgentes", "caution", "Emulgente con debate sobre microbiota intestinal.", ["polisorbato 60"]),
  e(436, "Polisorbato 65", "Emulgentes", "caution", "Emulgente con debate sobre microbiota intestinal.", ["polisorbato 65"]),
  e(440, "Pectinas", "Espesantes", "ok", "Espesante natural. Tranquilo.", ["pectina"]),
  e(466, "Carboximetilcelulosa", "Emulgentes", "caution", "Investigación reciente sobre microbiota intestinal.", ["carboximetilcelulosa", "cmc"]),
  e(471, "Mono- y diglicéridos de ácidos grasos", "Emulgentes", "ok", "Emulgente muy usado, sin problema.", ["monogliceridos", "digliceridos", "mono y digliceridos"]),

  // Gasificantes
  e(290, "Dióxido de carbono", "Gases", "ok", "Gas de envasado. Tranquilo.", ["dioxido de carbono", "co2"]),
  e(336, "Cremor tártaro", "Gasificantes", "ok", "Leudante de repostería. Tranquilo.", ["cremor tartaro"]),
  e(500, "Carbonatos de sodio", "Gasificantes", "ok", "Bicarbonato / química de repostería. Tranquilo.", ["bicarbonato", "carbonato sodio"]),
  e(503, "Carbonatos de amonio", "Gasificantes", "ok", "Leudante. Tranquilo."),

  // Antiaglomerantes
  e(551, "Dióxido de silicio", "Antiaglomerantes", "ok", "Antiaglomerante. Tranquilo.", ["silicio"]),

  // Potenciadores del sabor
  e(621, "Glutamato monosódico (GMS)", "Potenciadores", "ok", "El miedo al glutamato está desmentido.", ["glutamato", "gms", "msg"]),
  e(627, "Guanylato disódico", "Potenciadores", "ok", "Potenciador del sabor. Tranquilo.", ["guanylato"]),
  e(631, "Inosinato disódico", "Potenciadores", "ok", "Potenciador del sabor. Tranquilo.", ["inosinato"]),

  // Espesantes
  e(412, "Goma guar", "Espesantes", "ok", "Espesante natural. Tranquilo.", ["goma guar", "guar"]),
  e(415, "Goma xantana", "Espesantes", "ok", "Espesante natural. Tranquilo.", ["xantana", "xanthan"]),

  // Edulcorantes — tranquilos
  e(951, "Aspartamo", "Edulcorantes", "ok", "OK en general. Debate solo en dosis enormes.", ["aspartamo"]),
  e(955, "Sucralosa", "Edulcorantes", "ok", "Edulcorante. OK en general.", ["sucralosa"]),
  e(960, "Glucósidos de esteviol (estevia)", "Edulcorantes", "ok", "Edulcorante natural. OK en general.", ["estevia", "stevia"]),

  // Polioles — ojo
  e(420, "Sorbitol", "Edulcorantes", "caution", "Efecto laxante en cantidad, sobre todo en niños.", ["sorbitol"]),
  e(421, "Manitol", "Edulcorantes", "caution", "Efecto laxante en cantidad.", ["manitol"]),
  e(953, "Isomalt", "Edulcorantes", "caution", "Poliol. Efecto laxante en cantidad.", ["isomalt"]),
  e(965, "Maltitol", "Edulcorantes", "caution", "Efecto laxante en cantidad, sobre todo en niños.", ["maltitol"]),
  e(966, "Lactitol", "Edulcorantes", "caution", "Poliol. Efecto laxante en cantidad.", ["lactitol"]),
  e(967, "Xilitol", "Edulcorantes", "caution", "Poliol. Efecto laxante en cantidad.", ["xilitol", "xylitol"]),

  // Emulsionantes polisorbato (continuación)
  e(491, "Polisorbato 60 (grasas)", "Emulgentes", "caution", "Emulgente con debate sobre microbiota.", ["polisorbato"]),
  e(492, "Polisorbato 65 (grasas)", "Emulgentes", "caution", "Emulgente con debate sobre microbiota."),
  e(493, "Polisorbato 80 (grasas)", "Emulgentes", "caution", "Emulgente con debate sobre microbiota."),
  e(494, "Polisorbato 20 (grasas)", "Emulgentes", "caution", "Emulgente con debate sobre microbiota."),
  e(495, "Polisorbato 80 (grasas, otro)", "Emulgentes", "caution", "Emulgente con debate sobre microbiota."),

  // Acidulantes
  e(330, "Ácido cítrico", "Acidulantes", "ok", "Ácido de fruta. El bulo de que causa cáncer es falso.", ["acido citrico"]),
  e(338, "Ácido fosfórico", "Acidulantes", "caution", "En refrescos de cola. Es un fosfato: moderar si se abusa.", ["acido fosforico"]),

  // Fosfatos — evitar
  e(450, "Difosfatos", "Fosfatos", "avoid", "Retienen agua e hinchan el producto. Señal de calidad baja.", ["difosfato"]),
  e(451, "Trifosfatos", "Fosfatos", "avoid", "Retienen agua e hinchan el producto. Señal de calidad baja.", ["trifosfato"]),
  e(452, "Polifosfatos", "Fosfatos", "avoid", "Retienen agua e hinchan el producto. Señal de calidad baja.", ["polifosfato", "fosfato"]),

  // Conservantes — benzoatos (tranquilos)
  e(210, "Ácido benzoico", "Conservantes", "ok", "Conservante. OK en general.", ["acido benzoico"]),
  e(211, "Benzoato de sodio", "Conservantes", "ok", "Conservante. Leve debate con vitamina C en bebidas ácidas.", ["benzoato"]),
  e(212, "Benzoato de potasio", "Conservantes", "ok", "Conservante. OK en general."),
  e(213, "Benzoato de calcio", "Conservantes", "ok", "Conservante. OK en general."),

  // Parabenos — ojo
  e(214, "Etil p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno"]),
  e(215, "Propil p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno"]),
  e(216, "Butil p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno"]),
  e(217, "Heptil p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno"]),
  e(218, "Metil p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno", "metilparabeno"]),
  e(219, "Na p-hidroxibenzoato", "Conservantes", "caution", "Parabeno. Dudas sobre efecto hormonal.", ["parabeno"]),

  // Sulfitos — ojo
  e(220, "Dióxido de azufre", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito", "dioxido de azufre"]),
  e(221, "Sulfito de sodio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito"]),
  e(222, "Bisulfito de sodio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito", "bisulfito"]),
  e(223, "Metabisulfito de sodio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["metabisulfito"]),
  e(224, "Metabisulfito de potasio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["metabisulfito"]),
  e(225, "Sulfito de potasio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito"]),
  e(226, "Sulfito de calcio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito"]),
  e(227, "Bisulfito de calcio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito"]),
  e(228, "Bisulfito de potasio", "Conservantes", "caution", "Sulfito. Ojo si hay asma o alergia.", ["sulfito"]),

  // Sorbatos — tranquilos
  e(200, "Ácido sórbico", "Conservantes", "ok", "Conservante. De los más seguros.", ["acido sorbico", "sorbico"]),
  e(201, "Sorbato de potasio", "Conservantes", "ok", "Conservante. De los más seguros.", ["sorbato"]),
  e(202, "Sorbato de calcio", "Conservantes", "ok", "Conservante. De los más seguros.", ["sorbato"]),
  e(203, "Sorbato de potasio (variante)", "Conservantes", "ok", "Conservante. De los más seguros.", ["sorbato"]),

  // Nitritos / nitratos — ojo
  e(234, "Nisina", "Conservantes", "ok", "Conservante de origen natural (quesos). Tranquilo.", ["nisina"]),
  e(235, "Natamicina", "Conservantes", "ok", "Conservante de origen natural (corteza de quesos). Tranquilo.", ["natamicina"]),
  e(249, "Nitrito de potasio", "Conservantes", "caution", "Conserva carne curada. OK de vez en cuando, no a diario.", ["nitrito"]),
  e(250, "Nitrito de sodio", "Conservantes", "caution", "Conserva carne curada. OK de vez en cuando, no a diario.", ["nitrito"]),
  e(251, "Nitrato de sodio", "Conservantes", "caution", "Conserva carne curada. OK de vez en cuando, no a diario.", ["nitrato"]),
  e(252, "Nitrato de potasio", "Conservantes", "caution", "Conserva carne curada. OK de vez en cuando, no a diario.", ["nitrato"]),

  // Propionatos — tranquilos
  e(280, "Ácido propiónico", "Conservantes", "ok", "Antimoho en pan de molde. Seguro.", ["acido propionico"]),
  e(281, "Propionato de sodio", "Conservantes", "ok", "Antimoho en pan de molde. Seguro.", ["propionato"]),
  e(282, "Propionato de calcio", "Conservantes", "ok", "Antimoho en pan de molde. Seguro.", ["propionato"]),
  e(283, "Propionato de potasio", "Conservantes", "ok", "Antimoho en pan de molde. Seguro.", ["propionato"]),

  // Almidones modificados — tranquilos
  e(1404, "Almidón oxidado", "Almidones", "ok", '"Modificado" no es químico raro ni transgénico.', ["almidon modificado"]),
  e(1410, "Almidón de monofosfato", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),
  e(1412, "Almidón de difosfato", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),
  e(1414, "Almidón de acetato", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),
  e(1420, "Almidón de acetato", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),
  e(1440, "Almidón de hidroxipropil", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),
  e(1450, "Almidón de octenil succinato", "Almidones", "ok", "Almidón modificado. Tranquilo.", ["almidon"]),

  // Ceras — tranquilas
  e(901, "Cera de abejas", "Ceras", "ok", "Recubrimiento comestible. Tranquilo.", ["cera de abejas"]),
  e(903, "Cera de carnauba", "Ceras", "ok", "Recubrimiento comestible. Tranquilo.", ["carnauba"]),
  e(904, "Goma laca", "Ceras", "ok", "Recubrimiento comestible. Tranquilo.", ["goma laca"]),

  // Gases
  e(941, "Nitrógeno", "Gases", "ok", "Gas de envasado. Tranquilo.", ["nitrogeno"]),
];

/** Entradas sin código E (texto en etiqueta). */
const TEXT_ENTRIES: AdditiveEntry[] = [
  text(
    "carne-separada",
    "Carne separada mecánicamente",
    "Carnes procesadas",
    "avoid",
    "Restos de carne prensados. Indica producto de relleno.",
    ["carne separada mecanicamente", "mechanically separated meat"]
  ),
  text(
    "nitritos-generico",
    "Nitritos / nitratos (sin E)",
    "Carnes curadas",
    "caution",
    "Conservan y dan color a la carne curada. OK de vez en cuando, no a diario.",
    ["nitrito", "nitrato", "nitrite", "nitrate"]
  ),
  text(
    "sulfitos-etiqueta",
    "Sulfitos (mención en etiqueta)",
    "Conservantes",
    "caution",
    "Ojo si hay asma o alergia.",
    ["contiene sulfitos", "contiene sulfito"]
  ),
];

export const ADDITIVE_CATALOG: AdditiveEntry[] = [
  ...E_ENTRIES.sort((a, b) => (a.eCode ?? 0) - (b.eCode ?? 0)),
  ...TEXT_ENTRIES.sort((a, b) => a.name.localeCompare(b.name, "es")),
];

/** Mapa E-code → entrada (para búsqueda rápida). */
export const ADDITIVE_BY_E_CODE = new Map<number, AdditiveEntry>(
  E_ENTRIES.map((entry) => [entry.eCode!, entry])
);

export const VERDICT_LABELS: Record<AdditiveVerdict, string> = {
  ok: "Tranquilo",
  caution: "Ojo",
  avoid: "Evitar si puedes",
};

export const VERDICT_ORDER: AdditiveVerdict[] = ["avoid", "caution", "ok"];

/** Guía ordenada: códigos E por número, luego entradas de texto A-Z. */
export function getCatalogForBrowse(): AdditiveEntry[] {
  return ADDITIVE_CATALOG;
}

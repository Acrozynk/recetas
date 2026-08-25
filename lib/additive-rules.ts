/**
 * Additive rules derived from aditivos_supermercado.pdf
 * Verdicts: caution (naranja) and avoid (rojo) are flagged as unhealthy.
 */

export type AdditiveVerdict = "caution" | "avoid";

export interface AdditiveRule {
  id: string;
  name: string;
  category: string;
  verdict: AdditiveVerdict;
  summary: string;
  eCodes?: number[];
  eCodeRanges?: [number, number][];
  keywords?: string[];
}

export const ADDITIVE_RULES: AdditiveRule[] = [
  // 1. Salchichas, fiambres y carnes
  {
    id: "nitritos-nitratos",
    name: "Nitritos / nitratos",
    category: "Carnes curadas",
    verdict: "caution",
    summary: "Conservan y dan color a la carne curada. OK de vez en cuando, no a diario.",
    eCodeRanges: [[249, 252]],
    keywords: ["nitrito", "nitrato", "nitrite", "nitrate"],
  },
  {
    id: "fosfatos",
    name: "Fosfatos",
    category: "Carnes procesadas",
    verdict: "avoid",
    summary: "Retienen agua e hinchan el producto. Señal de calidad baja.",
    eCodes: [450, 451, 452, 338],
    keywords: ["fosfato", "phosphate", "acido fosforico", "ácido fosfórico"],
  },
  {
    id: "carne-separada-mecanicamente",
    name: "Carne separada mecánicamente",
    category: "Carnes procesadas",
    verdict: "avoid",
    summary: "Restos de carne prensados. Indica producto de relleno.",
    keywords: [
      "carne separada mecanicamente",
      "carne separada mecánicamente",
      "mechanically separated meat",
    ],
  },

  // 2. Conservantes
  {
    id: "sulfitos",
    name: "Sulfitos",
    category: "Conservantes",
    verdict: "caution",
    summary: "En vino, frutos secos, patata prelavada… Ojo si hay asma o alergia.",
    eCodeRanges: [[220, 228]],
    keywords: ["sulfito", "sulfite", "anhidrido sulfuroso", "anídrido sulfuroso", "metabisulfito"],
  },
  {
    id: "bha-bht",
    name: "BHA / BHT",
    category: "Conservantes",
    verdict: "avoid",
    summary: "En snacks, grasas y cereales. BHA es posible cancerígeno; cambiar de marca si hay opción.",
    eCodes: [320, 321],
    keywords: ["bha", "bht", "butilhidroxianisol", "butilhidroxitolueno", "butylated"],
  },
  {
    id: "galato-propilo",
    name: "Galato de propilo",
    category: "Conservantes",
    verdict: "avoid",
    summary: "En grasas y aperitivos. Mismo debate que BHA/BHT.",
    eCodes: [310],
    keywords: ["galato de propilo", "propyl gallate"],
  },
  {
    id: "parabenos",
    name: "Parabenos",
    category: "Conservantes",
    verdict: "caution",
    summary: "Poco frecuentes hoy en la UE. Dudas sobre efecto hormonal.",
    eCodeRanges: [[214, 219]],
    keywords: ["parabeno", "paraben"],
  },

  // 3. Emulgentes, colorantes, edulcorantes
  {
    id: "emulgentes-debate",
    name: "Emulgentes con debate",
    category: "Emulgentes",
    verdict: "caution",
    summary: "Investigación reciente sobre microbiota intestinal.",
    eCodes: [407, 466, 432, 433, 434, 435, 436, 491, 492, 493, 494, 495],
    keywords: [
      "polisorbato",
      "polysorbate",
      "carboximetilcelulosa",
      "carboxymethylcellulose",
      "carragenano",
      "carrageenan",
      "carragenina",
    ],
  },
  {
    id: "colorantes-azoicos",
    name: "Colorantes azoicos",
    category: "Colorantes",
    verdict: "caution",
    summary: 'Llevan aviso "puede afectar a la atención" en niños.',
    eCodes: [102, 104, 110, 122, 124, 129],
    keywords: [
      "tartrazina",
      "tartrazine",
      "amarillo ocaso",
      "sunset yellow",
      "rojo allura",
      "allura red",
      "colorante azoico",
    ],
  },
  {
    id: "polioles",
    name: "Polioles (edulcorantes)",
    category: "Edulcorantes",
    verdict: "caution",
    summary: "Efecto laxante en cantidad, sobre todo en niños.",
    eCodes: [420, 421, 953, 965, 966, 967],
    keywords: ["sorbitol", "maltitol", "manitol", "manitol", "xilitol", "xylitol", "isomalt"],
  },
  {
    id: "dioxido-titanio",
    name: "Dióxido de titanio",
    category: "Colorantes",
    verdict: "avoid",
    summary: "Prohibido en la UE desde 2022. No debería aparecer.",
    eCodes: [171],
    keywords: ["dioxido de titanio", "dióxido de titanio", "titanium dioxide"],
  },
];

export const VERDICT_LABELS: Record<AdditiveVerdict, string> = {
  caution: "Ojo",
  avoid: "Evitar si puedes",
};

export const VERDICT_ORDER: AdditiveVerdict[] = ["avoid", "caution"];

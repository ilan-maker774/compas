/** Libellés affichés. Tout l'affichage est en français. */

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  pea: "PEA",
  pea_pme: "PEA-PME",
  cto: "Compte-titres",
  assurance_vie: "Assurance-vie",
  per: "PER",
  autre: "Autre",
};

export const INSTRUMENT_TYPE_LABELS: Record<string, string> = {
  action: "Action",
  etf: "ETF",
  fonds: "Fonds (OPCVM)",
  obligation: "Obligation",
  fonds_euros: "Fonds euros",
  indice: "Indice (référence)",
  autre: "Autre",
};

export const ASSET_CLASS_LABELS: Record<string, string> = {
  actions: "Actions",
  obligations: "Obligations",
  monetaire: "Monétaire",
  fonds_euros: "Fonds euros",
  immobilier: "Immobilier",
  matieres_premieres: "Matières premières",
  mixte: "Mixte",
  autre: "Autre",
  liquidites: "Liquidités",
};

export const REGION_LABELS: Record<string, string> = {
  monde: "Monde",
  france: "France",
  europe: "Europe",
  amerique_du_nord: "Amérique du Nord",
  japon: "Japon",
  asie_pacifique: "Asie-Pacifique",
  emergents: "Pays émergents",
  autre: "Autre",
  non_renseigne: "Non renseignée",
  liquidites: "Liquidités",
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  achat: "Achat",
  vente: "Vente",
  dividende: "Dividende",
  interets: "Intérêts",
  frais: "Frais",
  taxe: "Taxe",
  versement: "Versement",
  retrait: "Retrait",
};

export const OUTCOME_LABELS: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  partiellement: "Partiellement",
};

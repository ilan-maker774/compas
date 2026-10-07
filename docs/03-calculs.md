# 3. Règles de calcul

Code : [`src/lib/finance/`](../src/lib/finance) · Tests : [`tests/unit/`](../tests/unit)

Tous les montants sont calculés en décimal exact (decimal.js), jamais en virgule flottante.

## Valorisation
- Valeur d'une ligne = quantité × dernier cours de clôture connu à la date ÷ taux BCE (1 € = x devise).
- S'il n'existe aucun cours plus récent que la dernière opération, on retient le prix de cette opération
  (source affichée : « dernière transaction »).
- Fonds euros : 1 part = 1 €, toujours.
- Aucun taux de change disponible → **le calcul est refusé** avec un message, plutôt qu'approximé.

## Prix de revient et plus-values
- PRU = coût total d'acquisition (prix × quantité + frais + taxes, en € au taux de l'achat) ÷ quantité.
- Calculé par compte et par titre. Une vente réalise `produit net − PRU × quantité` et laisse le PRU inchangé.
- Revenus = dividendes et intérêts nets de retenues. Les intérêts capitalisés du fonds euros ajoutent des parts
  et augmentent le coût de revient : ils apparaissent en revenus, pas en plus-value latente.

## Liquidités et flux externes
- Un compte **suit les espèces** dès qu'il contient un versement ou un retrait : sa valeur inclut les liquidités,
  et seuls versements et retraits sont des apports ou retraits d'argent.
- Sur un compte sans versement saisi (cas fréquent d'un import partiel), chaque achat est un apport et chaque
  vente, dividende ou frais un flux de sortie : la performance reste juste sans avoir à reconstituer les espèces.

## Performance
| Indicateur | Définition | Usage |
|---|---|---|
| **TWR** (pondérée par le temps) | Chaînage des sous-périodes entre deux flux : `(V_i − F_i) / V_{i−1}` (flux supposés à la clôture) | Qualité des choix, comparable à un indice |
| **TRI** (pondéré par l'argent) | Taux r tel que Σ flux / (1 + r)^(jours/365) = 0 — identique à XIRR d'Excel | Rendement réel de vos euros |
| **Benchmark** | Variation du cours de l'indice choisi, convertie en €, sur la même période | Comparaison |

Le portefeuille est valorisé à chaque date de flux (indispensable pour un TWR exact) et à chaque fin de mois
(graphique). TWR annualisé seulement au-delà d'un an. Exactitude vérifiée contre l'exemple de la documentation
Excel (XIRR = 37,34 %) et des cas calculés à la main (voir `tests/unit/performance.test.ts`).

## Journal de thèse
- Un indicateur décrit la condition attendue (« marge ≥ 20 % ») ; il est **hors condition** quand la valeur
  renseignée ne la respecte plus. C'est un constat, jamais une recommandation.
- Prochaine revue = la plus proche entre « dernière revue + N mois » et « lendemain de la prochaine publication
  de résultats » (connue via le fournisseur de données).
- Invitations facultatives : rédiger une thèse à l'ouverture d'une position, la clôturer quand elle est soldée.

## Données de marché
- Cours de clôture quotidiens via un fournisseur interchangeable (`MARKET_DATA_PROVIDER=eodhd` + `EODHD_API_KEY`).
  Sans fournisseur, les cours des instruments personnels se saisissent à la main.
- Taux de change : taux de référence BCE (gratuits).
- Tâche quotidienne : `npm run job:daily` (à planifier en semaine après 18 h). Elle ne déclenche aucune
  notification liée aux cours.

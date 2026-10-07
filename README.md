# Compas (nom provisoire)

Outil d'aide à la décision pour investisseurs particuliers exigeants (PEA, CTO, assurance-vie, PER).

Compas n'est pas une plateforme de courtage : il aide à **mieux décider**, pas à décider plus souvent.

## Documentation produit

1. [Vision](docs/01-vision.md)
2. [Modèle de données](docs/02-modele-de-donnees.md)
3. [Règles de calcul](docs/03-calculs.md)

## État d'avancement

- [x] Section 1 — Vision et principes directeurs
- [x] Modèle de données
- [x] Import et calculs du portefeuille
- [x] Journal de thèse
- [x] Tableau de bord
- [ ] Authentification (Auth.js) — prérequis avant toute mise en ligne
- [ ] Chiffrement applicatif des textes de thèse

## Lancer le projet en local

Prérequis : Node.js 22+, PostgreSQL 16 (ou Docker).

```bash
cp .env.example .env
docker compose up -d        # PostgreSQL local (bases compas et compas_test)
npm install
npm run db:migrate          # crée les tables
npm run db:seed             # profil de démonstration (cours simulés)
npm test                    # tests unitaires et base de données
npm run dev                 # http://localhost:3000
npm run job:daily           # mise à jour des cours et taux (à planifier chaque jour)
```

Sans profil, l'application ouvre la page « Bienvenue » : on y crée un profil, vide ou avec le portefeuille
de démonstration.

## Limites actuelles (V1 locale)
- **Pas encore d'authentification** : application mono-utilisateur, à n'utiliser qu'en local. Tout passe par
  `getCurrentUser()` (`src/server/current-user.ts`), seul point à modifier pour brancher Auth.js.
- Les cours de démonstration sont **simulés** (source « démo »).
- Divisions d'actions non gérées.

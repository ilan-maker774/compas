# Compas (nom provisoire)

Outil d'aide à la décision pour investisseurs particuliers exigeants (PEA, CTO, assurance-vie, PER).

Compas n'est pas une plateforme de courtage : il aide à **mieux décider**, pas à décider plus souvent.

## Documentation produit

1. [Vision](docs/01-vision.md)
2. [Modèle de données](docs/02-modele-de-donnees.md)

## État d'avancement

- [x] Section 1 — Vision et principes directeurs
- [x] Modèle de données
- [ ] Import et calculs du portefeuille
- [ ] Journal de thèse
- [ ] Tableau de bord

## Lancer le projet en local

Prérequis : Node.js 22+, PostgreSQL 16 (ou Docker).

```bash
cp .env.example .env
docker compose up -d        # PostgreSQL local (bases compas et compas_test)
npm install
npm run db:migrate          # crée les tables
npm run db:seed             # données de démonstration
npm test                    # tests du modèle de données
npm run dev                 # http://localhost:3000
```

# Bijouterie — application microservices (CRUD bijoux en or)

Petite boutique en ligne de bijoux en or : catalogue, ajout, modification,
suppression de bijoux, avec **photo** pour chaque bijou.

```
Navigateur ──► frontend (Nginx :80) ──/api/*──► backend (Node.js :3000) ──► mysql (:3306)
```

| Service    | Dossier      | Technologie            | Port | Rôle                                                  |
|------------|--------------|------------------------|------|-------------------------------------------------------|
| `frontend` | `frontend/`  | Nginx 1.27 + HTML/JS   | 80   | Sert le site et relaie `/api/*` vers le backend        |
| `backend`  | `backend/`   | Node.js 20 / Express   | 3000 | API REST CRUD, stockage des photos en base (BLOB)     |
| `mysql`    | `database/`  | MySQL 8.4              | 3306 | Base `bijouterie`, table `bijoux` + données de démo   |

## Lancer en local

```bash
cp .env.example .env          # facultatif
docker compose up --build
```

Puis ouvrir <http://localhost:8080>.

Arrêter : `docker compose down` (ajouter `-v` pour effacer aussi les données MySQL).

## Variables d'environnement

### backend
| Variable                    | Défaut          | Sensible | Description                              |
|-----------------------------|-----------------|----------|------------------------------------------|
| `PORT`                      | `3000`          | non      | Port d'écoute de l'API                    |
| `DB_HOST`                   | *(obligatoire)* | non      | Hôte MySQL (nom du service)               |
| `DB_PORT`                   | `3306`          | non      | Port MySQL                                |
| `DB_NAME`                   | *(obligatoire)* | non      | Nom de la base                            |
| `DB_USER`                   | *(obligatoire)* | **oui**  | Utilisateur MySQL                         |
| `DB_PASSWORD`               | *(obligatoire)* | **oui**  | Mot de passe MySQL                        |
| `SHOP_NAME`                 | `Maison Aurore` | non      | Nom affiché sur le site                   |
| `CURRENCY`                  | `EUR`           | non      | Devise des prix (code ISO 4217)           |
| `MAX_FILE_SIZE_MB`          | `5`             | non      | Taille max d'une photo                    |
| `DB_CONNECT_RETRIES`        | `30`            | non      | Nb de tentatives de connexion au démarrage|
| `DB_CONNECT_RETRY_DELAY_MS` | `3000`          | non      | Délai entre deux tentatives               |

### frontend
| Variable          | Défaut                 | Description                                  |
|-------------------|------------------------|----------------------------------------------|
| `BACKEND_URL`     | `http://backend:3000`  | URL interne du backend (reverse proxy Nginx) |
| `MAX_UPLOAD_SIZE` | `6m`                   | Taille max d'une requête (upload photo)      |

### mysql
`MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` (toutes obligatoires).

## API REST

| Méthode  | Route                    | Description                                       |
|----------|--------------------------|---------------------------------------------------|
| `GET`    | `/api/health`            | Liveness : le processus répond                    |
| `GET`    | `/api/ready`             | Readiness : la base est joignable (503 sinon)     |
| `GET`    | `/api/config`            | Configuration publique + nom du pod (`servedBy`)  |
| `GET`    | `/api/bijoux`            | Liste (`?categorie=bague&q=or`)                   |
| `GET`    | `/api/bijoux/:id`        | Détail                                            |
| `GET`    | `/api/bijoux/:id/photo`  | Photo du bijou                                    |
| `POST`   | `/api/bijoux`            | Création (`multipart/form-data`, champ `photo`)   |
| `PUT`    | `/api/bijoux/:id`        | Modification (photo facultative, `supprimerPhoto=true`) |
| `DELETE` | `/api/bijoux/:id`        | Suppression                                       |

Champs d'un bijou : `nom`, `description`, `categorie` (`bague`, `collier`,
`bracelet`, `boucles`, `pendentif`, `montre`), `carat` (9, 14, 18, 22, 24),
`poids_g`, `prix`, `stock`.

Exemple :
```bash
curl -F nom="Bague Test" -F categorie=bague -F carat=18 -F poids_g=3.5 \
     -F prix=450 -F stock=2 -F photo=@bague.jpg http://localhost:8080/api/bijoux
```

## Remarques techniques

- Les photos sont stockées **dans MySQL** (colonne `LONGBLOB`) : le backend ne
  garde aucun fichier sur disque, il peut donc tourner avec plusieurs replicas.
- Le backend crée la table si elle n'existe pas et réessaie de se connecter à
  MySQL tant que la base n'est pas prête.
- Le frontend n'appelle que des URL relatives (`/api/...`) ; seul le frontend a
  besoin d'être exposé à l'extérieur.

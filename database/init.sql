-- =============================================================================
-- Script d'initialisation de la base « bijouterie »
-- -----------------------------------------------------------------------------
-- Exécuté automatiquement par l'image MySQL officielle au PREMIER démarrage
-- (fichiers présents dans /docker-entrypoint-initdb.d/), dans la base
-- désignée par la variable MYSQL_DATABASE.
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS bijoux (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(120)  NOT NULL,
  description  TEXT,
  categorie    VARCHAR(40)   NOT NULL,
  carat        TINYINT       NOT NULL,
  poids_g      DECIMAL(7,2)  NOT NULL,
  prix         DECIMAL(10,2) NOT NULL,
  stock        INT           NOT NULL DEFAULT 0,
  photo        LONGBLOB      NULL,
  photo_mime   VARCHAR(40)   NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jeu de données de démonstration (sans photo : à ajouter depuis le site)
INSERT INTO bijoux (nom, description, categorie, carat, poids_g, prix, stock) VALUES
  ('Alliance Éternité',        'Alliance classique en or jaune poli, profil demi-jonc.',            'bague',     18,  4.20,  690.00, 12),
  ('Solitaire Aurore',         'Bague solitaire en or rose, griffes fines.',                        'bague',     18,  3.10,  890.00,  5),
  ('Chaîne Maille Forçat',     'Chaîne maille forçat 50 cm, fermoir mousqueton.',                   'collier',   18,  7.80, 1150.00,  8),
  ('Bracelet Jonc Soleil',     'Jonc rigide ouvrant en or jaune, finition martelée.',               'bracelet',  18, 12.50, 1890.00,  3),
  ('Créoles Lune',             'Paire de créoles diamètre 25 mm en or jaune.',                      'boucles',   14,  2.60,  320.00, 15),
  ('Pendentif Médaille Vierge','Médaille ronde gravée, idéale pour un baptême.',                    'pendentif', 18,  1.90,  240.00, 20),
  ('Gourmette Enfant',         'Gourmette personnalisable par gravure.',                            'bracelet',   9,  2.30,  145.00, 10),
  ('Lingotin Prestige',        'Pendentif lingotin en or pur, poinçon de garantie.',                'pendentif', 24,  5.00,  620.00,  4);

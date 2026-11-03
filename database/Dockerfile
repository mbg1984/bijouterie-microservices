# =============================================================================
# Image de la base de données MySQL de la bijouterie
# -----------------------------------------------------------------------------
# On part de l'image officielle et on y ajoute le script d'initialisation
# (création de la table + données de démonstration).
#
# Variables attendues au démarrage (aucune valeur par défaut, à fournir
# via docker compose / Secret Kubernetes) :
#   MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
# =============================================================================
FROM mysql:8.4

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 3306

# =============================================================================
# Image du microservice frontend (site statique servi par Nginx)
# =============================================================================
FROM nginx:1.27-alpine

# Template de configuration : les variables ${...} sont substituées au démarrage
# par le script /docker-entrypoint.d/20-envsubst-on-templates.sh de l'image.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Fichiers du site
COPY public/ /usr/share/nginx/html/

# Valeurs par défaut (à surcharger via ConfigMap dans Kubernetes)
ENV BACKEND_URL=http://backend:3000 \
    MAX_UPLOAD_SIZE=6m

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

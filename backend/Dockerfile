# =============================================================================
# Image du microservice backend « bijoux-api » (Node.js / Express)
# =============================================================================
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Dépendances d'abord (meilleure utilisation du cache Docker)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 2) Code source
COPY src ./src

# Valeurs par défaut NON sensibles (à surcharger via ConfigMap dans Kubernetes).
# Les variables DB_HOST, DB_NAME, DB_USER et DB_PASSWORD n'ont volontairement
# PAS de valeur par défaut : le conteneur refuse de démarrer sans elles.
ENV PORT=3000 \
    DB_PORT=3306 \
    SHOP_NAME="Maison Aurore" \
    CURRENCY=EUR \
    MAX_FILE_SIZE_MB=5

# Exécution avec un utilisateur non-root (fourni par l'image node)
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "src/server.js"]

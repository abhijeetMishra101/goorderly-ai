#!/bin/bash
# quick-start.sh - Démarrage rapide pour tester OAuth

set -e

echo "🚀 Démarrage rapide GoOrderly.ai"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env non trouvé!${NC}"
    echo -e "${YELLOW}Créez un fichier .env avec vos credentials Google OAuth${NC}"
    echo -e "${YELLOW}Voir OAUTH_TESTING.md pour les instructions${NC}"
    exit 1
fi

# Vérifier si les dépendances sont installées
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}Installation des dépendances backend...${NC}"
    npm install
fi

if [ ! -d frontend/node_modules ]; then
    echo -e "${YELLOW}Installation des dépendances frontend...${NC}"
    cd frontend && npm install && cd ..
fi

# Vérifier la base de données
echo -e "\n${BLUE}Vérification de la base de données...${NC}"
if npm run db:init 2>&1 | grep -q "already exists\|initialized"; then
    echo -e "${GREEN}✓ Base de données OK${NC}"
else
    echo -e "${GREEN}✓ Base de données initialisée${NC}"
fi

echo ""
echo -e "${GREEN}✅ Prêt à démarrer!${NC}"
echo ""
echo -e "${YELLOW}Pour démarrer:${NC}"
echo -e "${BLUE}Terminal 1 (Backend):${NC} npm run dev"
echo -e "${BLUE}Terminal 2 (Frontend):${NC} cd frontend && npm start"
echo ""
echo -e "${YELLOW}Puis ouvrez:${NC} http://localhost:3001"
echo ""


# SuperDashboard

[![CC BY-NC-SA 4.0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by-nc-sa.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

[![GitHub repository](https://img.shields.io/badge/GitHub-luilautre%2FSuperDashboard-181717?logo=github)](https://github.com/luilautre/SuperDashboard)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-application-000000?logo=express&logoColor=white)
![Google](https://img.shields.io/badge/Google-Gmail%20%26%20Calendar-4285F4?logo=google&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-OAuth-5865F2?logo=discord&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-database-3FCF8E?logo=supabase&logoColor=white)

Application Express locale de dashboard avec connexion Google, lecture des messages Gmail et des prochains événements Google Calendar, connexion Discord pour afficher les serveurs accessibles, et notes privées enregistrées dans Supabase.

## Installation

1. Node.js 18 ou plus récent.
2. Copie `.env.example` vers `.env` et remplis les variables.
3. Google Cloud Console : active Gmail API et Google Calendar API. Crée un client OAuth Web, ajoute l’URI `http://localhost:3000/auth/google/callback` et autorise les scopes Gmail `gmail.readonly` et Calendar `calendar.readonly` (le code les demande).
4. Supabase : exécute `supabase/schema.sql` dans le SQL Editor. Mets l’URL et la clé `service_role` dans `.env`; garde cette clé uniquement côté serveur.
5. Discord Developer Portal : crée une application OAuth2, ajoute `http://localhost:3000/auth/discord/callback` comme redirect URI, puis renseigne `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET`. Le scope `identify guilds` permet d’afficher les serveurs du compte. Il ne donne pas accès aux messages.
6. Lance `npm install`, puis `npm start`, et ouvre `http://localhost:3000`.

Les routes Gmail et Calendar sont en lecture seule. La connexion Google demande aussi l’identité du compte. Si l’app a déjà été autorisée avant l’ajout de Gmail/Calendar, reconnecte Google pour accorder ces scopes.

**Limites honnêtes :** Discord OAuth affiche les serveurs, pas leurs messages. Pour lire des messages, il faut un bot installé sur le serveur et configuré avec les permissions appropriées; l’application ne fait pas de self-bot. Signal ne dispose pas d’une API publique officielle générale adaptée à cette intégration. Les sessions utilisent actuellement le store mémoire Express, adapté aux essais locaux mais pas à un déploiement serverless multi-instances comme Vercel; il faudra un store persistant pour cette plateforme.

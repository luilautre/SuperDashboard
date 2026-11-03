# SuperDashboard

Application web locale Express avec connexion Google et stockage des notes dans Supabase.

## Installation

1. Installe Node.js 18 ou plus récent.
2. Copie `.env.example` vers `.env`, puis remplis les variables.
3. Dans Google Cloud Console, crée un client OAuth de type **Application Web** et ajoute `http://localhost:3000/auth/google/callback` comme URI de redirection autorisée.
4. Dans Supabase, exécute le SQL de `supabase/schema.sql` dans le SQL Editor.
5. Mets l’URL du projet et la clé `service_role` Supabase dans `.env`. Cette clé reste uniquement sur le serveur et ne doit jamais être publiée.
6. Lance `npm install`, puis `npm start`, et ouvre `http://localhost:3000`.

Variables requises dans `.env` : `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé `service_role` donne des droits élevés : garde le dépôt public exempt de vraies clés, et remplace immédiatement toute clé qui aurait été publiée.

La connexion Google sert ici à l’authentification du compte. Elle ne demande pas l’accès à Gmail ou Google Calendar. Les sessions sont conservées en mémoire pour cette version locale ; elles disparaissent au redémarrage du serveur.

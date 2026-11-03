const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const session = require('express-session');
const { google } = require('googleapis');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${BASE_URL}/auth/google/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET doit être défini dans le fichier .env.');
}

const hasGoogleConfig = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

function createGoogleClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Connecte-toi avec Google pour continuer.' });
  }
  next();
}

function requireSupabase(res) {
  if (hasSupabaseConfig) return true;
  res.status(503).json({ error: 'Supabase n’est pas configuré dans le fichier .env.' });
  return false;
}

async function supabaseRequest(table, query = '', options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase (${response.status}): ${text || response.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

app.set('trust proxy', 1);
app.use(session({
  name: 'superdashboard.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.user),
    user: req.session.user || null,
    googleConfigured: hasGoogleConfig,
    databaseConfigured: hasSupabaseConfig
  });
});

app.get('/auth/google', (req, res) => {
  if (!hasGoogleConfig) {
    return res.status(503).send('Google OAuth n’est pas configuré dans le fichier .env.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  const authUrl = createGoogleClient().generateAuthUrl({
    access_type: 'online',
    state,
    scope: ['openid', 'email', 'profile']
  });
  return res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res, next) => {
  if (req.query.error) {
    return res.status(400).send(`Connexion Google annulée ou refusée : ${String(req.query.error)}`);
  }

  if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) {
    return res.status(400).send('Réponse OAuth invalide. Réessaie de te connecter.');
  }

  delete req.session.oauthState;

  try {
    const oauthClient = createGoogleClient();
    const { tokens } = await oauthClient.getToken(String(req.query.code));
    oauthClient.setCredentials(tokens);
    const { data: profile } = await google.oauth2({ version: 'v2', auth: oauthClient }).userinfo.get();

    if (!profile.id || !profile.email) {
      return res.status(400).send('Google n’a pas fourni l’identifiant ou l’adresse e-mail du compte.');
    }

    const user = {
      google_id: profile.id,
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || null
    };

    if (hasSupabaseConfig) {
      await supabaseRequest('profiles', '?on_conflict=google_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { ...user, updated_at: new Date().toISOString() }
      });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = user;
      return res.redirect('/');
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('superdashboard.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.redirect('/');
  });
});

app.get('/api/notes', requireLogin, async (req, res, next) => {
  if (!requireSupabase(res)) return;
  try {
    const googleId = encodeURIComponent(req.session.user.google_id);
    const notes = await supabaseRequest('notes', `?google_id=eq.${googleId}&select=id,content,created_at&order=created_at.desc`);
    return res.json({ notes });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/notes', requireLogin, async (req, res, next) => {
  if (!requireSupabase(res)) return;
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 500) {
    return res.status(400).json({ error: 'La note doit contenir entre 1 et 500 caractères.' });
  }

  try {
    const [note] = await supabaseRequest('notes', '', {
      method: 'POST',
      body: { google_id: req.session.user.google_id, content }
    });
    return res.status(201).json({ note });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/notes/:id', requireLogin, async (req, res, next) => {
  if (!requireSupabase(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant de note invalide.' });
  }

  try {
    const id = encodeURIComponent(req.params.id);
    const googleId = encodeURIComponent(req.session.user.google_id);
    await supabaseRequest('notes', `?id=eq.${id}&google_id=eq.${googleId}`, {
      method: 'DELETE',
      prefer: 'return=minimal'
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Erreur serveur. Vérifie la configuration et les logs.' });
});

app.listen(PORT, () => {
  console.log(`SuperDashboard prêt sur ${BASE_URL}`);
  console.log(`Callback Google : ${GOOGLE_CALLBACK_URL}`);
  console.log(`Google configuré : ${hasGoogleConfig ? 'oui' : 'non'}`);
  console.log(`Supabase configuré : ${hasSupabaseConfig ? 'oui' : 'non'}`);
});

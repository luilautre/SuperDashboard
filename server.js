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
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `${BASE_URL}/auth/discord/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SESSION_SECRET) throw new Error('SESSION_SECRET doit être défini dans les variables d’environnement.');

const hasGoogleConfig = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const hasDiscordConfig = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];

function createGoogleClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Connecte-toi avec Google pour continuer.' });
  }
  return next();
}

function requireSupabase(res) {
  if (hasSupabaseConfig) return true;
  res.status(503).json({ error: 'Supabase n’est pas configuré dans les variables d’environnement.' });
  return false;
}

function getGoogleApiClient(req, res) {
  const tokens = req.session.googleTokens;
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    res.status(401).json({ error: 'Autorisation Gmail et Calendar absente. Clique sur « Autoriser Google ».' });
    return null;
  }

  const client = createGoogleClient();
  client.setCredentials(tokens);
  client.on('tokens', (updatedTokens) => {
    req.session.googleTokens = { ...req.session.googleTokens, ...updatedTokens };
  });
  return client;
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
  if (!response.ok) throw new Error(`Supabase (${response.status}): ${text || response.statusText}`);
  return text ? JSON.parse(text) : null;
}

async function discordTokenRequest(params) {
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      ...params
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || 'Échec de l’authentification Discord.');
  return data;
}

async function discordApi(req, endpoint) {
  const accessToken = req.session.discordTokens && req.session.discordTokens.access_token;
  if (!accessToken) return null;
  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Discord API (${response.status})`);
  return data;
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
    googleAuthorized: Boolean(req.session.googleTokens),
    discordConfigured: hasDiscordConfig,
    discordAuthorized: Boolean(req.session.discordTokens),
    databaseConfigured: hasSupabaseConfig
  });
});

app.get('/auth/google', (req, res) => {
  if (!hasGoogleConfig) return res.status(503).send('Google OAuth n’est pas configuré.');
  const state = crypto.randomBytes(32).toString('hex');
  req.session.googleOAuthState = state;
  return res.redirect(createGoogleClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    state,
    scope: GOOGLE_SCOPES
  }));
});

app.get('/auth/google/callback', async (req, res, next) => {
  if (req.query.error) return res.status(400).send(`Connexion Google refusée : ${String(req.query.error)}`);
  if (!req.query.code || !req.query.state || req.query.state !== req.session.googleOAuthState) {
    return res.status(400).send('Réponse OAuth Google invalide. Réessaie de te connecter.');
  }
  delete req.session.googleOAuthState;
  try {
    const oauthClient = createGoogleClient();
    const { tokens } = await oauthClient.getToken(String(req.query.code));
    oauthClient.setCredentials(tokens);
    const { data: profile } = await google.oauth2({ version: 'v2', auth: oauthClient }).userinfo.get();
    if (!profile.id || !profile.email) return res.status(400).send('Google n’a pas fourni l’identifiant ou l’adresse e-mail du compte.');

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
      req.session.googleTokens = tokens;
      return res.redirect('/');
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/auth/discord', (req, res) => {
  if (!hasDiscordConfig) return res.status(503).send('Discord OAuth n’est pas configuré.');
  const state = crypto.randomBytes(32).toString('hex');
  req.session.discordOAuthState = state;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: 'code',
    scope: 'identify guilds',
    state
  });
  return res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res, next) => {
  if (req.query.error) return res.status(400).send(`Connexion Discord refusée : ${String(req.query.error)}`);
  if (!req.query.code || !req.query.state || req.query.state !== req.session.discordOAuthState) {
    return res.status(400).send('Réponse OAuth Discord invalide. Réessaie de te connecter.');
  }
  delete req.session.discordOAuthState;
  try {
    const tokens = await discordTokenRequest({
      grant_type: 'authorization_code',
      code: String(req.query.code),
      redirect_uri: DISCORD_CALLBACK_URL
    });
    req.session.discordTokens = tokens;
    const profile = await discordApi(req, '/users/@me');
    req.session.discordUser = profile ? { id: profile.id, username: profile.global_name || profile.username, avatar: profile.avatar } : null;
    return res.redirect('/?app=discord');
  } catch (error) {
    return next(error);
  }
});

app.get('/api/google/gmail', requireLogin, async (req, res, next) => {
  const auth = getGoogleApiClient(req, res);
  if (!auth) return;
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 12, q: 'in:inbox' });
    const messages = await Promise.all((list.data.messages || []).map(async ({ id }) => {
      const result = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
      const headers = result.data.payload && result.data.payload.headers ? result.data.payload.headers : [];
      const value = (name) => headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
      return { id, from: value('From'), subject: value('Subject') || '(sans objet)', date: value('Date'), snippet: result.data.snippet || '' };
    }));
    return res.json({ messages });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/google/calendar', requireLogin, async (req, res, next) => {
  const auth = getGoogleApiClient(req, res);
  if (!auth) return;
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 12,
      singleEvents: true,
      orderBy: 'startTime'
    });
    return res.json({ events: (result.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || '(sans titre)',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location || '',
      link: event.htmlLink || ''
    })) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/discord/guilds', requireLogin, async (req, res, next) => {
  if (!req.session.discordTokens) return res.status(401).json({ error: 'Discord n’est pas connecté.' });
  try {
    const guilds = await discordApi(req, '/users/@me/guilds');
    return res.json({ guilds: guilds.map(({ id, name, icon, owner }) => ({ id, name, icon, owner })) });
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

app.post('/auth/discord/logout', requireLogin, (req, res) => {
  delete req.session.discordTokens;
  delete req.session.discordUser;
  return res.redirect('/?app=discord');
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
  if (!content || content.length > 500) return res.status(400).json({ error: 'La note doit contenir entre 1 et 500 caractères.' });
  try {
    const [note] = await supabaseRequest('notes', '', { method: 'POST', body: { google_id: req.session.user.google_id, content } });
    return res.status(201).json({ note });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/notes/:id', requireLogin, async (req, res, next) => {
  if (!requireSupabase(res)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Identifiant de note invalide.' });
  try {
    const id = encodeURIComponent(req.params.id);
    const googleId = encodeURIComponent(req.session.user.google_id);
    await supabaseRequest('notes', `?id=eq.${id}&google_id=eq.${googleId}`, { method: 'DELETE', prefer: 'return=minimal' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Erreur serveur. Vérifie la configuration et les logs.' });
});

app.listen(PORT, () => console.log(`SuperDashboard prêt sur ${BASE_URL}`));

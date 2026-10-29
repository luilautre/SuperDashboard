const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const { google } = require('googleapis');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'superdashboard-local-secret';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const oauth2Client = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
  ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, `${BASE_URL}/auth/google/callback`)
  : null;

const runtimeState = {
  discord: false,
  gmail: false,
  calendar: false,
  signal: false,
  notes: false,
};

const serviceCatalog = [
  {
    id: 'discord',
    name: 'Discord',
    type: 'chat',
    description: 'Notifications de serveur et messages importants.',
    envKey: 'DISCORD_TOKEN'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    type: 'mail',
    description: 'Boîte mail, tâches et messages prioritaires.',
    envKey: 'GMAIL_CLIENT_ID'
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    type: 'calendar',
    description: 'Agenda, rendez-vous et événements à venir.',
    envKey: 'GOOGLE_CLIENT_ID'
  },
  {
    id: 'signal',
    name: 'Signal',
    type: 'messaging',
    description: 'Alertes rapides ou messages de sécurité.',
    envKey: 'SIGNAL_PHONE_NUMBER'
  },
  {
    id: 'notes',
    name: 'Notes',
    type: 'todo',
    description: 'Liste rapide, rappels et mini-to-do local.',
    envKey: 'NOTES_ENABLED'
  }
];

function isGoogleConnected(req) {
  return Boolean(req.session && req.session.googleConnected);
}

function isServiceEnabled(service, req = null) {
  if (runtimeState[service.id]) {
    return true;
  }

  if (req && (service.id === 'gmail' || service.id === 'calendar')) {
    if (isGoogleConnected(req)) {
      return true;
    }
  }

  const envValue = process.env[service.envKey];
  return Boolean(envValue);
}

function buildStatus(req = null) {
  const services = serviceCatalog.map((service) => ({
    id: service.id,
    name: service.name,
    type: service.type,
    description: service.description,
    connected: isServiceEnabled(service, req)
  }));

  return {
    appName: 'SuperDashboard',
    mode: 'local',
    port: PORT,
    timestamp: new Date().toISOString(),
    services,
    google: {
      configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      connected: isGoogleConnected(req)
    }
  };
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(buildStatus(req));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'SuperDashboard', timestamp: new Date().toISOString() });
});

app.get('/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !oauth2Client) {
    return res.status(500).json({
      error: 'Google OAuth non configuré. Mets GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans le .env.'
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });

  return res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  if (!oauth2Client) {
    return res.status(500).send('Google OAuth non configuré.');
  }

  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Code OAuth absent.');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    req.session.googleTokens = tokens;
    req.session.googleConnected = true;
    req.session.googleEmail = null;

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const profile = await oauth2.userinfo.get();
      req.session.googleEmail = profile.data.email || null;
    } catch (profileError) {
      console.warn('Impossible de récupérer le profil Google:', profileError.message);
    }

    runtimeState.gmail = true;
    runtimeState.calendar = true;

    return res.redirect('/?google=connected');
  } catch (error) {
    console.error('Erreur OAuth Google :', error.message);
    return res.status(500).send(`Erreur OAuth Google: ${error.message}`);
  }
});

app.get('/api/google/status', (req, res) => {
  res.json({
    connected: Boolean(req.session && req.session.googleConnected),
    email: req.session && req.session.googleEmail ? req.session.googleEmail : null,
    configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
  });
});

app.post('/api/provider/:id/connect', async (req, res) => {
  const service = serviceCatalog.find((item) => item.id === req.params.id);

  if (!service) {
    return res.status(404).json({ error: 'Service introuvable' });
  }

  if ((service.id === 'gmail' || service.id === 'calendar') && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)) {
    return res.status(400).json({
      ok: false,
      error: 'Google OAuth non configuré. Mets GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans le .env.'
    });
  }

  if (service.id === 'gmail' || service.id === 'calendar') {
    return res.json({
      ok: true,
      provider: service.id,
      status: 'redirect',
      redirectUrl: '/auth/google'
    });
  }

  runtimeState[service.id] = true;
  return res.json({
    ok: true,
    provider: service.id,
    status: 'connected',
    message: `${service.name} est maintenant activé pour le dashboard local.`
  });
});

app.post('/api/provider/:id/disconnect', (req, res) => {
  const service = serviceCatalog.find((item) => item.id === req.params.id);

  if (!service) {
    return res.status(404).json({ error: 'Service introuvable' });
  }

  if (service.id === 'gmail' || service.id === 'calendar') {
    runtimeState.gmail = false;
    runtimeState.calendar = false;
    req.session.googleConnected = false;
    req.session.googleTokens = null;
    req.session.googleEmail = null;
    return res.json({
      ok: true,
      provider: service.id,
      status: 'disconnected',
      message: 'Google a été déconnecté.'
    });
  }

  runtimeState[service.id] = false;
  return res.json({
    ok: true,
    provider: service.id,
    status: 'disconnected',
    message: `${service.name} a été désactivé.`
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SuperDashboard local listening on http://localhost:${PORT}`);
  console.log(`Google OAuth callback: ${BASE_URL}/auth/google/callback`);
});

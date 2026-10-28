const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

function isServiceEnabled(service) {
  if (runtimeState[service.id]) {
    return true;
  }

  const envValue = process.env[service.envKey];
  return Boolean(envValue);
}

function buildStatus() {
  const services = serviceCatalog.map((service) => ({
    id: service.id,
    name: service.name,
    type: service.type,
    description: service.description,
    connected: isServiceEnabled(service)
  }));

  return {
    appName: 'SuperDashboard',
    mode: 'local',
    port: PORT,
    timestamp: new Date().toISOString(),
    services
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json(buildStatus());
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'SuperDashboard', timestamp: new Date().toISOString() });
});

app.post('/api/provider/:id/connect', (req, res) => {
  const service = serviceCatalog.find((item) => item.id === req.params.id);

  if (!service) {
    return res.status(404).json({ error: 'Service introuvable' });
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
});

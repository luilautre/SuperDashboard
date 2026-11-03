const accountArea = document.querySelector('#accountArea');
const welcome = document.querySelector('#welcome');
const dashboard = document.querySelector('#dashboard');
const loginButton = document.querySelector('#loginButton');
const setupMessage = document.querySelector('#setupMessage');
const activeAppName = document.querySelector('#activeAppName');
const appAvatar = document.querySelector('#appAvatar');
const connectionStatus = document.querySelector('#connectionStatus');
const headerCount = document.querySelector('#headerCount');
const noteForm = document.querySelector('#noteForm');
const noteInput = document.querySelector('#noteInput');
const noteList = document.querySelector('#noteList');
const noteCount = document.querySelector('#noteCount');
const noteMessage = document.querySelector('#noteMessage');
const integrationPanel = document.querySelector('#integrationPanel');
const integrationIcon = document.querySelector('#integrationIcon');
const integrationTitle = document.querySelector('#integrationTitle');
const integrationDescription = document.querySelector('#integrationDescription');
const integrationStatus = document.querySelector('#integrationStatus');
const integrationDetails = document.querySelector('#integrationDetails');
const integrationAction = document.querySelector('#integrationAction');
const integrationResults = document.querySelector('#integrationResults');
const notesPanel = document.querySelector('#notesPanel');
const tabs = [...document.querySelectorAll('[data-app]')];
let config = null;

const applications = {
  discord: { name: 'Discord', icon: '◉', description: 'Tes serveurs Discord.', details: 'Cette intégration affiche les serveurs accessibles à ton compte. Lire les messages nécessite un bot Discord installé sur le serveur avec les autorisations voulues.' },
  gmail: { name: 'Gmail', icon: '✉', description: 'Messages récents de ta boîte de réception.', details: 'Lecture seule. L’autorisation Google Gmail est demandée par le serveur.' },
  calendar: { name: 'Google Calendar', icon: '▦', description: 'Tes prochains événements de l’agenda principal.', details: 'Lecture seule. L’autorisation Google Calendar est demandée par le serveur.' },
  signal: { name: 'Signal', icon: '◌', description: 'Un espace prévu pour Signal.', details: 'Signal ne fournit pas d’API publique officielle générale pour intégrer messages et bots dans ce type d’application. On ne prétend donc pas être connecté.' },
  notes: { name: 'Notes', icon: '▤', description: 'Tes notes personnelles enregistrées dans Supabase.' }
};

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Erreur HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function renderAccount(user) {
  accountArea.replaceChildren();
  if (!user) return;
  if (user.picture) {
    const avatar = document.createElement('img');
    avatar.className = 'avatar'; avatar.src = user.picture; avatar.alt = ''; avatar.referrerPolicy = 'no-referrer';
    accountArea.append(avatar);
  }
  const name = document.createElement('span'); name.className = 'account-name'; name.textContent = user.name || user.email;
  accountArea.append(name);
  const logout = document.createElement('form'); logout.action = '/auth/logout'; logout.method = 'post';
  const button = document.createElement('button'); button.className = 'button button-quiet'; button.type = 'submit'; button.textContent = 'Déconnexion';
  logout.append(button); accountArea.append(logout);
}

function renderNotes(notes) {
  noteList.replaceChildren(); noteCount.textContent = String(notes.length);
  if (!notes.length) {
    const empty = document.createElement('li'); empty.className = 'empty-state'; empty.textContent = 'Aucune note pour le moment. Ajoute la première !'; noteList.append(empty); return;
  }
  for (const note of notes) {
    const item = document.createElement('li'); item.className = 'note-item';
    const text = document.createElement('span'); text.textContent = note.content;
    const date = document.createElement('time'); date.dateTime = note.created_at; date.textContent = new Date(note.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
    const remove = document.createElement('button'); remove.className = 'delete-note'; remove.type = 'button'; remove.textContent = 'Supprimer'; remove.setAttribute('aria-label', `Supprimer la note : ${note.content}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try { await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' }); await loadNotes(); }
      catch (error) { setMessage(noteMessage, error.message, true); remove.disabled = false; }
    });
    const meta = document.createElement('div'); meta.className = 'note-meta'; meta.append(date, remove); item.append(text, meta); noteList.append(item);
  }
}

async function loadNotes() { const { notes } = await api('/api/notes'); renderNotes(notes); }

function renderItems(items, kind) {
  integrationResults.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'results-empty';
    empty.textContent = kind === 'gmail' ? 'Aucun message dans la boîte de réception.' : kind === 'calendar' ? 'Aucun événement à venir.' : 'Aucun serveur trouvé.';
    integrationResults.append(empty); return;
  }
  for (const data of items) {
    const item = document.createElement(kind === 'discord' ? 'a' : 'article');
    item.className = 'result-item';
    if (kind === 'discord') { item.href = `https://discord.com/channels/${encodeURIComponent(data.id)}`; item.target = '_blank'; item.rel = 'noopener noreferrer'; }
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    const preview = document.createElement('span'); preview.className = 'result-preview';
    if (kind === 'gmail') { title.textContent = data.subject; detail.textContent = data.from; preview.textContent = data.snippet; }
    else if (kind === 'calendar') {
      title.textContent = data.title;
      detail.textContent = data.start ? new Date(data.start).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: data.start.includes('T') ? 'short' : undefined }) : '';
      preview.textContent = data.location;
    } else { title.textContent = data.name; detail.textContent = data.owner ? 'Tu es propriétaire' : 'Serveur Discord'; preview.textContent = ''; }
    item.append(title, detail); if (preview.textContent) item.append(preview); integrationResults.append(item);
  }
}

async function loadIntegration(id) {
  integrationResults.replaceChildren();
  if (id === 'signal') return;
  const needsGoogle = id === 'gmail' || id === 'calendar';
  const connected = id === 'discord' ? config.discordAuthorized : config.googleAuthorized;
  integrationStatus.textContent = connected ? 'Connecté' : 'Connexion requise';
  integrationAction.hidden = false;
  integrationAction.textContent = id === 'discord' ? (connected ? 'Actualiser les serveurs' : 'Connecter Discord') : (connected ? 'Actualiser' : 'Autoriser Google');
  integrationAction.onclick = async () => {
    if (!connected) { window.location.assign(id === 'discord' ? '/auth/discord' : '/auth/google'); return; }
    integrationAction.disabled = true;
    integrationResults.textContent = 'Chargement…';
    try {
      const endpoint = id === 'gmail' ? '/api/google/gmail' : id === 'calendar' ? '/api/google/calendar' : '/api/discord/guilds';
      const data = await api(endpoint);
      renderItems(id === 'gmail' ? data.messages : id === 'calendar' ? data.events : data.guilds, id);
    } catch (error) {
      integrationResults.replaceChildren();
      const message = document.createElement('p'); message.className = 'results-error'; message.textContent = error.message; integrationResults.append(message);
      if (needsGoogle && error.message.includes('Autorisation')) {
        integrationAction.textContent = 'Autoriser Google';
        integrationAction.onclick = () => window.location.assign('/auth/google');
      }
    } finally { integrationAction.disabled = false; }
  };
  if (connected && id !== 'discord') integrationAction.click();
  if (connected && id === 'discord') integrationAction.click();
}

function selectApplication(id) {
  const application = applications[id]; if (!application) return;
  for (const tab of tabs) {
    const selected = tab.dataset.app === id; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
  }
  activeAppName.textContent = application.name; appAvatar.textContent = application.icon;
  document.querySelector('#appView').setAttribute('aria-labelledby', `tab-${id}`);
  const isNotes = id === 'notes'; integrationPanel.hidden = isNotes; notesPanel.hidden = !isNotes; headerCount.hidden = !isNotes;
  if (isNotes) {
    connectionStatus.textContent = 'Enregistrées dans Supabase';
    loadNotes().catch((error) => setMessage(noteMessage, error.message, true)); return;
  }
  connectionStatus.textContent = id === 'signal' ? 'API officielle indisponible' : 'Application connectée au dashboard';
  integrationIcon.textContent = application.icon; integrationTitle.textContent = application.name;
  integrationDescription.textContent = application.description; integrationDetails.textContent = application.details;
  integrationStatus.textContent = id === 'signal' ? 'Non disponible officiellement' : 'Connexion requise';
  integrationAction.hidden = id === 'signal';
  integrationResults.replaceChildren();
  loadIntegration(id);
}

async function initialize() {
  try {
    config = await api('/api/config'); renderAccount(config.user);
    if (!config.loggedIn) {
      welcome.hidden = false; dashboard.hidden = true; loginButton.disabled = !config.googleConfigured;
      if (!config.googleConfigured || !config.databaseConfigured) {
        setupMessage.hidden = false;
        setupMessage.textContent = 'Configuration incomplète : vérifie les variables Google, Supabase et SESSION_SECRET dans les paramètres de déploiement.';
      }
      return;
    }
    welcome.hidden = true; dashboard.hidden = false;
    const requestedApp = new URLSearchParams(location.search).get('app');
    selectApplication(applications[requestedApp] ? requestedApp : 'discord');
  } catch (error) { setMessage(setupMessage, error.message, true); setupMessage.hidden = false; }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectApplication(tab.dataset.app));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0; if (event.key === 'End') nextIndex = tabs.length - 1;
    tabs[nextIndex].focus(); selectApplication(tabs[nextIndex].dataset.app);
  });
});

loginButton.addEventListener('click', () => window.location.assign('/auth/google'));
noteForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const content = noteInput.value.trim(); if (!content) return;
  const submitButton = noteForm.querySelector('button[type="submit"]'); submitButton.disabled = true; setMessage(noteMessage, 'Enregistrement…');
  try { await api('/api/notes', { method: 'POST', body: JSON.stringify({ content }) }); noteInput.value = ''; setMessage(noteMessage, 'Note enregistrée.'); await loadNotes(); }
  catch (error) { setMessage(noteMessage, error.message, true); }
  finally { submitButton.disabled = false; }
});

initialize();

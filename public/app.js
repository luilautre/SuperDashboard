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
const notesPanel = document.querySelector('#notesPanel');
const tabs = [...document.querySelectorAll('[data-app]')];

const applications = {
  discord: {
    name: 'Discord', icon: '◉',
    description: 'Messages et notifications de tes serveurs Discord.',
    details: 'L’onglet est prêt côté interface. La connexion à Discord (bot ou OAuth) n’est pas encore implémentée.'
  },
  gmail: {
    name: 'Gmail', icon: '✉',
    description: 'Ta boîte de réception et tes messages importants.',
    details: 'La connexion Google utilisée pour ouvrir le dashboard ne donne pas accès à Gmail. L’API Gmail et les autorisations OAuth restent à ajouter.'
  },
  calendar: {
    name: 'Google Calendar', icon: '▦',
    description: 'Ton agenda et tes prochains événements.',
    details: 'L’API Google Calendar et les autorisations OAuth correspondantes restent à ajouter.'
  },
  signal: {
    name: 'Signal', icon: '◌',
    description: 'Un espace prévu pour Signal.',
    details: 'Signal ne propose pas d’API publique officielle générale pour ce type d’intégration. Cet onglet est donc un emplacement, pas une connexion active.'
  },
  notes: {
    name: 'Notes', icon: '▤',
    description: 'Tes notes personnelles enregistrées dans Supabase.'
  }
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
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
    avatar.className = 'avatar';
    avatar.src = user.picture;
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    accountArea.append(avatar);
  }

  const name = document.createElement('span');
  name.className = 'account-name';
  name.textContent = user.name || user.email;
  accountArea.append(name);

  const logout = document.createElement('form');
  logout.action = '/auth/logout';
  logout.method = 'post';
  const button = document.createElement('button');
  button.className = 'button button-quiet';
  button.type = 'submit';
  button.textContent = 'Déconnexion';
  logout.append(button);
  accountArea.append(logout);
}

function renderNotes(notes) {
  noteList.replaceChildren();
  noteCount.textContent = String(notes.length);
  if (!notes.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Aucune note pour le moment. Ajoute la première !';
    noteList.append(empty);
    return;
  }

  for (const note of notes) {
    const item = document.createElement('li');
    item.className = 'note-item';
    const text = document.createElement('span');
    text.textContent = note.content;
    const date = document.createElement('time');
    date.dateTime = note.created_at;
    date.textContent = new Date(note.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
    const remove = document.createElement('button');
    remove.className = 'delete-note';
    remove.type = 'button';
    remove.textContent = 'Supprimer';
    remove.setAttribute('aria-label', `Supprimer la note : ${note.content}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' });
        await loadNotes();
      } catch (error) {
        setMessage(noteMessage, error.message, true);
        remove.disabled = false;
      }
    });
    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.append(date, remove);
    item.append(text, meta);
    noteList.append(item);
  }
}

async function loadNotes() {
  const { notes } = await api('/api/notes');
  renderNotes(notes);
}

function selectApplication(id) {
  const application = applications[id];
  if (!application) return;

  for (const tab of tabs) {
    const selected = tab.dataset.app === id;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }

  activeAppName.textContent = application.name;
  appAvatar.textContent = application.icon;
  document.querySelector('#appView').setAttribute('aria-labelledby', `tab-${id}`);
  const isNotes = id === 'notes';
  integrationPanel.hidden = isNotes;
  notesPanel.hidden = !isNotes;
  headerCount.hidden = !isNotes;

  if (isNotes) {
    connectionStatus.textContent = 'Enregistrées dans Supabase';
    loadNotes().catch((error) => setMessage(noteMessage, error.message, true));
    return;
  }

  connectionStatus.textContent = 'Intégration non connectée';
  integrationIcon.textContent = application.icon;
  integrationTitle.textContent = application.name;
  integrationDescription.textContent = application.description;
  integrationDetails.textContent = application.details;
  integrationStatus.textContent = 'À intégrer';
}

async function initialize() {
  try {
    const config = await api('/api/config');
    renderAccount(config.user);

    if (!config.loggedIn) {
      welcome.hidden = false;
      dashboard.hidden = true;
      loginButton.disabled = !config.googleConfigured;
      if (!config.googleConfigured || !config.databaseConfigured) {
        setupMessage.hidden = false;
        setupMessage.textContent = 'Configuration incomplète : vérifie GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.';
      }
      return;
    }

    welcome.hidden = true;
    dashboard.hidden = false;
    selectApplication('discord');
  } catch (error) {
    setMessage(setupMessage, error.message, true);
    setupMessage.hidden = false;
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectApplication(tab.dataset.app));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    tabs[nextIndex].focus();
    selectApplication(tabs[nextIndex].dataset.app);
  });
});

loginButton.addEventListener('click', () => window.location.assign('/auth/google'));

noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = noteInput.value.trim();
  if (!content) return;

  const submitButton = noteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(noteMessage, 'Enregistrement…');
  try {
    await api('/api/notes', { method: 'POST', body: JSON.stringify({ content }) });
    noteInput.value = '';
    setMessage(noteMessage, 'Note enregistrée.');
    await loadNotes();
  } catch (error) {
    setMessage(noteMessage, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

initialize();

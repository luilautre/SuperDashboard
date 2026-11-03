const accountArea = document.querySelector('#accountArea');
const welcome = document.querySelector('#welcome');
const dashboard = document.querySelector('#dashboard');
const loginButton = document.querySelector('#loginButton');
const setupMessage = document.querySelector('#setupMessage');
const firstName = document.querySelector('#firstName');
const connectionStatus = document.querySelector('#connectionStatus');
const footerStatus = document.querySelector('#footerStatus');
const noteForm = document.querySelector('#noteForm');
const noteInput = document.querySelector('#noteInput');
const noteList = document.querySelector('#noteList');
const noteCount = document.querySelector('#noteCount');
const noteMessage = document.querySelector('#noteMessage');

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (!response.ok) {
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
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

async function initialize() {
  try {
    const config = await api('/api/config');
    renderAccount(config.user);
    footerStatus.textContent = config.databaseConfigured ? 'Base connectée' : 'Base non configurée';

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
    const givenName = (config.user.name || '').trim().split(/\s+/)[0];
    firstName.textContent = givenName ? ` ${givenName}` : '';
    connectionStatus.textContent = config.databaseConfigured ? '● Enregistré dans Supabase' : '● Supabase non configuré';
    if (!config.databaseConfigured) {
      noteForm.hidden = true;
      setMessage(noteMessage, 'Configure Supabase et exécute supabase/schema.sql pour enregistrer des notes.', true);
      return;
    }
    await loadNotes();
  } catch (error) {
    setMessage(setupMessage, error.message, true);
    setupMessage.hidden = false;
  }
}

loginButton.addEventListener('click', () => {
  window.location.assign('/auth/google');
});

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

const themeIds = ['t1', 't2', 't3', 't4', 't5', 't6'];
const themeButton = document.querySelector('#themeToggle');
const themeStylesheet = document.createElement('link');
themeStylesheet.rel = 'stylesheet';
themeStylesheet.id = 'selectedTheme';
document.head.append(themeStylesheet);

function applyTheme(themeId) {
  themeStylesheet.href = `/${themeId}.css`;
  themeButton.textContent = `Thème : ${themeId}`;
  themeButton.setAttribute('aria-label', `Thème actuel : ${themeId}. Cliquer pour changer de thème`);
  try {
    localStorage.setItem('superdashboard-theme', themeId);
  } catch {
    // Le thème reste utilisable même si le navigateur bloque le stockage local.
  }
}

let selectedTheme = 't1';
try {
  const savedTheme = localStorage.getItem('superdashboard-theme');
  if (themeIds.includes(savedTheme)) selectedTheme = savedTheme;
} catch {
  // En cas d'accès refusé, on démarre simplement sur t1.
}

applyTheme(selectedTheme);
themeButton.addEventListener('click', () => {
  const currentIndex = themeIds.indexOf(selectedTheme);
  selectedTheme = themeIds[(currentIndex + 1) % themeIds.length];
  applyTheme(selectedTheme);
});

// Logos SVG des applications : les éléments et les chemins sont constants.
const applicationLogos = {
  discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 7.2a15.6 15.6 0 0 0-3.9-1.2l-.2.4c1.9.5 3.5 1.4 4.9 2.6-.8-.5-1.7-.9-2.6-1.3l-.6.7a12.9 12.9 0 0 0-5.6 0l-.5-.7c-.9.4-1.7.8-2.6 1.3 1.4-1.2 3-2.1 4.9-2.6l-.2-.4A15.6 15.6 0 0 0 4.5 7.2c-1.8 3.1-2.3 6.1-2 9.1 2.2 1.7 4.2 2.7 6.1 3.4.5-.7.9-1.5 1.2-2.4a8 8 0 0 1-2.9-1.5l.7-.5a10.5 10.5 0 0 0 7.1 0l.7.5a8 8 0 0 1-2.9 1.5c.3.9.7 1.7 1.2 2.4 1.9-.7 3.9-1.7 6.1-3.4.3-3-.2-6-2-9.1Zm-8.1 8.1c-1.2 0-2.3-1.1-2.3-2.5s1-2.5 2.3-2.5c1.3 0 2.3 1.1 2.3 2.5 0 1.4-1 2.5-2.3 2.5Zm6.1 0c-1.2 0-2.3-1.1-2.3-2.5s1-2.5 2.3-2.5 2.3 1.1 2.3 2.5c0 1.4-1 2.5-2.3 2.5Z"/></svg>',
  gmail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2 .1v10.9c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V6.6l-7 5.2L5 6.6Zm1.8-.6 5.2 3.9L17.2 6H6.8Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2.5a1 1 0 0 1 1 1V3h8v.5a1 1 0 1 1 2 0V3h1.5A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13A2.5 2.5 0 0 1 4.5 3H6v.5a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1Zm13 7h-16v9c0 .3.2.5.5.5h15a.5.5 0 0 0 .5-.5v-9ZM6 12h3v3H6v-3Zm5 0h3v3h-3v-3Zm5 0h3v3h-3v-3Z"/></svg>',
  signal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.5 9.5 0 0 0-8.2 14.3L2.5 21l4.8-1.3A9.5 9.5 0 1 0 12 2Zm0 17a7.5 7.5 0 0 1-4-1.2l-.4-.2-2.1.6.6-2-.3-.5A7.5 7.5 0 1 1 12 19Zm-3.2-9.3c.2-.4.4-.4.6-.4h.4c.1 0 .3 0 .4.3l.7 1.6c.1.2.1.3 0 .5l-.4.5c-.2.2-.2.3 0 .5.5.8 1.1 1.4 1.9 1.8.2.1.3.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.5.7c.2.1.3.2.3.4 0 .2-.1.9-.6 1.3-.4.4-1 .6-1.6.5-1-.2-2.2-.7-3.3-1.7-1.4-1.2-2.3-2.7-2.5-3.6-.2-.7 0-1.3.4-1.7l.6-.2Z"/></svg>',
  notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5A2.5 2.5 0 0 0 3.5 6v12A2.5 2.5 0 0 0 6 20.5h12a2.5 2.5 0 0 0 2.5-2.5V8.5l-5-5H6Zm9 2.2 2.8 2.8H15V5.7Zm-8.5 2h8v1.7h-8V8.4Zm0 3.6h11v1.7h-11V12Zm0 3.6h8v1.7h-8v-1.7Z"/></svg>'
};

function renderLogo(element, appId) {
  const logo = applicationLogos[appId];
  if (!element || !logo || element.innerHTML === logo) return;
  element.dataset.app = appId;
  element.innerHTML = logo;
}

for (const tab of document.querySelectorAll('.nav-item[data-app]')) {
  renderLogo(tab.querySelector('.nav-icon'), tab.dataset.app);
}

const appAvatar = document.querySelector('#appAvatar');
const integrationIcon = document.querySelector('#integrationIcon');

function syncApplicationLogo(element) {
  if (!element) return;
  const selectedTab = document.querySelector('.nav-item.active[data-app]');
  if (selectedTab) renderLogo(element, selectedTab.dataset.app);
}

syncApplicationLogo(appAvatar);
syncApplicationLogo(integrationIcon);

// app.js actualise ces deux éléments à chaque changement d’application.
const logoObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) syncApplicationLogo(mutation.target);
});
for (const element of [appAvatar, integrationIcon]) {
  if (element) logoObserver.observe(element, { childList: true });
}

// Lien de connexion dans accountArea lorsque la session est absente.
 //const accountArea = document.querySelector('#accountArea'); // déja dans app.js
function ensureSignInLink() {
  if (!accountArea.querySelector('.sign-in-link')) {
    const link = document.createElement('a');
    link.className = 'button button-quiet sign-in-link';
    link.href = '/auth/google';
    link.textContent = 'Se connecter';
    accountArea.append(link);
  }
}

const accountObserver = new MutationObserver(() => ensureSignInLink());
fetch('/api/config')
  .then((response) => {
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    return response.json();
  })
  .then((config) => {
    if (!config.loggedIn) {
      accountObserver.observe(accountArea, { childList: true });
      ensureSignInLink();
    }
  })
  .catch(() => {
    // L'écran de connexion principal reste disponible si la vérification échoue.
  });

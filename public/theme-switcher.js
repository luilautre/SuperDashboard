const themeIds = ['t1', 't2', 't3', 't5', 't6'];
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

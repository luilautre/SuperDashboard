const serviceCards = document.querySelector('#serviceCards');
const appStatus = document.querySelector('#appStatus');
const lastUpdated = document.querySelector('#lastUpdated');

async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();

    appStatus.textContent = `${data.appName} • mode ${data.mode}`;
    lastUpdated.textContent = `Mise à jour : ${new Date(data.timestamp).toLocaleString('fr-FR')}`;

    serviceCards.innerHTML = '';

    data.services.forEach((service) => {
      const card = document.createElement('article');
      card.className = 'service-card';

      const badge = document.createElement('span');
      badge.className = service.connected ? 'status connected' : 'status disconnected';
      badge.textContent = service.connected ? 'connecté' : 'déconnecté';

      const title = document.createElement('h3');
      title.textContent = service.name;

      const description = document.createElement('p');
      description.textContent = service.description;

      const actions = document.createElement('div');
      actions.className = 'actions';

      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = service.connected ? 'Déconnecter' : 'Connecter';
      toggleBtn.className = service.connected ? 'secondary' : 'primary';

      toggleBtn.addEventListener('click', async () => {
        const endpoint = service.connected ? 'disconnect' : 'connect';
        const res = await fetch(`/api/provider/${service.id}/${endpoint}`, { method: 'POST' });
        const result = await res.json();
        
        if (result.ok) {
          loadStatus();
        } else {
          alert(result.error || 'Erreur inconnue');
        }
        if (result.status === 'redirect')window.location.href = result.redirectUrl;
      });

      actions.appendChild(toggleBtn);
      card.appendChild(badge);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(actions);
      serviceCards.appendChild(card);
    });
  } catch (error) {
    appStatus.textContent = 'Erreur de chargement du dashboard';
    lastUpdated.textContent = 'Vérifie le serveur local';
    console.error(error);
  }
}

loadStatus();
setInterval(loadStatus, 10000);

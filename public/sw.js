// Service Worker - VN Pedroni Fotografia
// Versão mínima para garantir a instalabilidade do PWA

const CACHE_NAME = 'vnpedroni-v1';

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado com sucesso');
  // Ativa imediatamente sem esperar o SW anterior
  self.skipWaiting();
});

// Evento de ativação
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativado');
  // Limpa caches antigos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Assume controle imediato de todas as páginas
  return self.clients.claim();
});

// Estratégia: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e extensões do Chrome
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Só cacheia respostas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tenta o cache
        return caches.match(event.request);
      })
  );
});

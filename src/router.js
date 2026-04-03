// ── Hash-based SPA Router ──

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function getCurrentRoute() {
  const hash = window.location.hash.slice(1) || '/login';
  return hash.split('?')[0];
}

function matchRoute(path) {
  // Exact match
  if (routes[path]) return { handler: routes[path], params: {} };
  
  // Dynamic segments (e.g., /student/track/:id)
  for (const routePath of Object.keys(routes)) {
    const routeParts = routePath.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) continue;
    
    const params = {};
    let match = true;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    
    if (match) return { handler: routes[routePath], params };
  }
  
  return null;
}

async function handleRouteChange() {
  const path = getCurrentRoute();
  const container = document.getElementById('main-content');
  
  if (!container) return;
  
  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }
  
  const result = matchRoute(path);
  
  if (result) {
    container.innerHTML = '';
    currentCleanup = await result.handler(container, result.params);
  } else {
    // 404 or redirect to login
    container.innerHTML = `
      <div class="page">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h2>Page Not Found</h2>
          <p class="empty-text">The page you're looking for doesn't exist.</p>
          <button class="btn btn-primary mt-4" onclick="window.location.hash='#/login'">Go Home</button>
        </div>
      </div>
    `;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  // Initial route
  handleRouteChange();
}

/**
 * D2 Group CRM - Aplicação Core (Vanilla JS)
 * Especialista em Firebase & Google Maps API
 */

// ==========================================================================
// 1. CONFIGURAÇÕES & DICIONÁRIO DE IDIOMAS (i18n)
// ==========================================================================

const i18n = {
  pt: {
    login_subtitle: "Plataforma Avançada de Prospecção em Campo",
    btn_login_google: "Entrar com Google",
    search_title: "Encontrar Clientes em Potencial",
    search_label: "O que você está procurando?",
    location_label: "Filtro de Localidade",
    btn_search: "Buscar no Google Maps",
    tab_prospects: "Resultados",
    tab_visitas: "Visitas",
    tab_admin: "Painel",
    results_title: "Clientes Encontrados",
    empty_prospects: "Digite um termo e busque para carregar os prospects.",
    saved_title: "Visitas Registradas",
    btn_pdf: "Gerar PDF",
    status_all: "Todos os Status",
    status_to_visit: "A Visitar",
    status_visited: "Visitado",
    status_potential: "Potencial",
    status_revisit: "Revisitar",
    status_inactive: "Desativada/Mudou",
    status_to_visit_short: "A Visitar",
    status_visited_short: "Visitado",
    status_potential_short: "Potencial",
    status_revisit_short: "Revisitar",
    status_inactive_short: "Desativada",
    empty_visitas: "Nenhuma visita registrada no CRM ainda.",
    admin_panel_title: "Controle de Acessos",
    admin_panel_desc: "Gerencie os acessos e permissões dos usuários do D2 Group CRM.",
    th_user: "Usuário",
    th_role: "Acesso",
    crm_modal_title: "Detalhes da Prospecção",
    crm_contact_name: "Nome do Contato / Decisor",
    crm_contact_email: "E-mail de Contato",
    crm_visit_status: "Status da Visita",
    crm_visit_notes: "Notas da Visita",
    btn_cancel: "Cancelar",
    btn_save_visit: "Salvar Visita",
    alert_auth_needed: "Você precisa fazer login para acessar o app.",
    alert_search_empty: "Por favor, digite um termo para busca.",
    alert_save_success: "Dados da visita salvos com sucesso!",
    alert_save_error: "Erro ao salvar dados da visita: ",
    alert_no_admin: "Acesso negado: Somente administradores podem ver o Painel de Controle.",
    role_admin: "Administrador",
    role_sales: "Consultor de Vendas"
  },
  en: {
    login_subtitle: "Advanced Field Prospecting Platform",
    btn_login_google: "Sign in with Google",
    search_title: "Find Prospects",
    search_label: "What are you looking for?",
    location_label: "Location Filter",
    btn_search: "Search in Google Maps",
    tab_prospects: "Results",
    tab_visitas: "Visits",
    tab_admin: "Admin",
    results_title: "Found Prospects",
    empty_prospects: "Enter a search term and search to load prospects.",
    saved_title: "Registered Visits",
    btn_pdf: "Generate PDF",
    status_all: "All Statuses",
    status_to_visit: "To Visit",
    status_visited: "Visited",
    status_potential: "Potential",
    status_revisit: "Revisit",
    status_inactive: "Deactivated/Moved",
    status_to_visit_short: "To Visit",
    status_visited_short: "Visited",
    status_potential_short: "Potential",
    status_revisit_short: "Revisit",
    status_inactive_short: "Deactivated",
    empty_visitas: "No visits registered in CRM yet.",
    admin_panel_title: "Access Control",
    admin_panel_desc: "Manage roles and permissions of D2 Group CRM users.",
    th_user: "User",
    th_role: "Access",
    crm_modal_title: "Prospecting Details",
    crm_contact_name: "Contact Name / Decision Maker",
    crm_contact_email: "Contact E-mail",
    crm_visit_status: "Visit Status",
    crm_visit_notes: "Visit Notes",
    btn_cancel: "Cancel",
    btn_save_visit: "Save Visit",
    alert_auth_needed: "You must log in to access the application.",
    alert_search_empty: "Please enter a search query.",
    alert_save_success: "Visit details successfully saved!",
    alert_save_error: "Error saving visit details: ",
    alert_no_admin: "Access Denied: Only Super Admins can access the Admin Panel.",
    role_admin: "Super Admin",
    role_sales: "Sales Rep"
  },
  es: {
    login_subtitle: "Plataforma Avanzada de Prospección de Campo",
    btn_login_google: "Iniciar sesión con Google",
    search_title: "Buscar Prospectos",
    search_label: "¿Qué estás buscando?",
    location_label: "Filtro de Localización",
    btn_search: "Buscar en Google Maps",
    tab_prospects: "Resultados",
    tab_visitas: "Visitas",
    tab_admin: "Panel Admin",
    results_title: "Prospectos Encontrados",
    empty_prospects: "Ingrese un término de búsqueda para cargar los prospectos.",
    saved_title: "Visitas Registradas",
    btn_pdf: "Generar PDF",
    status_all: "Todos los Estados",
    status_to_visit: "A Visitar",
    status_visited: "Visitado",
    status_potential: "Potencial",
    status_revisit: "Revisitar",
    status_inactive: "Desactivada/Mudó",
    status_to_visit_short: "A Visitar",
    status_visited_short: "Visitado",
    status_potential_short: "Potencial",
    status_revisit_short: "Revisitar",
    status_inactive_short: "Desactivada",
    empty_visitas: "No hay visitas registradas en el CRM todavía.",
    admin_panel_title: "Control de Acceso",
    admin_panel_desc: "Gestione los roles y permisos de los usuarios de D2 Group CRM.",
    th_user: "Usuario",
    th_role: "Acceso",
    crm_modal_title: "Detalles de la Prospección",
    crm_contact_name: "Nombre del Contacto / Decisor",
    crm_contact_email: "Correo Electrónico",
    crm_visit_status: "Estado de la Visita",
    crm_visit_notes: "Notas de la Visita",
    btn_cancel: "Cancelar",
    btn_save_visit: "Guardar Visita",
    alert_auth_needed: "Debe iniciar sesión para acceder a la aplicación.",
    alert_search_empty: "Por favor, ingrese un término de búsqueda.",
    alert_save_success: "¡Detalles de la visita guardados con éxito!",
    alert_save_error: "Error al guardar los detalles de la visita: ",
    alert_no_admin: "Acceso denegado: Solo los Súper Administradores pueden acceder al Panel de Control.",
    role_admin: "Súper Admin",
    role_sales: "Consultor de Ventas"
  }
};

let currentLanguage = 'pt';

function changeLanguage(lang) {
  if (!i18n[lang]) return;
  currentLanguage = lang;
  
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (i18n[lang][key]) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = i18n[lang][key];
      } else {
        const icon = element.querySelector('i[data-lucide]');
        if (icon) {
          element.innerHTML = '';
          element.appendChild(icon);
          const textSpan = document.createElement('span');
          textSpan.textContent = " " + i18n[lang][key];
          element.appendChild(textSpan);
        } else {
          element.textContent = i18n[lang][key];
        }
      }
    }
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.placeholder = lang === 'pt' ? 'Ex: Arquitetos, Interior Designers, Construtores...' : 
                             lang === 'es' ? 'Ej: Arquitectos, Diseñadores de Interiores...' : 
                                             'Ex: Architects, Interior Designers, Builders...';
  }
  const locationInput = document.getElementById('location-input');
  if (locationInput) {
    locationInput.placeholder = lang === 'pt' ? 'Estado, Cidade ou CEP' : 
                               lang === 'es' ? 'Estado, Ciudad o CEP' : 
                                               'State, County or Zip Code';
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active-lang');
      btn.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
    } else {
      btn.classList.remove('active-lang');
      btn.style.backgroundColor = '';
    }
  });
}

// ==========================================================================
// 2. CONEXÃO FIREBASE
// ==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyAL0vtm4XO_uKDKyn2UCuysb5mXIrYW-8o",
  authDomain: "d2-map-crm.firebaseapp.com",
  projectId: "d2-map-crm",
  storageBucket: "d2-map-crm.firebasestorage.app",
  messagingSenderId: "859602108494",
  appId: "1:859602108494:web:203450d0f43c8ce322031f"
};

let app, auth, db;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } else {
    console.warn("D2 Group CRM: Credenciais do Firebase ausentes.");
  }
} catch (e) {
  console.error("Erro ao inicializar Firebase:", e);
}

// ==========================================================================
// 3. ESTADOS GLOBAIS DA APLICAÇÃO
// ==========================================================================

let map;
let placesService;
let currentMarkers = {}; // Estrutura em Objeto { placeId: marker } para vinculação direta
let infoWindow;          // Instância global única de Balão do Mapa
let searchResults = []; 
let savedVisits = {};   
let loggedInUser = null;
let isSuperAdmin = false;
let currentSelectedProspect = null;

// ==========================================================================
// 4. INICIALIZAÇÃO DO GOOGLE MAPS & SERVIÇOS
// ==========================================================================

function initMap() {
  const defaultLatLng = { lat: 26.2301, lng: -80.1248 }; // Pompano Beach, FL como referência padrão operacional
  
  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLatLng,
    zoom: 12,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: true
  });

  placesService = new google.maps.places.PlacesService(map);
  infoWindow = new google.maps.InfoWindow(); // Inicializa janela única de informações
  
  initRoutingServices(); // Inicia os serviços de rota (Adicionado na V2)

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(userPos);
        
        new google.maps.Marker({
          position: userPos,
          map: map,
          title: "Minha Localização",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#0088ff",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }
        });
      },
      () => { console.warn("Geolocalização não permitida."); }
    );
  }
}

window.initMap = initMap;

// ==========================================================================
// 5. LOGIN E AUTENTICAÇÃO
// ==========================================================================

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      loggedInUser = user;
      document.getElementById("login-container").classList.add("hidden");
      document.getElementById("app-container").classList.remove("hidden");
      
      document.getElementById("user-avatar").src = user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80";
      document.getElementById("user-name").textContent = user.displayName || user.email;

      await syncUserRecord(user);
    } else {
      loggedInUser = null;
      isSuperAdmin = false;
      document.getElementById("login-container").classList.remove("hidden");
      document.getElementById("app-container").classList.add("hidden");
      document.getElementById("tab-admin-btn").classList.add("hidden");
    }
  });
}

async function syncUserRecord(user) {
  if (!db) return;
  const userRef = db.collection("users").doc(user.uid);
  
  try {
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({
        uid: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        super_admin: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      isSuperAdmin = false;
    } else {
      isSuperAdmin = !!doc.data().super_admin;
    }

    const roleTag = document.getElementById("user-role");
    if (roleTag) {
      roleTag.textContent = isSuperAdmin ? i18n[currentLanguage].role_admin : i18n[currentLanguage].role_sales;
    }

    const adminBtn = document.getElementById("tab-admin-btn");
    if (isSuperAdmin) {
      adminBtn.classList.remove("hidden");
      listenToAllUsers();
    } else {
      adminBtn.classList.add("hidden");
    }

    listenToVisitas();
  } catch (error) {
    console.error("Erro ao sincronizar usuário:", error);
  }
}

document.getElementById("btn-login-google").addEventListener("click", () => {
  if (!auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    document.getElementById("login-error").textContent = error.message;
    document.getElementById("login-error").classList.remove("hidden");
  });
});

document.getElementById("btn-logout").addEventListener("click", () => {
  if (auth) auth.signOut();
});

// ==========================================================================
// 6. BUSCA DE ESTABELECIMENTOS VIA PLACES API
// ==========================================================================

document.getElementById("btn-search").addEventListener("click", performPlacesSearch);

function performPlacesSearch() {
  const queryText = document.getElementById("search-input").value.trim();
  const locationText = document.getElementById("location-input").value.trim();

  if (!queryText) {
    alert(i18n[currentLanguage].alert_search_empty);
    return;
  }

  let finalQuery = queryText;
  if (locationText) finalQuery += ` in ${locationText}`;

  const request = {
    query: finalQuery,
    bounds: map.getBounds(),
    location: map.getCenter(),
    radius: '5000'
  };

  placesService.textSearch(request, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
      searchResults = results.map(place => ({
        id: place.place_id,
        name: place.name,
        address: place.formatted_address || "",
        phone: place.formatted_phone_number || "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        rating: place.rating || 0
      }));

      renderMapPins();
      renderProspectsList();
      
      if (results.length > 0) {
        map.setCenter(results[0].geometry.location);
      }
    } else {
      alert("Nenhum resultado retornado para a busca.");
    }
  });
}

function renderProspectsList() {
  const container = document.getElementById("prospects-list");
  const countBadge = document.getElementById("results-count");
  
  container.innerHTML = "";
  countBadge.textContent = searchResults.length;

  if (searchResults.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="map"></i>
        <p data-i18n="empty_prospects">${i18n[currentLanguage].empty_prospects}</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  searchResults.forEach(prospect => {
    const card = document.createElement("div");
    card.className = "list-item-card";
    card.id = `prospect-card-${prospect.id}`;
    
    const savedVisit = savedVisits[prospect.id];
    let statusDotHtml = "";
    if (savedVisit) {
      const statusClass = getStatusClass(savedVisit.status);
      statusDotHtml = `<span class="item-badge-status ${statusClass}"></span>`;
    }

    card.innerHTML = `
      ${statusDotHtml}
      <h5 class="item-title">${prospect.name}</h5>
      <p class="item-detail"><i data-lucide="map-pin"></i> <span>${prospect.address}</span></p>
    `;

    // Ações de clique e Hover Integrado
    card.addEventListener("click", () => openCrmModal(prospect));
    
    card.addEventListener("mouseenter", () => {
      const marker = currentMarkers[prospect.id];
      if (marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        triggerInfoWindow(marker, prospect.name, prospect.address, savedVisit?.status, prospect.phone);
      }
    });

    card.addEventListener("mouseleave", () => {
      const marker = currentMarkers[prospect.id];
      if (marker) {
        marker.setAnimation(null);
        infoWindow.close();
      }
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

// ==========================================================================
// 7. SINCRONIZAÇÃO FIRESTORE & RENDERIZAÇÃO DA LISTA DE VISITAS
// ==========================================================================

function listenToVisitas() {
  if (!db || !loggedInUser) return;
  let query = db.collection("visitas");
  
  if (!isSuperAdmin) {
    query = query.where("createdByUid", "==", loggedInUser.uid);
  }

  query.onSnapshot((snapshot) => {
    savedVisits = {};
    snapshot.forEach((doc) => {
      savedVisits[doc.id] = doc.data();
    });

    renderProspectsList();
    renderVisitasList();
    renderMapPins();
  }, (error) => {
    console.error("Erro ao carregar visitas:", error);
  });
}

function renderVisitasList() {
  const container = document.getElementById("visitas-list");
  const filterStatus = document.getElementById("filter-visit-status").value;

  container.innerHTML = "";

  const visitsArray = Object.values(savedVisits).filter(visit => {
    if (filterStatus === "all") return true;
    return visit.status === filterStatus;
  });

  if (visitsArray.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-square"></i>
        <p data-i18n="empty_visitas">${i18n[currentLanguage].empty_visitas}</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  visitsArray.forEach(visit => {
    const card = document.createElement("div");
    card.className = "list-item-card";
    card.style.display = "flex";
    card.style.alignItems = "flex-start";
    card.style.gap = "12px";
    
    // Verifica se já está selecionado na rota
    const isChecked = selectedRoutePlaces.some(p => p.id === visit.placeId) ? "checked" : "";
    const statusClass = getStatusClass(visit.status);

    card.innerHTML = `
      <div style="padding-top: 4px;">
        <input type="checkbox" class="route-checkbox" data-id="${visit.placeId}" style="width: 18px; height: 18px; cursor: pointer;" ${isChecked}>
      </div>
      <div style="flex: 1; cursor: pointer; position: relative;" class="visit-card-content">
        <span class="item-badge-status ${statusClass}" style="position: absolute; top: 0; right: 0;"></span>
        <h5 class="item-title" style="margin:0 0 4px 0; padding-right: 15px;">${visit.placeName}</h5>
        <p class="item-detail" style="margin:0; font-size: 0.8rem; color: #64748b;"><i data-lucide="map-pin"></i> ${visit.placeAddress}</p>
        <p class="item-detail" style="margin:4px 0 0 0; font-size: 0.75rem;"><i data-lucide="user"></i> <b>Decisor:</b> ${visit.contactName || '---'}</p>
        <p class="item-detail" style="margin:4px 0 0 0; font-size: 0.75rem;">Status: <b>${visit.status}</b></p>
      </div>
    `;

    // Evento do Checkbox de Rota (Isolado do card)
    const checkbox = card.querySelector(".route-checkbox");
    checkbox.addEventListener("change", (e) => {
      handleRouteSelection(e.target.checked, visit);
    });

    // Eventos do Conteúdo do Card (Abre Modal do CRM e Hover no Mapa)
    const contentArea = card.querySelector(".visit-card-content");
    const prospectObj = {
      id: visit.placeId,
      name: visit.placeName,
      address: visit.placeAddress,
      phone: visit.placePhone || "---",
      lat: visit.lat,
      lng: visit.lng
    };

    contentArea.addEventListener("click", () => openCrmModal(prospectObj));

    contentArea.addEventListener("mouseenter", () => {
      const marker = currentMarkers[visit.placeId];
      if (marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        triggerInfoWindow(marker, visit.placeName, visit.placeAddress, visit.status, visit.placePhone);
      }
    });

    contentArea.addEventListener("mouseleave", () => {
      const marker = currentMarkers[visit.placeId];
      if (marker) {
        marker.setAnimation(null);
        infoWindow.close();
      }
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

document.getElementById("filter-visit-status").addEventListener("change", renderVisitasList);

// ==========================================================================
// 8. CONTROLE DE PINOS DE ALTA VISIBILIDADE & BALÕES (INFO WINDOW)
// ==========================================================================

function triggerInfoWindow(marker, name, address, status, phone) {
  let emoji = "⚪";
  if (status === "A Visitar") emoji = "🟡";
  if (status === "Visitado") emoji = "🟢";
  if (status === "Potencial") emoji = "🔵";
  if (status === "Revisitar") emoji = "🟠";
  if (status === "Desativada/Mudou") emoji = "🔴";

  const cleanStatus = status || "Não Cadastrado";

  const boxContent = `
    <div style="padding: 10px; font-family: 'Inter', sans-serif; color: #0f172a; max-width: 250px;">
      <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #1e293b;">${name}</h4>
      <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.4;"><i data-lucide="map-pin" style="width:10px; height:10px; display:inline-block;"></i> ${address}</p>
      <div style="font-size: 11px; font-weight: 600; display:flex; align-items:center; gap:4px; margin-bottom: 4px;">
        <span>Status:</span> <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${emoji} ${cleanStatus}</span>
      </div>
      ${phone && phone !== '---' ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #475569;"><b>Tel:</b> ${phone}</p>` : ''}
    </div>
  `;
  infoWindow.setContent(boxContent);
  infoWindow.open(map, marker);
}

function createHighVisibilityPin(color) {
  return {
    path: "M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    fillColor: color,
    fillOpacity: 1.0,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 1.5,
    anchor: new google.maps.Point(12, 22)
  };
}

function renderMapPins() {
  Object.values(currentMarkers).forEach(marker => marker.setMap(null));
  currentMarkers = {};

  // 1. Renderiza Pins dos Resultados Atuais
  searchResults.forEach(prospect => {
    const isSaved = savedVisits[prospect.id];
    const markerColor = isSaved ? getStatusHexColor(isSaved.status) : "#475569"; // Slate escuro para não cadastrados

    const marker = new google.maps.Marker({
      position: { lat: prospect.lat, lng: prospect.lng },
      map: map,
      title: prospect.name,
      icon: createHighVisibilityPin(markerColor)
    });

    marker.addListener("click", () => openCrmModal(prospect));
    marker.addListener("mouseover", () => triggerInfoWindow(marker, prospect.name, prospect.address, isSaved?.status, prospect.phone));
    marker.addListener("mouseout", () => infoWindow.close());

    currentMarkers[prospect.id] = marker;
  });

  // 2. Renderiza Pins de visitas antigas fora da busca atual para persistência visual
  Object.values(savedVisits).forEach(visit => {
    if (!currentMarkers[visit.placeId]) {
      const markerColor = getStatusHexColor(visit.status);

      const marker = new google.maps.Marker({
        position: { lat: visit.lat, lng: visit.lng },
        map: map,
        title: visit.placeName,
        icon: createHighVisibilityPin(markerColor)
      });

      const prospectObj = {
        id: visit.placeId,
        name: visit.placeName,
        address: visit.placeAddress,
        phone: visit.placePhone || "---",
        lat: visit.lat,
        lng: visit.lng
      };

      marker.addListener("click", () => openCrmModal(prospectObj));
      marker.addListener("mouseover", () => triggerInfoWindow(marker, visit.placeName, visit.placeAddress, visit.status, visit.placePhone));
      marker.addListener("mouseout", () => infoWindow.close());

      currentMarkers[visit.placeId] = marker;
    }
  });
}

function getStatusClass(status) {
  switch (status) {
    case "A Visitar": return "status-to-visit";
    case "Visitado": return "status-visited";
    case "Potencial": return "status-potential";
    case "Revisitar": return "status-revisit";
    case "Desativada/Mudou": return "status-inactive";
    default: return "";
  }
}

function getStatusHexColor(status) {
  switch (status) {
    case "A Visitar": return "#eab308";      // Amarelo
    case "Visitado": return "#10b981";       // Verde
    case "Potencial": return "#3b82f6";      // Azul
    case "Revisitar": return "#f97316";      // Laranja
    case "Desativada/Mudou": return "#ef4444"; // Vermelho
    default: return "#475569";
  }
}

// ==========================================================================
// 9. MODAL CRM & GRAVAÇÃO NO FIRESTORE
// ==========================================================================

const modal = document.getElementById("crm-modal");
const crmForm = document.getElementById("crm-form");

function openCrmModal(prospect) {
  currentSelectedProspect = prospect;
  
  document.getElementById("crm-place-name").textContent = prospect.name;
  document.getElementById("crm-place-address").textContent = prospect.address;
  
  let phone = prospect.phone || "---";
  if (savedVisits[prospect.id] && savedVisits[prospect.id].placePhone) {
    phone = savedVisits[prospect.id].placePhone;
  }
  document.getElementById("crm-place-phone").textContent = phone;

  document.getElementById("crm-contact-name").value = "";
  document.getElementById("crm-contact-email").value = "";
  document.getElementById("crm-visit-status").value = "A Visitar";
  document.getElementById("crm-visit-notes").value = "";

  if (savedVisits[prospect.id]) {
    const historicalData = savedVisits[prospect.id];
    document.getElementById("crm-contact-name").value = historicalData.contactName || "";
    document.getElementById("crm-contact-email").value = historicalData.contactEmail || "";
    document.getElementById("crm-visit-status").value = historicalData.status || "A Visitar";
    document.getElementById("crm-visit-notes").value = historicalData.visitNotes || "";
  }

  modal.classList.remove("hidden");
}

function closeCrmModal() {
  modal.classList.add("hidden");
  currentSelectedProspect = null;
}

document.getElementById("btn-close-modal").addEventListener("click", closeCrmModal);
document.getElementById("btn-cancel-crm").addEventListener("click", closeCrmModal);

crmForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db || !currentSelectedProspect || !loggedInUser) return;

  const contactName = document.getElementById("crm-contact-name").value.trim();
  const contactEmail = document.getElementById("crm-contact-email").value.trim();
  const status = document.getElementById("crm-visit-status").value;
  const visitNotes = document.getElementById("crm-visit-notes").value.trim();

  const visitPayload = {
    placeId: currentSelectedProspect.id,
    placeName: currentSelectedProspect.name,
    placeAddress: currentSelectedProspect.address,
    placePhone: currentSelectedProspect.phone || document.getElementById("crm-place-phone").textContent || "",
    lat: currentSelectedProspect.lat,
    lng: currentSelectedProspect.lng,
    contactName: contactName,
    contactEmail: contactEmail,
    status: status,
    visitNotes: visitNotes,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    createdByUid: savedVisits[currentSelectedProspect.id]?.createdByUid || loggedInUser.uid,
    createdByName: savedVisits[currentSelectedProspect.id]?.createdByName || loggedInUser.displayName || loggedInUser.email,
  };

  try {
    await db.collection("visitas").doc(currentSelectedProspect.id).set(visitPayload, { merge: true });
    alert(i18n[currentLanguage].alert_save_success);
    closeCrmModal();
  } catch (error) {
    alert(i18n[currentLanguage].alert_save_error + error.message);
  }
});

// ==========================================================================
// 10. PAINEL ADMINISTRATIVO (CONTROLE DE ACESSOS)
// ==========================================================================

let usersListenerUnsubscribe = null;

function listenToAllUsers() {
  if (!db || !isSuperAdmin) return;
  if (usersListenerUnsubscribe) usersListenerUnsubscribe();

  usersListenerUnsubscribe = db.collection("users").onSnapshot((snapshot) => {
    const listContainer = document.getElementById("admin-users-list");
    listContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const user = doc.data();
      const tr = document.createElement("tr");
      const isSelf = user.uid === loggedInUser.uid;
      const toggleDisabled = isSelf ? "disabled" : "";

      tr.innerHTML = `
        <td>
          <div class="table-user-cell">
            <span><b>${user.name || 'Sem nome'}</b></span>
            <span class="table-user-email">${user.email}</span>
          </div>
        </td>
        <td>
          <div class="toggle-switch-container">
            <input type="checkbox" id="toggle-admin-${user.uid}" ${user.super_admin ? 'checked' : ''} ${toggleDisabled}>
            <label for="toggle-admin-${user.uid}" class="text-xs ml-1" style="cursor: pointer; font-weight: 500;">
              ${user.super_admin ? i18n[currentLanguage].role_admin : i18n[currentLanguage].role_sales}
            </label>
          </div>
        </td>`;

      const checkbox = tr.querySelector(`#toggle-admin-${user.uid}`);
      if (checkbox && !isSelf) {
        checkbox.addEventListener("change", async (e) => {
          const makeAdmin = e.target.checked;
          try {
            await db.collection("users").doc(user.uid).update({ super_admin: makeAdmin });
          } catch (err) {
            e.target.checked = !makeAdmin;
          }
        });
      }
      listContainer.appendChild(tr);
    });
  });
}

// ==========================================================================
// 11. EXPORTAÇÃO DE RELATÓRIO PDF
// ==========================================================================

document.getElementById("btn-export-pdf").addEventListener("click", generatePDFReport);

function generatePDFReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const primaryColor = [15, 23, 42];   
  const secondaryColor = [100, 116, 139]; 
  const lightBg = [248, 250, 252];      

  doc.setFillColor(...primaryColor);
  doc.rect(15, 15, 30, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("D2", 24, 25);

  doc.setTextColor(...primaryColor);
  doc.setFontSize(20);
  doc.text("D2 GROUP CRM", 50, 22);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text("Relatorio de Prospeccao em Campo & CRM", 50, 28);

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 35, 195, 35);

  doc.setTextColor(...primaryColor);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo de Campo", 15, 45);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  doc.text(`Data do Relatorio: ${new Date().toLocaleDateString()}`, 15, 50);
  doc.text(`Gerado por: ${loggedInUser ? loggedInUser.displayName || loggedInUser.email : 'Consultor D2'}`, 15, 55);

  const filterStatus = document.getElementById("filter-visit-status").value;
  const visitsToExport = Object.values(savedVisits).filter(v => {
    if (filterStatus === "all") return true;
    return v.status === filterStatus;
  });

  doc.text(`Total de Visitas Exportadas: ${visitsToExport.length}`, 150, 50);
  
  let currentY = 65;

  visitsToExport.forEach((visit, index) => {
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(...lightBg);
    doc.rect(15, currentY, 180, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, 180, 32, 'S');

    let statusColor = [100, 116, 139]; 
    if (visit.status === "A Visitar") statusColor = [234, 179, 8];
    if (visit.status === "Visitado") statusColor = [16, 185, 129];
    if (visit.status === "Potencial") statusColor = [59, 130, 246];
    if (visit.status === "Revisitar") statusColor = [249, 115, 22];
    if (visit.status === "Desativada/Mudou") statusColor = [239, 68, 68];

    doc.setFillColor(...statusColor);
    doc.rect(15, currentY, 3, 32, 'F');

    doc.setTextColor(...primaryColor);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${visit.placeName}`, 21, currentY + 6);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text(`Endereco: ${visit.placeAddress}`, 21, currentY + 11);
    
    doc.setTextColor(...primaryColor);
    doc.text(`Status: ${visit.status}`, 21, currentY + 16);
    doc.text(`Decisor: ${visit.contactName || '---'} | Contato: ${visit.contactEmail || '---'} | Tel: ${visit.placePhone || '---'}`, 21, currentY + 21);
    
    doc.setTextColor(...secondaryColor);
    const notesText = visit.visitNotes ? `Notas: ${visit.visitNotes}` : "Notas: Nenhuma nota registrada.";
    const truncatedNotes = notesText.length > 105 ? notesText.substring(0, 102) + "..." : notesText;
    doc.text(truncatedNotes, 21, currentY + 26);

    currentY += 36;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...secondaryColor);
    doc.text("D2 Group CRM - Relatorio de Prospeccao Privado", 15, 287);
    doc.text(`Pagina ${i} de ${pageCount}`, 180, 287);
  }

  doc.save(`D2_Group_CRM_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ==========================================================================
// 12. LOGICA DE INTERFACE: TABS & EVENTOS INICIAIS
// ==========================================================================

document.querySelectorAll(".tab-link").forEach(tabLink => {
  tabLink.addEventListener("click", () => {
    document.querySelectorAll(".tab-link").forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    tabLink.classList.add("active");
    const targetPanelId = tabLink.getAttribute("data-tab");
    document.getElementById(targetPanelId).classList.add("active");
  });
});

document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    changeLanguage(btn.getAttribute("data-lang"));
  });
});

document.addEventListener("DOMContentLoaded", () => {
  changeLanguage("pt");
  lucide.createIcons();
});

// ==========================================================================
// 13. SISTEMA DE ROTEAMENTO (MAPA & GPS)
// ==========================================================================

let directionsService;
let directionsRenderer;
let selectedRoutePlaces = [];

function initRoutingServices() {
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: "#3b82f6", strokeWeight: 5, strokeOpacity: 0.8 }
  });
}

function handleRouteSelection(isChecked, visitData) {
  if (isChecked) {
    selectedRoutePlaces.push({ id: visitData.placeId, name: visitData.placeName, lat: visitData.lat, lng: visitData.lng });
  } else {
    selectedRoutePlaces = selectedRoutePlaces.filter(p => p.id !== visitData.placeId);
  }

  const actionBar = document.getElementById("route-action-bar");
  const countSpan = document.getElementById("route-count");

  if (selectedRoutePlaces.length > 0) {
    actionBar.style.display = "flex";
    if(countSpan) countSpan.textContent = selectedRoutePlaces.length;
  } else {
    actionBar.style.display = "none";
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
  }
}

document.getElementById("btn-clear-route")?.addEventListener("click", () => {
  selectedRoutePlaces = [];
  renderVisitasList(); 
  document.getElementById("route-action-bar").style.display = "none";
  if (directionsRenderer) directionsRenderer.setDirections({routes: []});
});

document.getElementById("btn-draw-route")?.addEventListener("click", () => {
  if (selectedRoutePlaces.length < 2) {
    alert("Selecione pelo menos 2 locais para traçar uma rota no mapa.");
    return;
  }
  
  if (!directionsService) initRoutingServices();

  const origin = { lat: selectedRoutePlaces[0].lat, lng: selectedRoutePlaces[0].lng };
  const destination = { lat: selectedRoutePlaces[selectedRoutePlaces.length - 1].lat, lng: selectedRoutePlaces[selectedRoutePlaces.length - 1].lng };
  
  const waypoints = selectedRoutePlaces.slice(1, -1).map(place => ({
    location: { lat: place.lat, lng: place.lng },
    stopover: true
  }));

  directionsService.route({
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    optimizeWaypoints: true, 
    travelMode: google.maps.TravelMode.DRIVING
  }, (response, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(response);
    } else {
      alert("Não foi possível calcular a rota: " + status);
    }
  });
});

document.getElementById("btn-gps-route")?.addEventListener("click", () => {
  if (selectedRoutePlaces.length === 0) return;

  const baseUrl = "https://www.google.com/maps/dir/?api=1";
  const destinationPlace = selectedRoutePlaces[selectedRoutePlaces.length - 1];
  
  let url = `${baseUrl}&destination=${destinationPlace.lat},${destinationPlace.lng}`;

  if (selectedRoutePlaces.length > 1) {
    const waypointsArray = selectedRoutePlaces.slice(0, -1).map(p => `${p.lat},${p.lng}`);
    url += `&waypoints=${waypointsArray.join('|')}`;
  }

  window.open(url, "_blank");
});
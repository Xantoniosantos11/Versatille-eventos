const cfg = window.SUPABASE_CONFIG;

const setupScreen = document.getElementById("setupScreen");
const setupForm = document.getElementById("setupForm");
const setupError = document.getElementById("setupError");
const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const roleBadge = document.getElementById("roleBadge");
const panelTitle = document.getElementById("panelTitle");
const panelSubtitle = document.getElementById("panelSubtitle");
const admArea = document.getElementById("admArea");
const sellerArea = document.getElementById("sellerArea");
const statusText = document.getElementById("statusText");
const statusDot = document.querySelector(".dot");

let supabaseClient = null;

function setStatus(text, ok=false){
  statusText.textContent = text;
  statusDot.style.background = ok ? "#55d98a" : "#e0a83b";
}

function showSetup(){
  setupScreen.classList.remove("hidden");
  loginScreen.classList.add("hidden");
  dashboardScreen.classList.add("hidden");
}

function showLogin(){
  setupScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  dashboardScreen.classList.add("hidden");
}

function showDashboard(){
  loginScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
}

async function init(){
  if(!cfg?.url || !cfg.anonKey){
    setStatus("Cole a Publishable key do Supabase para começar.");
    showSetup();
    return;
  }

  supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  setStatus("Conectado ao Supabase", true);

  const {data:{session}} = await supabaseClient.auth.getSession();
  if(session) await loadProfile(session.user);
  else showLogin();

  supabaseClient.auth.onAuthStateChange(async (event, session)=>{
    if(session) await loadProfile(session.user);
    else showLogin();
  });
}

async function loadProfile(user){
  const {data: profile, error} = await supabaseClient
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

  if(error){
    loginError.textContent = "Não foi possível carregar o perfil.";
    showLogin();
    return;
  }

  if(!profile.active){
    loginError.textContent = "Usuário desativado.";
    await supabaseClient.auth.signOut();
    return;
  }

  userInfo.textContent = profile.full_name || user.email;
  roleBadge.textContent = profile.role;
  panelTitle.textContent = profile.role === "ADM" ? "Painel administrativo" : "Painel do vendedor";
  panelSubtitle.textContent = profile.role === "ADM"
    ? "Controle de eventos, produtos, estoque e relatórios."
    : "Registre vendas do evento com seu usuário individual.";

  admArea.classList.toggle("hidden", profile.role !== "ADM");
  sellerArea.classList.toggle("hidden", profile.role !== "VENDEDOR");
  showDashboard();
}


setupForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const key = document.getElementById("publishableKey").value.trim();
  if(!key.startsWith("sb_publishable_")){
    setupError.textContent = "Use a Publishable key que começa com sb_publishable_.";
    return;
  }
  localStorage.setItem("versatille_publishable_key", key);
  location.reload();
});

loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  loginError.textContent = "";
  if(!supabaseClient){
    loginError.textContent = "Configure o Supabase primeiro.";
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const {error} = await supabaseClient.auth.signInWithPassword({email,password});
  if(error) loginError.textContent = "E-mail ou senha inválidos.";
});

logoutBtn.addEventListener("click", async ()=>{
  await supabaseClient.auth.signOut();
});


document.querySelectorAll("[data-section]").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    const section = btn.dataset.section;
    if(section === "events"){
      await openEvents();
    } else {
      alert(`Módulo "${section}" será construído na próxima etapa.`);
    }
  });
});

async function openEvents(){
  const content = document.querySelector(".content");
  const oldHtml = content.innerHTML;

  content.innerHTML = `
    <div class="module-head">
      <div>
        <button id="backDashboard" class="ghost">← Voltar</button>
        <div class="eyebrow">ADMINISTRAÇÃO</div>
        <h1>Eventos</h1>
        <p class="muted">Crie, abra, feche e consulte os eventos da Versatille.</p>
      </div>
      <button id="newEventBtn" class="primary compact">+ Novo evento</button>
    </div>

    <div id="eventFormWrap" class="card hidden">
      <h2>Novo evento</h2>
      <form id="eventForm">
        <label>Nome do evento
          <input id="eventName" required maxlength="120" placeholder="Ex.: Automotubas Experience">
        </label>
        <label>Data
          <input id="eventDate" type="date" required>
        </label>
        <label>Local
          <input id="eventLocation" maxlength="180" placeholder="Ex.: Goiânia - GO">
        </label>
        <div class="form-actions">
          <button type="button" id="cancelEventForm" class="ghost">Cancelar</button>
          <button type="submit" class="primary compact">Criar evento</button>
        </div>
        <p id="eventFormError" class="error"></p>
      </form>
    </div>

    <div id="eventsList" class="list"></div>
  `;

  document.getElementById("backDashboard").onclick = () => {
    content.innerHTML = oldHtml;
    rebindDashboardButtons();
  };
  document.getElementById("newEventBtn").onclick = () => {
    document.getElementById("eventFormWrap").classList.remove("hidden");
    document.getElementById("eventDate").value = new Date().toISOString().slice(0,10);
    document.getElementById("eventName").focus();
  };
  document.getElementById("cancelEventForm").onclick = () => {
    document.getElementById("eventFormWrap").classList.add("hidden");
  };
  document.getElementById("eventForm").onsubmit = createEvent;
  await loadEvents();
}

function rebindDashboardButtons(){
  document.querySelectorAll("[data-section]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const section = btn.dataset.section;
      if(section === "events") await openEvents();
      else alert(`Módulo "${section}" será construído na próxima etapa.`);
    });
  });
}

async function loadEvents(){
  const list = document.getElementById("eventsList");
  list.innerHTML = `<div class="card muted">Carregando eventos...</div>`;

  const {data, error} = await supabaseClient
    .from("events")
    .select("id,name,event_date,location,status,created_at,closed_at")
    .order("event_date", {ascending:false})
    .order("created_at", {ascending:false});

  if(error){
    list.innerHTML = `<div class="card error">Não foi possível carregar os eventos: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if(!data?.length){
    list.innerHTML = `<div class="card empty">Nenhum evento cadastrado ainda. Toque em <b>+ Novo evento</b> para criar o primeiro.</div>`;
    return;
  }

  list.innerHTML = data.map(e => `
    <article class="event-card card">
      <div>
        <div class="event-title">${escapeHtml(e.name)}</div>
        <div class="muted">${formatDate(e.event_date)}${e.location ? " • " + escapeHtml(e.location) : ""}</div>
      </div>
      <div class="event-right">
        <span class="status ${e.status.toLowerCase()}">${escapeHtml(e.status)}</span>
        <div class="event-actions">
          ${e.status === "ABERTO" ? `<button class="ghost small-btn" data-close="${e.id}">Fechar</button>` : ""}
          ${e.status !== "CANCELADO" && e.status !== "FECHADO" ? `<button class="danger-btn small-btn" data-cancel="${e.id}">Cancelar</button>` : ""}
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => updateEventStatus(b.dataset.close, "FECHADO"));
  document.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => updateEventStatus(b.dataset.cancel, "CANCELADO"));
}

async function createEvent(e){
  e.preventDefault();
  const err = document.getElementById("eventFormError");
  err.textContent = "";

  const {data:{user}} = await supabaseClient.auth.getUser();
  if(!user){ err.textContent = "Sessão expirada. Faça login novamente."; return; }

  const payload = {
    name: document.getElementById("eventName").value.trim(),
    event_date: document.getElementById("eventDate").value,
    location: document.getElementById("eventLocation").value.trim() || null,
    status: "ABERTO",
    created_by: user.id
  };

  const {error} = await supabaseClient.from("events").insert(payload);
  if(error){
    err.textContent = error.message;
    return;
  }

  document.getElementById("eventForm").reset();
  document.getElementById("eventFormWrap").classList.add("hidden");
  await loadEvents();
}

async function updateEventStatus(id, status){
  const label = status === "FECHADO" ? "fechar" : "cancelar";
  if(!confirm(`Tem certeza que deseja ${label} este evento?`)) return;

  const update = {status};
  if(status === "FECHADO") update.closed_at = new Date().toISOString();

  const {error} = await supabaseClient.from("events").update(update).eq("id", id);
  if(error){
    alert("Não foi possível atualizar o evento: " + error.message);
    return;
  }
  await loadEvents();
}

function formatDate(value){
  if(!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

init();

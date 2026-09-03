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
    } else if(section === "products"){
      await openProducts();
    } else if(section === "users"){
      await openEventSellers();
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
      else if(section === "products") await openProducts();
      else if(section === "users") await openEventSellers();
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


async function openProducts(){
  const content=document.querySelector(".content");
  const oldHtml=content.innerHTML;

  content.innerHTML=`
    <div class="module-head">
      <div>
        <button id="backProducts" class="ghost">← Voltar</button>
        <div class="eyebrow">ADMINISTRAÇÃO</div>
        <h1>Produtos</h1>
        <p class="muted">Cadastre bebidas, preços e disponibilidade para as vendas.</p>
      </div>
      <button id="newProductBtn" class="primary compact">+ Novo produto</button>
    </div>

    <div id="productFormWrap" class="card hidden">
      <h2 id="productFormTitle">Novo produto</h2>
      <form id="productForm">
        <input id="productId" type="hidden">
        <label>Nome do produto
          <input id="productName" required maxlength="120" placeholder="Ex.: Red Bull 250ml">
        </label>
        <label>Categoria
          <input id="productCategory" maxlength="80" placeholder="Ex.: Energético">
        </label>
        <label>Preço de venda
          <input id="productPrice" type="number" min="0" step="0.01" required placeholder="0,00">
        </label>
        <div class="form-actions">
          <button type="button" id="cancelProductForm" class="ghost">Cancelar</button>
          <button type="submit" class="primary compact">Salvar produto</button>
        </div>
        <p id="productFormError" class="error"></p>
      </form>
    </div>

    <div id="productsList" class="list"></div>
  `;

  document.getElementById("backProducts").onclick=()=>{content.innerHTML=oldHtml;rebindDashboardButtons()};
  document.getElementById("newProductBtn").onclick=()=>openProductForm();
  document.getElementById("cancelProductForm").onclick=()=>document.getElementById("productFormWrap").classList.add("hidden");
  document.getElementById("productForm").onsubmit=saveProduct;
  await loadProducts();
}

function openProductForm(product=null){
  const wrap=document.getElementById("productFormWrap");
  wrap.classList.remove("hidden");
  document.getElementById("productFormTitle").textContent=product?"Editar produto":"Novo produto";
  document.getElementById("productId").value=product?.id||"";
  document.getElementById("productName").value=product?.name||"";
  document.getElementById("productCategory").value=product?.category||"";
  document.getElementById("productPrice").value=product?.price??"";
  document.getElementById("productFormError").textContent="";
  document.getElementById("productName").focus();
}

async function loadProducts(){
  const list=document.getElementById("productsList");
  list.innerHTML=`<div class="card muted">Carregando produtos...</div>`;

  const {data,error}=await supabaseClient
    .from("products")
    .select("id,name,category,price,active,created_at,updated_at")
    .order("active",{ascending:false})
    .order("name",{ascending:true});

  if(error){
    list.innerHTML=`<div class="card error">Não foi possível carregar os produtos: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if(!data?.length){
    list.innerHTML=`<div class="card empty">Nenhum produto cadastrado. Toque em <b>+ Novo produto</b>.</div>`;
    return;
  }

  list.innerHTML=data.map(p=>`
    <article class="product-card card">
      <div>
        <div class="event-title">${escapeHtml(p.name)}</div>
        <div class="muted">${p.category?escapeHtml(p.category)+" • ":""}${formatMoney(p.price)}</div>
      </div>
      <div class="product-right">
        <span class="status ${p.active?"aberto":"fechado"}">${p.active?"ATIVO":"INATIVO"}</span>
        <div class="event-actions">
          <button class="ghost small-btn" data-edit-product="${p.id}">Editar</button>
          <button class="${p.active?"danger-btn":"ghost"} small-btn" data-toggle-product="${p.id}" data-active="${p.active}">
            ${p.active?"Desativar":"Ativar"}
          </button>
        </div>
      </div>
    </article>
  `).join("");

  data.forEach(p=>{
    const edit=document.querySelector(`[data-edit-product="${p.id}"]`);
    const toggle=document.querySelector(`[data-toggle-product="${p.id}"]`);
    if(edit) edit.onclick=()=>openProductForm(p);
    if(toggle) toggle.onclick=()=>toggleProduct(p.id,!p.active);
  });
}

async function saveProduct(e){
  e.preventDefault();
  const err=document.getElementById("productFormError");
  err.textContent="";

  const id=document.getElementById("productId").value;
  const payload={
    name:document.getElementById("productName").value.trim(),
    category:document.getElementById("productCategory").value.trim()||null,
    price:Number(document.getElementById("productPrice").value)
  };

  if(!payload.name || !Number.isFinite(payload.price) || payload.price<0){
    err.textContent="Informe nome e preço válidos.";
    return;
  }

  const result=id
    ? await supabaseClient.from("products").update(payload).eq("id",id)
    : await supabaseClient.from("products").insert({...payload,active:true});

  if(result.error){err.textContent=result.error.message;return}

  document.getElementById("productForm").reset();
  document.getElementById("productFormWrap").classList.add("hidden");
  await loadProducts();
}

async function toggleProduct(id,active){
  const {error}=await supabaseClient.from("products").update({active}).eq("id",id);
  if(error){alert("Não foi possível alterar o produto: "+error.message);return}
  await loadProducts();
}

function formatMoney(value){
  return Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}



async function openEventSellers(){
  const content=document.querySelector(".content");
  const oldHtml=content.innerHTML;

  content.innerHTML=`
    <div class="module-head">
      <div>
        <button id="backSellers" class="ghost">← Voltar</button>
        <div class="eyebrow">ADMINISTRAÇÃO</div>
        <h1>Vendedores</h1>
        <p class="muted">Gerencie a equipe vinculada a cada evento.</p>
      </div>
    </div>

    <div class="card">
      <label>Evento
        <select id="sellerEventSelect" class="select"></select>
      </label>
    </div>

    <div id="sellerAddArea" class="card hidden">
      <h2>Vincular vendedor</h2>
      <form id="sellerForm">
        <label>Usuário já cadastrado no sistema
          <select id="sellerUserSelect" class="select" required></select>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary compact">Adicionar ao evento</button>
        </div>
        <p id="sellerFormError" class="error"></p>
      </form>
    </div>

    <div id="sellersList" class="list"></div>
  `;

  document.getElementById("backSellers").onclick=()=>{
    content.innerHTML=oldHtml;
    rebindDashboardButtons();
  };
  document.getElementById("sellerEventSelect").onchange=loadEventSellers;
  document.getElementById("sellerForm").onsubmit=addSellerToEvent;

  await loadSellerEvents();
}

async function loadSellerEvents(){
  const select=document.getElementById("sellerEventSelect");
  const {data,error}=await supabaseClient.from("events")
    .select("id,name,event_date,status")
    .order("event_date",{ascending:false});

  if(error){
    select.innerHTML=`<option>Erro ao carregar eventos</option>`;
    return;
  }
  if(!data?.length){
    select.innerHTML=`<option value="">Nenhum evento cadastrado</option>`;
    document.getElementById("sellerAddArea").classList.add("hidden");
    document.getElementById("sellersList").innerHTML=`<div class="card empty">Crie um evento primeiro.</div>`;
    return;
  }

  select.innerHTML=data.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} • ${formatDate(e.event_date)} • ${escapeHtml(e.status)}</option>`).join("");
  document.getElementById("sellerAddArea").classList.remove("hidden");
  await loadSellerUsers();
  await loadEventSellers();
}

async function loadSellerUsers(){
  const select=document.getElementById("sellerUserSelect");
  const {data,error}=await supabaseClient.from("profiles")
    .select("id,full_name,role,active")
    .eq("role","VENDEDOR")
    .eq("active",true)
    .order("full_name",{ascending:true});

  if(error){
    select.innerHTML=`<option value="">Não foi possível carregar vendedores</option>`;
    return;
  }
  select.innerHTML=data?.length
    ? data.map(u=>`<option value="${u.id}">${escapeHtml(u.full_name||"Vendedor")} </option>`).join("")
    : `<option value="">Nenhum vendedor cadastrado ainda</option>`;
}

async function loadEventSellers(){
  const eventId=document.getElementById("sellerEventSelect").value;
  const list=document.getElementById("sellersList");
  if(!eventId){list.innerHTML="";return;}

  const {data,error}=await supabaseClient.from("event_sellers")
    .select("id,user_id,active,created_at,profiles(full_name)")
    .eq("event_id",eventId)
    .order("created_at",{ascending:true});

  if(error){
    list.innerHTML=`<div class="card error">Não foi possível carregar a equipe: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if(!data?.length){
    list.innerHTML=`<div class="card empty">Nenhum vendedor vinculado a este evento.</div>`;
    return;
  }

  list.innerHTML=data.map(s=>`
    <article class="product-card card">
      <div>
        <div class="event-title">${escapeHtml(s.profiles?.full_name||"Vendedor")}</div>
        <div class="muted">Vínculo ${s.active?"ativo":"inativo"}</div>
      </div>
      <div class="product-right">
        <span class="status ${s.active?"aberto":"fechado"}">${s.active?"ATIVO":"INATIVO"}</span>
        <button class="${s.active?"danger-btn":"ghost"} small-btn" data-toggle-seller="${s.id}" data-active="${s.active}">
          ${s.active?"Desativar":"Ativar"}
        </button>
      </div>
    </article>
  `).join("");

  data.forEach(s=>{
    const b=document.querySelector(`[data-toggle-seller="${s.id}"]`);
    if(b) b.onclick=()=>toggleEventSeller(s.id,!s.active);
  });
}

async function addSellerToEvent(e){
  e.preventDefault();
  const err=document.getElementById("sellerFormError");
  err.textContent="";
  const eventId=document.getElementById("sellerEventSelect").value;
  const userId=document.getElementById("sellerUserSelect").value;
  if(!eventId||!userId){err.textContent="Selecione o evento e o vendedor.";return;}

  const {error}=await supabaseClient.from("event_sellers").insert({
    event_id:eventId,user_id:userId,active:true
  });

  if(error){
    err.textContent=error.code==="23505"?"Esse vendedor já está vinculado a este evento.":error.message;
    return;
  }
  await loadEventSellers();
}

async function toggleEventSeller(id,active){
  const {error}=await supabaseClient.from("event_sellers").update({active}).eq("id",id);
  if(error){alert("Não foi possível alterar o acesso ao evento: "+error.message);return}
  await loadEventSellers();
}

init();

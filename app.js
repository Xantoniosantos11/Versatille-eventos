
// ===== CONTROLE DE OPERAÇÃO DO EVENTO =====
async function loadEventOperationsControls(eventId, targetId="eventOperationsPanel") {
  const c = document.getElementById(targetId);
  if (!c || !eventId) return;
  window.currentAdminEventId = eventId;
  c.innerHTML = `<div class="card muted">Carregando controle operacional...</div>`;

  const [evR, hoursR, periodsR, sellersR, accessR] = await Promise.all([
    supabaseClient.from("events").select("id,name,event_date,location,status").eq("id",eventId).maybeSingle(),
    supabaseClient.from("event_operating_hours").select("start_time,end_time,active").eq("event_id",eventId).maybeSingle(),
    supabaseClient.from("event_operating_periods").select("id,period_start,period_end,created_at").eq("event_id",eventId).order("period_start",{ascending:false}),
    supabaseClient.from("event_sellers").select("user_id,active,profiles(full_name)").eq("event_id",eventId).order("created_at",{ascending:true}),
    supabaseClient.from("event_seller_period_access").select("id,period_id,seller_id,released_at,closed_at,closed_by").eq("event_id",eventId)
  ]);
  const firstError=[evR,hoursR,periodsR,sellersR,accessR].find(r=>r.error);
  if(firstError){
    c.innerHTML=`<div class="card error">Não foi possível carregar o controle operacional: ${escapeHtml(firstError.error.message)}</div>`;
    return;
  }
  const ev=evR.data;
  if(!ev){ c.innerHTML=`<div class="card error">Evento não encontrado.</div>`; return; }
  const closed=ev.status!=="ABERTO";
  const periods=periodsR.data||[];
  const sellers=(sellersR.data||[]).filter(s=>s.active!==false);
  const accesses=accessR.data||[];
  const hours=hoursR.data;

  const fmtDateTime=v=>v?new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"";
  const periodRows=periods.length ? periods.map(period=>{
    const pa=accesses.filter(a=>a.period_id===period.id);
    const sellerRows=sellers.length ? sellers.map(s=>{
      const a=pa.find(x=>x.seller_id===s.user_id);
      const name=s.profiles?.full_name||`Garçom ${String(s.user_id).slice(0,8)}`;
      let status="Não liberado";
      if(a && !a.closed_at) status="🟢 Liberado";
      if(a && a.closed_at) status="🔒 Fechado";
      return `<div class="card" style="margin-top:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <div><strong>🍹 ${escapeHtml(name)}</strong><br><span class="muted">${status}</span></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(!a || a.closed_at) && !closed ? `<button class="primary compact" data-release-period="${period.id}" data-release-seller="${s.user_id}">🟢 Liberar</button>` : ""}
            ${a && !a.closed_at && !closed ? `<button class="danger-btn small-btn" data-close-seller-period="${period.id}" data-close-seller="${s.user_id}">🔒 Fechar</button>` : ""}
            ${a ? `<button class="ghost small-btn" data-seller-period-report="${period.id}" data-report-seller="${s.user_id}">📄 Ver fechamento</button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("") : `<div class="muted">Nenhum garçom ativo vinculado a este evento.</div>`;
    return `<div class="card" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><div class="eyebrow">PERÍODO OPERACIONAL</div><strong>${fmtDateTime(period.period_start)} → ${fmtDateTime(period.period_end)}</strong></div>
        ${!closed ? `<button class="ghost small-btn" data-refresh-periods="${eventId}">↻ Atualizar</button>` : ""}
      </div>
      <div style="margin-top:8px">${sellerRows}</div>
      <div id="sellerPeriodReport-${period.id}" style="margin-top:8px"></div>
    </div>`;
  }).join("") : `<div class="card muted" style="margin-top:12px">Nenhum período operacional criado ainda.</div>`;

  c.innerHTML=`
    <div class="card">
      <div class="eyebrow">CONTROLE OPERACIONAL</div>
      <h2>${escapeHtml(ev.name)}</h2>
      <p class="muted">O ADM define manualmente cada período. O garçom só pode vender quando estiver dentro do período e tiver sido liberado individualmente.</p>
      <div class="grid">
        <label>Início do novo período\n          <input id="periodStartInput" type="datetime-local" ${closed?"disabled":""}>\n        </label>
        <label>Fim do novo período\n          <input id="periodEndInput" type="datetime-local" ${closed?"disabled":""}>\n        </label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button id="createPeriodBtn" class="primary compact" ${closed?"disabled":""}>➕ Criar período</button>
        <button id="closeEventDayBtn" class="secondary compact" ${closed?"disabled":""}>📊 Fechar relatório do dia</button>
        <button id="closeEventBtn" class="danger-btn small-btn" ${closed?"disabled":""}>🔒 Fechar evento</button>
        ${closed?'<button id="deleteFinishedEventBtn" class="danger-btn small-btn">🗑️ Excluir evento definitivamente</button>':""}
      </div>
      <p id="periodControlError" class="error"></p>
    </div>

    <div class="card">
      <div class="eyebrow">HORÁRIO GERAL DO EVENTO</div>
      <p class="muted">Mantido como configuração geral. O controle de vendas usa os períodos manuais acima.</p>
      <div class="grid">
        <label>Início<input id="eventStartTime" type="time" value="${hours?.start_time?.slice(0,5)||""}" ${closed?"disabled":""}></label>
        <label>Fim<input id="eventEndTime" type="time" value="${hours?.end_time?.slice(0,5)||""}" ${closed?"disabled":""}></label>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <input id="eventHoursActive" type="checkbox" ${hours?.active !== false ? "checked":""} ${closed?"disabled":""}> Horário ativo
      </label>
      <button id="saveEventHoursBtn" class="ghost small-btn" style="margin-top:10px" ${closed?"disabled":""}>💾 Salvar horário geral</button>
    </div>

    <div>
      <div class="eyebrow" style="margin-top:18px">PERÍODOS E GARÇONS</div>
      ${periodRows}
    </div>`;

  document.getElementById("createPeriodBtn")?.addEventListener("click",()=>createEventPeriodFromApp(eventId,targetId));
  document.getElementById("saveEventHoursBtn")?.addEventListener("click",saveEventOperationsHours);
  document.getElementById("closeEventDayBtn")?.addEventListener("click",closeEventDayFromApp);
  document.getElementById("closeEventBtn")?.addEventListener("click",async()=>{await closeEventFromApp(); await loadEventOperationsControls(eventId,targetId); await loadEvents();});
  document.getElementById("deleteFinishedEventBtn")?.addEventListener("click",async()=>{await deleteFinishedEventFromApp();});
  document.querySelectorAll("[data-release-period]").forEach(b=>b.onclick=async()=>{
    const {error}=await supabaseClient.rpc("release_seller_for_period",{p_period_id:b.dataset.releasePeriod,p_seller_id:b.dataset.releaseSeller});
    if(error) return alert(error.message);
    await loadEventOperationsControls(eventId,targetId);
  });
  document.querySelectorAll("[data-close-seller-period]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Fechar este garçom para este período? Ele não poderá realizar novas vendas neste período.")) return;
    const {error}=await supabaseClient.rpc("close_seller_period",{p_period_id:b.dataset.closeSellerPeriod,p_seller_id:b.dataset.closeSeller});
    if(error) return alert(error.message);
    await loadEventOperationsControls(eventId,targetId);
  });
  document.querySelectorAll("[data-seller-period-report]").forEach(b=>b.onclick=()=>renderSellerPeriodReport(b.dataset.sellerPeriodReport,b.dataset.reportSeller,eventId,targetId));
  document.querySelectorAll("[data-refresh-periods]").forEach(b=>b.onclick=()=>loadEventOperationsControls(eventId,targetId));
}

async function createEventPeriodFromApp(eventId,targetId="eventOperationsPanel") {
  const start=document.getElementById("periodStartInput")?.value;
  const end=document.getElementById("periodEndInput")?.value;
  const err=document.getElementById("periodControlError");
  if(err) err.textContent="";
  if(!start||!end){ if(err) err.textContent="Informe início e fim do período."; return; }
  const startIso=new Date(start).toISOString();
  const endIso=new Date(end).toISOString();
  if(new Date(endIso)<=new Date(startIso)){ if(err) err.textContent="O fim deve ser depois do início."; return; }
  const {error}=await supabaseClient.rpc("create_event_operating_period",{p_event_id:eventId,p_period_start:startIso,p_period_end:endIso});
  if(error){if(err) err.textContent=error.message; return;}
  alert("Período criado com sucesso. Agora libere cada garçom individualmente.");
  await loadEventOperationsControls(eventId,targetId);
}

async function renderSellerPeriodReport(periodId,sellerId,eventId,targetId="eventOperationsPanel") {
  const target=document.getElementById(`sellerPeriodReport-${periodId}`);
  if(!target) return;
  target.innerHTML=`<div class="card muted">Gerando fechamento individual...</div>`;
  const [periodR,salesR,nameR]=await Promise.all([
    supabaseClient.from("event_operating_periods").select("period_start,period_end").eq("id",periodId).single(),
    supabaseClient.from("sales").select("id,total,status,created_at,sale_items(quantity,unit_price,products(name)),payments(method,amount)").eq("event_id",eventId).eq("seller_id",sellerId).order("created_at",{ascending:true}).limit(5000),
    supabaseClient.from("profiles").select("full_name").eq("id",sellerId).maybeSingle()
  ]);
  const e=[periodR,salesR,nameR].find(r=>r.error);
  if(e){target.innerHTML=`<div class="card error">${escapeHtml(e.error.message)}</div>`;return;}
  const p=periodR.data;
  const sales=(salesR.data||[]).filter(s=>new Date(s.created_at)>=new Date(p.period_start)&&new Date(s.created_at)<new Date(p.period_end));
  const confirmed=sales.filter(s=>s.status==="CONFIRMADA");
  const revenue=confirmed.reduce((a,s)=>a+Number(s.total||0),0);
  const payments={}; const products={};
  confirmed.forEach(s=>{
    (s.payments||[]).forEach(x=>payments[x.method]=(payments[x.method]||0)+Number(x.amount||0));
    (s.sale_items||[]).forEach(i=>{const n=i.products?.name||"Produto";products[n]=(products[n]||0)+Number(i.quantity||0);});
  });
  const paymentRows=Object.entries(payments).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0"><span>${escapeHtml(reportPaymentLabel(k))}</span><strong>${formatMoney(v)}</strong></div>`).join("")||'<div class="muted">Nenhum pagamento.</div>';
  const productRows=Object.entries(products).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0"><span>${escapeHtml(k)}</span><strong>${v}</strong></div>`).join("")||'<div class="muted">Nenhum produto.</div>';
  const saleRows=sales.map(s=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><strong>${new Date(s.created_at).toLocaleString("pt-BR")}</strong><strong>${formatMoney(s.total)}</strong></div><div class="muted">${escapeHtml((s.sale_items||[]).map(i=>`${i.quantity}× ${i.products?.name||"Produto"}`).join(", "))} • ${escapeHtml(s.status)}</div></div>`).join("")||'<div class="muted">Nenhuma venda neste período.</div>';
  const name=nameR.data?.full_name||"Garçom";
  target.innerHTML=`<div class="card" style="margin-top:8px"><div class="eyebrow">FECHAMENTO INDIVIDUAL</div><h3>${escapeHtml(name)}</h3><div class="muted">${new Date(p.period_start).toLocaleString("pt-BR")} → ${new Date(p.period_end).toLocaleString("pt-BR")}</div><div class="grid" style="margin-top:10px"><div><strong>${confirmed.length}</strong><br><small>Vendas</small></div><div><strong>${formatMoney(revenue)}</strong><br><small>Total</small></div></div><h4>Pagamentos</h4>${paymentRows}<h4>Produtos</h4>${productRows}<h4>Vendas • data e hora</h4>${saleRows}<button class="ghost small-btn" style="margin-top:10px" onclick="window.print()">🖨️ Imprimir</button></div>`;
}
async function saveEventOperationsHours() {
  const id=window.currentAdminEventId, start=document.getElementById("eventStartTime")?.value, end=document.getElementById("eventEndTime")?.value;
  const active=document.getElementById("eventHoursActive")?.checked ?? true;
  if(!id) return alert("Selecione um evento.");
  if(!start||!end) return alert("Informe início e término.");
  const {error}=await supabaseClient.from("event_operating_hours").upsert(
    {event_id:id,start_time:start,end_time:end,active,updated_at:new Date().toISOString()},
    {onConflict:"event_id"});
  if(error) return alert(error.message);
  alert("Horário salvo com sucesso.");
}
async function closeEventDayFromApp() {
  const id=window.currentAdminEventId;
  if(!id) return alert("Selecione um evento.");
  const date=new Date().toISOString().slice(0,10);
  if(!confirm(`Fechar o relatório do dia ${date}?\n\nAs vendas realizadas serão preservadas.`)) return;
  const {error}=await supabaseClient.rpc("close_event_day",{p_event_id:id,p_closure_date:date});
  if(error) return alert(error.message);
  alert("Relatório diário fechado com sucesso.");
}
async function closeEventFromApp() {
  const id=window.currentAdminEventId;
  if(!id) return alert("Selecione um evento.");
  if(!confirm("⚠️ Fechar este evento impedirá novas vendas e movimentações.\n\nDeseja continuar?")) return;
  const {error}=await supabaseClient.rpc("close_event",{p_event_id:id});
  if(error) return alert(error.message);
  alert("Evento fechado com sucesso.");
}
async function deleteFinishedEventFromApp() {
  const id=window.currentAdminEventId;
  if(!id) return alert("Selecione um evento.");
  if(!confirm("🗑️ EXCLUSÃO DEFINITIVA\n\nSerão removidos vendas, pagamentos, estoque, movimentações e vínculos deste evento.\n\nProdutos e usuários NÃO serão apagados.\n\nContinuar?")) return;
  if(prompt("Digite EXCLUIR para confirmar:")!=="EXCLUIR") return alert("Exclusão cancelada.");
  const {error}=await supabaseClient.rpc("delete_finished_event",{p_event_id:id});
  if(error) return alert(error.message);
  alert("Evento excluído definitivamente.");
  location.reload();
}

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
const organizationArea = document.getElementById("organizationArea");
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

  if(profile.role === "ADM"){
    panelTitle.textContent = "Painel administrativo";
    panelSubtitle.textContent = "Controle de eventos, produtos, estoque e relatórios.";
  } else if(profile.role === "ORGANIZACAO"){
    panelTitle.textContent = "Painel da organização";
    panelSubtitle.textContent = "Acompanhamento do evento em modo somente leitura.";
  } else {
    panelTitle.textContent = "Painel do vendedor";
    panelSubtitle.textContent = "Registre vendas do evento com seu usuário individual.";
  }

  admArea.classList.toggle("hidden", profile.role !== "ADM");
  sellerArea.classList.toggle("hidden", profile.role !== "VENDEDOR");
  organizationArea.classList.toggle("hidden", profile.role !== "ORGANIZACAO");
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

  const login = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const email = login.includes("@") ? login : `${login}@login.versatille-eventos.local`;

  const {error} = await supabaseClient.auth.signInWithPassword({email,password});
  if(error) loginError.textContent = "E-mail ou senha inválidos.";
});

logoutBtn.addEventListener("click", async ()=>{
  await supabaseClient.auth.signOut();
});


async function handleDashboardSection(section){
  if(section === "events") await openEvents();
  else if(section === "products") await openProducts();
  else if(section === "users") await openEventSellers();
  else if(section === "stock") await openStock();
  else if(section === "sale") await openNewSale();
  else if(section === "mySales") await openMySales();
  else if(section === "organizationDashboard") await openOrganizationDashboard();
  else if(section === "reports") await openReports();
  else alert(`Módulo "${section}" será construído na próxima etapa.`);
}

document.addEventListener("click", async (event)=>{
  const btn = event.target.closest("[data-section]");
  if(!btn) return;
  event.preventDefault();
  await handleDashboardSection(btn.dataset.section);
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
    <div id="eventOperationsPanel"></div>
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
  // Compatibilidade com módulos antigos. O roteador usa delegação de eventos.
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
          ${e.status === "ABERTO" ? `<button class="ghost small-btn" data-operations="${e.id}">⏱️ Períodos</button>` : ""}
          ${e.status === "ABERTO" ? `<button class="ghost small-btn" data-close="${e.id}">Fechar</button>` : ""}
          ${e.status !== "CANCELADO" && e.status !== "FECHADO" ? `<button class="danger-btn small-btn" data-cancel="${e.id}">Cancelar</button>` : ""}
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => updateEventStatus(b.dataset.close, "FECHADO"));
  document.querySelectorAll("[data-cancel]").forEach(b => b.onclick = () => updateEventStatus(b.dataset.cancel, "CANCELADO"));
  document.querySelectorAll("[data-operations]").forEach(b => b.onclick = () => loadEventOperationsControls(b.dataset.operations, "eventOperationsPanel"));
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
  const message = status === "FECHADO"
    ? "Tem certeza que deseja fechar este evento?\n\nDepois do fechamento, novas vendas e movimentações de estoque serão bloqueadas."
    : "Tem certeza que deseja cancelar este evento?";

  if(!confirm(message)) return;

  // Fechamento usa a função protegida do banco.
  // Isso garante que o evento só seja fechado de forma segura pelo ADM.
  if(status === "FECHADO"){
    const {error} = await supabaseClient.rpc("close_event", { p_event_id: id });
    if(error){
      alert("Não foi possível fechar o evento: " + error.message);
      return;
    }
  } else {
    const {error} = await supabaseClient
      .from("events")
      .update({ status: "CANCELADO" })
      .eq("id", id);

    if(error){
      alert("Não foi possível cancelar o evento: " + error.message);
      return;
    }
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
        <h1>Acessos</h1>
        <p class="muted">Crie e gerencie acessos de garçons e organizações por evento.</p>
      </div>
    </div>

    <div class="card">
      <label>Evento
        <select id="sellerEventSelect" class="select"></select>
      </label>
    </div>

    <div id="sellerAddArea" class="card hidden">
      <h2>Novo acesso para este evento</h2>
      <p class="muted">Escolha se o acesso será de Garçom ou Organização.</p>
      <form id="sellerForm">
        <label>Tipo de acesso
          <select id="sellerAccessType" class="select" required>
            <option value="VENDEDOR">🍹 Garçom</option>
            <option value="ORGANIZACAO">👁️ Organização</option>
          </select>
        </label>
        <label>Nome
          <input id="sellerFullName" required maxlength="100" placeholder="Ex.: João da Silva">
        </label>
        <label>Usuário de acesso
          <input id="sellerUsername" required maxlength="40" autocomplete="off" placeholder="Ex.: joao01">
        </label>
        <label>Senha
          <input id="sellerPassword" type="password" required minlength="6" maxlength="72" autocomplete="new-password" placeholder="Mínimo de 6 caracteres">
        </label>
        <div class="form-actions">
          <button type="submit" class="primary compact">Criar acesso</button>
        </div>
        <p id="sellerFormError" class="error"></p>
      </form>
      <div id="sellerCreated" class="created-box hidden"></div>
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
  await loadEventSellers();
}

async function loadEventSellers(){
  const eventId=document.getElementById("sellerEventSelect").value;
  const list=document.getElementById("sellersList");
  if(!eventId){list.innerHTML="";return;}

  const [{data:sellers,error:sellerError},{data:orgs,error:orgError}] = await Promise.all([
    supabaseClient.from("event_sellers")
      .select("id,user_id,active,created_at,profiles(full_name)")
      .eq("event_id",eventId)
      .order("created_at",{ascending:true}),
    supabaseClient.from("event_access")
      .select("id,user_id,active,created_at,profiles(full_name)")
      .eq("event_id",eventId)
      .order("created_at",{ascending:true})
  ]);

  if(sellerError || orgError){
    const message=sellerError?.message || orgError?.message || "Erro ao carregar acessos.";
    list.innerHTML=`<div class="card error">Não foi possível carregar os acessos: ${escapeHtml(message)}</div>`;
    return;
  }

  const rows=[
    ...(sellers||[]).map(s=>({...s,accessType:"VENDEDOR"})),
    ...(orgs||[]).map(s=>({...s,accessType:"ORGANIZACAO"}))
  ].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if(!rows.length){
    list.innerHTML=`<div class="card empty">Nenhum acesso vinculado a este evento.</div>`;
    return;
  }

  list.innerHTML=rows.map(s=>{
    const isOrg=s.accessType==="ORGANIZACAO";
    return `
      <article class="product-card card">
        <div>
          <div class="event-title">${isOrg?"👁️":"🍹"} ${escapeHtml(s.profiles?.full_name||"Usuário")}</div>
          <div class="muted">${isOrg?"Organização":"Garçom"} • Vínculo ${s.active?"ativo":"inativo"}</div>
        </div>
        <div class="product-right">
          <span class="status ${s.active?"aberto":"fechado"}">${s.active?"ATIVO":"INATIVO"}</span>
          <button class="${s.active?"danger-btn":"ghost"} small-btn"
            data-toggle-access="${s.id}"
            data-access-type="${s.accessType}"
            data-active="${s.active}">
            ${s.active?"Desativar":"Ativar"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  rows.forEach(s=>{
    const b=document.querySelector(`[data-toggle-access="${s.id}"]`);
    if(b){
      b.onclick=()=>toggleEventAccess(s.id,!s.active,s.accessType);
    }
  });
}

async function addSellerToEvent(e){
  e.preventDefault();
  const err=document.getElementById("sellerFormError");
  const createdBox=document.getElementById("sellerCreated");
  err.textContent="";
  createdBox.classList.add("hidden");

  const eventId=document.getElementById("sellerEventSelect").value;
  const accessType=document.getElementById("sellerAccessType").value;
  const fullName=document.getElementById("sellerFullName").value.trim();
  const username=document.getElementById("sellerUsername").value.trim().toLowerCase();
  const password=document.getElementById("sellerPassword").value;

  if(!eventId||!fullName||!username||!password){err.textContent="Preencha todos os campos.";return;}
  if(!["VENDEDOR","ORGANIZACAO"].includes(accessType)){err.textContent="Escolha um tipo de acesso válido.";return;}
  if(!/^[a-z0-9._-]{3,40}$/.test(username)){err.textContent="Usuário inválido. Use 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.";return;}
  if(password.length<6){err.textContent="A senha precisa ter pelo menos 6 caracteres.";return;}

  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){err.textContent="Sua sessão expirou. Entre novamente como ADM.";return;}

  const { data: result, error: functionError } = await supabaseClient.functions.invoke(
    "create-event-seller",
    {
      body: {
        event_id:eventId,
        full_name:fullName,
        username,
        password,
        access_type:accessType
      }
    }
  );

  if(functionError){
    let message=functionError.message||"Não foi possível criar o acesso.";
    try{
      if(functionError.context){
        const body=await functionError.context.json();
        if(body?.error) message=body.error;
      }
    }catch{}
    err.textContent=message;
    return;
  }

  if(!result||result.error){
    err.textContent=result?.error||"Não foi possível criar o acesso.";
    return;
  }

  document.getElementById("sellerForm").reset();
  const label=accessType==="ORGANIZACAO"?"Organização":"Garçom";
  createdBox.innerHTML=`<strong>${label} criado com sucesso.</strong><br>Usuário: <b>${escapeHtml(result.username)}</b><br><span class="muted">Guarde a senha informada por você. Ela não será exibida novamente.</span>`;
  createdBox.classList.remove("hidden");
  await loadEventSellers();
}

async function toggleEventAccess(id,active,type){
  const table=type==="ORGANIZACAO"?"event_access":"event_sellers";
  const {error}=await supabaseClient.from(table).update({active}).eq("id",id);
  if(error){alert("Não foi possível alterar o acesso: "+error.message);return}
  await loadEventSellers();
}



/* =========================================================
   MÓDULO DE ESTOQUE
   ========================================================= */

async function openStock(){
  const content=document.querySelector(".content");
  const oldHtml=content.innerHTML;

  content.innerHTML=`
    <div class="module-head">
      <div>
        <button id="backStock" class="ghost">← Voltar</button>
        <div class="eyebrow">ADMINISTRAÇÃO</div>
        <h1>Estoque</h1>
        <p class="muted">Controle o estoque de cada produto por evento.</p>
      </div>
    </div>

    <div class="card">
      <label>Evento
        <select id="stockEventSelect" class="select"></select>
      </label>
      <div id="stockEventStatus" class="muted" style="margin-top:8px"></div>
    </div>

    <div id="stockMoveArea" class="card hidden">
      <h2>Registrar movimentação</h2>
      <p class="muted">Use ENTRADA para colocar mercadoria no evento. PERDA, QUEBRA e CONSUMO INTERNO retiram do estoque.</p>
      <form id="stockForm">
        <label>Produto
          <select id="stockProductSelect" class="select" required></select>
        </label>
        <label>Tipo de movimentação
          <select id="stockMovementType" class="select" required>
            <option value="ENTRADA">Entrada</option>
            <option value="PERDA">Perda</option>
            <option value="QUEBRA">Quebra</option>
            <option value="CONSUMO_INTERNO">Consumo interno</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </label>
        <label>Quantidade
          <input id="stockQuantity" type="number" min="1" step="1" value="1" inputmode="numeric" required>
        </label>
        <div id="stockAdjustmentDirectionWrap" class="hidden">
          <label>Direção do ajuste
            <select id="stockAdjustmentDirection" class="select">
              <option value="1">Adicionar ao estoque</option>
              <option value="-1">Retirar do estoque</option>
            </select>
          </label>
        </div>
        <label>Motivo / observação
          <input id="stockReason" maxlength="200" placeholder="Ex.: Entrada de mercadoria do fornecedor">
        </label>
        <div class="form-actions">
          <button type="submit" class="primary compact">Registrar movimentação</button>
        </div>
        <p id="stockFormError" class="error"></p>
      </form>
    </div>

    <div class="card">
      <h2>Estoque atual</h2>
      <div id="stockList" class="list"><div class="muted">Carregando...</div></div>
    </div>

    <div class="card">
      <h2>Últimas movimentações</h2>
      <div id="stockHistory" class="list"><div class="muted">Carregando...</div></div>
    </div>
  `;

  document.getElementById("backStock").onclick=()=>{
    content.innerHTML=oldHtml;
    rebindDashboardButtons();
  };
  document.getElementById("stockEventSelect").onchange=loadStockForSelectedEvent;
  document.getElementById("stockForm").onsubmit=registerStockMovement;
  document.getElementById("stockMovementType").onchange=()=>{
    document.getElementById("stockAdjustmentDirectionWrap").classList.toggle(
      "hidden", document.getElementById("stockMovementType").value !== "AJUSTE"
    );
  };

  await loadStockEvents();
}

async function loadStockEvents(){
  const select=document.getElementById("stockEventSelect");
  const {data,error}=await supabaseClient.from("events")
    .select("id,name,event_date,status")
    .order("event_date",{ascending:false});

  if(error){
    select.innerHTML=`<option value="">Erro ao carregar eventos</option>`;
    document.getElementById("stockList").innerHTML=`<div class="card error">${escapeHtml(error.message)}</div>`;
    return;
  }

  if(!data?.length){
    select.innerHTML=`<option value="">Nenhum evento cadastrado</option>`;
    document.getElementById("stockMoveArea").classList.add("hidden");
    document.getElementById("stockList").innerHTML=`<div class="empty muted">Crie um evento primeiro.</div>`;
    document.getElementById("stockHistory").innerHTML=`<div class="empty muted">Nenhuma movimentação.</div>`;
    return;
  }

  select.innerHTML=data.map(e=>
    `<option value="${e.id}">${escapeHtml(e.name)} • ${formatDate(e.event_date)} • ${escapeHtml(e.status)}</option>`
  ).join("");
  await loadStockForSelectedEvent();
}

async function loadStockForSelectedEvent(){
  const eventId=document.getElementById("stockEventSelect")?.value;
  if(!eventId) return;

  const eventText=document.getElementById("stockEventSelect").selectedOptions[0]?.textContent || "";
  const eventStatus=eventText.split("•").pop()?.trim() || "";
  document.getElementById("stockEventStatus").textContent =
    eventStatus === "ABERTO" ? "Evento aberto para movimentações." : "Evento fechado/cancelado: movimentações estão bloqueadas.";

  document.getElementById("stockMoveArea").classList.toggle("hidden", eventStatus !== "ABERTO");

  await Promise.all([loadStockProducts(eventId), loadStockList(eventId), loadStockHistory(eventId)]);
}

async function loadStockProducts(eventId){
  const select=document.getElementById("stockProductSelect");
  const {data,error}=await supabaseClient.from("products")
    .select("id,name,category,price,active")
    .eq("active",true)
    .order("name",{ascending:true});

  if(error){
    select.innerHTML=`<option value="">Erro ao carregar produtos</option>`;
    return;
  }

  if(!data?.length){
    select.innerHTML=`<option value="">Nenhum produto ativo cadastrado</option>`;
    return;
  }

  select.innerHTML=`<option value="">Selecione um produto</option>`+
    data.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}${p.category?" • "+escapeHtml(p.category):""}</option>`).join("");
}

async function loadStockList(eventId){
  const list=document.getElementById("stockList");
  list.innerHTML=`<div class="muted">Carregando estoque...</div>`;

  const [{data:products,error:productsError},{data:stocks,error:stocksError}]=await Promise.all([
    supabaseClient.from("products").select("id,name,category,active").order("name",{ascending:true}),
    supabaseClient.from("event_stock").select("product_id,current_quantity").eq("event_id",eventId)
  ]);

  if(productsError || stocksError){
    list.innerHTML=`<div class="error">Não foi possível carregar o estoque: ${escapeHtml((productsError||stocksError).message)}</div>`;
    return;
  }

  const stockMap=new Map((stocks||[]).map(s=>[s.product_id,Number(s.current_quantity||0)]));
  const activeProducts=(products||[]).filter(p=>p.active);

  if(!activeProducts.length){
    list.innerHTML=`<div class="empty muted">Nenhum produto ativo cadastrado.</div>`;
    return;
  }

  list.innerHTML=activeProducts.map(p=>{
    const qty=stockMap.has(p.id)?stockMap.get(p.id):0;
    return `<article class="product-card card">
      <div>
        <div class="event-title">${escapeHtml(p.name)}</div>
        <div class="muted">${p.category?escapeHtml(p.category):"Produto"}</div>
      </div>
      <div class="product-right">
        <strong style="font-size:24px">${qty}</strong>
        <span class="muted">un.</span>
      </div>
    </article>`;
  }).join("");
}

async function loadStockHistory(eventId){
  const list=document.getElementById("stockHistory");
  list.innerHTML=`<div class="muted">Carregando histórico...</div>`;

  const {data,error}=await supabaseClient.from("stock_movements")
    .select("id,product_id,movement_type,quantity,reason,created_at,products(name)")
    .eq("event_id",eventId)
    .order("created_at",{ascending:false})
    .limit(50);

  if(error){
    list.innerHTML=`<div class="error">Não foi possível carregar o histórico: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if(!data?.length){
    list.innerHTML=`<div class="empty muted">Nenhuma movimentação registrada neste evento.</div>`;
    return;
  }

  list.innerHTML=data.map(m=>{
    const typeLabel={
      ENTRADA:"Entrada",PERDA:"Perda",QUEBRA:"Quebra",CONSUMO_INTERNO:"Consumo interno",AJUSTE:"Ajuste",VENDA:"Venda"
    }[m.movement_type] || m.movement_type;
    const sign=(m.movement_type==="ENTRADA" || m.movement_type==="AJUSTE")?"":"−";
    return `<article class="card">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div>
          <div class="event-title">${escapeHtml(m.products?.name || "Produto")}</div>
          <div class="muted">${escapeHtml(typeLabel)}${m.reason?" • "+escapeHtml(m.reason):""}</div>
        </div>
        <strong>${sign}${Math.abs(Number(m.quantity||0))}</strong>
      </div>
      <div class="muted" style="margin-top:8px">${new Date(m.created_at).toLocaleString("pt-BR")}</div>
    </article>`;
  }).join("");
}

async function registerStockMovement(e){
  e.preventDefault();
  const err=document.getElementById("stockFormError");
  err.textContent="";

  const eventId=document.getElementById("stockEventSelect").value;
  const productId=document.getElementById("stockProductSelect").value;
  const movementType=document.getElementById("stockMovementType").value;
  const quantity=Number(document.getElementById("stockQuantity").value);
  const reason=document.getElementById("stockReason").value.trim() || null;

  if(!eventId || !productId){err.textContent="Selecione evento e produto.";return;}
  if(!Number.isInteger(quantity) || quantity<1){err.textContent="Informe uma quantidade inteira maior que zero.";return;}

  let delta=quantity;
  if(["PERDA","QUEBRA","CONSUMO_INTERNO"].includes(movementType)) delta=-quantity;
  if(movementType==="AJUSTE") delta=quantity*Number(document.getElementById("stockAdjustmentDirection").value);

  const button=document.querySelector("#stockForm button[type=submit]");
  button.disabled=true;
  button.textContent="Registrando...";

  const {data,error}=await supabaseClient.rpc("adjust_event_stock",{
    p_event_id:eventId,
    p_product_id:productId,
    p_delta:delta,
    p_movement_type:movementType,
    p_reason:reason
  });

  button.disabled=false;
  button.textContent="Registrar movimentação";

  if(error){
    err.textContent=error.message || "Não foi possível registrar a movimentação.";
    return;
  }

  document.getElementById("stockForm").reset();
  document.getElementById("stockQuantity").value="1";
  document.getElementById("stockAdjustmentDirection").value="1";
  document.getElementById("stockAdjustmentDirectionWrap").classList.add("hidden");
  alert(`Movimentação registrada. Estoque atual: ${Number(data)} unidade(s).`);
  await Promise.all([loadStockList(eventId),loadStockHistory(eventId)]);
}

/* =========================================================
   MÓDULO DE VENDAS
   ========================================================= */

let saleState = {
  event: null,
  products: [],
  cart: []
};

async function getSellerEvent(){
  const { data: { user } } = await supabaseClient.auth.getUser();
  if(!user) return { error: { message: "Sessão expirada. Faça login novamente." } };

  const { data, error } = await supabaseClient
    .from("event_sellers")
    .select("event_id,active,events(id,name,event_date,status)")
    .eq("user_id", user.id)
    .eq("active", true);

  if(error) return { error };

  const activeLinks = (data || []).filter(x => x.events);
  if(!activeLinks.length){
    return { error: { message: "Você não está vinculado a nenhum evento ativo." } };
  }

  const openLinks = activeLinks.filter(x => x.events.status === "ABERTO");
  if(!openLinks.length){
    return { error: { message: "Seu evento não está aberto para vendas." } };
  }

  return { event: openLinks[0].events };
}

async function openNewSale(){
  const content = document.querySelector(".content");
  const oldHtml = content.innerHTML;

  content.innerHTML = `
    <div class="module-head">
      <div>
        <button id="backSale" class="ghost">← Voltar</button>
        <div class="eyebrow">VENDAS</div>
        <h1>Nova venda</h1>
        <p id="saleEventInfo" class="muted">Carregando evento...</p>
      </div>
    </div>

    <div class="card">
      <label>Produto
        <select id="saleProductSelect" class="select">
          <option value="">Carregando produtos...</option>
        </select>
      </label>

      <label>Quantidade
        <input id="saleQty" type="number" min="1" step="1" value="1" inputmode="numeric">
      </label>

      <button id="addSaleItem" class="primary compact" type="button">+ Adicionar ao pedido</button>
      <p id="saleFormError" class="error"></p>
    </div>

    <div class="card">
      <h2>Pedido</h2>
      <div id="saleCart" class="list"></div>

      <div style="display:flex;justify-content:space-between;gap:15px;align-items:center;margin-top:18px;padding-top:15px;border-top:1px solid var(--line)">
        <strong>Total</strong>
        <strong id="saleTotal" style="font-size:22px;color:var(--accent)">R$ 0,00</strong>
      </div>

      <label style="display:flex;gap:8px;align-items:center;margin-top:12px">
        <input id="splitPaymentToggle" type="checkbox">
        💳 Dividir pagamento entre vários clientes
      </label>

      <div id="singlePaymentArea">
        <label>Forma de pagamento
          <select id="salePayment" class="select">
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="DEBITO">Débito</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </label>
      </div>

      <div id="splitPaymentArea" class="hidden" style="margin-top:12px">
        <div id="splitPaymentsList"></div>
        <button id="addSplitPaymentBtn" class="ghost compact" type="button">+ Adicionar pagamento</button>
        <div id="splitPaymentSummary" class="card" style="margin-top:10px;padding:10px"></div>
      </div>

      <button id="confirmSale" class="primary" type="button">Confirmar venda</button>
      <p id="saleSubmitError" class="error"></p>
    </div>
  `;

  document.getElementById("backSale").onclick = () => {
    content.innerHTML = oldHtml;
    rebindDashboardButtons();
  };

  document.getElementById("addSaleItem").onclick = addItemToSale;
  document.getElementById("confirmSale").onclick = confirmSale;

  document.getElementById("splitPaymentToggle").addEventListener("change", toggleSplitPaymentUI);
  document.getElementById("addSplitPaymentBtn").addEventListener("click", addSplitPaymentRow);

  saleState = { event: null, products: [], cart: [], splitPayments: [] };
  renderSplitPayments();

  const eventResult = await getSellerEvent();
  if(eventResult.error){
    document.getElementById("saleEventInfo").textContent = eventResult.error.message;
    document.getElementById("saleFormError").textContent = eventResult.error.message;
    document.getElementById("addSaleItem").disabled = true;
    document.getElementById("confirmSale").disabled = true;
    return;
  }

  saleState.event = eventResult.event;
  document.getElementById("saleEventInfo").textContent =
    `${eventResult.event.name} • ${formatDate(eventResult.event.event_date)}`;

  await loadSaleProducts();
  renderSaleCart();
}

async function loadSaleProducts(){
  const select = document.getElementById("saleProductSelect");
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,category,price,active")
    .eq("active", true)
    .order("name", { ascending: true });

  if(error){
    select.innerHTML = `<option value="">Erro ao carregar produtos</option>`;
    document.getElementById("saleFormError").textContent =
      "Não foi possível carregar os produtos: " + error.message;
    return;
  }

  saleState.products = data || [];

  if(!saleState.products.length){
    select.innerHTML = `<option value="">Nenhum produto ativo cadastrado</option>`;
    return;
  }

  select.innerHTML =
    `<option value="">Selecione um produto</option>` +
    saleState.products.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)} • ${formatMoney(p.price)}</option>`
    ).join("");
}

function addItemToSale(){
  const error = document.getElementById("saleFormError");
  error.textContent = "";

  const productId = document.getElementById("saleProductSelect").value;
  const qty = Number(document.getElementById("saleQty").value);

  if(!productId){
    error.textContent = "Selecione um produto.";
    return;
  }

  if(!Number.isInteger(qty) || qty < 1){
    error.textContent = "Informe uma quantidade válida.";
    return;
  }

  const product = saleState.products.find(p => p.id === productId);
  if(!product){
    error.textContent = "Produto não encontrado.";
    return;
  }

  const existing = saleState.cart.find(i => i.product_id === productId);

  if(existing){
    existing.quantity += qty;
  } else {
    saleState.cart.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: qty
    });
  }

  document.getElementById("saleProductSelect").value = "";
  document.getElementById("saleQty").value = "1";
  renderSaleCart();
}

function removeSaleItem(productId){
  saleState.cart = saleState.cart.filter(i => i.product_id !== productId);
  renderSaleCart();
}

function changeSaleQty(productId, delta){
  const item = saleState.cart.find(i => i.product_id === productId);
  if(!item) return;

  item.quantity += delta;
  if(item.quantity <= 0){
    removeSaleItem(productId);
    return;
  }

  renderSaleCart();
}

function renderSaleCart(){
  const cart = document.getElementById("saleCart");
  const totalEl = document.getElementById("saleTotal");
  if(!cart || !totalEl) return;

  if(!saleState.cart.length){
    cart.innerHTML = `<div class="empty muted">Nenhum item adicionado ao pedido.</div>`;
    totalEl.textContent = formatMoney(0);
    return;
  }

  cart.innerHTML = saleState.cart.map(item => `
    <article class="product-card card">
      <div>
        <div class="event-title">${escapeHtml(item.name)}</div>
        <div class="muted">${item.quantity} × ${formatMoney(item.price)}</div>
        <div style="margin-top:5px;font-weight:800">${formatMoney(item.quantity * item.price)}</div>
      </div>
      <div class="product-right">
        <button class="ghost small-btn" type="button"
          data-minus-sale="${item.product_id}">−</button>
        <strong>${item.quantity}</strong>
        <button class="ghost small-btn" type="button"
          data-plus-sale="${item.product_id}">+</button>
        <button class="danger-btn small-btn" type="button"
          data-remove-sale="${item.product_id}">Remover</button>
      </div>
    </article>
  `).join("");

  const total = saleState.cart.reduce(
    (sum, item) => sum + (item.quantity * item.price), 0
  );

  totalEl.textContent = formatMoney(total);

  saleState.cart.forEach(item => {
    const minus = document.querySelector(`[data-minus-sale="${item.product_id}"]`);
    const plus = document.querySelector(`[data-plus-sale="${item.product_id}"]`);
    const remove = document.querySelector(`[data-remove-sale="${item.product_id}"]`);

    if(minus) minus.onclick = () => changeSaleQty(item.product_id, -1);
    if(plus) plus.onclick = () => changeSaleQty(item.product_id, 1);
    if(remove) remove.onclick = () => removeSaleItem(item.product_id);
  });
}

function getSaleTotal() {
  return saleState.cart.reduce((sum,item) => sum + (item.quantity * item.price), 0);
}

function toggleSplitPaymentUI() {
  const split=!!document.getElementById("splitPaymentToggle")?.checked;
  document.getElementById("singlePaymentArea")?.classList.toggle("hidden", split);
  document.getElementById("splitPaymentArea")?.classList.toggle("hidden", !split);
  if(split && !saleState.splitPayments.length) addSplitPaymentRow();
  renderSplitPayments();
}

function addSplitPaymentRow() {
  saleState.splitPayments.push({method:"PIX",amount:""});
  renderSplitPayments();
}

function removeSplitPaymentRow(index) {
  saleState.splitPayments.splice(index,1);
  renderSplitPayments();
}

function renderSplitPayments() {
  const list=document.getElementById("splitPaymentsList");
  const summary=document.getElementById("splitPaymentSummary");
  if(!list || !summary) return;

  list.innerHTML=saleState.splitPayments.map((p,i)=>`
    <div class="card" style="margin:8px 0;padding:10px">
      <div class="grid">
        <label>Forma
          <select data-split-method="${i}" class="select">
            <option value="PIX" ${p.method==="PIX"?"selected":""}>PIX</option>
            <option value="DINHEIRO" ${p.method==="DINHEIRO"?"selected":""}>Dinheiro</option>
            <option value="DEBITO" ${p.method==="DEBITO"?"selected":""}>Débito</option>
            <option value="CREDITO" ${p.method==="CREDITO"?"selected":""}>Crédito</option>
          </select>
        </label>
        <label>Valor
          <input data-split-amount="${i}" type="number" min="0" step="0.01" inputmode="decimal"
                 value="${escapeHtml(String(p.amount||""))}" placeholder="0,00">
        </label>
      </div>
      <button type="button" class="ghost small-btn" data-split-remove="${i}">Remover</button>
    </div>
  `).join("") || '<div class="muted">Adicione um pagamento.</div>';

  list.querySelectorAll("[data-split-method]").forEach(el=>{
    el.addEventListener("change",()=>{
      saleState.splitPayments[Number(el.dataset.splitMethod)].method=el.value;
      renderSplitPayments();
    });
  });
  list.querySelectorAll("[data-split-amount]").forEach(el=>{
    el.addEventListener("input",()=>{
      saleState.splitPayments[Number(el.dataset.splitAmount)].amount=el.value;
      renderSplitPaymentSummary();
    });
  });
  list.querySelectorAll("[data-split-remove]").forEach(el=>{
    el.addEventListener("click",()=>removeSplitPaymentRow(Number(el.dataset.splitRemove)));
  });
  renderSplitPaymentSummary();
}

function renderSplitPaymentSummary() {
  const summary=document.getElementById("splitPaymentSummary");
  if(!summary) return;
  const total=getSaleTotal();
  const received=saleState.splitPayments.reduce((a,p)=>a+Number(String(p.amount).replace(",",".")||0),0);
  const diff=Number((total-received).toFixed(2));
  let text;
  if(Math.abs(diff)<0.005) text=`<strong>Recebido: ${formatMoney(received)}</strong><br>✅ Pagamento completo`;
  else if(diff>0) text=`<strong>Recebido: ${formatMoney(received)}</strong><br>⚠️ Falta ${formatMoney(diff)}`;
  else text=`<strong>Recebido: ${formatMoney(received)}</strong><br>⚠️ Excedente de ${formatMoney(Math.abs(diff))}`;
  summary.innerHTML=`<div>Venda: <strong>${formatMoney(total)}</strong></div>${text}`;
}

async function confirmSale(){
  const error = document.getElementById("saleSubmitError");
  error.textContent = "";

  if(!saleState.event){
    error.textContent = "Evento não encontrado.";
    return;
  }

  if(!saleState.cart.length){
    error.textContent = "Adicione pelo menos um produto ao pedido.";
    return;
  }

  const split=!!document.getElementById("splitPaymentToggle")?.checked;
  const total=getSaleTotal();
  let payments;

  if(split){
    payments=saleState.splitPayments
      .map(p=>({method:p.method,amount:Number(String(p.amount).replace(",","."))||0}))
      .filter(p=>p.amount>0);

    const paid=payments.reduce((a,p)=>a+p.amount,0);
    if(!payments.length){
      error.textContent="Adicione pelo menos um pagamento.";
      return;
    }
    if(Math.abs(Number((paid-total).toFixed(2)))>0.005){
      error.textContent=`A soma dos pagamentos (${formatMoney(paid)}) deve ser igual ao total da venda (${formatMoney(total)}).`;
      return;
    }
  } else {
    payments=[{method:document.getElementById("salePayment").value,amount:Number(total.toFixed(2))}];
  }

  const button = document.getElementById("confirmSale");

  button.disabled = true;
  button.textContent = "Registrando venda...";

  try{
    const items = saleState.cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }));

    /*
     * A função create_sale é a camada segura do banco:
     * valida estoque, baixa estoque, grava venda, itens,
     * pagamento, movimento e auditoria em uma única operação.
     */
    const { data, error: rpcError } = await supabaseClient.rpc(
      "create_sale_split",
      {
        p_event_id: saleState.event.id,
        p_items: items,
        p_payments: payments
      }
    );

    if(rpcError){
      console.error("create_sale:", rpcError);
      error.textContent = rpcError.message || "Não foi possível registrar a venda.";
      return;
    }

    const saleId = typeof data === "string" ? data : data?.id;

    alert(
      `Venda registrada com sucesso!${saleId ? `\nVenda: ${saleId}` : ""}`
    );

    saleState.cart = [];
    saleState.splitPayments = [];
    renderSaleCart();
    renderSplitPayments();

  } finally {
    button.disabled = false;
    button.textContent = "Confirmar venda";
  }
}

async function openMySales(){
  const content = document.querySelector(".content");
  const oldHtml = content.innerHTML;

  content.innerHTML = `
    <div class="module-head">
      <div>
        <button id="backMySales" class="ghost">← Voltar</button>
        <div class="eyebrow">VENDAS</div>
        <h1>Minhas vendas</h1>
        <p class="muted">Consulta somente leitura das vendas registradas pelo seu usuário. Nenhuma alteração ou cancelamento é permitido.</p>
      </div>
    </div>
    <div id="mySalesDailyControls"></div>
    <div id="mySalesDailyArea"></div>
    <div id="mySalesList" class="list">
      <div class="card muted">Carregando vendas...</div>
    </div>
  `;

  document.getElementById("backMySales").onclick = () => {
    content.innerHTML = oldHtml;
    rebindDashboardButtons();
  };

  await loadMySales();
}

async function loadMySales(){
  const list = document.getElementById("mySalesList");

  const { data: { user } } = await supabaseClient.auth.getUser();
  if(!user){
    list.innerHTML = `<div class="card error">Sessão expirada.</div>`;
    return;
  }

  // Consulta diária separada, sem somar dias diferentes.
  const {data: sellerEvents} = await supabaseClient
    .from("event_sellers")
    .select("event_id,events(id,name,status)")
    .eq("user_id", user.id)
    .eq("active", true);

  if(sellerEvents?.length) {
    const eventId = sellerEvents[0].event_id;
    setupDailyReport(eventId,"mySalesDailyControls",user.id,true);
  }

  const { data, error } = await supabaseClient
    .from("sales")
    .select(`
      id,event_id,total,status,created_at,cancelled_at,
      events(name),
      sale_items(
        quantity,
        unit_price,
        products(name)
      ),
      payments(method,amount)
    `)
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if(error){
    list.innerHTML =
      `<div class="card error">Não foi possível carregar suas vendas: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if(!data?.length){
    list.innerHTML = `<div class="card empty">Nenhuma venda registrada ainda.</div>`;
    return;
  }

  list.innerHTML = data.map(sale => {
    const items = (sale.sale_items || [])
      .map(i => `${i.quantity}× ${escapeHtml(i.products?.name || "Produto")}`)
      .join(" • ");

    const payment = sale.payments?.[0]?.method || "Pagamento";
    const status = sale.status || "CONFIRMADA";

    return `
      <article class="card">
        <div style="display:flex;justify-content:space-between;gap:12px">
          <div>
            <div class="event-title">${escapeHtml(sale.events?.name || "Evento")}</div>
            <div class="muted">${new Date(sale.created_at).toLocaleString("pt-BR")}</div>
          </div>
          <span class="status ${status === "CONFIRMADA" ? "aberto" : "cancelado"}">
            ${escapeHtml(status)}
          </span>
        </div>
        <div class="muted" style="margin-top:10px">${items || "Sem itens"}</div>
        <div style="display:flex;justify-content:space-between;margin-top:12px">
          <span>${escapeHtml(payment)}</span>
          <strong>${formatMoney(sale.total)}</strong>
        </div>
      </article>
    `;
  }).join("");
}




/* =========================================================
   RELATÓRIO FINAL DO EVENTO | ADM
   ========================================================= */

function reportPaymentLabel(method){
  return ({PIX:"PIX",DINHEIRO:"Dinheiro",DEBITO:"Débito",CREDITO:"Crédito"})[method] || method || "Outro";
}

function reportMovementLabel(type){
  return ({
    ENTRADA:"Entrada",
    VENDA:"Venda",
    PERDA:"Perda",
    QUEBRA:"Quebra",
    CONSUMO_INTERNO:"Consumo interno",
    AJUSTE:"Ajuste"
  })[type] || type || "Movimentação";
}

async function openReports(){
  const content=document.querySelector(".content");
  const oldHtml=content.innerHTML;

  content.innerHTML=`
    <div class="module-head">
      <div>
        <button id="backReports" class="ghost">← Voltar</button>
        <div class="eyebrow">ADMINISTRAÇÃO</div>
        <h1>Relatório do evento</h1>
        <p class="muted">Fechamento, vendas, pagamentos e conferência do estoque.</p>
      </div>
      <button id="printReportBtn" class="primary compact" disabled>🖨️ Imprimir</button>
    </div>

    <div class="card">
      <label>Selecionar evento
        <select id="reportEventSelect" class="select">
          <option value="">Carregando eventos...</option>
        </select>
      </label>
      <p id="reportStatus" class="muted" style="margin-bottom:0"></p>
    </div>

    <div id="reportDailyControls"></div>
    <div id="reportDailyArea"></div>
    <div id="eventOperationsControls"></div>
    <div id="reportArea">
      <div class="card muted">Selecione um evento para gerar o relatório.</div>
    </div>
  `;

  document.getElementById("backReports").onclick=()=>{
    content.innerHTML=oldHtml;
    rebindDashboardButtons();
  };
  document.getElementById("reportEventSelect").onchange=loadEventReport;
  document.getElementById("printReportBtn").onclick=()=>window.print();

  await loadReportEvents();
}

async function loadReportEvents(){
  const select=document.getElementById("reportEventSelect");
  const {data,error}=await supabaseClient
    .from("events")
    .select("id,name,event_date,status")
    .order("event_date",{ascending:false})
    .order("created_at",{ascending:false});

  if(error){
    select.innerHTML=`<option value="">Erro ao carregar eventos</option>`;
    document.getElementById("reportArea").innerHTML=`<div class="card error">Não foi possível carregar os eventos: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if(!data?.length){
    select.innerHTML=`<option value="">Nenhum evento cadastrado</option>`;
    return;
  }

  select.innerHTML=`<option value="">Selecione um evento</option>`+
    data.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} • ${formatDate(e.event_date)} • ${escapeHtml(e.status)}</option>`).join("");
}

async function loadEventReport(){
  const eventId=document.getElementById("reportEventSelect")?.value;
  const area=document.getElementById("reportArea");
  const printBtn=document.getElementById("printReportBtn");
  const statusEl=document.getElementById("reportStatus");
  printBtn.disabled=true;
  if(!eventId){
    area.innerHTML=`<div class="card muted">Selecione um evento para gerar o relatório.</div>`;
    statusEl.textContent="";
    return;
  }

  area.innerHTML=`<div class="card muted">Gerando relatório...</div>`;

  const eventPromise=supabaseClient.from("events")
    .select("id,name,event_date,location,status,created_at,closed_at")
    .eq("id",eventId).single();
  const salesPromise=supabaseClient.from("sales")
    .select("id,seller_id,total,status,created_at,cancelled_at,sale_items(quantity,unit_price,products(name)),payments(method,amount)")
    .eq("event_id",eventId)
    .order("created_at",{ascending:false})
    .limit(5000);
  const stockPromise=supabaseClient.from("event_stock")
    .select("product_id,initial_quantity,current_quantity,minimum_quantity,products(name,active)")
    .eq("event_id",eventId);
  const movementsPromise=supabaseClient.from("stock_movements")
    .select("product_id,user_id,movement_type,quantity,reason,created_at,products(name)")
    .eq("event_id",eventId)
    .order("created_at",{ascending:true})
    .limit(5000);
  const sellerNamesPromise=supabaseClient.rpc("get_event_seller_names",{p_event_id:eventId});

  const [eventR,salesR,stockR,movementsR,sellerNamesR]=await Promise.all([
    eventPromise,salesPromise,stockPromise,movementsPromise,sellerNamesPromise
  ]);
  const firstError=[eventR,salesR,stockR,movementsR,sellerNamesR].find(r=>r.error);
  if(firstError){
    area.innerHTML=`<div class="card error">Não foi possível gerar o relatório: ${escapeHtml(firstError.error.message)}</div>`;
    statusEl.textContent="";
    return;
  }

  const event=eventR.data;
  window.currentAdminEventId=eventId;
  loadEventOperationsControls(eventId,"eventOperationsControls");
  setupDailyReport(eventId,"reportDailyControls",null,false);
  const sales=salesR.data||[];
  const stock=stockR.data||[];
  const movements=movementsR.data||[];
  const sellerNames={};
  (sellerNamesR.data||[]).forEach(p=>sellerNames[p.user_id]=p.full_name||"Garçom");

  const confirmed=sales.filter(s=>s.status==="CONFIRMADA");
  const cancelled=sales.filter(s=>s.status==="CANCELADA");
  const revenue=confirmed.reduce((sum,s)=>sum+Number(s.total||0),0);
  const averageTicket=confirmed.length ? revenue/confirmed.length : 0;

  const sellerTotals={};
  const paymentTotals={};
  const productTotals={};
  confirmed.forEach(s=>{
    const seller=s.seller_id||"sem-vendedor";
    if(!sellerTotals[seller]) sellerTotals[seller]={sales:0,total:0};
    sellerTotals[seller].sales++;
    sellerTotals[seller].total+=Number(s.total||0);

    (s.payments||[]).forEach(p=>{
      const method=p.method||"OUTRO";
      paymentTotals[method]=(paymentTotals[method]||0)+Number(p.amount||0);
    });
    (s.sale_items||[]).forEach(item=>{
      const name=item.products?.name||"Produto";
      const qty=Number(item.quantity||0);
      const total=qty*Number(item.unit_price||0);
      if(!productTotals[name]) productTotals[name]={qty:0,total:0};
      productTotals[name].qty+=qty;
      productTotals[name].total+=total;
    });
  });

  const movementTotals={ENTRADA:0,VENDA:0,PERDA:0,QUEBRA:0,CONSUMO_INTERNO:0,AJUSTE:0};
  movements.forEach(m=>movementTotals[m.movement_type]=(movementTotals[m.movement_type]||0)+Number(m.quantity||0));

  const moneyRows=(obj, labelFn)=>{
    const rows=Object.entries(obj).sort((a,b)=>{
      const av=typeof a[1]==="object"?a[1].total:a[1];
      const bv=typeof b[1]==="object"?b[1].total:b[1];
      return bv-av;
    });
    return rows.length ? rows.map(([key,value])=>{
      const total=typeof value==="object"?value.total:value;
      const extra=typeof value==="object"?`<small class="muted">${value.sales} venda(s)</small>`:"";
      return `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><span>${escapeHtml(labelFn(key))}<br>${extra}</span><strong>${formatMoney(total)}</strong></div>`;
    }).join("") : `<div class="muted">Nenhum dado disponível.</div>`;
  };

  const productRows=Object.entries(productTotals).sort((a,b)=>b[1].qty-a[1].qty).map(([name,v])=>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><span>${escapeHtml(name)}<br><small class="muted">${v.qty} unidade(s)</small></span><strong>${formatMoney(v.total)}</strong></div>`
  ).join("");

  const stockRows=stock.map(s=>{
    const initial=Number(s.initial_quantity||0);
    const current=Number(s.current_quantity||0);
    const minimum=Number(s.minimum_quantity||0);
    const productName=s.products?.name||"Produto";
    const productMovements=movements.filter(m=>m.product_id===s.product_id);
    const sold=productMovements.filter(m=>m.movement_type==="VENDA").reduce((a,m)=>a+Number(m.quantity||0),0);
    const loss=productMovements.filter(m=>["PERDA","QUEBRA","CONSUMO_INTERNO"].includes(m.movement_type)).reduce((a,m)=>a+Number(m.quantity||0),0);
    const entryMovements=productMovements.filter(m=>m.movement_type==="ENTRADA").slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    // O primeiro ENTRADA normalmente é o carregamento inicial que já está
    // contabilizado em event_stock.initial_quantity. Não podemos somá-lo duas vezes.
    let initializationEntryIndex=-1;
    if(initial>0 && entryMovements.length && Number(entryMovements[0].quantity||0)===initial){
      initializationEntryIndex=0;
    }
    const additionalEntries=entryMovements.reduce((a,m,i)=>a+(i===initializationEntryIndex?0:Number(m.quantity||0)),0);
    const expected=initial+additionalEntries-sold-loss;
    const adjustment=current-expected;
    return `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;gap:12px"><strong>${escapeHtml(productName)}${current<=minimum?" ⚠️":""}</strong><strong>${current} un.</strong></div>
      <div class="muted">Inicial: ${initial} • Entradas adicionais: +${additionalEntries} • Vendidas: -${sold} • Perdas/quebras/consumo: -${loss}</div>
      <div class="muted">Saldo calculado: ${expected} • Diferença para o estoque atual: ${adjustment>=0?"+":""}${adjustment}</div>
    </div>`;
  }).join("");

  const movementRows=movements.slice().reverse().slice(0,120).map(m=>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)"><span><strong>${escapeHtml(reportMovementLabel(m.movement_type))}</strong><br><small class="muted">${escapeHtml(m.products?.name||"Produto")} • ${new Date(m.created_at).toLocaleString("pt-BR")}${m.reason?" • "+escapeHtml(m.reason):""}</small></span><strong>${Number(m.quantity||0)}</strong></div>`
  ).join("");

  const sellerRows=Object.entries(sellerTotals).sort((a,b)=>b[1].total-a[1].total).map(([id,v])=>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><span>${escapeHtml(sellerNames[id]||"Garçom") }<br><small class="muted">${v.sales} venda(s)</small></span><strong>${formatMoney(v.total)}</strong></div>`
  ).join("");

  const closedText=event.status==="FECHADO" && event.closed_at
    ? `Fechado em ${new Date(event.closed_at).toLocaleString("pt-BR")}`
    : event.status==="ABERTO" ? "Evento ainda aberto" : `Status: ${event.status}`;

  statusEl.textContent=closedText;
  area.innerHTML=`
    <div class="card" id="printableReport">
      <div class="eyebrow">RELATÓRIO DO EVENTO</div>
      <h2>${escapeHtml(event.name)}</h2>
      <div class="muted">${formatDate(event.event_date)}${event.location?" • "+escapeHtml(event.location):""} • ${escapeHtml(event.status)}</div>
      <p class="muted">${escapeHtml(closedText)}</p>

      <div class="grid">
        <div class="card"><div class="eyebrow">FATURAMENTO</div><h2>${formatMoney(revenue)}</h2><div class="muted">vendas confirmadas</div></div>
        <div class="card"><div class="eyebrow">VENDAS</div><h2>${confirmed.length}</h2><div class="muted">confirmadas</div></div>
        <div class="card"><div class="eyebrow">TICKET MÉDIO</div><h2>${formatMoney(averageTicket)}</h2><div class="muted">por venda</div></div>
        <div class="card"><div class="eyebrow">CANCELADAS</div><h2>${cancelled.length}</h2><div class="muted">vendas</div></div>
      </div>

      <div class="card"><div class="eyebrow">VENDAS POR GARÇOM</div>${sellerRows||`<div class="muted">Nenhuma venda confirmada.</div>`}</div>
      <div class="card"><div class="eyebrow">FORMAS DE PAGAMENTO</div>${moneyRows(paymentTotals,reportPaymentLabel)}</div>
      <div class="card"><div class="eyebrow">PRODUTOS VENDIDOS</div>${productRows||`<div class="muted">Nenhum produto vendido.</div>`}</div>

      <div class="card">
        <div class="eyebrow">MOVIMENTAÇÃO DE ESTOQUE</div>
        <div class="grid">
          <div><strong>Entradas</strong><br>${movementTotals.ENTRADA}</div>
          <div><strong>Vendas</strong><br>${movementTotals.VENDA}</div>
          <div><strong>Perdas</strong><br>${movementTotals.PERDA}</div>
          <div><strong>Quebras</strong><br>${movementTotals.QUEBRA}</div>
          <div><strong>Consumo interno</strong><br>${movementTotals.CONSUMO_INTERNO}</div>
          <div><strong>Ajustes</strong><br>${movementTotals.AJUSTE}</div>
        </div>
      </div>

      <div class="card"><div class="eyebrow">CONFERÊNCIA DO ESTOQUE</div>${stockRows||`<div class="muted">Nenhum estoque registrado.</div>`}</div>
      <div class="card"><div class="eyebrow">MOVIMENTAÇÕES RECENTES</div>${movementRows||`<div class="muted">Nenhuma movimentação.</div>`}</div>
    </div>
  `;
  printBtn.disabled=false;
}

/* =========================================================
   PAINEL DA ORGANIZAÇÃO | SOMENTE LEITURA
   ========================================================= */

let organizationState = {
  events: [],
  eventId: null
};

function orgPaymentLabel(method){
  return ({
    PIX: "PIX",
    DINHEIRO: "Dinheiro",
    DEBITO: "Débito",
    CREDITO: "Crédito"
  })[method] || method || "Outro";
}

function orgMovementSign(type){
  return type === "ENTRADA" ? "+" : "-";
}

async function openOrganizationDashboard(){
  const content = document.querySelector(".content");
  const oldHtml = content.innerHTML;

  content.innerHTML = `
    <div class="module-head">
      <div>
        <button id="backOrganization" class="ghost">← Voltar</button>
        <div class="eyebrow">ORGANIZAÇÃO</div>
        <h1>Painel do evento</h1>
        <p class="muted">Acompanhamento completo em modo somente leitura.</p>
      </div>
    </div>

    <div class="card">
      <label>Evento autorizado
        <select id="organizationEventSelect" class="select">
          <option value="">Carregando...</option>
        </select>
      </label>
      <button id="organizationRefresh" class="ghost" type="button">↻ Atualizar dados</button>
    </div>

    <div id="organizationDashboardList" class="list">
      <div class="card muted">Carregando...</div>
    </div>
  `;

  document.getElementById("backOrganization").onclick = () => {
    content.innerHTML = oldHtml;
    rebindDashboardButtons();
  };
  document.getElementById("organizationEventSelect").onchange = async (e) => {
    organizationState.eventId = e.target.value;
    await loadOrganizationEventData();
  };
  document.getElementById("organizationRefresh").onclick = loadOrganizationEventData;

  await loadOrganizationEvents();
}

async function loadOrganizationEvents(){
  const select = document.getElementById("organizationEventSelect");
  const list = document.getElementById("organizationDashboardList");

  const {data, error} = await supabaseClient
    .from("event_access")
    .select("event_id,active,events(id,name,event_date,location,status)")
    .eq("user_id", (await supabaseClient.auth.getUser()).data.user?.id)
    .eq("active", true);

  if(error){
    select.innerHTML = `<option value="">Erro</option>`;
    list.innerHTML = `<div class="card error">Não foi possível carregar os eventos: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const rows = (data || []).filter(row => row.events);
  organizationState.events = rows.map(row => row.events);

  if(!rows.length){
    select.innerHTML = `<option value="">Nenhum evento autorizado</option>`;
    list.innerHTML = `<div class="card empty">Nenhum evento está vinculado a este acesso.</div>`;
    return;
  }

  select.innerHTML = rows.map(row => {
    const e = row.events;
    return `<option value="${e.id}">${escapeHtml(e.name)} • ${formatDate(e.event_date)}</option>`;
  }).join("");

  organizationState.eventId = rows[0].events.id;
  select.value = organizationState.eventId;
  await loadOrganizationEventData();
}

async function loadOrganizationEventData(){
  const eventId = organizationState.eventId || document.getElementById("organizationEventSelect")?.value;
  const list = document.getElementById("organizationDashboardList");
  if(!list || !eventId) return;

  list.innerHTML = `<div class="card muted">Atualizando dados do evento...</div>`;

  const eventPromise = supabaseClient
    .from("events")
    .select("id,name,event_date,location,status")
    .eq("id", eventId)
    .single();

  const salesPromise = supabaseClient
    .from("sales")
    .select(`
      id,seller_id,total,status,created_at,cancelled_at,
      sale_items(quantity,unit_price,products(name)),
      payments(method,amount)
    `)
    .eq("event_id", eventId)
    .order("created_at", {ascending:false})
    .limit(1000);

  const stockPromise = supabaseClient
    .from("event_stock")
    .select("product_id,initial_quantity,current_quantity,minimum_quantity,products(name,active)")
    .eq("event_id", eventId);

  const movementsPromise = supabaseClient
    .from("stock_movements")
    .select("product_id,user_id,movement_type,quantity,reason,created_at,products(name)")
    .eq("event_id", eventId)
    .order("created_at", {ascending:false})
    .limit(300);

  const sellersPromise = supabaseClient
    .from("event_sellers")
    .select("user_id,active")
    .eq("event_id", eventId);

  const sellerNamesPromise = supabaseClient.rpc("get_event_seller_names", {
    p_event_id: eventId
  });

  const [eventR, salesR, stockR, movementsR, sellersR, sellerNamesR] =
    await Promise.all([eventPromise,salesPromise,stockPromise,movementsPromise,sellersPromise,sellerNamesPromise]);

  const firstError = [eventR,salesR,stockR,movementsR,sellersR,sellerNamesR].find(r => r.error);
  if(firstError){
    list.innerHTML =
      `<div class="card error">Não foi possível carregar o painel: ${escapeHtml(firstError.error.message)}</div>`;
    return;
  }

  const event = eventR.data;
  const sales = salesR.data || [];
  const stock = stockR.data || [];
  const movements = movementsR.data || [];
  const sellers = sellersR.data || [];
  const sellerProfiles = sellerNamesR.data || [];

  const sellerNames = {};
  sellerProfiles.forEach(p => {
    sellerNames[p.user_id] = p.full_name || `Garçom ${String(p.user_id || "").slice(0,8)}`;
  });
  sellers.forEach(s => {
    if (!sellerNames[s.user_id]) {
      sellerNames[s.user_id] = `Garçom ${String(s.user_id || "").slice(0,8)}`;
    }
  });

  const confirmed = sales.filter(s => s.status !== "CANCELADA");
  const cancelled = sales.filter(s => s.status === "CANCELADA");
  const revenue = confirmed.reduce((sum,s) => sum + Number(s.total || 0), 0);

  const sellerTotals = {};
  const paymentTotals = {};
  const productTotals = {};

  confirmed.forEach(s => {
    const seller = s.seller_id || "sem-vendedor";
    sellerTotals[seller] = (sellerTotals[seller] || 0) + Number(s.total || 0);

    (s.payments || []).forEach(p => {
      const method = p.method || "OUTRO";
      paymentTotals[method] = (paymentTotals[method] || 0) + Number(p.amount || 0);
    });

    (s.sale_items || []).forEach(item => {
      const productName = item.products?.name || "Produto";
      const qty = Number(item.quantity || 0);
      const total = qty * Number(item.unit_price || 0);
      if(!productTotals[productName]) productTotals[productName] = {qty:0,total:0};
      productTotals[productName].qty += qty;
      productTotals[productName].total += total;
    });
  });

  const lowStock = stock.filter(s =>
    Number(s.current_quantity || 0) <= Number(s.minimum_quantity || 0)
  );

  const rankRows = (obj, labelFn) => {
    const entries = Object.entries(obj).sort((a,b) => b[1] - a[1]);
    if(!entries.length) return `<div class="muted">Nenhum dado disponível.</div>`;
    return entries.map(([key,value]) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
        <span>${escapeHtml(labelFn(key))}</span>
        <strong>${formatMoney(value)}</strong>
      </div>
    `).join("");
  };

  const productRows = Object.entries(productTotals)
    .sort((a,b) => b[1].qty - a[1].qty)
    .map(([name,value]) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
        <span>${escapeHtml(name)}<br><small class="muted">${value.qty} unidade(s)</small></span>
        <strong>${formatMoney(value.total)}</strong>
      </div>
    `).join("");

  const stockRows = stock.map(s => {
    const current = Number(s.current_quantity || 0);
    const minimum = Number(s.minimum_quantity || 0);
    return `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
        <span>${escapeHtml(s.products?.name || "Produto")}${current <= minimum ? " ⚠️" : ""}
          <br><small class="muted">Inicial: ${Number(s.initial_quantity || 0)} • Mínimo: ${minimum}</small>
        </span>
        <strong>${current}</strong>
      </div>
    `;
  }).join("");

  const movementRows = movements.slice(0,80).map(m => `
    <div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${escapeHtml(m.movement_type || "")}</strong>
        <strong>${orgMovementSign(m.movement_type)}${Number(m.quantity || 0)}</strong>
      </div>
      <div class="muted">${escapeHtml(m.products?.name || "Produto")} • ${new Date(m.created_at).toLocaleString("pt-BR")}${m.reason ? " • " + escapeHtml(m.reason) : ""}</div>
    </div>
  `).join("");

  list.innerHTML = `
    <div class="card">
      <div class="eyebrow">EVENTO</div>
      <h2>${escapeHtml(event?.name || "Evento")}</h2>
      <div class="muted">${formatDate(event?.event_date)}${event?.location ? " • " + escapeHtml(event.location) : ""} • ${escapeHtml(event?.status || "")}</div>
    </div>

    <div class="grid">
      <div class="card"><div class="eyebrow">VENDAS</div><h2>${confirmed.length}</h2><div class="muted">confirmadas</div></div>
      <div class="card"><div class="eyebrow">FATURAMENTO</div><h2>${formatMoney(revenue)}</h2><div class="muted">vendas confirmadas</div></div>
      <div class="card"><div class="eyebrow">ESTOQUE</div><h2>${stock.length}</h2><div class="muted">produtos no evento</div></div>
      <div class="card"><div class="eyebrow">CANCELADAS</div><h2>${cancelled.length}</h2><div class="muted">vendas</div></div>
    </div>

    <div class="card">
      <div class="eyebrow">VENDAS POR GARÇOM</div>
      ${rankRows(sellerTotals, id => sellerNames[id] || `Garçom ${String(id).slice(0,8)}`)}
    </div>

    <div class="card">
      <div class="eyebrow">FORMAS DE PAGAMENTO</div>
      ${rankRows(paymentTotals, id => orgPaymentLabel(id))}
    </div>

    <div class="card">
      <div class="eyebrow">PRODUTOS VENDIDOS</div>
      ${productRows || `<div class="muted">Nenhum produto vendido.</div>`}
    </div>

    <div class="card">
      <div class="eyebrow">ESTOQUE ATUAL</div>
      ${stockRows || `<div class="muted">Nenhum estoque cadastrado.</div>`}
      ${lowStock.length ? `<p class="error" style="margin-bottom:0">⚠️ ${lowStock.length} produto(s) estão no mínimo ou abaixo.</p>` : ""}
    </div>

    <div class="card">
      <div class="eyebrow">MOVIMENTAÇÕES RECENTES</div>
      ${movementRows || `<div class="muted">Nenhuma movimentação registrada.</div>`}
    </div>

    <div class="card status-box">
      <span class="dot" style="background:#55d98a"></span>
      <span>Acesso de Organização: somente leitura. Este painel não possui ações de alteração, exclusão ou criação.</span>
    </div>
  `;
}


// ===== RELATÓRIO DIÁRIO INTEGRADO =====
function dailyDateKeyFromLocalDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
}
function dailyBRDate(key) {
  const [y,m,d] = String(key||"").split("-");
  return y && m && d ? `${d}/${m}/${y}` : key || "";
}
function dailyLocalRange(key) {
  const [y,m,d] = key.split("-").map(Number);
  return {
    start: new Date(y,m-1,d,0,0,0,0).toISOString(),
    end: new Date(y,m-1,d+1,0,0,0,0).toISOString()
  };
}
function dailyMethodLabel(v) {
  return ({PIX:"PIX",DINHEIRO:"Dinheiro",DEBITO:"Débito",CREDITO:"Crédito"})[v] || v || "Outro";
}
async function dailyLoad(eventId, dayKey, sellerId=null) {
  const r = dailyLocalRange(dayKey);
  let q = supabaseClient.from("sales")
    .select("id,seller_id,total,status,created_at,sale_items(quantity,unit_price,products(name)),payments(method,amount)")
    .eq("event_id",eventId).gte("created_at",r.start).lt("created_at",r.end)
    .order("created_at",{ascending:false}).limit(5000);
  if(sellerId) q=q.eq("seller_id",sellerId);
  const [salesR,movR] = await Promise.all([
    q,
    supabaseClient.from("stock_movements")
      .select("movement_type,quantity,created_at,products(name)")
      .eq("event_id",eventId).gte("created_at",r.start).lt("created_at",r.end)
      .order("created_at",{ascending:false}).limit(5000)
  ]);
  if(salesR.error) throw salesR.error;
  if(movR.error) throw movR.error;
  return {sales:salesR.data||[], movements:movR.data||[]};
}
function dailyRender(data, names, sellerMode) {
  const sales=data.sales, movements=data.movements;
  const confirmed=sales.filter(s=>s.status==="CONFIRMADA");
  const cancelled=sales.filter(s=>s.status==="CANCELADA");
  const revenue=confirmed.reduce((a,s)=>a+Number(s.total||0),0);
  const payments={}, products={}, sellers={};
  confirmed.forEach(s=>{
    const name=names[s.seller_id]||"Garçom";
    sellers[name]=(sellers[name]||0)+Number(s.total||0);
    (s.payments||[]).forEach(p=>payments[p.method]=(payments[p.method]||0)+Number(p.amount||0));
    (s.sale_items||[]).forEach(i=>{
      const n=i.products?.name||"Produto";
      products[n]=(products[n]||0)+Number(i.quantity||0);
    });
  });
  const movTotals={};
  movements.forEach(m=>movTotals[m.movement_type]=(movTotals[m.movement_type]||0)+Number(m.quantity||0));
  const esc = s => escapeHtml(String(s));
  const list = sales.length ? sales.map(s=>`
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <strong>${esc(new Date(s.created_at).toLocaleString("pt-BR"))}</strong>
        <strong>${formatMoney(Number(s.total)||0)}</strong>
      </div>
      <div class="muted">${esc(names[s.seller_id]||"Garçom")} • ${esc(s.status||"CONFIRMADA")}</div>
    </div>`).join("") : '<div class="muted">Nenhuma venda neste dia.</div>';

  const rows=(obj, money=false)=>Object.entries(obj).map(([k,v])=>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">
      <span>${esc(k)}</span><strong>${money?formatMoney(v):v}</strong>
    </div>`).join("") || '<div class="muted">Nenhum dado.</div>';

  return `
    <div class="card">
      <div class="eyebrow">FECHAMENTO DIÁRIO</div>
      <h2>${formatMoney(revenue)}</h2>
      <div class="muted">Faturamento do dia</div>
      <div class="grid" style="margin-top:12px">
        <div><strong>${confirmed.length}</strong><br><small>Confirmadas</small></div>
        <div><strong>${cancelled.length}</strong><br><small>Canceladas</small></div>
        <div><strong>${confirmed.length?formatMoney(revenue/confirmed.length):formatMoney(0)}</strong><br><small>Ticket médio</small></div>
      </div>
    </div>
    ${sellerMode ? "" : `<div class="card"><div class="eyebrow">VENDAS POR GARÇOM</div>${rows(sellers,true)}</div>
    <div class="card"><div class="eyebrow">PAGAMENTOS DO DIA</div>${rows(Object.fromEntries(Object.entries(payments).map(([k,v])=>[dailyMethodLabel(k),v])),true)}</div>
    <div class="card"><div class="eyebrow">PRODUTOS DO DIA</div>${rows(products,false)}</div>
    <div class="card"><div class="eyebrow">MOVIMENTAÇÕES DO DIA</div>${rows(Object.fromEntries(Object.entries(movTotals).map(([k,v])=>[reportMovementLabel(k),v])),false)}</div>`}
    <div class="card"><div class="eyebrow">VENDAS DO DIA • DATA E HORA</div>${list}</div>`;
}
async function dailyAvailableDays(eventId, sellerId=null) {
  let q=supabaseClient.from("sales").select("created_at").eq("event_id",eventId).order("created_at",{ascending:true}).limit(5000);
  if(sellerId) q=q.eq("seller_id",sellerId);
  const {data,error}=await q;
  if(error) throw error;
  return [...new Set((data||[]).map(x=>dailyDateKeyFromLocalDate(x.created_at)))].sort();
}
async function setupDailyReport(eventId, targetId, sellerId=null, sellerMode=false) {
  const target=document.getElementById(targetId);
  if(!target) return;
  try {
    const days=await dailyAvailableDays(eventId,sellerId);
    const today=dailyDateKeyFromLocalDate(new Date());
    if(!days.includes(today)) days.push(today);
    days.sort();
    target.innerHTML=`
      <div class="card">
        <div class="eyebrow">CONSULTA POR DIA</div>
        <label>Data
          <select id="${targetId}Date" class="select">
            ${days.map(d=>`<option value="${d}" ${d===today?"selected":""}>${dailyBRDate(d)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div id="${targetId}Content"></div>`;
    const sel=document.getElementById(targetId+"Date");
    const render=async()=>{
      const out=document.getElementById(targetId+"Content");
      out.innerHTML='<div class="card muted">Carregando dia...</div>';
      try{
        const [data,nr]=await Promise.all([
          dailyLoad(eventId,sel.value,sellerId),
          sellerMode ? Promise.resolve({data:[]}) : supabaseClient.rpc("get_event_seller_names",{p_event_id:eventId})
        ]);
        const names={};
        (nr.data||[]).forEach(x=>names[x.user_id]=x.full_name||"Garçom");
        if(sellerMode && sellerId) names[sellerId]="Minhas vendas";
        out.innerHTML=dailyRender(data,names,sellerMode);
      }catch(err){out.innerHTML=`<div class="card error">${escapeHtml(err.message||String(err))}</div>`;}
    };
    sel.addEventListener("change",render);
    await render();
  } catch(err) {
    target.innerHTML=`<div class="card error">${escapeHtml(err.message||String(err))}</div>`;
  }
}


/* ===== PWA / INSTALAÇÃO ===== */
(function setupPWA() {
  let deferredInstallPrompt = null;
  const installBtn = document.getElementById("installAppBtn");
  const helpCard = document.getElementById("installHelpCard");
  const helpText = document.getElementById("installHelpText");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function showInstallHelp(message) {
    if (!helpCard) return;
    helpCard.classList.remove("hidden");
    if (helpText && message) helpText.textContent = message;
  }

  function showInstallButton() {
    if (installBtn && !isStandalone()) installBtn.classList.remove("hidden");
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "./service-worker.js?v=19",
          { scope: "./" }
        );
        console.log("Versatille PWA: Service Worker registrado.", registration.scope);
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch (err) {
        console.error("Versatille PWA: falha ao registrar Service Worker:", err);
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.classList.add("hidden");
    if (helpCard) helpCard.classList.add("hidden");
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } catch (_) {}
        deferredInstallPrompt = null;
        installBtn.classList.add("hidden");
        return;
      }

      // Browser doesn't expose a prompt. Give the correct manual path instead
      // of making the button appear broken.
      const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isiOS) {
        showInstallHelp("No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.");
      } else {
        showInstallHelp("No Android/Chrome: abra o menu ⋮ do navegador e toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.");
      }
    });
  }

  if (isStandalone()) {
    if (installBtn) installBtn.classList.add("hidden");
    if (helpCard) helpCard.classList.add("hidden");
  }
})();

init();



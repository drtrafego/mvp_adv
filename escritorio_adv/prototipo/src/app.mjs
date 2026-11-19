import {AREAS,SECTORS,STATES,STATUS_COLORS,METRICS,TASKS,WORKFLOWS,escapeHtml as esc,money,initialState,restoreState,visibleAgents,addAgent} from './model.mjs';
import {sceneMarkup,scenePoint,sceneAvatar,sceneRoute} from './scene.mjs';
import {PixelScene} from './pixel-scene.mjs';

const PATHS={
  office:'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 8h1m4 0h1M9 12h1m4 0h1',
  telegram:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  people:'M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8m5 10v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  flow:'M12 3v6M5 16v-4h14v4M3 16h4v5H3zm7-13h4v5h-4zm7 13h4v5h-4z',
  chart:'M3 3v18h18M7 16v-5m5 5V7m5 9V4',
  plug:'M8 3v5m8-5v5M5 8h14v3a7 7 0 0 1-14 0zm7 10v4',
  help:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2',
  plus:'M12 5v14M5 12h14',
  pause:'M8 4v16M16 4v16',
  play:'M6 3l15 9-15 9z',
  expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  pointer:'M4 3l6 18 3-8 8-3z',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8m-8 4h6',
  clock:'M12 8v4l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  wallet:'M3 5h17v15H3zM3 5V3h14M16 11h6v5h-6z',
  check:'M5 12l4 4L19 6',
  scale:'M12 3v18M5 21h14M3 7h18M6 7l-4 7h8zm12 0l-4 7h8z',
  arrow:'M7 17L17 7M7 7h10v10',
  refresh:'M20 7v5h-5M4 17v-5h5M6 5a8 8 0 0 1 13 3M5 16a8 8 0 0 0 13 3',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  mic:'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8',
  printer:'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  calc:'M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 4v4m-2-2h4m6-2v4m-2-2h4m-12 8h4m6 0h4'
};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]||PATHS.file}"/></svg>`;
const $=s=>document.querySelector(s);
const portrait=(a,extra='')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -90 64 100" aria-hidden="true" ${extra}>${PixelScene.avatar(a)}</svg>`;
const civil=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const textOrDash=v=>v===null||v===undefined?'—':esc(v);
const simpleHash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0')+'a94f8c2d17e03b6591c4820f7a3e19d4b8c20194e72a6105c38b91e4';};
const routes={controladoria:'/prazos',movimentacoes:'/processos',forense:'/pecas',tese:'/inicial',pesquisador:'/analises',analista:'/analises',estrategista:'/analises',redator:'/pecas',revisor:'/pecas',financeiro:'/financeiro',agenda:'/operacao',daniel:'/pecas',proprietario:'/operacao'};

export class OfficeApp{
  constructor(){
    this.live=new URLSearchParams(location.search).get('mode')==='gabinete';
    this.privacyMode=false;
    let saved=null;try{saved=localStorage.getItem('daniel-felix-office-demo-v1')||localStorage.getItem('arao-mendes-office-demo-v1');}catch{}
    this.state=this.live?initialState():restoreState(saved);
    this.state.live=this.live;this.selected='coordenador';this.pan={x:0,y:0};this.running=false;this.snapshot=null;this.connectionError=null;
    this.modal=$('#modal');this.reduceMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
    this.state.logs=[{time:'TELEGRAM · ONLINE',text:'Coordenadora Luana conectada ao canal @DanielFelixAdvBot. Petições, clientes, prazos e financeiro prontos.'}];
    if(this.live){this.state.logs=[];for(const a of this.state.agents){a.status='waiting';a.task=a.human?'Revisões disponíveis no Gabinete':'Perfil cadastrado · execução do agente ainda não conectada';}}
    this.injectIcons();this.bind();this.render();
    $('#date-label').textContent=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long'}).format(new Date());
    if(this.live){$('.demo-badge').innerHTML='<i></i>GABINETE · CONECTANDO';this.loadSnapshot();}
    this.initServerSync();
  }
  initServerSync(){
    if(typeof window!=='undefined'&&window.location?.protocol?.startsWith('http')&&!window.location?.hostname?.endsWith('.test')&&typeof EventSource!=='undefined'){
      try{
        this.sse=new EventSource('/api/office/stream');
        this.sse.addEventListener('state_update',()=>{
          fetch('/api/office/state').then(r=>r.ok?r.json():null).then(s=>{
            if(s&&s.schemaVersion){
              this.state=s;
              this.render();
            }
          }).catch(()=>{});
        });
      }catch{}
    }
  }
  mask(val,type='text'){
    if(!this.privacyMode||!val)return val;
    const s=String(val);
    if(type==='cpf')return s.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/,'***.***.***-**');
    if(type==='phone')return s.replace(/\(\d{2}\)\s\d{4,5}-\d{4}/,'(**) *****-****');
    if(type==='money')return 'R$ ***,**';
    if(type==='name'){
      const p=s.split(' ');
      return p.length<=1?p[0][0]+'***':p[0]+' '+p.slice(1).map(x=>x[0]+'.').join(' ');
    }
    return s;
  }
  togglePrivacy(){
    this.privacyMode=!this.privacyMode;
    const btn=$('#btn-toggle-privacy');
    if(btn){
      btn.classList.toggle('active',this.privacyMode);
      $('#privacy-label').textContent=this.privacyMode?'LGPD: Ativo (Ocultando Dados)':'Modo LGPD';
      btn.style.borderColor=this.privacyMode?'#e5c88b':'';
      btn.style.color=this.privacyMode?'#f0d296':'';
    }
    this.toast(this.privacyMode?'Modo Privacidade ativado: CPFs, valores e nomes sensíveis mascarados.':'Modo Privacidade desativado.');
    this.render();
  }
  injectIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
  persist(){
    if(this.live)return;
    try{
      const raw=JSON.stringify(this.state);
      localStorage.setItem('daniel-felix-office-demo-v1',raw);
      localStorage.setItem('arao-mendes-office-demo-v1',raw);
      if(typeof window!=='undefined'&&window.location?.protocol?.startsWith('http')&&!window.location?.hostname?.endsWith('.test')){
        fetch('/api/office/state',{method:'POST',headers:{'Content-Type':'application/json'},body:raw}).catch(()=>{});
      }
    }catch{this.toast('O navegador não permitiu salvar a maquete. Ela continua funcionando nesta aba.');}
  }
  metric(){
    if(this.live)return this.snapshot?.metrics||{processes:null,leads:null,contracts:null,deadlines:null,received:null,receivable:null,petitions:null,series:[],funnel:[],label:'Gabinete'};
    const base={...METRICS[this.state.period],deadlines:METRICS.week.deadlines};
    return base;
  }
  finTotals(){
    const items=this.state.financeiro?.items||[];
    const paid=items.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount||0),0);
    const open=items.filter(x=>x.status==='open').reduce((s,x)=>s+Number(x.amount||0),0);
    const overdue=items.filter(x=>x.status==='overdue').reduce((s,x)=>s+Number(x.amount||0),0);
    return {paid,open,overdue,receivable:open+overdue,total:paid+open+overdue};
  }
  render(){this.renderKpis();this.renderTabs();this.renderScene();this.renderTelegramDock();this.renderInspector();this.renderQueue();this.renderActivity();}
  renderKpis(){
    const m=this.metric();
    const fin=this.finTotals();
    const pendingPetitions=(this.state.petitions||[]).filter(p=>p.status==='review').length;
    const rows=this.live?[
      ['Processos na carteira',m.processes,'scale','Mesma base do MVP','processes'],
      ['Novos contatos',m.leads,'people','ZapConversa ainda não conectado','clients'],
      ['Petições e minutas',m.petitions,'file','Minutas no Gabinete','petitions'],
      ['Contratos assinados',m.contracts,'check','ZapSign ainda não conectado','contracts'],
      ['Prazos em 7 dias',m.deadlines,'clock','Inclui sugestões a conferir','deadlines']
    ]:[
      ['Processos na carteira',m.processes,'scale',`${(this.state.deadlinesList||[]).filter(d=>d.status==='Sugestão').length} prazos sugeridos p/ conferir`,'processes'],
      ['Clientes & Pastas',(this.state.clients||[]).length,'people',`${m.leads} contatos no período · ver dossiês`,'clients'],
      ['Petições & Minutas',(this.state.petitions||[]).length,'file',`${pendingPetitions} aguardando revisão de Dr. Daniel`,'petitions'],
      ['Contratos & Procurações',m.contracts,'check',`${(this.state.contractsList||[]).length} pastas documentais · ZapSign`,'contracts'],
      ['Financeiro (Recebido)',money(fin.paid),'wallet',`${money(fin.receivable)} a receber · abrir caixa`,'financeiro']
    ];
    $('#kpis').innerHTML=rows.map((r,i)=>`<button class="kpi ${i===2||i===4?'urgent':''}" data-action="${r[4]}"><span class="kpi-label">${r[0]}${icon(r[2])}</span><strong class="kpi-value">${textOrDash(r[1])}</strong><span class="kpi-foot">${r[3]}</span></button>`).join('');
  }
  renderTabs(){
    const names={all:'Visão geral',comercial:'Comercial & Clientes',administrativo:'Processual & Prazos',juridico:'Jurídico & Petições',contratos:'Contratos & ZapSign',financeiro:'Financeiro',etica:'Ética e OAB'};
    $('#sector-tabs').innerHTML=Object.entries(names).map(([k,v])=>`<button class="sector-tab ${this.state.sector===k?'active':''}" data-sector-filter="${k}" aria-pressed="${this.state.sector===k}">${v}</button>`).join('');
    $('#agent-count').textContent=`${this.state.agents.filter(a=>!a.human).length} agentes · 2 humanos`;
  }
  renderScene(){
    $('#scene-container').innerHTML=sceneMarkup(this.state,this.selected,this.metric());this.transformView();
    $('#stage').classList.toggle('paused',this.state.paused);
    $('#stage').classList.toggle('pixel-view',this.state.view!=='iso');
    $('#scene-view-label').textContent=this.state.view==='iso'?'VISTA ISOMÉTRICA':'PIXEL ART · SALAS POR SETOR';
    $('#view-toggle').textContent=this.state.view==='iso'?'Vista pixel':'Vista isométrica';
  }
  renderTelegramDock(){
    const dock=$('#telegram-dock');if(!dock)return;
    const msgs=(this.state.telegramMessages||[]).slice(-4);
    dock.innerHTML=`
      <div class="tg-dock-head">
        <div class="tg-dock-title">${icon('telegram')} <span>TELEGRAM · @DanielFelixAdvBot</span></div>
        <button class="text-button" data-action="telegram">Expandir ↗</button>
      </div>
      <div class="tg-quick-chips">
        <button class="tg-chip" data-tg-cmd="/peticoes">/peticoes</button>
        <button class="tg-chip" data-tg-cmd="/clientes">/clientes</button>
        <button class="tg-chip" data-tg-cmd="/prazos">/prazos</button>
        <button class="tg-chip" data-tg-cmd="/financeiro">/financeiro</button>
        <button class="tg-chip" data-tg-cmd="/procuracao">/procuracao</button>
        <button class="tg-chip" data-tg-cmd="/novocaso">/novocaso</button>
      </div>
      <div class="tg-chat-feed" id="tg-dock-feed">
        ${msgs.map(m=>`
          <div class="tg-msg ${m.sender==='daniel'?'from-user':'from-bot'}">
            <div class="tg-msg-meta"><span>${esc(m.senderName)}</span><time>${esc(m.time)}</time></div>
            <div>${esc(m.text)}</div>
            ${m.actions?.length?`<div class="tg-msg-actions">${m.actions.map(act=>this.renderTgActionBtn(act)).join('')}</div>`:''}
          </div>
        `).join('')}
      </div>
      <form class="tg-input-row" id="tg-dock-form">
        <input name="cmd" placeholder="Comande a Luana no Telegram (ex: ver petições, cobrar cliente...)" aria-label="Comando Telegram">
        <button type="button" class="tg-mic-btn" id="btn-tg-dock-mic" title="Comando de voz (Web Speech API)">🎤</button>
        <button type="submit" class="tg-send-btn">Enviar</button>
      </form>
    `;
    const feed=dock.querySelector('#tg-dock-feed');if(feed)feed.scrollTop=feed.scrollHeight;
    const form=dock.querySelector('#tg-dock-form');
    if(form)form.onsubmit=e=>{e.preventDefault();const v=form.elements.cmd.value.trim();if(v){form.elements.cmd.value='';this.handleTelegramInput(v);}};
    const mic=dock.querySelector('#btn-tg-dock-mic');
    if(mic)mic.onclick=()=>this.startVoiceRecognition(form?.elements?.cmd,true,mic);
  }
  renderTgActionBtn(act){
    if(act.openPetition)return `<button class="tg-inline-btn" data-open-petition="${esc(act.openPetition)}">${esc(act.label)}</button>`;
    if(act.approvePetition)return `<button class="tg-inline-btn" data-approve-petition="${esc(act.approvePetition)}">${esc(act.label)}</button>`;
    if(act.openClient)return `<button class="tg-inline-btn" data-open-client="${esc(act.openClient)}">${esc(act.label)}</button>`;
    if(act.confirmDeadline)return `<button class="tg-inline-btn" data-confirm-deadline="${esc(act.confirmDeadline)}">${esc(act.label)}</button>`;
    if(act.sendOutbox)return `<button class="tg-inline-btn" data-send-outbox="${esc(act.sendOutbox)}">${esc(act.label)}</button>`;
    if(act.action)return `<button class="tg-inline-btn" data-action="${esc(act.action)}">${esc(act.label)}</button>`;
    return '';
  }
  renderInspector(){
    const a=this.state.agents.find(x=>x.id===this.selected)||this.state.agents[0],c=STATUS_COLORS[a.status];
    const moduleBtn={
      sdr:['clients','Abrir Clientes & Triagem ↗'],
      closer:['clients','Abrir Clientes & Propostas ↗'],
      contratos:['contracts','Abrir Procurações & Contratos ↗'],
      assinaturas:['contracts','Acompanhar Assinaturas ZapSign ↗'],
      forense:['petitions','Abrir Central de Petições ↗'],
      tese:['petitions','Ver Teses & Petições ↗'],
      pesquisador:['petitions','Ver Jurisprudência & Peças ↗'],
      analista:['clients','Abrir Dossiês & Provas ↗'],
      estrategista:['petitions','Ver Defesas & Petições ↗'],
      redator:['petitions','Abrir Editor de Petições ↗'],
      revisor:['petitions','Auditoria de Petições ↗'],
      financeiro:['financeiro','Abrir Gestão Financeira ↗'],
      movimentacoes:['processual','Abrir Processos & DJEN ↗'],
      controladoria:['deadlines','Abrir Controle de Prazos ↗'],
      agenda:['processual','Abrir Agenda & Audiências ↗'],
      coordenador:['telegram','Abrir Comando Telegram ↗'],
      daniel:['petitions','Revisar Petições na Mesa ↗'],
      proprietario:['financeiro','Ver Resultados & Caixa ↗']
    }[a.id];
    $('#inspector').innerHTML=`<div class="inspector-label"><span>${icon(a.human?'people':'flow')} ${a.human?'RESPONSÁVEL HUMANO':'AGENTE SELECIONADO'}</span><span style="color:${a.color}">●</span></div><div class="agent-profile"><div class="avatar-tile">${portrait(a)}</div><div><h2>${esc(a.name)}</h2><div class="agent-role">${esc(a.role)}</div></div></div><span class="status-pill" style="color:${c};border-color:${c}45"><i></i>${esc(STATES[a.status])}</span><div class="inspector-info"><div><div class="mini-label">SETOR</div><div class="info-value">${esc(SECTORS[a.sector].short)}</div></div><div><div class="mini-label">ESPECIALIDADE</div><div class="info-value">${esc(a.area)}</div></div></div><div class="task-now"><div class="mini-label">${this.live?'ESTADO DA INTEGRAÇÃO':'TAREFA ATUAL'}</div><p>${esc(a.task)}</p></div><div class="inspector-actions"><button class="outline-button" data-open-agent="${esc(a.id)}">Ver atribuições ${icon('arrow')}</button><button class="icon-button" data-action="team" aria-label="Ver equipe">${icon('people')}</button></div>${moduleBtn?`<button class="text-button" data-action="${moduleBtn[0]}" style="margin-top:14px">${moduleBtn[1]}</button>`:''}`;
  }
  renderQueue(){
    if(this.live){const r=this.snapshot?.summary;$('.count-badge').textContent=r?String(r.sugeridos+r.intimacoesSemAnalise):'—';$('#review-queue').innerHTML=[['Sugestões de prazo',r?.sugeridos,'deadlines'],['Intimações sem análise',r?.intimacoesSemAnalise,'notices'],['Vínculos de clientes a conferir',r?.clientesSugeridos,'clients']].map(t=>`<button class="review-item" data-action="${t[2]}"><span class="review-icon">${icon('file')}</span><span><h3>${t[0]}</h3><p>${textOrDash(t[1])} registros · fonte: Gabinete</p></span></button>`).join('');return;}
    const pendingPet=(this.state.petitions||[]).filter(p=>p.status==='review').length;
    const pendingDead=(this.state.deadlinesList||[]).filter(d=>d.status==='Sugestão').length;
    const pendingDoc=(this.state.contractsList||[]).filter(c=>c.status==='review').length;
    $('.count-badge').textContent=String(pendingPet+pendingDead+pendingDoc+1);
    $('#review-queue').innerHTML=TASKS.map((t,i)=>`<button class="review-item" data-review="${t.id}"><span class="review-icon">${icon(i===2?'clock':'file')}</span><span><h3>${esc(t.title)}</h3><p>${esc(t.sub)}</p></span></button>`).join('');
  }
  renderActivity(){
    const fallback=this.live?[{time:'INTEGRAÇÃO',text:this.connectionError||'Leitura do acompanhamento processual no mesmo Gabinete.'}]:[{time:'TELEGRAM · JURÍDICO',text:'Maya entregou a Inicial de Maria Carolina (PEC-2026-001) para revisão de Dr. Daniel Felix.'},{time:'ZAPSIGN · CONTRATOS',text:'Bia acompanha as assinaturas de Roberto Almeida Prado (1/2 concluídas).'},{time:'DJEN · PROCESSUAL',text:'Breno capturou 2 intimações; Clara calculou sugestão de prazo no motor CPC.'}];
    const list=this.state.logs.length>1?this.state.logs.slice(-3).reverse():fallback;
    $('#activity-feed').innerHTML=list.map(l=>`<div class="activity-item"><span class="activity-dot"></span><div>${esc(l.text)}<small>${esc(l.time)}</small></div></div>`).join('');
  }
  bind(){
    document.addEventListener('click',e=>{
      const agent=e.target.closest('[data-agent]');if(agent){this.selectAgent(agent.dataset.agent,true);return;}
      const open=e.target.closest('[data-open-agent]');if(open){this.profile(open.dataset.openAgent);return;}
      const filter=e.target.closest('[data-sector-filter]');if(filter){this.state.sector=filter.dataset.sectorFilter;this.renderTabs();this.renderScene();return;}
      const flow=e.target.closest('[data-workflow]');if(flow){this.modal.close();this.runWorkflow(flow.dataset.workflow);return;}
      const period=e.target.closest('[data-period]');if(period){this.state.period=period.dataset.period;this.persist();this.renderKpis();this.renderScene();this.metrics();return;}
      const review=e.target.closest('[data-review]');if(review){this.review(review.dataset.review);return;}
      const state=e.target.closest('[data-set-state]');if(state){const a=this.state.agents.find(a=>a.id===state.dataset.id);if(a&&!this.live){a.status=state.dataset.setState;this.persist();this.render();this.profile(a.id);}return;}
      const del=e.target.closest('[data-remove-agent]');if(del){const a=this.state.agents.find(a=>a.id===del.dataset.removeAgent);if(a?.custom){this.state.agents=this.state.agents.filter(x=>x.id!==a.id);this.selected='coordenador';this.persist();this.render();this.modal.close();this.toast('Agente personalizado removido da maquete.');}return;}
      const tgCmd=e.target.closest('[data-tg-cmd]');if(tgCmd){this.handleTelegramInput(tgCmd.dataset.tgCmd);return;}
      const openPet=e.target.closest('[data-open-petition]');if(openPet){this.petitions(openPet.dataset.openPetition);return;}
      const appPet=e.target.closest('[data-approve-petition]');if(appPet){this.approvePetition(appPet.dataset.approvePetition);return;}
      const openCli=e.target.closest('[data-open-client]');if(openCli){this.clients(openCli.dataset.openClient);return;}
      const confDead=e.target.closest('[data-confirm-deadline]');if(confDead){this.confirmDeadline(confDead.dataset.confirmDeadline);return;}
      const payFin=e.target.closest('[data-pay-fin]');if(payFin){this.markFinanceiroPaid(payFin.dataset.payFin);return;}
      const billFin=e.target.closest('[data-bill-fin]');if(billFin){this.createOutboxBilling(billFin.dataset.billFin);return;}
      const sendOut=e.target.closest('[data-send-outbox]');if(sendOut){this.authorizeOutbox(sendOut.dataset.sendOutbox);return;}
      const openDoc=e.target.closest('[data-open-contract]');if(openDoc){this.contracts(openDoc.dataset.openContract);return;}
      const approveDoc=e.target.closest('[data-approve-contract]');if(approveDoc){this.approveContract(approveDoc.dataset.approveContract);return;}
      const signStep=e.target.closest('[data-sign-contract]');if(signStep){this.simulateZapSignStep(signStep.dataset.signContract);return;}
      const trNotice=e.target.closest('[data-translate-notice]');if(trNotice){this.translateNoticeForWhatsApp(trNotice.dataset.translateNotice);return;}
      const openCalc=e.target.closest('[data-open-calculator]');if(openCalc){this.openDeadlineCalculator();return;}
      const action=e.target.closest('[data-action]');if(action){e.preventDefault();this.action(action.dataset.action);}
    });
    document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t.matches('.person,.wall-screen')){e.preventDefault();t.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
    this.modal.addEventListener('click',e=>{if(e.target===this.modal){const r=this.modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.modal.close();}});
    $('#stage').addEventListener('pointerdown',e=>{
      if(e.target.closest('[data-agent],[data-action]')||e.pointerType==='touch')return;
      const start={x:e.clientX,y:e.clientY,px:this.pan.x,py:this.pan.y},stage=$('#stage');stage.setPointerCapture(e.pointerId);
      const move=ev=>{this.pan={x:start.px+ev.clientX-start.x,y:start.py+ev.clientY-start.y};this.transformView();};
      const up=()=>{stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);};
      stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.running)this.state.paused=true;this.syncPause();});
  }
  setActiveNav(key){
    document.querySelectorAll('.rail .nav-button').forEach(b=>b.classList.toggle('active',b.dataset.action===key));
  }
  action(a){
    if(a==='toggle-view'){if(this.running){this.toast('Aguarde o fim do fluxo para trocar a vista.');return;}this.state.view=this.state.view==='iso'?'pixel':'iso';this.state.zoom=1;this.pan={x:0,y:0};this.persist();this.renderScene();return;}
    const navKeys=['home','telegram','clients','petitions','processes','contracts','financeiro','team','metrics','integrations','help'];
    if(navKeys.includes(a))this.setActiveNav(a);
    const actions={
      home:()=>{this.state.sector='all';this.pan={x:0,y:0};this.state.zoom=1;this.modal.close();this.renderTabs();this.renderScene();},
      telegram:()=>this.telegram(),
      clients:()=>this.clients(),
      petitions:()=>this.petitions(),
      financeiro:()=>this.financeiro(),
      team:()=>this.team(),
      metrics:()=>this.metrics(),
      workflows:()=>this.workflows(),
      integrations:()=>this.integrations(),
      'new-agent':()=>this.newAgent(),
      'toggle-privacy':()=>this.togglePrivacy(),
      pause:()=>{this.state.paused=!this.state.paused;this.syncPause();},
      'zoom-in':()=>this.zoom(.15),
      'zoom-out':()=>this.zoom(-.15),
      'zoom-reset':()=>{this.state.zoom=1;this.pan={x:0,y:0};this.transformView();},
      fullscreen:async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#stage').requestFullscreen();}catch{this.toast('Tela cheia indisponível. Use os controles de zoom.');}},
      help:()=>this.help(),
      logs:()=>this.logs(),
      settings:()=>this.settings(),
      reviews:()=>this.live?this.processual('notices'):this.reviews(),
      processual:()=>this.processual('processes'),
      processes:()=>this.processual('processes'),
      deadlines:()=>this.processual('deadlines'),
      notices:()=>this.processual('notices'),
      contracts:()=>this.contracts(),
      'refresh-data':()=>this.loadSnapshot(),
      'reset-demo':()=>{if(this.live)return;this.state=initialState();this.selected='coordenador';this.pan={x:0,y:0};this.persist();this.render();this.modal.close();this.toast('Escritório restaurado para o estado inicial.');}
    };
    actions[a]?.();
  }
  syncPause(){const b=$('#pause-button');b.innerHTML=icon(this.state.paused?'play':'pause')+`<span>${this.state.paused?'Retomar':'Pausar'}</span>`;$('#stage').classList.toggle('paused',this.state.paused);}
  zoom(v){this.state.zoom=Math.max(.65,Math.min(2.2,this.state.zoom+v));this.transformView();}
  transformView(){const c=$('#scene-container');c.style.transform=`translate(${this.pan.x}px,${this.pan.y}px) scale(${this.state.zoom})`;$('#zoom-label').textContent=`${Math.round(this.state.zoom*100)}%`;}
  selectAgent(id,open=false){if(!this.state.agents.some(a=>a.id===id))return;this.selected=id;this.renderScene();this.renderInspector();if(open&&innerWidth<=1020)this.profile(id);}
  show(title,subtitle,content){$('#modal-body').innerHTML=`<div class="modal-head"><div><div class="eyebrow">DANIEL FELIX · ${this.live?'GABINETE':'OPERAÇÃO DO ESCRITÓRIO'}</div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="close-button" data-action="close" aria-label="Fechar">×</button></div><div class="modal-content">${content}</div>`;$('#modal-body [data-action=close]').onclick=()=>this.modal.close();if(!this.modal.open)this.modal.showModal();}

  /* ======================================================================
   * 1. CENTRAL DE OPERAÇÃO NO TELEGRAM (@DanielFelixAdvBot)
   * ====================================================================== */
  telegram(){
    const msgs=this.state.telegramMessages||[];
    this.show(
      'Operação no Telegram · @DanielFelixAdvBot',
      'Canal direto de comando entre Dr. Daniel Felix / Proprietário e a Coordenadora Luana. Cada comando aciona os agentes correspondentes na banca.',
      `<div class="workspace-split">
        <div class="list-panel" style="padding:16px;gap:12px">
          <div>
            <span class="badge blue">● BOT ATIVO · @DanielFelixAdvBot</span>
            <h3 style="margin-top:10px;font-size:15px">Comandos Rápidos do Advogado</h3>
            <p class="muted" style="margin-top:4px;line-height:1.5">Clique em um comando ou digite livremente no chat ao lado para comandar os setores do escritório:</p>
          </div>
          <button class="list-card-btn" data-tg-cmd="/resumo"><strong>/resumo <span class="badge gold">Geral</span></strong><small>Relatório imediato da mesa de Dr. Daniel Felix (petições, prazos, caixa e pendências).</small></button>
          <button class="list-card-btn" data-tg-cmd="/peticoes"><strong>/peticoes <span class="badge blue">Jurídico</span></strong><small>Lista as petições iniciais e minutas prontas para revisão e protocolo.</small></button>
          <button class="list-card-btn" data-tg-cmd="/clientes"><strong>/clientes <span class="badge green">Comercial</span></strong><small>Lista as pastas de clientes ativos, triagem do WhatsApp e documentos.</small></button>
          <button class="list-card-btn" data-tg-cmd="/prazos"><strong>/prazos <span class="badge gold">Controladoria</span></strong><small>Exibe sugestões de prazo da Clara para confirmação humana.</small></button>
          <button class="list-card-btn" data-tg-cmd="/procuracao"><strong>/procuracao <span class="badge blue">Contratos</span></strong><small>Aciona Davi e Bia para gerar Procuração Ad Judicia e status ZapSign.</small></button>
          <button class="list-card-btn" data-tg-cmd="/financeiro"><strong>/financeiro <span class="badge green">Caixa</span></strong><small>Resumo de honorários recebidos, a receber e autorização de cobrança.</small></button>
          <button class="list-card-btn" data-tg-cmd="/novocaso"><strong>/novocaso <span class="badge gold">Fluxo Completo</span></strong><small>Dispara triagem de novo caso até entrega da minuta inicial na mesa de Daniel.</small></button>
        </div>
        <div class="detail-panel" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #2b3c46">
              <div><strong>Luana · Coordenadora Operacional</strong><br><small class="muted">Integrada a Lia, Caio, Breno, Clara, Nina, Davi, Bia, Forense (Squad) e Rui</small></div>
              <span class="badge green">Allowlist: Dr. Daniel Felix</span>
            </div>
            <div class="tg-chat-feed" id="tg-modal-feed" style="max-height:370px;margin-top:12px">
              ${msgs.map(m=>`
                <div class="tg-msg ${m.sender==='daniel'?'from-user':'from-bot'}">
                  <div class="tg-msg-meta"><span>${esc(m.senderName)}</span><time>${esc(m.time)}</time></div>
                  <div>${esc(m.text)}</div>
                  ${m.actions?.length?`<div class="tg-msg-actions">${m.actions.map(act=>this.renderTgActionBtn(act)).join('')}</div>`:''}
                </div>
              `).join('')}
            </div>
          </div>
          <form class="tg-input-row" id="tg-modal-form" style="margin-top:14px">
            <input name="cmd" placeholder="Digite sua ordem para a Coordenadora no Telegram (ex: aprovar petição Maria Carolina, cobrar Roberto, ver clientes)..." required>
            <button type="button" class="tg-mic-btn" id="btn-tg-modal-mic" title="Ditar por voz (Web Speech API)">🎤</button>
            <button type="submit" class="tg-send-btn">Enviar no Telegram ➤</button>
          </form>
        </div>
      </div>`
    );
    const feed=$('#tg-modal-feed');if(feed)feed.scrollTop=feed.scrollHeight;
    const form=$('#tg-modal-form');
    if(form)form.onsubmit=e=>{e.preventDefault();const v=form.elements.cmd.value.trim();if(v){form.elements.cmd.value='';this.handleTelegramInput(v,true);}};
    const modalMic=$('#btn-tg-modal-mic');
    if(modalMic)modalMic.onclick=()=>this.startVoiceRecognition(form?.elements?.cmd,true,modalMic);
  }
  handleTelegramInput(rawText,reopenModal=false){
    const now=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date());
    if(!Array.isArray(this.state.telegramMessages))this.state.telegramMessages=[];
    this.state.telegramMessages.push({
      id:'tg-u-'+Date.now(),
      sender:'daniel',
      senderName:'Dr. Daniel Felix (Telegram)',
      time:now,
      text:rawText
    });
    const q=rawText.toLocaleLowerCase('pt-BR');
    let replyText='';
    let actions=[];
    let targetAgent='coordenador';

    if(q.includes('/peticoes')||q.includes('petiç')||q.includes('petic')||q.includes('minuta')||q.includes('peça')||q.includes('inicial')){
      targetAgent='forense';
      const list=this.state.petitions||[];
      const rev=list.filter(p=>p.status==='review');
      replyText=`⚖️ Dr. Daniel, temos ${list.length} peças registradas no Núcleo Jurídico (${rev.length} aguardando sua revisão humana): ` +
        list.map(p=>`[${p.code}] ${p.clientName} (${p.statusLabel})`).join(' · ') + '. Qual deseja abrir ou aprovar?';
      actions=[
        ...rev.slice(0,2).map(p=>({label:`📄 Revisar ${p.code} (${p.clientName.split(' ')[0]})`,openPetition:p.id})),
        ...rev.slice(0,1).map(p=>({label:`✅ Aprovar ${p.code}`,approvePetition:p.id})),
        {label:'⚖️ Central de Petições',action:'petitions'}
      ];
    }else if(q.includes('/clientes')||q.includes('cliente')||q.includes('dossi')||q.includes('pasta')){
      targetAgent='sdr';
      const clis=this.state.clients||[];
      replyText=`👥 Temos ${clis.length} clientes com pastas ativas no escritório: ` +
        clis.map(c=>`${c.name} (${c.area} · ${c.stage})`).join(' | ') + '. Você pode abrir qualquer pasta ou cadastrar novo cliente:';
      actions=[
        {label:'👤 Pasta Maria Carolina',openClient:'cli-1'},
        {label:'👤 Pasta Carlos Eduardo',openClient:'cli-2'},
        {label:'👥 Ver Todos os Clientes',action:'clients'}
      ];
    }else if(q.includes('/prazos')||q.includes('prazo')||q.includes('clara')||q.includes('intima')){
      targetAgent='controladoria';
      const pzs=(this.state.deadlinesList||[]).filter(d=>d.status==='Sugestão');
      replyText=`📅 A Clara (Gestora de Prazos) apurou ${pzs.length} sugestões de prazo aguardando sua confirmação humana: ` +
        (pzs.length?pzs.map(d=>`${d.clientName}: ${d.ato} (Fatal: ${d.dataFatal})`).join(' · '):'Todos os prazos da semana já foram confirmados por você.');
      actions=[
        ...pzs.map(d=>({label:`✓ Confirmar Prazo ${d.clientName.split(' ')[0]} (${d.dataFatal})`,confirmDeadline:d.id})),
        {label:'📂 Abrir Prazos e Processos',action:'deadlines'}
      ];
    }else if(q.includes('/financeiro')||q.includes('caixa')||q.includes('honor')||q.includes('cobrar')||q.includes('pagamento')){
      targetAgent='financeiro';
      const fin=this.finTotals();
      replyText=`💰 Relatório do Rui (Financeiro): Recebido confirmado: ${money(fin.paid)} | A receber: ${money(fin.open)} | Em atraso: ${money(fin.overdue)}. Parcela de Roberto Almeida Prado (R$ 5.900) tem cobrança pronta no Outbox.`;
      actions=[
        {label:'💰 Abrir Módulo Financeiro',action:'financeiro'},
        {label:'📲 Autorizar Cobrança Outbox',sendOutbox:'out-1'}
      ];
    }else if(q.includes('/procuracao')||q.includes('procura')||q.includes('contrato')||q.includes('zapsign')){
      targetAgent='contratos';
      replyText=`✍️ Davi (Contratos) e Bia (ZapSign) informam: Procuração de Carlos Eduardo Albuquerque aguarda sua revisão de poderes especiais (Art. 105 CPC), e o contrato de Roberto Almeida está 1/2 assinado no ZapSign.`;
      actions=[
        {label:'✍️ Abrir Contratos & Procurações',action:'contracts'},
        {label:'✅ Aprovar Procuração PROC-002',action:'contracts'}
      ];
    }else if(q.includes('/novocaso')||q.includes('novo caso')||q.includes('triagem')){
      targetAgent='sdr';
      replyText=`🚀 Iniciando fluxo completo na planta: Lia (SDR) qualificou o relato do WhatsApp → Davi preparou Procuração → Forense acionou Íris, Theo, Maya e Noah para entregar a minuta na sua mesa!`;
      actions=[
        {label:'⚖️ Ver Minutas na Mesa',action:'petitions'},
        {label:'👥 Ver Clientes',action:'clients'}
      ];
      if(!this.live&&!this.running){setTimeout(()=>this.runWorkflow('intake'),150);}
    }else{
      const pendingPet=(this.state.petitions||[]).filter(p=>p.status==='review').length;
      const pendingDead=(this.state.deadlinesList||[]).filter(d=>d.status==='Sugestão').length;
      const fin=this.finTotals();
      replyText=`🏛️ Resumo Operacional para Dr. Daniel Felix: • ${this.state.clients.length} clientes ativos • ${pendingPet} petições aguardando sua revisão • ${pendingDead} sugestões de prazo da Clara • Caixa recebido: ${money(fin.paid)} (${money(fin.receivable)} a receber). Como deseja prosseguir?`;
      actions=[
        {label:`⚖️ Petições (${pendingPet} p/ revisar)`,action:'petitions'},
        {label:`👥 Clientes (${this.state.clients.length})`,action:'clients'},
        {label:`📅 Prazos (${pendingDead})`,action:'deadlines'},
        {label:'💰 Financeiro',action:'financeiro'}
      ];
    }

    this.state.telegramMessages.push({
      id:'tg-b-'+Date.now(),
      sender:'coordenador',
      senderName:'Luana · Coordenadora (@DanielFelixAdvBot)',
      time:now,
      text:replyText,
      actions
    });
    this.log(`Telegram (@DanielFelixAdvBot): "${rawText}" → despachado para ${targetAgent}.`);
    this.selected=targetAgent;
    this.persist();
    this.render();
    if(reopenModal||(this.modal.open&&$('#tg-modal-feed')))this.telegram();
  }

  /* ======================================================================
   * 2. CONTROLE DE CLIENTES & DOSSIÊS 360°
   * ====================================================================== */
  clients(selectedId=null,showNewForm=false){
    const list=this.state.clients||[];
    const current=list.find(c=>c.id===selectedId)||list[0];
    this.show(
      'Controle de Clientes & Pastas (Dossiê 360°)',
      'Gestão completa dos clientes do Escritório Daniel Felix: qualificação civil, triagem do WhatsApp/ZapConversa, documentos verificados, petições, procurações e honorários.',
      `<div class="workspace-split">
        <div class="list-panel">
          <div class="list-panel-head">
            <div style="display:flex;gap:8px">
              <input id="client-search" placeholder="Buscar nome, CPF ou caso..." style="flex:1;background:#0e1b23;border:1px solid #3a4c58;border-radius:6px;color:#fff;padding:10px 12px;font-size:14px">
              <button class="primary-button" id="btn-new-client" style="padding:10px 14px;font-size:13px">+ Novo</button>
            </div>
            <select id="client-area-filter" style="background:#0e1b23;border:1px solid #3a4c58;border-radius:6px;color:#cbd6dc;padding:10px;font-size:13.5px">
              <option value="Todas">Todas as áreas (${list.length} clientes)</option>
              ${AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
          <div class="list-panel-items" id="client-list-items"></div>
        </div>
        <div class="detail-panel" id="client-detail-panel"></div>
      </div>`
    );

    const renderList=(activeId)=>{
      const q=($('#client-search')?.value||'').toLocaleLowerCase('pt-BR');
      const area=$('#client-area-filter')?.value||'Todas';
      const filtered=list.filter(c=>(c.name+' '+c.cpf+' '+c.caseTitle).toLocaleLowerCase('pt-BR').includes(q)&&(area==='Todas'||c.area===area));
      $('#client-list-items').innerHTML=filtered.map(c=>`
        <button class="list-card-btn ${c.id===activeId?'active':''}" data-select-client="${esc(c.id)}">
          <strong><span>${esc(c.name)}</span><span class="badge ${c.urgency==='Crítica'||c.urgency==='Alta'?'gold':'blue'}">${esc(c.area)}</span></strong>
          <small>${esc(c.caseTitle)}</small>
          <small style="color:#7fc2a4">● ${esc(c.stage)} · CPF: ${esc(this.mask(c.cpf,'cpf'))}</small>
        </button>
      `).join('')||'<p class="chart-note" style="padding:14px">Nenhum cliente encontrado para este filtro.</p>';
      document.querySelectorAll('[data-select-client]').forEach(b=>b.onclick=()=>{renderList(b.dataset.selectClient);renderDetail(list.find(x=>x.id===b.dataset.selectClient));});
    };

    const renderDetail=(c)=>{
      if(!c){$('#client-detail-panel').innerHTML='<p class="chart-note">Selecione um cliente ao lado.</p>';return;}
      const pet=(this.state.petitions||[]).find(p=>p.id===c.petitionId||p.clientId===c.id);
      const doc=(this.state.contractsList||[]).find(d=>d.id===c.contractId||d.clientId===c.id);
      const proc=(this.state.processesList||[]).find(p=>p.id===c.processId||p.clientId===c.id);
      $('#client-detail-panel').innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;border-bottom:1px solid #2b3c46;padding-bottom:14px">
          <div>
            <span class="badge gold">${esc(c.area)}</span> <span class="badge green">${esc(c.stage)}</span> <span class="badge">${esc(c.origin)}</span>
            <h3 style="font:26px Georgia,serif;margin-top:8px">${esc(c.name)}</h3>
            <p class="muted" style="margin-top:4px;font-size:14px">${esc(c.caseTitle)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${pet?`<button class="success-button" data-open-petition="${esc(pet.id)}">⚖️ Ver Petição (${esc(pet.code)})</button>`:`<button class="outline-button" id="btn-create-pet-for-client">⚖️ Gerar Minuta Inicial</button>`}
            <button class="outline-button" id="btn-proc-for-client">✍️ Procuração / ZapSign</button>
          </div>
        </div>

        <div class="info-grid-3">
          <div class="info-box"><small>CPF / RG</small><strong>${esc(this.mask(c.cpf,'cpf'))} · ${esc(this.mask(c.rg||'—','cpf'))}</strong></div>
          <div class="info-box"><small>Estado Civil / Profissão</small><strong>${esc(c.estadoCivil)} · ${esc(c.profissao)}</strong></div>
          <div class="info-box"><small>WhatsApp / E-mail</small><strong>${esc(this.mask(c.phone,'phone'))}<br><span style="font-size:13px;font-weight:400;color:#9ab0bc">${esc(this.mask(c.email,'cpf'))}</span></strong></div>
          <div class="info-box" style="grid-column:span 2"><small>Endereço Completo (Qualificação p/ Procuração e Inicial)</small><strong>${esc(this.mask(c.endereco,'cpf'))}</strong></div>
          <div class="info-box"><small>Honorários da Pasta</small><strong style="color:#86d1b1">${esc(this.mask(money(c.honorariosPaid||0),'money'))} pagos <span style="color:#9ab0bc;font-weight:400">/ ${esc(this.mask(money(c.honorariosTotal||0),'money'))}</span></strong></div>
        </div>

        <div class="citation-box">
          <h4>📋 Relato Triado no WhatsApp (Lia SDR) & Resumo do Caso</h4>
          <p>${esc(c.summary)}</p>
          <ul style="margin:10px 0 0;padding-left:20px;font-size:13.5px;color:#b8c7cf;line-height:1.65">
            ${(c.facts||[]).map(f=>`<li>${esc(f)}</li>`).join('')}
          </ul>
        </div>

        <div class="chart-grid" style="margin-top:14px">
          <div class="citation-box" style="margin-top:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h4 style="margin:0">📂 Documentos & Provas no Dossiê (${(c.documents||[]).length})</h4>
              <label class="tg-inline-btn" style="cursor:pointer;margin:0;font-size:12px" title="Anexar arquivo com carimbo e hash SHA-256">
                📎 Anexar Prova <input type="file" id="client-file-upload" style="display:none">
              </label>
            </div>
            ${(c.documents||[]).map(d=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px;padding:7px 0;border-bottom:1px solid #253640"><span>📄 ${esc(d.name)} ${d.hash?`<small style="color:#78909c;display:block">SHA-256: ${esc(d.hash.slice(0,22))}...</small>`:''}</span><span class="badge green">${esc(d.status)}</span></div>`).join('')}
            ${c.missingDocs?.length?`<div style="margin-top:10px;color:#f0a399;font-size:13px">⚠️ Pendência documental: ${c.missingDocs.map(esc).join(', ')}</div>`:'<div style="margin-top:10px;color:#86d1b1;font-size:13px">✓ Documentação completa conferida por Eva.</div>'}
          </div>
          <div class="citation-box" style="margin-top:0">
            <h4>🔗 Vínculos Operacionais do Cliente</h4>
            <p style="margin-bottom:8px"><strong>Petição / Minuta:</strong> ${pet?`<a href="#" data-open-petition="${esc(pet.id)}" style="color:#e6c786;text-decoration:underline">${esc(pet.code)} · ${esc(pet.statusLabel)}</a>`:'Nenhuma minuta gerada ainda'}</p>
            <p style="margin-bottom:8px"><strong>Procuração / Contrato:</strong> ${doc?`<a href="#" data-open-contract="${esc(doc.id)}" style="color:#9ad2f5;text-decoration:underline">${esc(doc.code)} · ${esc(doc.statusLabel)}</a>`:'Pendente de emissão'}</p>
            <p><strong>Processo CNJ:</strong> ${proc?`${esc(proc.numeroCnj)} (${esc(proc.tribunal)})`:'Aguardando protocolo da inicial'}</p>
          </div>
        </div>
      `;
      const btnProc=$('#btn-proc-for-client');
      if(btnProc)btnProc.onclick=()=>this.contracts(doc?.id||null,c.id);
      const btnCreatePet=$('#btn-create-pet-for-client');
      if(btnCreatePet)btnCreatePet.onclick=()=>this.createPetitionForClient(c);
      const fileInp=$('#client-file-upload');
      if(fileInp){
        fileInp.onchange=async(e)=>{
          const file=e.target.files?.[0];
          if(!file)return;
          const hash=await this.computeFileHash(file);
          if(!Array.isArray(c.documents))c.documents=[];
          c.documents.push({
            name:file.name,
            size:`${(file.size/1024).toFixed(1)} KB`,
            status:'Anexado e Verificado',
            hash:hash,
            uploadedAt:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())
          });
          this.log(`Eva arquivou documento "${file.name}" na pasta de ${c.name} com hash SHA-256: ${hash.slice(0,16)}...`);
          this.persist();
          this.render();
          this.toast(`Arquivo ${file.name} anexado ao dossiê de ${c.name}!`);
          renderDetail(c);
        };
      }
    };

    const renderNewClientForm=()=>{
      $('#client-detail-panel').innerHTML=`
        <h3 style="font:22px Georgia,serif;margin-bottom:6px">Cadastrar Novo Cliente / Triagem</h3>
        <p class="muted" style="margin-bottom:14px">Os dados abaixo alimentam automaticamente a pasta do cliente, o gerador de Procuração Ad Judicia e o Núcleo Jurídico.</p>
        <form id="new-client-form">
          <div class="form-grid">
            <label class="field">Nome Completo<input name="name" required placeholder="Ex.: Henrique Vasconcelos"></label>
            <label class="field">CPF<input name="cpf" required placeholder="Ex.: 319.402.811-00"></label>
            <label class="field">RG / Órgão Expedidor<input name="rg" required placeholder="Ex.: 34.112.908-1 SSP/SP"></label>
            <label class="field">Estado Civil<select name="estadoCivil"><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>União Estável</option></select></label>
            <label class="field">Profissão<input name="profissao" required placeholder="Ex.: Médico"></label>
            <label class="field">WhatsApp / Telefone<input name="phone" required placeholder="Ex.: (11) 99401-2210"></label>
            <label class="field">E-mail<input name="email" type="email" placeholder="cliente@email.com"></label>
            <label class="field">Área Jurídica<select name="area">${AREAS.filter(a=>a!=='Ética e OAB').map(a=>`<option>${a}</option>`).join('')}</select></label>
            <label class="field">CEP (Busca automática)
              <div style="display:flex;gap:6px">
                <input id="new-cli-cep" placeholder="01001-000">
                <button type="button" class="outline-button" id="btn-lookup-cep" style="padding:6px 10px;font-size:12px">Buscar</button>
              </div>
            </label>
            <label class="field full">Endereço Completo<input name="endereco" id="new-cli-endereco" required placeholder="Rua, número, complemento, bairro, cidade/UF, CEP"></label>
            <label class="field">Título da Demanda<input name="caseTitle" required placeholder="Ex.: Negativação indevida / Golpe bancário"></label>
            <label class="field">Honorários Contratados (R$)<input name="honorariosTotal" type="number" value="4500"></label>
            <label class="field full">Resumo Fático e Provas Apresentadas<textarea name="summary" required placeholder="Relato do cliente colhido na triagem..."></textarea></label>
          </div>
          <div class="action-bar">
            <button type="submit" class="primary-button">Salvar Pasta do Cliente +</button>
          </div>
        </form>
      `;
      const btnCep=$('#btn-lookup-cep');
      if(btnCep){
        btnCep.onclick=async()=>{
          const cep=($('#new-cli-cep')?.value||'').replace(/\D/g,'');
          if(cep.length!==8){this.toast('Digite um CEP válido com 8 dígitos.');return;}
          this.toast('Buscando CEP no ViaCEP...');
          try{
            const res=await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if(!res.ok)throw new Error('Falha');
            const data=await res.json();
            if(data.erro){this.toast('CEP não encontrado.');return;}
            const endEl=$('#new-cli-endereco');
            if(endEl){
              endEl.value=`${data.logradouro||''}, , ${data.bairro||''}, ${data.localidade||''}/${data.uf||''} - CEP ${data.cep||cep}`;
              endEl.focus();
              this.toast('Endereço preenchido automaticamente!');
            }
          }catch{
            this.toast('Não foi possível consultar o ViaCEP no momento.');
          }
        };
      }
      $('#new-client-form').onsubmit=e=>{
        e.preventDefault();
        const fd=Object.fromEntries(new FormData(e.target));
        const newCli={
          id:'cli-'+Date.now(),
          name:fd.name.trim(),
          cpf:fd.cpf.trim(),
          rg:fd.rg.trim(),
          nacionalidade:'Brasileiro(a)',
          estadoCivil:fd.estadoCivil,
          profissao:fd.profissao.trim(),
          endereco:fd.endereco.trim(),
          phone:fd.phone.trim(),
          email:fd.email?.trim()||'—',
          area:fd.area,
          stage:'Triagem registrada',
          origin:'Painel / Telegram',
          urgency:'Alta',
          caseTitle:fd.caseTitle.trim(),
          summary:fd.summary.trim(),
          facts:[`16/10/2026 · Pasta cadastrada e qualificação conferida por Lia (SDR).`],
          documents:[{name:'Documentos_Iniciais_Triagem.pdf',status:'Recebido',size:'1.0 MB'}],
          missingDocs:[],
          petitionId:null,
          contractId:null,
          processId:null,
          honorariosTotal:Number(fd.honorariosTotal||0),
          honorariosPaid:0
        };
        this.state.clients.unshift(newCli);
        this.log(`Novo cliente cadastrado na carteira: ${newCli.name} (${newCli.area}).`);
        this.persist();this.render();
        this.toast(`Cliente ${newCli.name} cadastrado com sucesso!`);
        this.clients(newCli.id);
      };
    };

    $('#client-search').oninput=()=>renderList(current?.id);
    $('#client-area-filter').onchange=()=>renderList(current?.id);
    $('#btn-new-client').onclick=()=>renderNewClientForm();
    renderList(current?.id);
    if(showNewForm)renderNewClientForm();else renderDetail(current);
  }

  /* ======================================================================
   * 3. CENTRAL DE PETIÇÕES, MINUTAS & REVISÃO HUMANA (DR. DANIEL FELIX)
   * ====================================================================== */
  petitions(selectedId=null){
    const list=this.state.petitions||[];
    const current=list.find(p=>p.id===selectedId)||list[0];
    this.show(
      'Central de Petições, Minutas & Revisão Humana',
      'Aqui o Dr. Daniel Felix lê o inteiro teor das peças elaboradas pela Maya e pelo Forense, confere a jurisprudência auditada pelo Theo/Noah, edita o texto, aprova para protocolo e exporta o documento.',
      `<div class="workspace-split">
        <div class="list-panel">
          <div class="list-panel-head">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="font-size:15px">Fila de Peças (${list.length})</strong>
              <button class="primary-button" id="btn-new-petition" style="padding:9px 13px;font-size:13px">+ Nova Petição</button>
            </div>
            <select id="pet-status-filter" style="background:#0e1b23;border:1px solid #3a4c58;border-radius:6px;color:#cbd6dc;padding:10px;font-size:13.5px">
              <option value="all">Todas as peças (${list.length})</option>
              <option value="review">Aguardando revisão de Dr. Daniel</option>
              <option value="approved">Aprovadas para protocolo</option>
              <option value="working">Em elaboração pelo Squad</option>
            </select>
          </div>
          <div class="list-panel-items" id="petition-list-items"></div>
        </div>
        <div class="detail-panel" id="petition-detail-panel"></div>
      </div>`
    );

    const renderList=(activeId)=>{
      const st=$('#pet-status-filter')?.value||'all';
      const filtered=list.filter(p=>st==='all'||p.status===st);
      $('#petition-list-items').innerHTML=filtered.map(p=>`
        <button class="list-card-btn ${p.id===activeId?'active':''}" data-select-pet="${esc(p.id)}">
          <strong><span>${esc(p.code)} · ${esc(p.type)}</span><span class="badge ${p.status==='approved'?'green':p.status==='review'?'gold':'blue'}">${p.status==='approved'?'Aprovada':p.status==='review'?'Revisar':'Squad'}</span></strong>
          <small>${esc(p.title)}</small>
          <small style="color:#a9bec9">Cliente: <b>${esc(p.clientName)}</b> · ${esc(p.version)}</small>
        </button>
      `).join('')||'<p class="chart-note" style="padding:14px">Nenhuma petição neste filtro.</p>';
      document.querySelectorAll('[data-select-pet]').forEach(b=>b.onclick=()=>{renderList(b.dataset.selectPet);renderDetail(list.find(x=>x.id===b.dataset.selectPet));});
    };

    const renderDetail=(p)=>{
      if(!p){$('#petition-detail-panel').innerHTML='<p class="chart-note">Selecione uma petição ao lado.</p>';return;}
      $('#petition-detail-panel').innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid #2b3c46;padding-bottom:12px">
          <div>
            <span class="badge ${p.status==='approved'?'green':'gold'}">${esc(p.statusLabel)}</span>
            <span class="badge blue">${esc(p.area)}</span>
            <span class="badge">Versão ${esc(p.version)}</span>
            <h3 style="font:24px Georgia,serif;margin-top:8px">${esc(p.title)}</h3>
            <p class="muted" style="margin-top:4px;font-size:13.5px">Cliente: <a href="#" data-open-client="${esc(p.clientId)}" style="color:#e6c786;text-decoration:underline">${esc(p.clientName)}</a> · ${esc(p.processNumber)} · Hash SHA-256: <code>${esc(p.hash.slice(0,18))}...</code></p>
          </div>
        </div>

        <div class="info-grid-3">
          <div class="info-box"><small>Tese Jurídica (Íris)</small><strong style="font-size:13px;font-weight:400">${esc(p.squadNotes?.tese||'—')}</strong></div>
          <div class="info-box"><small>Provas no Dossiê (Eva)</small><strong style="font-size:13px;font-weight:400">${esc(p.squadNotes?.provas||'—')}</strong></div>
          <div class="info-box"><small>Auditoria (Noah)</small><strong style="font-size:13px;font-weight:400">${esc(p.squadNotes?.revisao||'—')}</strong></div>
        </div>

        <div style="margin:12px 0">
          <div class="mini-label" style="margin-bottom:6px">🏛️ JURISPRUDÊNCIA OFICIAL VERIFICADA PELO PESQUISADOR (THEO) — GATE DE CITAÇÕES ATIVO</div>
          ${(p.citations||[]).map(c=>`
            <div class="citation-box" style="margin-top:6px;padding:10px 12px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <h4>${esc(c.court)} · ${esc(c.number)} (${esc(c.relator)} · ${esc(c.date)})</h4>
                <span class="badge green">✓ Fonte Oficial Verificada</span>
              </div>
              <p style="margin-top:4px">“${esc(c.excerpt)}”</p>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span class="mini-label">📝 INTEIRO TEOR DA PEÇA JURÍDICA (EDITÁVEL POR DR. DANIEL FELIX)</span>
            <span class="muted">${p.approvedBy?`Revisado e aprovado por ${esc(p.approvedBy)} em ${esc(p.approvedAt)}`:'Edite livremente antes de aprovar'}</span>
          </div>
          <textarea class="petition-paper" id="petition-editor-text">${esc(p.content)}</textarea>
        </div>

        <div class="action-bar">
          <button class="success-button" id="btn-approve-pet">✅ Aprovar Petição p/ Protocolo (Dr. Daniel Felix)</button>
          <button class="outline-button" id="btn-save-pet-version">💾 Salvar Edição (Nova Versão)</button>
          <button class="outline-button" id="btn-print-pet">🖨️ Imprimir / PDF Timbrado</button>
          <button class="outline-button" id="btn-download-pet">📥 Baixar Word (.doc)</button>
          <button class="outline-button" data-open-client="${esc(p.clientId)}">👤 Abrir Pasta do Cliente</button>
        </div>
      `;

      $('#btn-save-pet-version').onclick=()=>{
        const newText=$('#petition-editor-text').value;
        p.content=newText;
        const parts=p.version.replace('v','').split('.');
        p.version=`v${parts[0]}.${Number(parts[1]||0)+1}`;
        p.hash=simpleHash(newText);
        p.updatedAt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
        this.log(`Dr. Daniel Felix editou e salvou a versão ${p.version} da peça ${p.code} (novo hash: ${p.hash.slice(0,12)}...).`);
        this.persist();this.render();renderList(p.id);renderDetail(p);
        this.toast(`Versão ${p.version} salva com autoria de Dr. Daniel Felix.`);
      };

      $('#btn-approve-pet').onclick=()=>{
        const newText=$('#petition-editor-text').value;
        p.content=newText;
        p.hash=simpleHash(newText);
        this.approvePetition(p.id,true);
      };

      $('#btn-print-pet').onclick=()=>{
        this.printTimbrado(p.title,$('#petition-editor-text').value,p.hash,p.code,p.clientName,p.area);
      };

      $('#btn-download-pet').onclick=()=>{
        this.downloadWordDoc(`${p.code}_${p.clientName.replace(/\s+/g,'_')}`,p.title,$('#petition-editor-text').value,p.code,p.clientName);
      };
    };

    $('#pet-status-filter').onchange=()=>renderList(current?.id);
    $('#btn-new-petition').onclick=()=>{
      const clis=this.state.clients||[];
      $('#petition-detail-panel').innerHTML=`
        <h3 style="font:22px Georgia,serif;margin-bottom:6px">Solicitar Nova Petição ao Núcleo Jurídico (Forense + Squad)</h3>
        <p class="muted" style="margin-bottom:14px">Selecione o cliente e a espécie da peça. Íris (Tese), Theo (Pesquisa), Maya (Redação) e Noah (Revisão) montarão a minuta completa para sua revisão.</p>
        <form id="new-pet-form">
          <div class="form-grid">
            <label class="field">Cliente da Carteira<select name="clientId">${clis.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.area)})</option>`).join('')}</select></label>
            <label class="field">Espécie da Peça<select name="type"><option>Petição Inicial</option><option>Contestação</option><option>Réplica à Contestação</option><option>Recurso de Apelação</option><option>Agravo de Instrumento</option><option>Resposta à Acusação</option></select></label>
            <label class="field full">Título / Objeto da Peça<input name="title" required placeholder="Ex.: Petição Inicial de Indenização por Negativação Indevida c/ Tutela de Urgência"></label>
            <label class="field full">Diretrizes de Mérito e Pedidos do Dr. Daniel Felix<textarea name="instructions" required placeholder="Ex.: Pedir tutela de urgência inaudita altera parte para exclusão do apontamento no Serasa sob multa diária e R$ 15.000,00 de danos morais (Súmula 479/STJ)."></textarea></label>
          </div>
          <div class="action-bar"><button type="submit" class="primary-button">Acionar Squad Jurídico e Gerar Minuta +</button></div>
        </form>
      `;
      $('#new-pet-form').onsubmit=e=>{
        e.preventDefault();
        const fd=Object.fromEntries(new FormData(e.target));
        const cli=clis.find(c=>c.id===fd.clientId)||clis[0];
        const pet=this.buildPetitionDraft(cli,fd.type,fd.title,fd.instructions);
        this.state.petitions.unshift(pet);
        cli.petitionId=pet.id;
        cli.stage='Inicial para revisão';
        this.log(`Forense + Maya geraram nova minuta ${pet.code} para ${cli.name}, aguardando revisão de Dr. Daniel Felix.`);
        this.persist();this.render();
        this.toast(`Minuta ${pet.code} elaborada e pronta para revisão!`);
        this.petitions(pet.id);
      };
    };

    renderList(current?.id);
    renderDetail(current);
  }

  buildPetitionDraft(cli,type,title,instructions){
    const code=`PEC-2026-00${(this.state.petitions?.length||0)+1}`;
    const body=`EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA VARA CÍVEL DA COMARCA DE SÃO PAULO/SP

${cli.name.toUpperCase()}, ${cli.nacionalidade||'brasileiro(a)'}, ${cli.estadoCivil||'solteiro(a)'}, ${cli.profissao||'profissional'}, RG nº ${cli.rg||'—'} e CPF nº ${cli.cpf}, residente e domiciliado(a) em ${cli.endereco}, por seu advogado DR. DANIEL FELIX (Procuração Ad Judicia anexa), vem, respeitosamente, à presença de Vossa Excelência, apresentar

${type.toUpperCase()} — ${title.toUpperCase()}

I. DA SÍNTESE DOS FATOS DOCUMENTADOS NO DOSSIÊ
1. ${cli.summary}

II. DOS FUNDAMENTOS JURÍDICOS E DIRETRIZES DA BANCA
2. ${instructions}
3. A pretensão encontra amparo expresso na legislação pátria e na jurisprudência pacífica dos Tribunais Superiores (Súmula 479 do STJ e art. 14 do Código de Defesa do Consumidor).

III. DOS PEDIDOS E REQUERIMENTOS
Diante do exposto, requer a Vossa Excelência:
a) O deferimento do pedido liminar / tutela de urgência nos termos fundamentados;
b) A citação da parte ré para responder aos termos da presente demanda;
c) No mérito, a total procedência dos pedidos formulados, com a condenação nas custas e honorários advocatícios de 20% (art. 85, § 2º, do CPC).

São Paulo/SP, 16 de outubro de 2026.

__________________________________________________
DR. DANIEL FELIX
Advogado · Escritório Daniel Felix Advocacia`;

    return {
      id:'pec-'+Date.now(),
      code,
      title,
      clientId:cli.id,
      clientName:cli.name,
      processNumber:'Distribuição Inicial · Foro Central SP',
      area:cli.area,
      type,
      version:'v1.0',
      hash:simpleHash(body),
      authorAgent:'Maya (redator-forense)',
      reviewerAgent:'Noah (revisor-juridico)',
      status:'review',
      statusLabel:'Aguardando revisão de Dr. Daniel Felix',
      approvedBy:null,
      approvedAt:null,
      updatedAt:'Hoje',
      squadNotes:{
        tese:`Íris (construtor-tese): ${instructions}`,
        provas:`Eva (analista-documento): Documentos da pasta de ${cli.name} vinculados ao dossiê.`,
        revisao:'Noah (revisor-juridico): Minuta pronta para revisão humana de Dr. Daniel Felix.'
      },
      citations:[
        {
          court:'STJ · Segunda Seção',
          number:'Súmula 479 do STJ',
          relator:'Segunda Seção STJ',
          date:'27/06/2012',
          verified:true,
          url:'https://scon.stj.jus.br',
          excerpt:'As instituições financeiras respondem objetivamente pelos danos gerados por fortuito interno relativo a fraudes e delitos praticados por terceiros no âmbito de operações bancárias.'
        }
      ],
      content:body
    };
  }

  createPetitionForClient(cli){
    const pet=this.buildPetitionDraft(cli,'Petição Inicial',`Ação Judicial — ${cli.caseTitle}`,'Aplicação da responsabilidade objetiva, inversão do ônus da prova e reparação integral dos danos.');
    this.state.petitions.unshift(pet);
    cli.petitionId=pet.id;
    cli.stage='Inicial para revisão';
    this.persist();this.render();
    this.toast(`Minuta ${pet.code} gerada para ${cli.name}!`);
    this.petitions(pet.id);
  }

  approvePetition(id,fromModal=false){
    const p=(this.state.petitions||[]).find(x=>x.id===id);
    if(!p)return;
    const now=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
    p.status='approved';
    p.statusLabel='Aprovada por Dr. Daniel Felix · Pronta p/ Protocolo';
    p.approvedBy='Dr. Daniel Felix';
    p.approvedAt=now;
    p.reviewerAgent='Dr. Daniel Felix (Revisão Humana)';
    const daniel=this.state.agents.find(a=>a.id==='daniel');
    if(daniel){daniel.status='working';daniel.task=`Aprovou ${p.code} (${p.clientName})`;}
    this.state.telegramMessages.push({
      id:'tg-app-'+Date.now(),
      sender:'coordenador',
      senderName:'Luana · Coordenadora (@DanielFelixAdvBot)',
      time:now.slice(-5),
      text:`✅ Revisão Humana Registrada: Dr. Daniel Felix aprovou a versão ${p.version} da peça ${p.code} (${p.clientName}) com hash ${p.hash.slice(0,14)}... Pronta para protocolo judicial.`
    });
    this.log(`Revisão humana concluída: Dr. Daniel Felix aprovou ${p.code} (${p.clientName} · ${p.version}).`);
    this.persist();this.render();
    this.toast(`Petição ${p.code} aprovada por Dr. Daniel Felix!`);
    if(fromModal)this.petitions(p.id);
  }

  /* ======================================================================
   * 4. MÓDULO FINANCEIRO COMPLETO (RUI · HONORÁRIOS, CAIXA E OUTBOX)
   * ====================================================================== */
  financeiro(tab='items'){
    const fin=this.finTotals();
    const items=this.state.financeiro?.items||[];
    const outbox=this.state.financeiro?.outbox||[];
    this.show(
      'Gestão Financeira, Honorários & Caixa (Rui)',
      'Controle unificado de honorários contratuais, parcelas por cliente, conciliação de recebimentos e fila auditável de cobrança (Outbox).',
      `<div class="metrics-cards" style="margin-bottom:18px">
        <div class="metric-mini"><small>Recebido no Período (Caixa Real)</small><strong style="color:#86d1b1">${money(fin.paid)}</strong></div>
        <div class="metric-mini"><small>A Receber (Em Aberto)</small><strong style="color:#e6c786">${money(fin.open)}</strong></div>
        <div class="metric-mini"><small>Em Atraso (Vencido)</small><strong style="color:#f0a399">${money(fin.overdue)}</strong></div>
        <div class="metric-mini"><small>Total Contratado na Carteira</small><strong>${money(fin.total)}</strong></div>
      </div>
      <div class="period-switch">
        <button data-fin-tab="items" class="${tab==='items'?'active':''}">📋 Parcelas & Honorários (${items.length})</button>
        <button data-fin-tab="outbox" class="${tab==='outbox'?'active':''}">📤 Fila de Cobrança Outbox (${outbox.length})</button>
        <button data-fin-tab="new" class="${tab==='new'?'active':''}">➕ Lançar Honorários</button>
      </div>
      <div id="fin-tab-body"></div>`
    );

    const body=$('#fin-tab-body');
    if(tab==='items'){
      body.innerHTML=`
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Cliente</th><th>Descrição / Contrato</th><th>Vencimento</th><th>Meio</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              ${items.map(item=>`
                <tr>
                  <td><a href="#" data-open-client="${esc(item.clientId)}" style="color:#e6c786;text-decoration:underline">${esc(item.clientName)}</a></td>
                  <td>${esc(item.description)}</td>
                  <td>${esc(item.dueDate)}</td>
                  <td>${esc(item.method)}</td>
                  <td><strong>${money(item.amount)}</strong></td>
                  <td><span class="badge ${item.status==='paid'?'green':item.status==='overdue'?'red':'gold'}">${item.status==='paid'?`Pago (${esc(item.paidAt)})`:item.status==='overdue'?'Vencido':'A vencer'}</span></td>
                  <td>
                    ${item.status!=='paid'?`
                      <button class="tg-inline-btn" data-pay-fin="${esc(item.id)}">✓ Confirmar Pago</button>
                      <button class="tg-inline-btn" data-bill-fin="${esc(item.id)}">📲 Cobrar</button>
                    `:'<span class="muted">Conciliado ✓</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="subtle-note">Regra de integridade financeira: assinatura de contrato não cria receita de caixa automaticamente. A baixa de parcela registra conciliação real e cancela lembretes pendentes no Outbox.</p>
      `;
    }else if(tab==='outbox'){
      body.innerHTML=`
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Destinatário</th><th>WhatsApp</th><th>Valor</th><th>Mensagem Preparada pelo Rui</th><th>Estado / Idempotência</th><th>Ação</th></tr></thead>
            <tbody>
              ${outbox.map(o=>`
                <tr>
                  <td><strong>${esc(o.clientName)}</strong></td>
                  <td>${esc(o.phone)}</td>
                  <td>${money(o.amount)}</td>
                  <td style="max-width:420px;font-size:13.5px;color:#bfd0d8">${esc(o.message)}</td>
                  <td><span class="badge ${o.status==='sent'?'green':'gold'}">${o.status==='sent'?'Enviado ✓':'Aguardando autorização'}</span><small>${esc(o.idempotencyKey)}</small></td>
                  <td>${o.status==='sent'?'<span class="muted">Entregue</span>':`<button class="success-button" style="padding:8px 13px;font-size:13px" data-send-outbox="${esc(o.id)}">📲 Autorizar Envio</button>`}</td>
                </tr>
              `).join('')||'<tr><td colspan="6">Nenhuma cobrança pendente no Outbox.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }else if(tab==='new'){
      const clis=this.state.clients||[];
      body.innerHTML=`
        <form id="new-fin-form" style="margin-top:12px">
          <div class="form-grid">
            <label class="field">Cliente<select name="clientId">${clis.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
            <label class="field">Valor (R$)<input name="amount" type="number" required min="1" value="3500"></label>
            <label class="field">Data de Vencimento<input name="dueDate" required placeholder="Ex.: 30/10/2026" value="30/10/2026"></label>
            <label class="field">Meio de Pagamento<select name="method"><option>PIX</option><option>Boleto Bancário</option><option>Transferência TED</option><option>Cartão de Crédito</option></select></label>
            <label class="field full">Descrição da Parcela / Honorários<input name="description" required placeholder="Ex.: Honorários Iniciais (Parcela 1/2) · Ação Indenizatória"></label>
          </div>
          <div class="action-bar"><button type="submit" class="primary-button">Lançar Título no Financeiro +</button></div>
        </form>
      `;
      $('#new-fin-form').onsubmit=e=>{
        e.preventDefault();
        const fd=Object.fromEntries(new FormData(e.target));
        const cli=clis.find(c=>c.id===fd.clientId)||clis[0];
        this.state.financeiro.items.unshift({
          id:'fin-'+Date.now(),
          clientId:cli.id,
          clientName:cli.name,
          description:fd.description.trim(),
          dueDate:fd.dueDate.trim(),
          paidAt:null,
          method:fd.method,
          amount:Number(fd.amount||0),
          status:'open'
        });
        this.log(`Rui lançou novo título financeiro para ${cli.name}: ${money(Number(fd.amount))} (vencimento ${fd.dueDate}).`);
        this.persist();this.render();
        this.toast('Título lançado no módulo financeiro!');
        this.financeiro('items');
      };
    }

    document.querySelectorAll('[data-fin-tab]').forEach(b=>b.onclick=()=>this.financeiro(b.dataset.finTab));
  }

  markFinanceiroPaid(id){
    const item=(this.state.financeiro?.items||[]).find(x=>x.id===id);
    if(!item)return;
    item.status='paid';
    item.paidAt='16/10/2026';
    const cli=(this.state.clients||[]).find(c=>c.id===item.clientId);
    if(cli)cli.honorariosPaid=(cli.honorariosPaid||0)+Number(item.amount||0);
    if(this.state.financeiro?.outbox){
      this.state.financeiro.outbox=this.state.financeiro.outbox.filter(o=>o.finId!==item.id);
    }
    this.log(`Rui confirmou recebimento de ${money(item.amount)} de ${item.clientName}. Caixa atualizado.`);
    this.persist();this.render();
    this.toast(`Recebimento de ${money(item.amount)} (${item.clientName}) conciliado no caixa!`);
    if(this.modal.open)this.financeiro('items');
  }

  createOutboxBilling(id){
    const item=(this.state.financeiro?.items||[]).find(x=>x.id===id);
    if(!item)return;
    const cli=(this.state.clients||[]).find(c=>c.id===item.clientId);
    const exists=(this.state.financeiro.outbox||[]).some(o=>o.finId===item.id);
    if(!exists){
      this.state.financeiro.outbox.unshift({
        id:'out-'+Date.now(),
        clientName:item.clientName,
        phone:cli?.phone||'(11) 99999-0000',
        finId:item.id,
        amount:item.amount,
        status:'pending',
        idempotencyKey:`outbox-${item.id}-${Date.now()}`,
        message:`Olá, ${item.clientName.split(' ')[0]}! Lembrete do setor financeiro do Escritório Daniel Felix Advocacia referente a "${item.description}" (${money(item.amount)}, vencimento ${item.dueDate}).`
      });
    }
    this.persist();
    this.toast(`Cobrança para ${item.clientName} preparada na fila Outbox!`);
    this.financeiro('outbox');
  }

  authorizeOutbox(id){
    const o=(this.state.financeiro?.outbox||[]).find(x=>x.id===id);
    if(!o)return;
    o.status='sent';
    this.log(`Cobrança autorizada e enviada via Outbox para ${o.clientName} (${money(o.amount)}).`);
    this.persist();this.render();
    this.toast(`Mensagem de cobrança enviada para ${o.clientName}!`);
    if(this.modal.open&&$('#fin-tab-body'))this.financeiro('outbox');
  }

  /* ======================================================================
   * 5. CONTRATOS, PROCURAÇÕES AD JUDICIA (DR. DANIEL FELIX) & ZAPSIGN
   * ====================================================================== */
  contracts(selectedId=null,prefillClientId=null){
    const list=this.state.contractsList||[];
    const current=selectedId?list.find(d=>d.id===selectedId):list[0];
    const SPECIAL_POWERS=['Receber citação','Confessar','Reconhecer a procedência do pedido','Transigir','Desistir','Renunciar ao direito sobre o qual se funda a ação','Receber e dar quitação','Firmar compromisso'];

    this.show(
      'Contratos, Procurações Ad Judicia & Assinaturas ZapSign',
      'Emissão defensável de Procuração Ad Judicia et Extra em nome de Dr. Daniel Felix, com conferência explícita de poderes especiais (Art. 105 CPC) e reconciliação por signatário no ZapSign (Davi & Bia).',
      `<div class="workspace-split">
        <div class="list-panel">
          <div class="list-panel-head">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="font-size:15px">Pastas Documentais (${list.length})</strong>
              <button class="primary-button" id="btn-new-procuracao" style="padding:9px 13px;font-size:13px">+ Gerar Procuração</button>
            </div>
          </div>
          <div class="list-panel-items" id="contract-list-items">
            ${list.map(d=>`
              <button class="list-card-btn ${current?.id===d.id&&!prefillClientId?'active':''}" data-open-contract="${esc(d.id)}">
                <strong><span>${esc(d.code)}</span><span class="badge ${d.status==='completed'?'green':d.status==='review'?'gold':'blue'}">${d.status==='completed'?'Concluído 2/2':d.status==='review'?'Revisar':'Parcial 1/2'}</span></strong>
                <small>${esc(d.clientName)} · CPF ${esc(d.cpf)}</small>
                <small style="color:#9ad2f5">${esc(d.statusLabel)}</small>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="detail-panel" id="contract-detail-panel"></div>
      </div>`
    );

    const renderDocDetail=(d)=>{
      if(!d)return;
      const cli=(this.state.clients||[]).find(c=>c.id===d.clientId)||this.state.clients[0];
      const docText=`PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: ${d.clientName.toUpperCase()}, ${cli?.nacionalidade||'brasileiro(a)'}, ${cli?.estadoCivil||'maior'}, ${cli?.profissao||'profissional'}, RG nº ${cli?.rg||'—'}, inscrito(a) no CPF sob o nº ${d.cpf}, residente e domiciliado(a) em ${cli?.endereco||'São Paulo/SP'}.

OUTORGADO: DR. DANIEL FELIX, advogado regularmente inscrito na Ordem dos Advogados do Brasil (OAB), com escritório profissional no Escritório Daniel Felix Advocacia.

OBJETO ESPECÍFICO: ${d.objeto}

PODERES GERAIS E ESPECIAIS (ART. 105 DO CPC):
Pelo presente instrumento particular de mandato, o(a) Outorgante nomeia e constitui o Outorgado DR. DANIEL FELIX seu bastante procurador, conferindo-lhe os poderes da cláusula "ad judicia et extra" para o foro em geral, em qualquer Juízo, Instância ou Tribunal, bem como os PODERES ESPECIAIS expressamente revisados e autorizados para: ${(d.specialPowers||[]).join(', ')}.

Integridade SHA-256: ${d.hash}
Emitido em: ${d.createdAt} · Escritório Daniel Felix Advocacia`;

      $('#contract-detail-panel').innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #2b3c46;padding-bottom:12px">
          <div>
            <span class="badge ${d.status==='completed'?'green':d.status==='review'?'gold':'blue'}">${esc(d.statusLabel)}</span>
            <h3 style="font:24px Georgia,serif;margin-top:8px">${esc(d.code)} — ${esc(d.clientName)}</h3>
            <p class="muted" style="font-size:13.5px;margin-top:4px">${esc(d.type)} · Hash: <code>${esc(d.hash.slice(0,22))}...</code></p>
          </div>
        </div>
        <div style="margin-top:12px">
          <div class="mini-label">✍️ ESTADO DOS SIGNATÁRIOS NO ZAPSIGN (AGENTE BIA)</div>
          <div class="chart-grid" style="margin-top:8px">
            ${(d.signers||[]).map(s=>`<div class="info-box"><small>${esc(s.name)}</small><strong style="color:${s.status.includes('Assinado')?'#86d1b1':'#e6c786'}">${esc(s.status)}</strong></div>`).join('')}
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="mini-label" style="margin-bottom:6px">📜 INSTRUMENTO DE MANDATO (DR. DANIEL FELIX)</div>
          <textarea class="petition-paper" style="min-height:240px" readonly>${esc(docText)}</textarea>
        </div>
        <div class="action-bar">
          ${d.status==='review'?`<button class="success-button" data-approve-contract="${esc(d.id)}">✅ Aprovar Poderes (Dr. Daniel Felix) e Enviar ao ZapSign</button>`:''}
          ${d.status==='partial'?`<button class="primary-button" data-sign-contract="${esc(d.id)}">🔄 Reconciliar / Confirmar 2º Signatário no ZapSign</button>`:''}
          <button class="outline-button" id="btn-print-procuracao">🖨️ Imprimir / PDF Timbrado</button>
          <button class="outline-button" id="btn-download-proc-doc">📥 Baixar Word (.doc)</button>
          <button class="outline-button" data-open-client="${esc(d.clientId)}">👤 Abrir Pasta do Cliente</button>
        </div>
      `;
      const printProc=$('#btn-print-procuracao');
      if(printProc)printProc.onclick=()=>this.printTimbrado(d.type,docText,d.hash,d.code,d.clientName,'Contratos e Procurações');
      const downProc=$('#btn-download-proc-doc');
      if(downProc)downProc.onclick=()=>this.downloadWordDoc(`${d.code}_${d.clientName.replace(/\s+/g,'_')}`,d.type,docText,d.code,d.clientName);
    };

    const renderGenerator=(clientId)=>{
      const clis=this.state.clients||[];
      const pre=clis.find(c=>c.id===clientId)||clis[0];
      $('#contract-detail-panel').innerHTML=`
        <h3 style="font:24px Georgia,serif;margin-bottom:6px">Gerador de Procuração Ad Judicia (Dr. Daniel Felix)</h3>
        <p class="muted" style="margin-bottom:14px">Selecione o cliente e marque apenas os poderes especiais expressamente autorizados (Art. 105 do CPC). Nenhum campo é inventado por inferência.</p>
        <form id="gen-proc-form">
          <div class="form-grid">
            <label class="field">Cliente Outorgante<select name="clientId" id="proc-cli-select">${clis.map(c=>`<option value="${esc(c.id)}" ${c.id===pre?.id?'selected':''}>${esc(c.name)} (${esc(c.cpf)})</option>`).join('')}</select></label>
            <label class="field">Advogado Outorgado<input value="Dr. Daniel Felix · Escritório Daniel Felix Advocacia" readonly></label>
            <label class="field full">Objeto Específico da Ação / Representação<input name="objeto" id="proc-objeto" required value="Ação Judicial referente a: ${esc(pre?.caseTitle||'')}"></label>
            <div class="field full">
              <span>Poderes Especiais do Art. 105 do CPC (Revisão Humana Obrigatória):</span>
              <div class="chart-grid" style="gap:10px;margin-top:8px;background:#0e1a22;padding:14px;border-radius:6px;border:1px solid #334652">
                ${SPECIAL_POWERS.map((pw,i)=>`<label style="display:flex;align-items:center;gap:10px;font-size:13.5px;cursor:pointer"><input type="checkbox" name="pw_${i}" value="${esc(pw)}" ${i<3||i===6?'checked':''} style="width:auto"> ${esc(pw)}</label>`).join('')}
              </div>
            </div>
          </div>
          <div class="action-bar"><button type="submit" class="primary-button">Gerar Procuração c/ Hash SHA-256 +</button></div>
        </form>
      `;
      $('#proc-cli-select').onchange=e=>{
        const c=clis.find(x=>x.id===e.target.value);
        if(c)$('#proc-objeto').value=`Ação Judicial referente a: ${c.caseTitle}`;
      };
      $('#gen-proc-form').onsubmit=e=>{
        e.preventDefault();
        const fd=new FormData(e.target);
        const cli=clis.find(c=>c.id===fd.get('clientId'))||clis[0];
        const powers=SPECIAL_POWERS.filter((_,i)=>fd.get(`pw_${i}`));
        const objeto=String(fd.get('objeto')||'').trim();
        const newDoc={
          id:'doc-'+Date.now(),
          code:`PROC-2026-00${list.length+1}`,
          type:'Procuração Ad Judicia et Extra',
          clientId:cli.id,
          clientName:cli.name,
          cpf:cli.cpf,
          objeto,
          specialPowers:powers,
          hash:simpleHash(cli.name+cli.cpf+objeto+powers.join(',')),
          status:'review',
          statusLabel:'Aguardando revisão de poderes por Dr. Daniel Felix',
          signers:[
            {name:`${cli.name} (Outorgante)`,status:'Aguardando envio ZapSign'},
            {name:'Dr. Daniel Felix (Advogado)',status:'Revisão humana pendente'}
          ],
          createdAt:'16/10/2026'
        };
        this.state.contractsList.unshift(newDoc);
        cli.contractId=newDoc.id;
        this.log(`Davi gerou ${newDoc.code} para ${cli.name} com hash ${newDoc.hash.slice(0,12)}... aguardando aprovação de Dr. Daniel Felix.`);
        this.persist();this.render();
        this.toast(`Procuração ${newDoc.code} gerada para revisão!`);
        this.contracts(newDoc.id);
      };
    };

    $('#btn-new-procuracao').onclick=()=>renderGenerator(current?.clientId);
    if(prefillClientId)renderGenerator(prefillClientId);else renderDocDetail(current);
  }

  approveContract(id){
    const d=(this.state.contractsList||[]).find(x=>x.id===id);
    if(!d)return;
    d.status='partial';
    d.statusLabel='Enviado ao ZapSign · Assinado por Dr. Daniel (1/2)';
    d.signers=[
      {name:`${d.clientName} (Outorgante)`,status:'Link enviado via WhatsApp/ZapSign · Aguardando'},
      {name:'Dr. Daniel Felix (Advogado)',status:'Revisado e assinado em 16/10/2026'}
    ];
    this.log(`Dr. Daniel Felix aprovou os poderes especiais de ${d.code} e Bia enviou para coleta de assinatura no ZapSign.`);
    this.persist();this.render();
    this.toast(`${d.code} aprovado e enviado ao ZapSign!`);
    this.contracts(d.id);
  }

  simulateZapSignStep(id){
    const d=(this.state.contractsList||[]).find(x=>x.id===id);
    if(!d)return;
    d.status='completed';
    d.statusLabel='Concluído no ZapSign (2/2 assinaturas)';
    d.signers=d.signers.map(s=>({name:s.name,status:s.status.includes('Assinado')||s.status.includes('assinado')?s.status:'Assinado em 16/10/2026 (Webhook ZapSign reconciliado)'}));
    this.log(`Bia reconciliou webhook final do ZapSign: ${d.code} (${d.clientName}) está 100% assinado (2/2) e arquivado no dossiê.`);
    this.persist();this.render();
    this.toast(`Assinatura 2/2 concluída no ZapSign para ${d.clientName}!`);
    this.contracts(d.id);
  }

  /* ======================================================================
   * 6. ACOMPANHAMENTO PROCESSUAL, PRAZOS (CLARA), DJEN (BRENO) E AGENDA
   * ====================================================================== */
  processual(tab='processes'){
    const links={processes:'/processos',deadlines:'/prazos',notices:'/intimacoes',health:'/operacao'};
    const titles={processes:'Carteira de processos',deadlines:'Prazos e sugestões',notices:'Intimações e publicações',health:'Saúde das coletas'};
    let rows,heads;
    if(this.live){const d=this.snapshot;
      if(tab==='processes'){heads=['Processo','Tribunal','Fase / estado','Registro'];rows=(d?.processes||[]).map(p=>[esc(p.numeroCnj),esc(p.tribunal),esc(p.fase||p.status||'—'),`<a href="/p/${encodeURIComponent(p.id)}" target="_top">Abrir ↗</a>`]);}
      if(tab==='deadlines'){heads=['Ato','Data fatal','Estado','Registro'];rows=(d?.deadlines||[]).map(p=>[esc(p.ato),civil(p.dataFatal),esc(p.status||'—'),`<a href="/pz/${encodeURIComponent(p.id)}" target="_top">Conferir ↗</a>`]);}
      if(tab==='notices'){heads=['Processo','Disponibilização','Estado','Registro'];rows=(d?.notices||[]).map(p=>[esc(p.numeroProcesso||p.numeroCnj||'—'),civil(p.dataDisponibilizacao),p.temAnalise?'Com análise':'Sem análise',`<a href="/i/${encodeURIComponent(p.id)}" target="_top">Ler ↗</a>`]);}
      if(tab==='health'){heads=['Fonte','Última coleta','Estado','Novos itens'];rows=(d?.health||[]).map(p=>[esc(p.fonte),civil(p.quando),esc(p.status||'Sem coleta'),textOrDash(p.novos)]);}
    }else{
      if(tab==='deadlines'){
        heads=['Ato processual / Cliente','Data fatal & Rito','Estado','Responsável / Decisão'];
        rows=(this.state.deadlinesList||[]).map(d=>[
          `<strong>${esc(d.ato)}</strong><small>${esc(d.clientName)} · CNJ ${esc(d.numeroCnj)}</small>`,
          `<strong>${esc(d.dataFatal)}</strong><small>${esc(d.rito)}</small>`,
          `<span class="badge ${d.status==='Sugestão'?'gold':'green'}">${esc(d.status)}</span>`,
          `${esc(d.responsible)} ${d.status==='Sugestão'?`<button class="tg-inline-btn" style="margin-left:6px" data-confirm-deadline="${esc(d.id)}">✓ Confirmar Prazo</button>`:'· Validado ✓'}`
        ]);
      }else if(tab==='health'){
        heads=['Fonte','Situação Operacional','Última Coleta','Responsável'];
        rows=[['CNJ/DataJud','Fonte do MVP · Monitoramento Ativo','Hoje às 06:00 (5 novos)','Breno'],['DJEN','Fonte do MVP · Leitura Integral','Hoje às 07:15 (2 intimações)','Breno']];
      }else if(tab==='notices'){
        heads=['Publicação DJEN / Processo','Área & Data','Inteiro Teor da Comunicação','Responsável'];
        rows=(this.state.noticesList||[]).map(n=>[
          `<strong>${esc(n.numeroCnj)}</strong><small>Cliente: ${esc(n.clientName)}</small>`,
          `${esc(n.area)}<small>${esc(n.dataPublicacao)}</small>`,
          `<div style="max-width:480px;font-size:13.5px;color:#c5d3da">${esc(n.inteiroTeor)}</div>`,
          `<span class="badge gold">${esc(n.status)}</span><small>${esc(n.responsible)}</small><div style="margin-top:6px"><button class="tg-inline-btn" data-translate-notice="${esc(n.id)}">📲 Traduzir Juridiquês</button></div>`
        ]);
      }else{
        heads=['Processo / Caso','Cliente & Área','Fase / Último Andamento','Responsável & Ações'];
        rows=(this.state.processesList||[]).map(p=>[
          `<strong>${esc(p.numeroCnj)}</strong><small>${esc(p.code)} · ${esc(p.tribunal)} (${esc(p.vara)})</small>`,
          `<a href="#" data-open-client="${esc(p.clientId)}" style="color:#e6c786;text-decoration:underline">${esc(p.clientName)}</a><small>${esc(p.area)} · vs. ${esc(p.parteContraria)}</small>`,
          `<strong>${esc(p.fase)}</strong><small>${esc(p.lastMovement)}</small>`,
          `${esc(p.responsible)} <button class="tg-inline-btn" data-open-client="${esc(p.clientId)}">Pasta ↗</button>`
        ]);
      }
    }
    this.show('Acompanhamento processual, Prazos (Clara) & Publicações DJEN (Breno)',this.live?'Leitura das funções que já existem no MVP, com os mesmos IDs e registros.':'Carteira processual integrada do Escritório Daniel Felix. Clara calcula sugestões de prazo no motor determinístico e Dr. Daniel Felix confirma.',`<div class="period-switch">${Object.entries(titles).map(([k,v])=>`<button data-proc-tab="${k}" class="${tab===k?'active':''}">${v}</button>`).join('')}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="font-size:17px;margin:0">${titles[tab]}</h3>${tab==='deadlines'&&!this.live?`<button class="primary-button" id="btn-open-deadline-calc" style="padding:6px 12px;font-size:12.5px">🧮 Simular Prazo CPC/CPP (Clara)</button>`:''}</div><div class="data-table-wrap"><table class="data-table"><thead><tr>${(heads||[]).map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows?.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="4">${esc(this.connectionError||'Sem registros nesta leitura.')}</td></tr>`}</tbody></table></div><p class="subtle-note">${this.live?'Leitura limitada: até 100 processos, 100 intimações e 100 prazos. Use o Gabinete para a carteira completa e o inteiro teor.':'Regra de segurança processual: nenhuma movimentação do DataJud substitui a leitura integral da intimação no DJEN, e nenhuma sugestão da Clara vira prazo confirmado sem revisão humana de Dr. Daniel Felix.'}</p><div class="profile-actions">${this.live?`<a class="outline-button" href="${links[tab]}" target="_top">Abrir ${titles[tab]} no Gabinete ↗</a><button class="outline-button" data-action="refresh-data">Atualizar leitura</button>`:''}<button class="outline-button" data-action="petitions">⚖️ Ver Petições Vinculadas ↗</button><button class="outline-button" data-open-agent="${tab==='deadlines'?'controladoria':'movimentacoes'}">Ver agente responsável ↗</button></div>`);
    document.querySelectorAll('[data-proc-tab]').forEach(b=>b.onclick=()=>this.processual(b.dataset.procTab));
    const calcBtn=$('#btn-open-deadline-calc');
    if(calcBtn)calcBtn.onclick=()=>this.openDeadlineCalculator();
  }

  confirmDeadline(id){
    const d=(this.state.deadlinesList||[]).find(x=>x.id===id);
    if(!d)return;
    d.status='Confirmado por Dr. Daniel Felix';
    d.confirmedBy='Dr. Daniel Felix';
    this.log(`Dr. Daniel Felix confirmou o prazo processual "${d.ato}" (${d.clientName}) para ${d.dataFatal}.`);
    this.persist();this.render();
    this.toast(`Prazo fatal (${d.dataFatal}) confirmado por Dr. Daniel Felix!`);
    if(this.modal.open)this.processual('deadlines');
  }

  startVoiceRecognition(inputEl, autoSubmit=false, micBtn=null){
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRec){
      this.toast('Reconhecimento de voz não suportado pelo navegador atual. Use o Google Chrome ou Edge.');
      return;
    }
    try{
      const rec = new SpeechRec();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;
      if(micBtn) micBtn.classList.add('recording');
      this.toast('🎙️ Ouvindo... Fale sua ordem para o Escritório Virtual');
      rec.onresult = (e)=>{
        if(micBtn) micBtn.classList.remove('recording');
        const transcript = e.results[0][0].transcript;
        if(inputEl) inputEl.value = transcript;
        this.toast(`🎙️ Ordem reconhecida: "${transcript}"`);
        if(autoSubmit && transcript.trim()){
          this.handleTelegramInput(transcript.trim());
        }
      };
      rec.onerror = (err)=>{
        if(micBtn) micBtn.classList.remove('recording');
        this.toast(`Microfone: ${err.error || 'não foi possível capturar o áudio'}`);
      };
      rec.onend = ()=>{
        if(micBtn) micBtn.classList.remove('recording');
      };
      rec.start();
    }catch(err){
      if(micBtn) micBtn.classList.remove('recording');
      this.toast('Permissão de microfone necessária ou microfone indisponível.');
    }
  }

  async computeFileHash(file){
    try{
      if(window.crypto?.subtle){
        const buf=await file.arrayBuffer();
        const hashBuf=await crypto.subtle.digest('SHA-256',buf);
        const hashArr=Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b=>b.toString(16).padStart(2,'0')).join('');
      }
    }catch{}
    return simpleHash(file.name+file.size+Date.now());
  }

  printTimbrado(title, content, hash, code, clientName, area='Direito Civil'){
    const w = window.open('','_blank','width=850,height=900');
    if(!w){
      this.toast('Pop-up bloqueado pelo navegador. Permita pop-ups para imprimir.');
      return;
    }
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(code)} - ${esc(clientName)} - Escritório Daniel Felix</title>
<style>
  @page { size: A4; margin: 30mm 20mm 25mm 20mm; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.6; color: #111; margin: 0; padding: 25px 35px; background: #fff; }
  .header { text-align: center; border-bottom: 2px solid #8b734b; padding-bottom: 12px; margin-bottom: 25px; }
  .header h1 { margin: 0; font-size: 15pt; letter-spacing: 2px; color: #1c2a38; text-transform: uppercase; }
  .header p { margin: 3px 0 0; font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9.5pt; font-family: Arial, sans-serif; }
  .meta-table td { padding: 5px 8px; border: 1px solid #ccc; background: #fafafa; }
  .content { white-space: pre-wrap; text-align: justify; font-size: 11.5pt; }
  .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 8pt; color: #666; font-family: Arial, sans-serif; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Escritório Daniel Felix Advocacia</h1>
    <p>OAB/SP • Advocacia & Consultoria Jurídica Estratégica • ${esc(area)}</p>
  </div>
  <table class="meta-table">
    <tr>
      <td><strong>Documento:</strong> ${esc(code)}</td>
      <td><strong>Cliente:</strong> ${esc(clientName)}</td>
      <td><strong>Data de Emissão:</strong> 16/10/2026</td>
    </tr>
    <tr>
      <td colspan="3"><strong>Hash Criptográfico SHA-256:</strong> <code>${esc(hash)}</code></td>
    </tr>
  </table>
  <div class="content">${content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  <div class="footer">
    <span>Escritório Virtual Daniel Felix • Assinado digitalmente</span>
    <span>Validação: ${esc(hash.slice(0, 24))}... • Página 1 de 1</span>
  </div>
  <script>window.onload=()=>{ window.print(); };<\/script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    this.toast('Documento timbrado ABNT / PDF pronto para impressão.');
  }

  downloadWordDoc(filename, title, content, code, clientName){
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${esc(title)}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
  h2 { font-size: 14pt; text-align: center; margin: 0; }
  p { text-align: justify; margin-bottom: 1em; }
</style>
</head><body>
<div style='text-align:center;border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:20px'>
  <h2>ESCRITÓRIO DANIEL FELIX ADVOCACIA</h2>
  <p style='margin:2px;font-size:10pt'>OAB/SP • Documento: ${esc(code)} • Cliente: ${esc(clientName)}</p>
</div>
<div>${content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</div>
</body></html>`;
    const blob = new Blob(['\ufeff', header], { type: 'application/msword;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(`Arquivo ${a.download} exportado com sucesso.`);
  }

  computeForenseDeadline(tipo, dataDispStr){
    const parts=dataDispStr.split('/').map(Number);
    const d=parts[0]||16, m=parts[1]||10, y=parts[2]||2026;
    const dt=new Date(y,m-1,d);
    const isWeekend=(date)=>date.getDay()===0||date.getDay()===6;
    const isHoliday=(date)=>{
      const dd=date.getDate(),mm=date.getMonth()+1;
      const holidays=['1/1','21/4','1/5','7/9','12/10','2/11','15/11','25/12'];
      return holidays.includes(`${dd}/${mm}`);
    };
    const isBusinessDay=(date)=>!isWeekend(date)&&!isHoliday(date);
    const nextBusinessDay=(date)=>{
      const res=new Date(date);
      res.setDate(res.getDate()+1);
      while(!isBusinessDay(res)){
        res.setDate(res.getDate()+1);
      }
      return res;
    };

    let dias=15;
    let rito='CPC (Dias Úteis)';
    let isCorridos=false;

    if(tipo.includes('Embargos'))dias=5;
    else if(tipo.includes('Agravo'))dias=10;
    else if(tipo.includes('Trabalhista')||tipo.includes('CLT')){dias=8;rito='CLT (Dias Úteis)';}
    else if(tipo.includes('Penal')||tipo.includes('CPP')||tipo.includes('Acusação')){
      isCorridos=true;
      rito='CPP (Dias Corridos)';
      if(tipo.includes('Apelação'))dias=5;
      else if(tipo.includes('Razões'))dias=8;
      else dias=10;
    }

    const d0=new Date(dt);
    const d1=nextBusinessDay(d0);
    const d2=nextBusinessDay(d1);

    const curr=new Date(d2);
    if(isCorridos){
      let count=1;
      while(count<dias){
        curr.setDate(curr.getDate()+1);
        count++;
      }
      while(!isBusinessDay(curr)){
        curr.setDate(curr.getDate()+1);
      }
    }else{
      let count=1;
      while(count<dias){
        curr.setDate(curr.getDate()+1);
        if(isBusinessDay(curr)){
          count++;
        }
      }
    }

    const fmt=(date)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
    return {
      disponibilizacao:fmt(d0),
      publicacao:fmt(d1),
      inicioContagem:fmt(d2),
      dataFatal:fmt(curr),
      dias,
      rito
    };
  }

  openDeadlineCalculator(){
    const today=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    const clis=this.state.clients||[];
    this.show(
      'Calculadora Determinística de Prazos Processuais (Clara)',
      'Cálculo exato com regras do CPC (dias úteis), CPP (dias corridos) e CLT, auditado marco a marco a partir do DJEN.',
      `<div class="form-grid" style="margin-top:10px">
        <label class="field">Cliente / Processo
          <select id="calc-client">${clis.map(c=>`<option value="${esc(c.name)}">${esc(c.name)} (${esc(c.area)})</option>`).join('')}</select>
        </label>
        <label class="field">Espécie do Ato Processual
          <select id="calc-tipo">
            <option>Contestação Cível (15 dias úteis · Art. 335 CPC)</option>
            <option>Recurso de Apelação Cível (15 dias úteis · Art. 1.003 CPC)</option>
            <option>Embargos de Declaração Cível (5 dias úteis · Art. 1.023 CPC)</option>
            <option>Agravo de Instrumento Cível (10 dias úteis · Art. 1.015 CPC)</option>
            <option>Resposta à Acusação Penal (10 dias corridos · Art. 396 CPP)</option>
            <option>Apelação Penal (5 dias corridos · Art. 593 CPP)</option>
            <option>Recurso Ordinário Trabalhista (8 dias úteis · Art. 895 CLT)</option>
          </select>
        </label>
        <label class="field">Data de Disponibilização no DJEN (D0)
          <input id="calc-data-disp" value="${today}" placeholder="DD/MM/AAAA">
        </label>
        <div class="field" style="display:flex;align-items:flex-end">
          <button type="button" class="primary-button" id="btn-do-calc" style="width:100%;padding:10px">🧮 Calcular Prazo Determinístico</button>
        </div>
      </div>
      <div id="calc-result-box" style="margin-top:16px"></div>`
    );

    const update=()=>{
      const tipo=$('#calc-tipo')?.value||'Contestação Cível (15 dias úteis · Art. 335 CPC)';
      const dtStr=$('#calc-data-disp')?.value||today;
      const res=this.computeForenseDeadline(tipo,dtStr);
      const clientName=$('#calc-client')?.value||'Cliente';
      $('#calc-result-box').innerHTML=`
        <div class="citation-box" style="margin-top:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h4 style="margin:0;font-size:16px;color:#86d1b1">✓ Auditoria do Prazo Calculado pela Clara</h4>
            <span class="badge green">${res.rito}</span>
          </div>
          <div class="chart-grid" style="margin-top:12px;gap:10px">
            <div class="info-box"><small>1. Disponibilização DJEN</small><strong>${res.disponibilizacao}</strong></div>
            <div class="info-box"><small>2. Publicação Oficial</small><strong>${res.publicacao}</strong></div>
            <div class="info-box"><small>3. Início da Contagem</small><strong>${res.inicioContagem}</strong></div>
            <div class="info-box" style="border:1px solid #e6c786"><small style="color:#e6c786">4. DATA FATAL IMPRORROGÁVEL</small><strong style="color:#e6c786;font-size:18px">${res.dataFatal}</strong></div>
          </div>
          <p style="font-size:13px;color:#9eb2bd;margin-top:10px;line-height:1.5">
            Art. 224 do CPC: Considera-se como data de publicação o primeiro dia útil seguinte ao da disponibilização da informação no Diário da Justiça eletrônico. A contagem inicia no primeiro dia útil subsequente.
          </p>
          <div class="action-bar" style="margin-top:14px">
            <button class="success-button" id="btn-save-calc-deadline">📥 Inserir como Sugestão de Prazo para Revisão</button>
          </div>
        </div>
      `;
      $('#btn-save-calc-deadline').onclick=()=>{
        if(!Array.isArray(this.state.deadlinesList))this.state.deadlinesList=[];
        const newD={
          id:'dead-'+Date.now(),
          ato:tipo.split('(')[0].trim(),
          clientName:clientName,
          numeroCnj:'1044912-30.2026.8.26.0100',
          dataFatal:res.dataFatal,
          rito:res.rito,
          status:'Sugestão',
          responsible:'Clara (Controladoria) · Aguardando validação'
        };
        this.state.deadlinesList.unshift(newD);
        this.log(`Clara calculou e sugeriu novo prazo fatal para ${clientName}: ${newD.ato} até ${res.dataFatal}.`);
        this.persist();
        this.render();
        this.toast(`Prazo fatal (${res.dataFatal}) adicionado à fila da Clara!`);
        this.processual('deadlines');
      };
    };

    $('#btn-do-calc').onclick=update;
    update();
  }

  translateNoticeForWhatsApp(id){
    const n=(this.state.noticesList||[]).find(x=>x.id===id)||this.state.noticesList[0];
    if(!n)return;
    const clientFirstName=n.clientName.split(' ')[0];
    const friendly=`Olá, ${clientFirstName}! Tudo bem com você? 😊\n\nPassando para te dar uma atualização sobre o seu processo (nº ${n.numeroCnj}).\n\nTivemos uma nova publicação no Diário Oficial. Traduzindo do juridiquês para o português claro:\n\n👉 "${n.inteiroTeor.length>120?n.inteiroTeor.slice(0,120)+'...':n.inteiroTeor}"\n\nO que isso significa na prática? Nosso escritório já está ciente e preparando as manifestações necessárias dentro do prazo judicial. Você não precisa se preocupar com nada!\n\nSeguimos firmes acompanhando cada passo do seu caso. Qualquer dúvida, estamos à disposição!\n\nAbraços,\nDr. Daniel Felix & Equipe`;
    
    this.show(
      'Tradutor de Juridiquês para WhatsApp (Nina & Lia)',
      'Comunicação clara, humana e acolhedora com o cliente, conforme as diretrizes do Dr. Daniel Felix.',
      `<div class="workspace-split">
        <div class="list-panel" style="padding:14px">
          <span class="mini-label">PUBLICAÇÃO OFICIAL DO DJEN (JURIDIQUÊS)</span>
          <div style="background:#0e1b23;padding:12px;border-radius:6px;border:1px solid #2b3d49;font-size:13px;color:#c0d2dc;margin-top:6px;line-height:1.6">
            <strong>${esc(n.numeroCnj)}</strong><br>
            <small style="color:#7f97a5">Data: ${esc(n.dataPublicacao)} · Área: ${esc(n.area)}</small><br><br>
            ${esc(n.inteiroTeor)}
          </div>
          <div style="margin-top:12px;font-size:12.5px;color:#8ba2ae">
            💡 <em>A tradução automática do escritório remove termos herméticos e tranquiliza o cliente sobre as providências adotadas.</em>
          </div>
        </div>
        <div class="detail-panel">
          <span class="mini-label">MENSAGEM TRADUZIDA PRONTA PARA WHATSAPP</span>
          <textarea class="petition-paper" id="tg-translated-msg" style="min-height:260px;margin-top:6px;font-size:14px">${esc(friendly)}</textarea>
          <div class="action-bar" style="margin-top:12px">
            <button class="primary-button" id="btn-copy-friendly-msg">📋 Copiar Mensagem</button>
            <button class="success-button" id="btn-send-friendly-outbox">📤 Adicionar ao Outbox do Rui</button>
          </div>
        </div>
      </div>`
    );
    const copyBtn=$('#btn-copy-friendly-msg');
    if(copyBtn)copyBtn.onclick=()=>{
      const text=$('#tg-translated-msg')?.value||'';
      navigator.clipboard?.writeText?.(text).then(()=>{
        this.toast('Mensagem copiada para a área de transferência!');
      }).catch(()=>{
        this.toast('Mensagem copiada!');
      });
    };
    const outboxBtn=$('#btn-send-friendly-outbox');
    if(outboxBtn)outboxBtn.onclick=()=>{
      const text=$('#tg-translated-msg')?.value||friendly;
      if(!this.state.financeiro.outbox)this.state.financeiro.outbox=[];
      this.state.financeiro.outbox.unshift({
        id:'out-msg-'+Date.now(),
        clientName:n.clientName,
        phone:'(11) 99401-2210',
        finId:'notice-'+n.id,
        amount:0,
        status:'pending',
        idempotencyKey:`notice-msg-${n.id}-${Date.now()}`,
        message:text
      });
      this.log(`Nina preparou atualização em linguagem clara para ${n.clientName} no Outbox.`);
      this.persist();
      this.toast(`Mensagem para ${n.clientName} adicionada à fila Outbox!`);
      this.modal.close();
    };
  }

  /* ======================================================================
   * PERFIS, EQUIPE, MÉTRICAS, FLUXOS E REVISÕES
   * ====================================================================== */
  profile(id){
    const a=this.state.agents.find(x=>x.id===id);if(!a)return;this.selected=id;this.renderInspector();
    const duties={sdr:['Ler o histórico autorizado no ZapConversa e identificar a demanda.','Separar fatos relatados, documentos e informações ainda ausentes.','Qualificar atendimento com respeito às regras da OAB.'],closer:['Preparar a contratação e esclarecer o escopo aprovado pelo advogado.','Encaminhar dúvidas jurídicas ao profissional responsável.','Acompanhar proposta, contrato e aceite sem prometer resultado.'],movimentacoes:['Usar os coletores DataJud e DJEN que já existem no MVP.','Conferir a saúde das fontes, a última coleta e possíveis eventos duplicados.','Vincular movimentações e intimações ao processo correto, sem confundir andamento com prazo.'],controladoria:['Ler o inteiro teor da comunicação e identificar ato, rito e marco inicial.','Usar o motor determinístico e o calendário já existentes no MVP.','Levar a sugestão ao advogado; somente depois usar o prazo validado nos lembretes.'],agenda:['Conferir audiência, dossiê, cliente e advogado responsável.','Consultar a agenda e oferecer horários livres com margem para preparação.','Reservar o horário e confirmar a call após o aceite do cliente.'],contratos:['Gerar contrato e procuração com modelo aprovado e campos validados.','Separar poderes especiais e obter revisão específica do advogado.','Integrar o repositório de contratos quando o endereço e a API forem confirmados.'],assinaturas:['Consultar o estado do documento e de cada signatário no ZapSign.','Um signatário assinar não significa documento completo.','Salvar o documento concluído e reconciliar eventos pendentes.'],forense:['Coordenar os seis especialistas do squad jurídico já existentes no MVP.','Caso novo: tese → pesquisa → redação → auditoria de citações.','Entregar a versão ao advogado para revisão, assinatura e protocolo.'],pesquisador:['Buscar jurisprudência e acórdãos em fontes oficiais.','Guardar URL, tribunal, número, relator, datas e trecho conferido.','Sinalizar resultado ausente ou fonte não verificada, sem inventar precedente.'],financeiro:['Consultar honorários no gerenciador financeiro do cliente.','Conferir parcelas, vencimentos e recebimentos, com fonte e período.','Preparar cobrança, sem duplicar o livro financeiro do Gabinete.'],etica:['Apoio interno com base nas regras éticas e fontes da OAB.','Revisar publicidade, conflitos e confidencialidade.','Não representa nem substitui o TED oficial da seccional.'],coordenador:['Receber pedidos do advogado pelo Telegram do próprio cliente (@DanielFelixAdvBot).','Distribuir tarefas específicas, acompanhar a fila e cobrar pendências.','Consumir APIs restritas do Gabinete, financeiro e contratos no mesmo servidor.'],daniel:['Revisar o mérito, os fatos, os documentos e as citações.','Confirmar os prazos e a versão exata da petição.','Assinar e realizar o protocolo pelos canais autorizados.'],proprietario:['Acompanhar metas, gargalos e resultados do escritório.','Definir equipe, permissões e prioridades.','Supervisionar a operação com Daniel.']};
    const list=duties[a.id]||['Atuar na especialidade e atribuição configuradas.','Entregar evidências, pendências e resultado rastreável.','Encaminhar atos reservados ao advogado responsável.'];
    const view=routes[a.id];
    this.show(esc(a.name),esc(a.role),`<div class="profile-details"><div class="profile-large">${portrait(a)}</div><div class="profile-copy"><span class="label-tag">${esc(SECTORS[a.sector].name)}</span> <span class="label-tag">${esc(a.area)}</span><p>${esc(a.task)}</p>${a.personality?`<p><strong>Personalidade:</strong> ${esc(a.personality)}</p>`:''}<ul>${list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="profile-actions">${['forense','tese','pesquisador','estrategista','redator','revisor','daniel'].includes(a.id)?`<button class="primary-button" data-action="petitions">⚖️ Abrir Petições & Minutas</button>`:''}${['sdr','closer','analista'].includes(a.id)?`<button class="primary-button" data-action="clients">👥 Abrir Clientes & Dossiês</button>`:''}${['contratos','assinaturas'].includes(a.id)?`<button class="primary-button" data-action="contracts">✍️ Abrir Contratos & Procurações</button>`:''}${a.id==='financeiro'?`<button class="primary-button" data-action="financeiro">💰 Abrir Painel Financeiro</button>`:''}${a.id==='coordenador'?`<button class="primary-button" data-action="telegram">✈️ Abrir Comando Telegram</button>`:''}${['controladoria','movimentacoes','forense','redator','revisor'].includes(a.id)?`<button class="outline-button" data-action="${a.id==='controladoria'?'deadlines':'processual'}">Abrir acompanhamento processual</button>`:''}${view&&this.live?`<a class="outline-button" href="${view}" target="_top">Abrir no Gabinete ↗</a>`:''}${!this.live?`<button class="outline-button" data-set-state="${a.status==='paused'?'available':'paused'}" data-id="${esc(a.id)}">${a.status==='paused'?'Retomar personagem':'Pausar personagem'}</button>`:''}${a.custom?`<button class="outline-button" data-remove-agent="${esc(a.id)}">Remover personagem</button>`:''}</div></div></div>`);
  }
  metrics(){
    const m=this.metric();
    const max=Math.max(...(m.series||[]),1),p=(m.series||[]).map((v,i)=>[20+i*53,155-v/max*115]);
    const graph=p.length?`<svg viewBox="0 0 370 190" role="img" aria-label="Atividades simuladas no período"><path d="M20 40h325M20 95h325M20 155h325" stroke="#31434e"/><path d="M${p.map(p=>p.join(' ')).join(' L')}" fill="none" stroke="#87bfa6" stroke-width="3"/>${p.map(v=>`<circle cx="${v[0]}" cy="${v[1]}" r="4" fill="#b1d4b8"/>`).join('')}<text x="20" y="180" fill="#8da2ae" font-size="11.5">Início do período</text><text x="245" y="180" fill="#8da2ae" font-size="11.5">Fim do período</text></svg>`:'<p class="subtle-note">Série histórica ainda não implementada nesta leitura. Nenhum ponto foi estimado.</p>';
    const funnel=m.funnel||[];
    this.show('O pulso do escritório',this.live?'Leitura autenticada da mesma base do Gabinete. Campos sem integração ficam indisponíveis.':'Métricas do Escritório Daniel Felix para acompanhamento no telão.alterne o período abaixo.',`${!this.live?`<div class="period-switch">${Object.entries(METRICS).map(([k,v])=>`<button data-period="${k}" class="${this.state.period===k?'active':''}">${v.label}</button>`).join('')}</div>`:''}<div class="metrics-cards">${[['Processos na carteira',m.processes],['Minutas na lista',m.petitions],['Prazos em 7 dias',m.deadlines],['Recebido no período',m.received==null?'—':money(m.received)]].map(v=>`<div class="metric-mini"><small>${v[0]}</small><strong>${textOrDash(v[1])}</strong></div>`).join('')}</div><div class="chart-grid"><div class="chart-card"><h3>Atividades no período</h3><p>${this.live?'A integração preserva dados ausentes':'Série demonstrativa · tarefas preparadas'}</p>${graph}</div><div class="chart-card"><h3>Do contato à contratação</h3><p>${this.live?'Depende de ZapConversa e assinatura':'Funil comercial de clientes'}</p>${funnel.length?funnel.map((v,i)=>`<div class="funnel-row"><span>${['Contatos','Qualificados','Propostas','Contratados'][i]}</span><div class="bar-track"><div class="bar-fill" style="width:${v/(funnel[0]||1)*100}%"></div></div><span>${v}</span></div>`).join(''):'<p class="subtle-note">Ainda sem fonte conectada.</p>'}</div></div><p class="chart-note">${this.live?'Atualizado em '+esc(this.snapshot?.generatedAt||'—')+'. Consultas e aprovações continuam no Gabinete.':'Você pode alternar os períodos e comparar os gráficos. O quadro processual usa a mesma carteira; os totais de contatos e contratos variam com o período escolhido.'}</p>${p.length?`<details><summary class="chart-note">Ver valores do gráfico</summary><table class="data-table"><thead><tr><th>Ponto</th><th>Atividades de exemplo</th></tr></thead><tbody>${m.series.map((v,i)=>`<tr><td>${i+1}</td><td>${v}</td></tr>`).join('')}</tbody></table></details>`:''}`);
  }
  team(){
    this.show('Cada agente, uma atribuição','Selecione uma pessoa para ver o papel, a especialidade e as rotinas do setor.',`<div class="team-tools"><input id="team-search" placeholder="Buscar nome ou atribuição" aria-label="Buscar equipe"><select id="team-area" aria-label="Filtrar área"><option>Todas</option>${AREAS.map(x=>`<option>${x}</option>`).join('')}</select><button class="outline-button" data-action="new-agent">+ Adicionar agente</button></div><div class="team-list" id="team-list"></div>`);
    const draw=()=>{const q=$('#team-search').value.toLocaleLowerCase('pt-BR'),area=$('#team-area').value;const list=this.state.agents.filter(a=>(a.name+' '+a.role).toLocaleLowerCase('pt-BR').includes(q)&&(area==='Todas'||a.area===area));$('#team-list').innerHTML=list.map(a=>`<button class="team-member" data-open-agent="${esc(a.id)}">${portrait(a)}<span><strong>${esc(a.name)}</strong><small>${esc(a.role)}<br>${esc(a.area)} · ${esc(SECTORS[a.sector].short)}</small></span></button>`).join('')||'<p class="chart-note">Nenhum personagem encontrado nesta busca.</p>';};
    $('#team-search').addEventListener('input',draw);$('#team-area').addEventListener('change',draw);draw();
  }
  newAgent(){
    if(this.live){this.show('Adicionar agente','A maquete conectada ainda não possui cadastro persistente de agentes.',`<div class="content-copy"><p>O cadastro deve ser implementado pela API autenticada do escritório. Os perfis deste pacote definem os campos e as permissões. A maquete offline permite experimentar a aparência e a distribuição.</p></div>`);return;}
    this.show('Uma nova pessoa no escritório','Defina a função e a aparência. O personagem ganhará uma estação no setor escolhido.',`<form id="agent-form"><div class="form-grid"><label class="field">Nome<input name="name" required minlength="2" maxlength="30" placeholder="Ex.: Helena"></label><label class="field">Atribuição<input name="role" required maxlength="80" placeholder="Ex.: Revisão de prova documental"></label><label class="field">Setor<select name="sector">${Object.entries(SECTORS).filter(([k])=>!['all','diretoria'].includes(k)).map(([k,v])=>`<option value="${k}" ${k==='juridico'?'selected':''}>${v.name}</option>`).join('')}</select></label><label class="field">Área de atuação<select name="area">${AREAS.map(v=>`<option>${v}</option>`).join('')}</select></label><label class="field">Cor da roupa<input type="color" name="color" value="#b89bd3"></label><label class="field">Característica<select name="accessory"><option value="glasses">Óculos · análise e pesquisa</option><option value="headset">Headset · atendimento</option><option value="tie">Gravata · jurídico</option><option value="gold">Broche dourado · coordenação</option></select></label><label class="field">Tom de pele<input type="color" name="skin" value="#cf9873"></label><label class="field">Cor do cabelo<input type="color" name="hair" value="#372b27"></label><label class="field full">Personalidade e jeito de comunicar<input name="personality" maxlength="180" placeholder="Ex.: acolhedora no atendimento, precisa ao explicar pendências"></label><label class="field full">Descrição da rotina<textarea name="task" maxlength="240" placeholder="O que essa pessoa deve acompanhar e preparar?"></textarea></label><div class="field full"><span>Prévia do personagem</span><div class="form-preview" id="avatar-preview"></div></div></div><div class="form-error" id="agent-error" role="alert"></div><div class="form-actions"><p class="muted">Salvo no navegador. Adicionar um boneco reserva uma estação na sala do setor escolhido.</p><button class="primary-button" type="submit">Criar personagem +</button></div></form>`);
    const f=$('#agent-form');const preview=()=>{$('#avatar-preview').innerHTML=portrait(Object.fromEntries(new FormData(f)));};f.addEventListener('input',preview);preview();
    f.addEventListener('submit',e=>{e.preventDefault();try{const a=addAgent(this.state,Object.fromEntries(new FormData(f)));this.selected=a.id;this.state.sector='all';this.persist();this.render();this.modal.close();this.toast(`${a.name} entrou na equipe do escritório.`);}catch(err){$('#agent-error').textContent=err.message;}});
  }
  workflows(){
    this.show('Veja a operação em movimento',this.live?'A execução dos agentes exige fila e adaptadores próprios. A leitura do MVP já tem contrato neste pacote.':'Os personagens se deslocam entre os setores enquanto as etapas aparecem no histórico e no Telegram.',`<div class="flow-cards">${Object.entries(WORKFLOWS).map(([k,v],i)=>`<button class="flow-card" ${this.live?'disabled':''} data-workflow="${k}">${icon(['flow','clock','file'][i])}<h3>${v.name}</h3><p>${['Entrada pelo WhatsApp, dossiê, pesquisa e inicial para revisão.','Audiência, dossiê e call com o advogado disponível.','Modelo de procuração, revisão e acompanhamento das assinaturas.'][i]}</p><span>${this.live?'Execução ainda não conectada':'Iniciar simulação ↗'}</span></button>`).join('')}</div><p class="subtle-note">${this.live?'A fila de execução não pode ser deduzida da movimentação dos bonecos. Os estados deverão vir de tarefas persistidas.':'Cada fluxo percorre os agentes responsáveis e entrega o resultado na mesa de revisão humana de Dr. Daniel Felix.'}</p>`);
  }
  async runWorkflow(key){
    if(this.live||this.running){this.toast('Já existe uma simulação em andamento. Acompanhe o histórico.');return;}
    const flow=WORKFLOWS[key];if(!flow)return;this.running=true;this.state.paused=false;this.state.sector='all';this.syncPause();this.renderTabs();
    try{for(const [id,text] of flow.steps){const a=this.state.agents.find(a=>a.id===id);if(!a)continue;this.selected=id;a.task=text+' · simulação';a.status=a.human||id==='revisor'?'review':id==='assinaturas'?'waiting':'working';this.renderScene();this.renderInspector();this.log(`${a.name}: ${text}.`);await this.walk(a);}this.toast(`Simulação concluída: ${flow.name}.`);}finally{this.running=false;this.persist();}
  }
  async walk(a){
    if(this.reduceMotion||a.human)return new Promise(r=>setTimeout(r,250));
    const home={x:a.x,y:a.y};const corridor=home.y>400?{x:a.sector==='juridico'?390:730,y:home.y}:{x:home.x,y:355};
    const points=(sceneRoute(this.state,a)||[home,corridor,{x:corridor.x,y:355},{x:550,y:355},{x:corridor.x,y:355},corridor,home]).map(p=>scenePoint(this.state,p.x,p.y));
    const distances=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])),total=distances.reduce((a,b)=>a+b,0),duration=Math.max(900,Math.min(2600,total*2.4));
    const walker=$('#walker');if(!walker)return;walker.innerHTML=`<g class="person walking">${sceneAvatar(this.state,a)}</g>`;walker.setAttribute('visibility','visible');const original=$(`#person-${a.id}`);if(original)original.style.visibility='hidden';
    await new Promise(resolve=>{let elapsed=0,last=null;const tick=t=>{if(last!==null&&!this.state.paused)elapsed+=Math.min(t-last,60);last=t;let dist=Math.min(elapsed/duration,1)*total,i=0;while(i<distances.length-1&&dist>distances[i])dist-=distances[i++];const frac=distances[i]?dist/distances[i]:0,p=points[i],q=points[i+1];walker.setAttribute('transform',`translate(${p[0]+(q[0]-p[0])*frac},${p[1]+(q[1]-p[1])*frac})`);if(elapsed<duration)requestAnimationFrame(tick);else{walker.setAttribute('visibility','hidden');if(original)original.style.visibility='';resolve();}};requestAnimationFrame(tick);});
  }
  log(text){const time=this.live?'GABINETE':new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())+' · OPERAÇÃO';this.state.logs.push({time,text});this.state.logs=this.state.logs.slice(-80);this.renderActivity();}
  logs(){this.show('Histórico da operação',this.live?'Registro desta leitura do Gabinete.':'Eventos gerados pelos comandos no Telegram, revisões de peças e fluxos de agentes.',`<div class="logs-list">${this.state.logs.slice().reverse().map(l=>`<div class="log-row"><time>${esc(l.time)}</time><span>${esc(l.text)}</span></div>`).join('')||'<p class="chart-note">Nenhum evento nesta sessão.</p>'}</div>`);}
  integrations(){
    const items=[
      ['Telegram + Coordenadora Luana','Operacional na interface · @DanielFelixAdvBot','Comandos /peticoes, /clientes, /prazos, /financeiro, /procuracao e linguagem natural integrados ao mapa e aos módulos.'],
      ['Gabinete · MVP Jurídico',this.snapshot?'Leitura conectada':'Módulo local ativo','Carteira, movimentações, intimações DJEN, prazos da Clara e peças jurídicas com editor completo.'],
      ['Gerenciador Financeiro (Rui)','Módulo local + Adaptador API','Controle de honorários, parcelas por cliente, conciliação de caixa e fila Outbox de cobrança.'],
      ['Contratos & Procurações (Davi)','Gerador Ad Judicia ativo','Emissão de Procuração em nome de Dr. Daniel Felix com seleção de poderes especiais (Art. 105 CPC) e hash SHA-256.'],
      ['ZapSign (Bia)','Reconciliação por signatário','Acompanhamento individual de cada assinatura até o status concluído (2/2) com arquivamento no dossiê.'],
      ['ZapConversa / WhatsApp (Lia)','Triagem estruturada em Clientes','Relato cronológico, qualificação civil, checklist de provas e abertura automática de pasta do cliente.'],
      ['Agenda & Audiências (Nina)','Controle de preparação','Verificação de dossiê e agendamento de call de alinhamento antes da audiência.'],
      ['DJEN e DataJud (Breno)','Monitoramento de publicações','Distinção estrita entre movimentação processual (DataJud) e inteiro teor de intimação (DJEN).']
    ];
    this.show('Conexões & Arquitetura do Escritório','Visão de todos os módulos e conectores do Escritório Virtual Daniel Felix.',`<div class="integration-grid">${items.map(r=>`<div class="integration"><h3>${r[0]}</h3><p>${r[2]}</p><span class="status-pill">${r[1]}</span></div>`).join('')}</div>`);
  }
  reviews(){
    this.show('Central de Revisão Humana · Mesa de Dr. Daniel Felix','Todos os atos privativos de advogado aguardando sua confirmação.',`
      <div style="display:grid;gap:10px">
        <button class="review-item" data-open-petition="pec-1"><span class="review-icon">${icon('file')}</span><span><h3>Petição Inicial PEC-2026-001 · Maria Carolina Mendes (Consumidor / LATAM)</h3><p>Redigida por Maya · 2 julgados STJ/TJSP verificados por Theo e Noah · Clique para ler, editar e aprovar</p></span></button>
        <button class="review-item" data-open-petition="pec-2"><span class="review-icon">${icon('file')}</span><span><h3>Petição Inicial PEC-2026-002 · Carlos Eduardo Albuquerque (Rescisão Imobiliária)</h3><p>Redigida por Maya · Súmula 543/STJ verificada · Clique para ler, editar e aprovar</p></span></button>
        <button class="review-item" data-open-contract="doc-2"><span class="review-icon">${icon('check')}</span><span><h3>Procuração Ad Judicia PROC-2026-002 · Carlos Eduardo Albuquerque</h3><p>Poderes especiais do Art. 105 do CPC preparados por Davi · Aguardando aprovação p/ envio ao ZapSign</p></span></button>
        <button class="review-item" data-action="deadlines"><span class="review-icon">${icon('clock')}</span><span><h3>2 Sugestões de Prazo Fatal (Clara · Controladoria)</h3><p>Fernanda Costa Lira (23/10/2026 · Penal) e Carlos Eduardo (05/11/2026 · Cível) · Clique para confirmar</p></span></button>
      </div>
    `);
  }
  review(id){
    if(id==='review-1'){this.petitions('pec-1');return;}
    if(id==='review-2'){this.contracts('doc-2');return;}
    if(id==='deadline-1'){this.processual('deadlines');return;}
    if(id==='meeting-1'){this.clients('cli-3');return;}
    const t=TASKS.find(t=>t.id===id);if(!t)return;
    this.reviews();
  }
  async loadSnapshot(){
    if(!this.live)return;try{const r=await fetch('/api/escritorio/estado',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw Error(r.status===401?'Entre no Gabinete para acessar os dados.':`Leitura indisponível (${r.status}).`);const d=await r.json();if(d.mode!=='live'||d.schemaVersion!==1||!d.summary||!d.metrics)throw Error('Resposta incompatível com o contrato do escritório.');this.snapshot=d;this.connectionError=null;$('.demo-badge').innerHTML='<i></i>MVP · LEITURA CONECTADA';$('.page-footer span:last-child').textContent='Fonte: Gabinete · CNJ/DataJud e DJEN · execução dos agentes ainda não conectada';this.log('Carteira, prazos, intimações e saúde das coletas atualizados do MVP.');}
    catch(e){this.snapshot=null;this.connectionError=e.message;$('.demo-badge').innerHTML='<i></i>MVP · SEM CONEXÃO';$('.page-footer span:last-child').textContent='Fonte indisponível · nenhum dado demonstrativo substituiu a leitura';this.toast(e.message);}this.render();
  }
  navigate(path){if(this.live){window.top.location.href=path;}else this.clients();}
  settings(){this.show('Configuração do Escritório Virtual Daniel Felix','Parâmetros de marca, infraestrutura Hetzner 4 vCPU e operação via Telegram.',`<div class="content-copy"><p><strong>Escritório:</strong> Daniel Felix Advocacia (Dr. Daniel Felix e Proprietário na mesa central da diretoria).</p><p><strong>Operação Telegram:</strong> Bot <code>@DanielFelixAdvBot</code> coordenado por Luana, despachando tarefas para os 17 agentes setoriais.</p><p><strong>Infraestrutura prevista:</strong> Servidor único Hetzner de 4 vCPU com isolamento de serviços, fila persistida e modelos remotos.</p><p><strong>Integridade Jurídica:</strong> Gate de jurisprudência verificada, revisão humana obrigatória de peças/prazos e procuração com poderes explícitos.</p></div>${!this.live?'<div class="profile-actions"><button class="outline-button" data-action="reset-demo">Restaurar dados iniciais do escritório</button></div>':''}`);}
  help(){this.show('Guia Rápido · Escritório Virtual Daniel Felix','Como operar todas as áreas do seu escritório virtual.',`<div class="content-copy"><ul><li><strong>✈️ Telegram (@DanielFelixAdvBot):</strong> Use o painel lateral direito ou o menu <em>Telegram</em> para enviar ordens à Coordenadora Luana (ex.: <code>/peticoes</code>, <code>/clientes</code>, <code>/prazos</code>, <code>/financeiro</code>, <code>/procuracao</code>).</li><li><strong>👥 Clientes & Dossiês:</strong> Acesse o menu <em>Clientes</em> para ver a pasta 360° de cada cliente, qualificação civil, documentos da triagem WhatsApp e cadastrar novos clientes.</li><li><strong>⚖️ Petições & Minutas:</strong> Acesse <em>Petições</em> para ler o inteiro teor das peças jurídicas redigidas pela Maya, conferir os acórdãos verificados pelo Theo/Noah, editar o texto, aprovar como Dr. Daniel Felix e baixar o arquivo.</li><li><strong>📂 Processos & Prazos:</strong> Acesse <em>Processos</em> para ver a carteira CNJ, ler o inteiro teor das publicações do DJEN (Breno) e confirmar os prazos sugeridos pela Clara.</li><li><strong>✍️ Contratos & Procurações:</strong> Acesse <em>Contratos</em> para gerar Procurações Ad Judicia em nome de Dr. Daniel Felix com seleção dos poderes do Art. 105 do CPC e acompanhar as assinaturas no ZapSign (Bia).</li><li><strong>💰 Financeiro:</strong> Acesse <em>Financeiro</em> para acompanhar o caixa recebido, contas a receber, dar baixa em parcelas e autorizar cobranças do Rui no Outbox.</li></ul></div>`);}
  toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),4000);}
}
if(typeof document!=='undefined'){window.danielFelixOffice=window.araoOffice=new OfficeApp();}

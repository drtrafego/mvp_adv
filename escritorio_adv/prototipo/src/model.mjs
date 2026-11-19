/* Dados e estado do Escritório Virtual Daniel Felix. */
import {INITIAL_CLIENTS,INITIAL_PETITIONS,INITIAL_PROCESSES_LIST,INITIAL_DEADLINES_LIST,INITIAL_NOTICES_LIST,INITIAL_CONTRACTS_LIST,INITIAL_FINANCEIRO,INITIAL_TELEGRAM_MESSAGES} from './office-data.mjs';
export const AREAS = ['Geral','Consumidor','Cível','Penal','Ética e OAB'];
export const SECTORS = {
  all: {name:'Todo o escritório',color:'#d6b673'},
  comercial: {name:'Relacionamento & entrada',short:'COMERCIAL',color:'#64baa5',box:[30,55,310,255]},
  administrativo: {name:'Controladoria & agenda',short:'ADMINISTRATIVO',color:'#e8ae62',box:[395,55,300,255]},
  contratos: {name:'Contratos & assinaturas',short:'CONTRATOS',color:'#92a7e8',box:[750,55,305,255]},
  juridico: {name:'Núcleo jurídico',short:'JURÍDICO',color:'#ad96d8',box:[30,405,340,385]},
  diretoria: {name:'Mesa da direção',short:'DIRETORIA',color:'#d6b673',box:[415,440,280,255]},
  financeiro: {name:'Gestão financeira',short:'FINANCEIRO',color:'#80b89a',box:[760,405,295,190]},
  etica: {name:'Ética e OAB · apoio interno',short:'ÉTICA E OAB',color:'#d1a3af',box:[760,665,295,130]},
};
const agent = (id,name,role,sector,area,x,y,color,task,status='working',accessory='tie',human=false) => ({id,name,role,sector,area,x,y,color,task,status,accessory,human,personality:human?'Decisões claras e revisão responsável.':accessory==='headset'?'Acolhedor no atendimento, claro ao explicar próximos passos.':accessory==='glasses'?'Analítico, preciso e atento às fontes e pendências.':'Organizado, objetivo e colaborativo.',skin:'#cf9873',hair:'#372b27'});
export const DEFAULT_AGENTS = [
  agent('sdr','Lia','SDR · triagem','comercial','Geral',110,195,'#66bda8','Organizando o relato de um novo contato','working','headset'),
  agent('closer','Caio','Closer · contratação','comercial','Geral',255,230,'#479b86','Preparando proposta para revisão','working','tie'),
  agent('controladoria','Clara','Gestora de prazos','administrativo','Cível',475,185,'#dba761','Conferindo fonte, rito e calendário do prazo','review','glasses'),
  agent('agenda','Nina','Agenda & relacionamento','administrativo','Geral',625,230,'#cb8f49','Consultando disponibilidade do advogado','working','headset'),
  agent('movimentacoes','Breno','Andamentos & intimações','administrativo','Geral',510,290,'#d3a16a','Acompanhando DataJud e DJEN do MVP','working','glasses'),
  agent('contratos','Davi','Contratos & procurações','contratos','Geral',830,195,'#93a6e0','Montando procuração a partir de modelo','review','tie'),
  agent('assinaturas','Bia','Assinaturas · ZapSign','contratos','Geral',995,230,'#738bc9','Aguardando os demais signatários','waiting','glasses'),
  agent('forense','Forense','Coordenador jurídico','juridico','Geral',90,530,'#ac91cf','Distribuindo as etapas da minuta','working','tie'),
  agent('tese','Íris','Construtora de tese','juridico','Consumidor',205,530,'#a787c7','Organizando fatos, prova e pedidos','working','glasses'),
  agent('pesquisador','Theo','Pesquisa jurídica','juridico','Cível',320,530,'#978ac9','Conferindo fontes oficiais de julgados','working','glasses'),
  agent('analista','Eva','Análise documental','juridico','Penal',90,650,'#baa3dc','Lendo o dossiê completo','waiting','tie'),
  agent('estrategista','Otto','Estratégia de defesa','juridico','Penal',205,650,'#9d8fbb','Organizando riscos da defesa','working','tie'),
  agent('redator','Maya','Redação forense','juridico','Consumidor',320,650,'#c19ed8','Preparando uma inicial em rascunho','working','glasses'),
  agent('revisor','Noah','Revisão jurídica','juridico','Cível',205,760,'#b19ccb','Auditoria de citações da minuta','review','glasses'),
  agent('coordenador','Coordenador','Orquestração · nome a definir','diretoria','Geral',550,400,'#d6b673','Consolidando a operação para o advogado','working','gold'),
  agent('daniel','Daniel','Advogado humano','diretoria','Geral',480,560,'#e5d7bc','Revisão de minutas e decisões','review','tie',true),
  agent('proprietario','Proprietário','Direção humana','diretoria','Geral',635,560,'#d7b273','Acompanhando a operação','available','gold',true),
  agent('financeiro','Rui','Financeiro · honorários','financeiro','Geral',910,540,'#7cb795','Conferindo honorários a receber','working','glasses'),
  agent('etica','Elisa','Ética e OAB · apoio interno','etica','Ética e OAB',910,780,'#c598aa','Conferindo comunicação e sigilo','available','glasses'),
];
export const STATES = {working:'Em atividade',review:'Aguardando revisão',waiting:'Aguardando retorno',available:'Disponível',paused:'Pausado'};
export const STATUS_COLORS = {working:'#70c4a1',review:'#e4ba6c',waiting:'#8fa4dc',available:'#98b1a2',paused:'#84919c'};
export const METRICS = {
  day:{label:'Hoje',processes:128,leads:12,contracts:3,received:4200,receivable:28400,deadlines:4,petitions:3,series:[1,4,3,6,4,8,7],funnel:[12,9,5,3]},
  week:{label:'Esta semana',processes:128,leads:24,contracts:7,received:12600,receivable:28400,deadlines:4,petitions:8,series:[4,8,6,12,9,15,18],funnel:[24,18,11,7]},
  month:{label:'Este mês',processes:128,leads:86,contracts:23,received:38400,receivable:28400,deadlines:12,petitions:26,series:[12,18,14,28,23,35,41],funnel:[86,61,38,23]},
};
export const TASKS = [
  {id:'review-1',title:'Inicial pronta para o advogado',sub:'Consumidor · revisão de mérito e anexos',sector:'juridico',status:'Revisão humana',level:'review'},
  {id:'review-2',title:'Procuração aguardando conferência',sub:'Dados do outorgante e poderes do modelo',sector:'contratos',status:'Revisão humana',level:'review'},
  {id:'deadline-1',title:'Prazo em conferência',sub:'Data sugerida · conferir fonte e calendário',sector:'administrativo',status:'A confirmar',level:'review'},
  {id:'meeting-1',title:'Call antes da audiência',sub:'Dossiê disponível · escolher horário',sector:'administrativo',status:'Preparar agenda',level:'waiting'},
];
export const WORKFLOWS = {
  intake:{name:'Novo caso → minuta',steps:[['sdr','Relato recebido no WhatsApp'],['contratos','Cadastro e procuração preparados'],['forense','Caso distribuído ao núcleo jurídico'],['tese','Fatos e pedidos organizados'],['pesquisador','Fontes reais a verificar'],['redator','Rascunho preparado'],['revisor','Citações encaminhadas à auditoria'],['daniel','Minuta aguardando revisão humana']]},
  hearing:{name:'Preparação de audiência',steps:[['controladoria','Evento de audiência identificado'],['agenda','Dossiê e advogado responsável conferidos'],['agenda','Horários disponíveis consultados'],['daniel','Call aguardando confirmação do cliente']]},
  signature:{name:'Procuração → assinatura',steps:[['contratos','Procuração preparada pelo modelo aprovado'],['daniel','Documento aguardando revisão humana'],['assinaturas','Consulta de status simulada'],['assinaturas','Documento aguardando assinaturas restantes']]},
};
export const escapeHtml = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
export function initialState(){
  return {
    version:1,
    view:'pixel',
    agents:structuredClone(DEFAULT_AGENTS),
    period:'week',
    sector:'all',
    area:'Todas',
    paused:false,
    zoom:1,
    logs:[],
    clients:structuredClone(INITIAL_CLIENTS),
    petitions:structuredClone(INITIAL_PETITIONS),
    processesList:structuredClone(INITIAL_PROCESSES_LIST),
    deadlinesList:structuredClone(INITIAL_DEADLINES_LIST),
    noticesList:structuredClone(INITIAL_NOTICES_LIST),
    contractsList:structuredClone(INITIAL_CONTRACTS_LIST),
    financeiro:structuredClone(INITIAL_FINANCEIRO),
    telegramMessages:structuredClone(INITIAL_TELEGRAM_MESSAGES),
    telegramBotHandle:'@DanielFelixAdvBot',
    coordinatorName:'Luana'
  };
}
export function visibleAgents(s){return s.agents.filter(a=>(s.sector==='all'||a.sector===s.sector)&&(s.area==='Todas'||a.area===s.area||a.area==='Geral'));}
export function validateAgent(a){
  if(!a || typeof a.name!=='string'||a.name.trim().length<2||a.name.trim().length>30)throw Error('Informe um nome entre 2 e 30 caracteres.');
  if(typeof a.role!=='string'||!a.role.trim()||a.role.length>80)throw Error('Descreva a atribuição em até 80 caracteres.');
  if(!Object.hasOwn(SECTORS,a.sector)||['all','diretoria'].includes(a.sector))throw Error('Escolha um setor de agentes.');
  if(!AREAS.includes(a.area))throw Error('Escolha uma área válida.');
  if(!/^#[0-9a-f]{6}$/i.test(a.color))throw Error('Escolha uma cor válida.');
  if(!['tie','headset','glasses','gold'].includes(a.accessory))throw Error('Acessório inválido.');
  return true;
}
export function addAgent(s,input){
  validateAgent(input);
  const same=s.agents.filter(a=>a.sector===input.sector);
  if(same.length>=12)throw Error('Este setor está cheio nesta maquete. Use outro setor ou remova um agente personalizado.');
  if(s.agents.length>=48)throw Error('A maquete comporta até 48 personagens. A planta de produção deve expandir por salas.');
  const box=SECTORS[input.sector].box;
  // Reserva uma estação livre; não empilha o novo personagem em uma mesa existente.
  const slots=[];
  const xs=[];for(let x=box[0]+55;x<box[0]+box[2]-30;x+=30)xs.push(x);xs.push(box[0]+box[2]-30);
  for(let y=box[1]+70;y<=box[1]+box[3]-25;y+=30)
    for(const x of xs)
      if(s.agents.every(a=>Math.abs(a.x-x)>=90||Math.abs(a.y-y)>=95))slots.push({x,y});
  const p=slots[0];
  if(!p)throw Error('Este setor não tem estação livre na planta atual. Escolha outro setor. A versão de produção deverá expandir a sala.');
  const id=`custom-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const out={id,name:input.name.trim(),role:input.role.trim(),sector:input.sector,area:input.area,color:input.color,accessory:input.accessory,skin:input.skin||'#cf9873',hair:input.hair||'#372b27',x:p.x,y:p.y,status:'available',task:input.task?.trim().slice(0,240)||'Aguardando atribuição',personality:input.personality?.trim().slice(0,180)||'Comunicação clara, objetiva e respeitosa.',human:false,custom:true};
  s.agents.push(out);return out;
}
export function restoreState(raw){
  const s=initialState();
  try{
    const r=JSON.parse(raw);
    if(r.version!==1||!Array.isArray(r.agents))return s;
    const base=new Map(DEFAULT_AGENTS.map(a=>[a.id,a]));
    const restored=[];const ids=new Set();
    for(const a of r.agents.slice(0,48)){
      if(typeof a?.id!=='string'||ids.has(a.id))continue;
      if(base.has(a.id)){
        const b=structuredClone(base.get(a.id));
        if(Object.hasOwn(STATES,a.status))b.status=a.status;
        restored.push(b);ids.add(b.id);continue;
      }
      if(!a.id.startsWith('custom-'))continue;
      try{validateAgent(a);}catch{continue;}
      if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>1120||a.y<0||a.y>830)continue;
      const b={...a,human:false,custom:true,status:Object.hasOwn(STATES,a.status)?a.status:'available',skin:/^#[0-9a-f]{6}$/i.test(a.skin)?a.skin:'#cf9873',hair:/^#[0-9a-f]{6}$/i.test(a.hair)?a.hair:'#372b27',task:String(a.task||'Aguardando atribuição').slice(0,240)};
      restored.push(b);ids.add(b.id);
    }
    for(const a of DEFAULT_AGENTS)if(!ids.has(a.id))restored.push(structuredClone(a));
    s.agents=restored;s.period=Object.hasOwn(METRICS,r.period)?r.period:'week';s.view=r.view==='iso'?'iso':'pixel';
    if(Array.isArray(r.clients)&&r.clients.length)s.clients=r.clients;
    if(Array.isArray(r.petitions)&&r.petitions.length)s.petitions=r.petitions;
    if(Array.isArray(r.processesList)&&r.processesList.length)s.processesList=r.processesList;
    if(Array.isArray(r.deadlinesList)&&r.deadlinesList.length)s.deadlinesList=r.deadlinesList;
    if(Array.isArray(r.noticesList)&&r.noticesList.length)s.noticesList=r.noticesList;
    if(Array.isArray(r.contractsList)&&r.contractsList.length)s.contractsList=r.contractsList;
    if(r.financeiro&&Array.isArray(r.financeiro.items))s.financeiro=r.financeiro;
    if(Array.isArray(r.telegramMessages)&&r.telegramMessages.length)s.telegramMessages=r.telegramMessages;
  }catch{/* Armazenamento indisponível ou versão antiga: usar apenas demonstração. */}
  return s;
}

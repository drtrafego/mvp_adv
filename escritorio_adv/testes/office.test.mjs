import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import {initialState,addAgent,restoreState,DEFAULT_AGENTS} from '../prototipo/src/model.mjs';
import {FinanceiroRead} from '../adaptadores/financeiro-read.mjs';
import {PixelScene} from '../prototipo/src/pixel-scene.mjs';
const require=createRequire(process.env.ARAO_QA_MODULES ? path.join(process.env.ARAO_QA_MODULES,'package.json') : import.meta.url);
const {JSDOM}=require('jsdom');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=await readFile(path.join(root,'prototipo/index.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function boot({url='https://maquete.test/',storage,fetcher}={}){
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(storage)w.localStorage.setItem('arao-mendes-office-demo-v1',storage);
 w.fetch=fetcher||(()=>{throw Error('A maquete offline não deve chamar a rede.');});
 w.eval(script);return {dom,w,app:w.araoOffice,d:w.document,close:()=>w.close()};
}
function click(w,s){const el=w.document.querySelector(s);assert.ok(el,`Elemento ${s} deve existir`);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));}
test('HTML autocontido tem sintaxe válida e não contém dependências externas',()=>{
 new Script(script);assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html));assert.equal((script.match(/^import /gm)||[]).length,0);
});
test('a planta possui os agentes processuais e dois chefes humanos únicos',()=>{
 const {d,app,close}=boot();try{
 assert.equal(d.querySelectorAll('#office-svg .person').length,DEFAULT_AGENTS.length);
 assert.equal(app.state.agents.filter(a=>a.human).length,2);
 for(const id of ['daniel','proprietario','movimentacoes','controladoria','forense'])assert.equal(d.querySelectorAll(`#person-${id}`).length,1);
 assert.ok(d.querySelector('#wall-dashboard[role=button]'));
 }finally{close();}
});
test('clicar no telão amplia gráficos e o período altera os valores',()=>{
 const {w,d,app,close}=boot();try{
 click(w,'#wall-dashboard');assert.equal(d.querySelector('#modal').open,true);assert.match(d.querySelector('#modal-title').textContent,/pulso/);
 click(w,'[data-period=month]');assert.equal(app.state.period,'month');assert.match(d.querySelector('.modal-content').textContent,/38400|38\.400/);assert.match(d.querySelector('#wall-dashboard').textContent,/23/);
 }finally{close();}
});
test('filtro destaca setor preservando personagens e estações independentes',()=>{
 const {w,d,app,close}=boot();try{
 click(w,'[data-sector-filter=administrativo]');assert.equal(app.state.sector,'administrativo');assert.equal(d.querySelectorAll('#person-daniel').length,1);
 assert.equal(d.querySelector('#person-redator').parentElement.getAttribute('opacity'),'0.16');
 click(w,'#person-movimentacoes');assert.match(d.querySelector('#inspector').textContent,/Breno/);
 }finally{close();}
});
test('criar agente conserva função, aparência e especialidade após reabrir',()=>{
 const {w,d,app,close}=boot();let storage;
 try{
 click(w,'[data-action=new-agent]');const f=d.querySelector('#agent-form');
 const vals={name:'Helena',role:'Provas de consumo',sector:'juridico',area:'Consumidor',color:'#abcdef',accessory:'glasses',skin:'#8d654a',hair:'#252020',personality:'Acolhedora e precisa.',task:'Conferir recibos e documentos.'};
 for(const [k,v]of Object.entries(vals))f.elements.namedItem(k).value=v;
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const a=app.state.agents.find(a=>a.name==='Helena');assert.ok(a);assert.equal(a.role,vals.role);assert.equal(a.area,'Consumidor');assert.equal(a.color,'#abcdef');assert.equal(a.personality,'Acolhedora e precisa.');
 assert.ok(d.querySelector(`[data-agent="${a.id}"]`));storage=w.localStorage.getItem('arao-mendes-office-demo-v1');
 }finally{close();}
 const reopened=boot({storage});try{assert.equal(reopened.app.state.agents.filter(a=>a.name==='Helena').length,1);}finally{reopened.close();}
});
test('dados de personagem são escapados e importação inválida não cria humanos',()=>{
 const s=initialState();const a=addAgent(s,{name:'<img onerror=alert(1)>',role:'Análise',sector:'juridico',area:'Cível',color:'#abcdef',accessory:'tie'});a.human=true;
 const {d,close}=boot({storage:JSON.stringify(s)});try{assert.equal(d.querySelectorAll('#office-svg img').length,0);assert.equal(d.querySelectorAll('#office-svg .human').length,2);}finally{close();}
 assert.equal(restoreState('{json quebrado').agents.length,DEFAULT_AGENTS.length);
});
test('área Penal filtra funções e o acompanhamento diferencia prazos e andamentos',()=>{
 const {w,d,close}=boot();try{
 click(w,'[data-action=team]');const sel=d.querySelector('#team-area');sel.value='Penal';sel.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('.team-member').length,2);
 click(w,'[data-action=close]');click(w,'[data-action=processes]');assert.match(d.querySelector('.modal-content').textContent,/Caso demonstrativo/);
 click(w,'[data-proc-tab=deadlines]');assert.match(d.querySelector('.modal-content').textContent,/Sugestão/);assert.match(d.querySelector('.modal-content').textContent,/Clara/);
 }finally{close();}
});
test('novo caso termina em revisão humana e não faz solicitações externas',async()=>{
 let calls=0;const {app,close}=boot({fetcher:()=>{calls++;throw Error('Rede não permitida nesta simulação.');}});
 try{await app.runWorkflow('intake');assert.equal(app.state.agents.find(a=>a.id==='daniel').status,'review');assert.equal(calls,0);assert.equal(app.running,false);assert.ok(app.state.logs.some(l=>l.text.includes('revisão humana')));}finally{close();}
});
test('modo Gabinete usa o endpoint autenticado e dados reais do fixture sem gerar zeros faltantes',async()=>{
 const calls=[];const fixture={schemaVersion:1,mode:'live',generatedAt:'2026-10-15T01:00:00Z',summary:{totalProcessos:2,venceEm7Dias:1,sugeridos:1,intimacoesSemAnalise:1,clientesSugeridos:0},metrics:{label:'Gabinete',processes:2,deadlines:1,leads:null,contracts:null,petitions:0,received:null,series:[],funnel:[]},processes:[{id:'abc-1',numeroCnj:'REGISTRO-FIXTURE',tribunal:'TJ-TESTE',fase:'postulatória'}],deadlines:[],notices:[],health:[]};
 const x=boot({url:'https://gabinete.test/escritorio-visual/index.html?mode=gabinete',fetcher:async(u,o)=>{calls.push([u,o]);return {ok:true,json:async()=>fixture};}});
 try{await new Promise(r=>setTimeout(r,20));assert.equal(calls[0][0],'/api/escritorio/estado');assert.equal(calls[0][1].credentials,'same-origin');assert.match(x.d.querySelector('#kpis').textContent,/2/);assert.equal(x.app.metric().leads,null);x.app.processual();assert.match(x.d.querySelector('.modal-content').textContent,/REGISTRO-FIXTURE/);assert.equal(x.app.state.agents.find(a=>a.id==='movimentacoes').status,'waiting');}
 finally{x.close();}
});
test('falha da fonte real não cai em dados de demonstração',async()=>{
 const x=boot({url:'https://gabinete.test/?mode=gabinete',fetcher:async()=>({ok:false,status:503})});
 try{await new Promise(r=>setTimeout(r,20));assert.equal(x.app.snapshot,null);assert.equal(x.app.metric().processes,null);assert.doesNotMatch(x.d.querySelector('#kpis').textContent,/128/);assert.match(x.d.querySelector('.demo-badge').textContent,/SEM CONEXÃO/);}finally{x.close();}
});
test('adaptador financeiro só faz GET no servidor e não converte novamente chartData',async()=>{
 let request;const data={periodReceived:1200,chartData:[{value:500}],chartCurrency:'BRL'};
 const api=new FinanceiroRead({baseUrl:'http://127.0.0.1:3002/api/agent/v1',token:'fixture-only',fetcher:async(u,o)=>{request=[u,o];return {ok:true,json:async()=>data};}});
 assert.equal(await api.metrics('2026-10-01','2026-10-14'),data);assert.equal(request[1].method,'GET');assert.equal(request[1].headers.Authorization,'Bearer fixture-only');assert.equal(request[0].pathname,'/api/agent/v1/dashboard/metrics');assert.equal(data.chartData[0].value,500);
 await assert.rejects(()=>api.get('/personal/transactions'),/escopo/);
});
test('vista pixel é inicial e alternar vista preserva equipe, seleção e dados',()=>{
 const x=boot();try{
  assert.equal(x.app.state.view,'pixel');assert.ok(x.d.querySelector('.pixel-map'));assert.equal(x.d.querySelectorAll('.pixel-room').length,7);
  click(x.w,'#person-controladoria');click(x.w,'[data-action=toggle-view]');assert.equal(x.app.state.view,'iso');assert.equal(x.app.selected,'controladoria');assert.equal(x.d.querySelectorAll('#person-daniel').length,1);
  click(x.w,'[data-action=toggle-view]');assert.equal(x.app.state.view,'pixel');assert.equal(x.app.selected,'controladoria');assert.ok(x.d.querySelector('#wall-dashboard'));
 }finally{x.close();}
});
test('circulação pixel termina na estação e usa pontos dentro do mapa',()=>{
 for(const a of DEFAULT_AGENTS.filter(a=>!a.human)){
  const path=PixelScene.route(a);assert.deepEqual(path[0],{x:a.x,y:a.y});assert.deepEqual(path.at(-1),path[0]);
  for(const p of path)assert.ok(p.x>=0&&p.x<=1120&&p.y>=0&&p.y<=830);
 }
});
test('caminhada move o personagem e restaura a estação ao terminar',async()=>{
 const x=boot();try{
  x.app.reduceMotion=false;const a=x.app.state.agents.find(a=>a.id==='sdr');
  const promise=x.app.walk(a),walker=x.d.querySelector('#walker');
  assert.equal(walker.getAttribute('visibility'),'visible');assert.equal(x.d.querySelector('#person-sdr').style.visibility,'hidden');
  await new Promise(r=>setTimeout(r,120));assert.match(walker.getAttribute('transform'),/translate/);
  await promise;assert.equal(walker.getAttribute('visibility'),'hidden');assert.equal(x.d.querySelector('#person-sdr').style.visibility,'');
 }finally{x.close();}
});
test('módulos operacionais: Telegram, Clientes, Petições e Financeiro funcionam ponta a ponta',()=>{
 const x=boot();try{
  // 1. Petições: abrir editor, verificar inteiro teor e aprovar como Dr. Daniel Felix
  click(x.w,'[data-action=petitions]');
  assert.match(x.d.querySelector('#petition-editor-text').value,/EXCELENTÍSSIMO/);
  assert.match(x.d.querySelector('#petition-editor-text').value,/DR\. DANIEL FELIX/);
  click(x.w,'#btn-approve-pet');
  assert.equal(x.app.state.petitions.find(p=>p.id==='pec-1').status,'approved');
  // 2. Clientes: abrir pasta 360° e conferir qualificação e documentos
  click(x.w,'[data-action=clients]');
  assert.match(x.d.querySelector('#client-detail-panel').textContent,/Maria Carolina Mendes/);
  assert.match(x.d.querySelector('#client-detail-panel').textContent,/348\.912\.408-15/);
  // 3. Financeiro: dar baixa em parcela e atualizar caixa recebido
  const beforePaid=x.app.finTotals().paid;
  click(x.w,'[data-action=financeiro]');
  click(x.w,'[data-pay-fin="fin-2"]');
  assert.ok(x.app.finTotals().paid>beforePaid);
  // 4. Telegram: enviar comando /prazos e receber resposta da Coordenadora Luana
  const msgCount=x.app.state.telegramMessages.length;
  click(x.w,'[data-tg-cmd="/prazos"]');
  assert.equal(x.app.state.telegramMessages.length,msgCount+2);
 }finally{x.close();}
});


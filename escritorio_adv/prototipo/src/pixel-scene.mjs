import {SECTORS,STATUS_COLORS,escapeHtml} from './model.mjs';
// Arte vetorial original em pixel art; nenhuma textura ou sprite do Reel é copiado.
export const PixelScene=(()=>{
 const e=escapeHtml;
 const point=(x,y,z=0)=>[85+x*1.15,130+y*.95-z];
 const r=(x,y,w,h,c,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`;
 const text=(x,y,t,size=10,c='#d8d7ca',extra='')=>`<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-family="monospace" ${extra}>${e(t)}</text>`;
 const longHair=new Set(['sdr','agenda','tese','analista','redator','assinaturas','etica']);
 function sprite(a){
  const shirt=a.color||'#a58db9',skin=a.skin||'#cf9873',hair=a.hair||'#372b27';
  let s=`<ellipse cx="0" cy="4" rx="17" ry="5" fill="#263129" opacity=".22"/><g class="body-bob" shape-rendering="crispEdges">`;
  if(longHair.has(a.id)||a.accessory==='headset')s+=r(-13,-61,26,36,hair);
  s+=r(-9,-20,7,20,'#35424e')+r(3,-20,7,20,'#35424e')+r(-11,-2,9,5,'#202b36')+r(3,-2,10,5,'#202b36');
  s+=r(-12,-45,25,27,shirt)+r(-16,-41,5,19,shirt)+r(13,-41,5,19,shirt)+r(-16,-25,5,6,skin)+r(13,-25,5,6,skin);
  s+=r(-4,-46,8,7,'#f3e5c6')+r(-2,-40,4,15,a.human?'#705036':'#e6dcc3');
  s+=r(-11,-68,23,23,skin)+r(-14,-61,4,9,skin)+r(12,-61,4,9,skin)+r(-10,-71,22,8,hair)+r(-13,-67,5,11,hair)+r(9,-67,5,8,hair);
  s+=r(-8,-58,4,4,'#f5edda')+r(4,-58,4,4,'#f5edda')+r(-6,-58,2,4,'#2d3333')+r(5,-58,2,4,'#2d3333')+r(-3,-49,7,2,'#98644e');
  s+=r(-10,-52,3,2,'#c47d64')+r(9,-52,3,2,'#c47d64');
  if(a.accessory==='glasses')s+=`<path d="M-10-60h9v7h-9zm12 0h9v7H2m-3-4h3" stroke="#2f3c42" stroke-width="2" fill="#afc8ca" fill-opacity=".3"/>`;
  if(a.accessory==='headset')s+=`<path d="M-15-58v-10h5v-5h19v5h6v13" stroke="#263d49" stroke-width="4" fill="none"/>${r(-17,-61,5,11,'#71929b')}${r(13,-61,5,11,'#71929b')}<path d="M15-50h-8" stroke="#405560" stroke-width="2"/>`;
  if(a.accessory==='gold')s+=r(6,-36,4,4,'#e6bb53');
  return s+'</g>';
 }
 function chair(x,y,color='#5c7d88'){
  return r(x-15,y-37,30,23,'#3a505b')+r(x-13,y-35,26,17,color)+r(x-16,y-15,32,11,'#3a505b')+r(x-13,y-15,26,7,color)+r(x-2,y-3,4,8,'#70777a')+`<path d="M${x-13} ${y+6}h26" stroke="#596064" stroke-width="3"/>`;
 }
 function desk(a){
  const p=point(a.x,a.y),x=p[0]-(a.sector==='juridico'?10:0),y=p[1],wood=a.sector==='juridico'?'#a48b75':'#aa8a64';
  let s=chair(x,y,'#526f7c')+r(x-45,y-34,111,41,'#776044')+r(x-45,y-39,111,36,wood)+r(x-45,y-39,111,3,'#d2b184');
  s+=r(x-37,y+7,6,9,'#495252')+r(x+52,y+7,6,9,'#495252')+r(x+13,y-69,39,27,'#25343c')+r(x+16,y-66,33,21,'#96bbb6')+r(x+30,y-42,5,7,'#52646c');
  s+=r(x+20,y-60,23,2,'#486878')+r(x+20,y-54,16,2,'#eff0d4')+r(x+20,y-49,20,2,'#628a84')+r(x+11,y-28,39,10,'#d1c5ac')+r(x+14,y-26,32,2,'#9a9a8b');
  s+=r(x-32,y-24,19,15,'#efead6')+r(x-29,y-21,12,2,'#bcc0b4')+r(x+56,y-29,8,11,'#eee2bd')+r(x+64,y-27,3,7,'#a6b1a4');
  return s;
 }
 function plant(x,y){
  return `<g shape-rendering="crispEdges">${r(x-11,y-13,22,21,'#927452')}${r(x-14,y-17,28,7,'#b19368')}${r(x-3,y-38,6,23,'#647153')}${r(x-18,y-43,16,18,'#568b67')}${r(x+1,y-47,16,19,'#3f7959')}${r(x-8,y-59,17,25,'#75a36e')}${r(x-4,y-56,5,13,'#88b580')}</g>`;
 }
 function shelves(x,y,w=110){
  let s=r(x,y,w,41,'#806f58')+r(x+4,y+3,w-8,34,'#564e40');
  for(let row=0;row<2;row++){
   for(let i=0;i<Math.floor((w-10)/8);i++)s+=r(x+7+i*8,y+5+row*17,6,13,['#b8b4a3','#9b6d5c','#91a6a2','#d6b77d','#9186a4'][i%5]);
   s+=r(x+4,y+18+row*17,w-8,3,'#b39a74');
  }return s;
 }
 function room(id,conf,state){
  const [wx,wy,ww,wh]=conf.box,[x,y]=point(wx,wy),w=ww*1.15,h=wh*.95;
  const floor={comercial:'#ded9ca',administrativo:'#d8d8ce',contratos:'#d8d9d4',juridico:'#d4c9ba',diretoria:'#c5aa7c',financeiro:'#d2d8cb',etica:'#d9cec8'}[id];
  const label={comercial:'RELACIONAMENTO',administrativo:'ACOMPANHAMENTO PROCESSUAL',contratos:'CONTRATOS E ASSINATURAS',juridico:'NÚCLEO JURÍDICO',diretoria:'DANIEL + PROPRIETÁRIO',financeiro:'FINANCEIRO',etica:'ÉTICA E OAB · APOIO INTERNO'}[id];
  const side={comercial:'bottom',administrativo:'bottom',contratos:'bottom',juridico:'right',diretoria:'top',financeiro:'left',etica:'left'}[id],door=58;
  let s=`<g class="pixel-room" data-sector="${id}" opacity="${state.sector!=='all'&&state.sector!==id?.45:1}">`;
  s+=r(x-5,y-7,w+10,h+14,'#6b716b')+r(x,y,w,h,floor);
  if(id==='diretoria'||id==='juridico'){
   for(let yy=y+10;yy<y+h;yy+=17)s+=r(x,yy,w,1,'#a78e6e','opacity=".28"');
   for(let xx=x+38;xx<x+w;xx+=80)s+=r(xx,y,1,h,'#b1987b','opacity=".22"');
  }else{
   for(let xx=x+35;xx<x+w;xx+=35)s+=r(xx,y,1,h,'#8b968e','opacity=".2"');
   for(let yy=y+35;yy<y+h;yy+=35)s+=r(x,yy,w,1,'#8b968e','opacity=".2"');
  }
  const wall=(sideName,xx,yy,ww,hh)=>{
   if(side!==sideName)return r(xx,yy,ww,hh,'#f0ebdb')+r(xx,yy+hh-3,ww,3,'#b5b6aa');
   if(sideName==='top'||sideName==='bottom')return r(xx,yy,(ww-door)/2,hh,'#ede7d7')+r(xx+(ww+door)/2,yy,(ww-door)/2,hh,'#ede7d7');
   return r(xx,yy,ww,(hh-door)/2,'#ede7d7')+r(xx,yy+(hh+door)/2,ww,(hh-door)/2,'#ede7d7');
  };
  s+=wall('top',x-5,y-16,w+10,16)+wall('left',x-5,y,9,h)+wall('right',x+w-4,y,9,h)+wall('bottom',x-5,y+h-3,w+10,10);
  s+=r(x+12,y-12,w-24,3,conf.color);
  const labelBoxW=Math.min(w-20,label.length*8.2+24);
  s+=r(x+12,y-19,labelBoxW,26,'#223339','rx="4"')+text(x+22,y-2,label,12,conf.color,'font-weight="700"');
  let pendingCount=0;
  if(id==='juridico')pendingCount=(state.petitions||[]).filter(p=>p.status==='review').length;
  else if(id==='administrativo')pendingCount=(state.deadlinesList||[]).filter(d=>d.status==='Sugestão').length;
  else if(id==='contratos')pendingCount=(state.contractsList||[]).filter(c=>c.status==='review'||c.status==='partial').length;
  else if(id==='financeiro')pendingCount=(state.financeiro?.outbox||[]).filter(o=>o.status==='pending').length;
  else if(id==='comercial')pendingCount=(state.clients||[]).filter(c=>c.stage?.includes('Triagem')||c.stage?.includes('revisão')).length;
  if(pendingCount>0){
    const bx=x+labelBoxW+8,by=y-16;
    s+=`<g class="room-alert-badge" title="${pendingCount} pendência(s) aguardando">${r(bx,by,24,20,'#d9534f','rx="10" stroke="#fff" stroke-width="1"')}${text(bx+12,by+14,String(pendingCount),11,'#ffffff','text-anchor="middle" font-weight="700"')}</g>`;
  }
  if(id==='comercial')s+=shelves(x+w-110,y+48,88);
  if(id==='contratos')s+=shelves(x+w-105,y+48,84);
  if(id==='juridico')s+=shelves(x+14,y+46,92);
  if(id==='diretoria')s+=r(x+22,y+50,w-44,h-76,'#b38e57','opacity=".18"');
  return s+'</g>';
 }
 function dashboard(m){
  m=m||{processes:128,contracts:7,series:[4,8,6,12,9,15,18]};
  const v=x=>x==null?'—':String(x);
  let s=`<g id="wall-dashboard" class="wall-screen" data-action="metrics" role="button" tabindex="0" aria-label="Ampliar o telão de métricas"><title>Clique para ampliar métricas e gráficos</title>`;
  s+=r(1002,26,359,112,'#45545c','rx="4"')+r(1008,31,347,100,'#172d38','rx="2"')+r(1017,40,329,2,'#c0a56e');
  s+=text(1022,58,'PAINEL DA OPERAÇÃO',12,'#d9c08c','font-weight="700"')+text(1022,90,v(m.processes),26,'#ede8d8','font-weight="700"')+text(1086,89,'PROCESSOS',11,'#a5bebc','font-weight="600"');
  s+=text(1022,117,v(m.contracts),20,'#d4bc85','font-weight="700"')+text(1058,117,'CONTRATOS',11,'#a5bebc','font-weight="600"');
  if(m.series?.length){const max=Math.max(...m.series,1),pts=m.series.map((v,i)=>[1175+i*25,117-v/max*46]);s+=`<path d="M${pts.map(p=>p.join(' ')).join('L')}" fill="none" stroke="#80bea4" stroke-width="3"/>`;}
  else s+=text(1175,101,'LEITURA DO MVP',12,'#a5bebc');
  s+=text(1305,58,'↗',15,'#e1c990');return s+'</g>';
 }
 function person(a,selected,state){
  const [x,y]=point(a.x,a.y),color=STATUS_COLORS[a.status];
  const dim=(state.sector!=='all'&&a.sector!==state.sector)||(state.area!=='Todas'&&a.area!==state.area&&a.area!=='Geral');
  const bubbleLabels={redator:'Minuta para revisão',controladoria:'Conferindo o prazo',movimentacoes:'Acompanhando o MVP',assinaturas:'Aguardando assinatura',coordenador:'Coordenando no Telegram'};
  const bubble=bubbleLabels[a.id]&&(selected||['redator','assinaturas','movimentacoes'].includes(a.id));
  let s=`<g class="agent-wrap" opacity="${dim?.16:1}"><g id="person-${e(a.id)}" class="person pixel-person ${a.human?'human':'agent'} ${a.status==='working'?'busy':''} ${selected?'selected':''}" data-agent="${e(a.id)}" tabindex="0" role="button" aria-label="${e(a.name+' · '+a.role)}" transform="translate(${x},${y})" style="--delay:${-((a.x+a.y)%8)/3}s"><title>${e(a.name+' · '+a.role)}</title>`;
  if(selected)s+='<ellipse cx="0" cy="4" rx="26" ry="11" stroke="#b78d43" fill="#f2d99c" fill-opacity=".35" stroke-width="2"/>';
  s+=sprite(a);
  s+=`<g class="nameplate">${r(-56,-96,112,22,'#1e3138','rx="4" stroke="'+color+'" stroke-width="1.5" stroke-opacity=".85"')}<circle cx="-45" cy="-85" r="3.2" fill="${color}"/>${text(4,-81,a.name.slice(0,15),12,'#f6f4e8','text-anchor="middle" font-weight="700"')}</g>`;
  if(bubble){const label=state.live?'Execução não conectada':bubbleLabels[a.id],w=label.length*7.2+22;s+=`<g class="task-bubble">${r(-w/2,-128,w,26,'#fbf7e9','rx="4" stroke="#7d8f82" stroke-width="1.4"')}<path d="M-5-102l6 8 6-8" fill="#fbf7e9"/>${text(0,-111,label,11.5,'#2c3b36','text-anchor="middle" font-weight="700"')}</g>`;}
  return s+'</g></g>';
 }
 function markup(state,selected,m){
  let s=`<svg xmlns="http://www.w3.org/2000/svg" id="office-svg" class="pixel-map" viewBox="0 0 1480 1030" role="group" aria-label="Escritório Daniel Felix em pixel art, com salas e agentes independentes"><defs><pattern id="pixel-sidewalk" width="38" height="22" patternUnits="userSpaceOnUse"><rect width="38" height="22" fill="#b4bbb3"/><path d="M0 0h38v22H0z" fill="none" stroke="#8f9b93" stroke-width="1"/></pattern></defs><g id="camera">`;
  s+=r(62,135,1331,811,'#07131a','opacity=".35" rx="6"')+r(75,116,1308,814,'#63716a')+r(85,126,1288,793,'#c9cbbb');
  for(let yy=137;yy<920;yy+=36)s+=r(85,yy,1288,1,'#9fa99c','opacity=".2"');
  for(let xx=100;xx<1373;xx+=36)s+=r(xx,126,1,793,'#9fa99c','opacity=".2"');
  s+=r(75,105,1308,25,'#ede8d7')+r(75,126,1308,6,'#778279');
  s+=r(135,54,660,75,'#3f514c','rx="3"')+r(148,66,49,49,'#a18756')+text(151,99,'DF',26,'#f3e1af','font-weight="700"')+text(221,89,'DANIEL FELIX',27,'#e3c98e','letter-spacing="4" font-weight="700"')+text(223,114,'ADVOCACIA · ESCRITÓRIO VIRTUAL OPERADO NO TELEGRAM',11.5,'#d4e0d6','letter-spacing="1.5" font-weight="600"');
  s+=dashboard(m);
  for(const [id,c]of Object.entries(SECTORS))if(c.box)s+=room(id,c,state);
  // Mesa de direção: dois humanos únicos e estações separadas das pessoas.
  const [tx,ty]=point(445,495);
  s+=chair(...point(480,560),'#7d6450')+chair(...point(635,560),'#7d6450');
  s+=r(tx,ty+12,235,70,'#876846')+r(tx,ty+7,235,58,'#b99565')+r(tx,ty+7,235,4,'#e0bc83');
  s+=r(tx+20,ty+22,38,25,'#f1e8d0')+r(tx+152,ty+19,39,27,'#283e49')+r(tx+155,ty+22,33,21,'#8ea9a1')+r(tx+95,ty+37,29,12,'#e1d3a4');
  for(const a of [...state.agents].sort((a,b)=>a.y-b.y))if(!a.human)s+=desk(a);
  // Elementos de uso compartilhado e elementos decorativos desenhados em código.
  s+=r(584,822,215,53,'#738d7a')+r(594,814,195,44,'#96a68b')+r(604,821,55,31,'#c7c1a5')+r(670,821,55,31,'#c7c1a5')+r(735,821,44,31,'#c7c1a5');
  s+=r(628,871,136,22,'#263c3c','rx="4"')+text(696,886,'MESA DE ALINHAMENTO',11,'#e6e4cc','text-anchor="middle" font-weight="700"');
  const decorations=[[109,470],[509,474],[933,470],[1334,470],[545,862],[1340,877]];
  for(const p of decorations)s+=plant(...p);
  // Áreas filtradas ficam discretas; nomes e tarefas continuam acessíveis pela lista da equipe.
  for(const a of [...state.agents].sort((a,b)=>a.y-b.y))s+=person(a,a.id===selected,state);
  s+='<g id="walker" visibility="hidden" pointer-events="none"></g>';
  s+=r(75,924,1308,10,'#607065')+r(75,936,1308,35,'#71865d');
  for(let i=0;i<26;i++)s+=r(78+i*50,937,43,17,'#83a568')+r(81+i*50,938,37,4,'#96b478');
  s+=r(75,974,1308,27,'url(#pixel-sidewalk)')+text(740,1020,'SALAS POR SETOR · OBJETOS CLICÁVEIS · PERSONAGENS INDEPENDENTES',12,'#cbd4c4','text-anchor="middle" font-weight="700"');
  return s+'</g></svg>';
 }
 function route(a){
  const home={x:a.x,y:a.y},center={x:550,y:355};
  let exit;
  if(a.sector==='juridico')exit=[{x:a.x,y:600},{x:390,y:600},{x:390,y:355}];
  else if(a.sector==='financeiro')exit=[{x:a.x,y:500},{x:730,y:500},{x:730,y:355}];
  else if(a.sector==='etica')exit=[{x:a.x,y:730},{x:730,y:730},{x:730,y:355}];
  else if(a.sector==='diretoria')exit=[center];
  else {const door={comercial:185,administrativo:545,contratos:902}[a.sector]||a.x;exit=[{x:door,y:a.y},{x:door,y:355}];}
  const out=[home,...exit,center];return [...out,...out.slice(0,-1).reverse()];
 }
 return {point,avatar:sprite,markup,route};
})();

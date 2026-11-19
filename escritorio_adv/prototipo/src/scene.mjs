import {SECTORS,STATUS_COLORS,escapeHtml as esc} from './model.mjs';
import {PixelScene} from './pixel-scene.mjs';
// Motor vetorial original: objetos e personagens independentes, sem imagem de fundo.
export const iso=(x,y,z=0)=>[635+(x-y)*.72,195+(x+y)*.34-z];
const pt=p=>p.map(n=>Math.round(n*100)/100).join(',');
const poly=(p,fill,more='')=>`<polygon points="${p.map(pt).join(' ')}" fill="${fill}" ${more}/>`;
export function tint(hex,n){const a=hex.slice(1).match(/../g).map(c=>Math.max(0,Math.min(255,parseInt(c,16)+n)));return '#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');}
export function plane(x,y,w,d,z,color,more=''){return poly([iso(x,y,z),iso(x+w,y,z),iso(x+w,y+d,z),iso(x,y+d,z)],color,more);}
export function block(x,y,w,d,z,h,color){
  return poly([iso(x,y+d,z),iso(x+w,y+d,z),iso(x+w,y+d,z+h),iso(x,y+d,z+h)],tint(color,-28))+
    poly([iso(x+w,y,z),iso(x+w,y+d,z),iso(x+w,y+d,z+h),iso(x+w,y,z+h)],tint(color,-46))+
    plane(x,y,w,d,z+h,tint(color,10));
}
function desk(x,y,c='#b29169',w=100){
  let s=block(x-47,y-25,6,6,0,38,'#303b42')+block(x+34,y+12,6,6,0,38,'#303b42')+block(x-50,y-30,w,60,38,7,c);
  s+=block(x-19,y-18,38,5,45,31,'#1b2932');
  const a=iso(x-17,y-12,73);
  s+=`<g transform="translate(${pt(a)}) skewY(25)"><rect width="24" height="17" fill="${tint(c,20)}" opacity=".85"/><path d="M3 12h4V7h4v3h4V3h4" fill="none" stroke="#dae8dd" stroke-width="1.5"/></g>`;
  s+=plane(x-18,y+8,34,11,46,'#ddd4c0')+block(x+31,y,8,8,46,8,'#eee3cd');
  return s;
}
function chair(x,y){return block(x-17,y-8,32,30,0,6,'#1c282c')+block(x-4,y+4,6,6,6,16,'#697077')+block(x-19,y-10,37,30,22,7,'#344751')+block(x-19,y+14,37,7,29,29,'#425863');}
function plant(x,y,scale=1){
  return block(x-14,y-14,28,28,0,28,'#8e7659')+block(x-3,y-3,6,6,28,27,'#707b4b')+block(x-25,y-17,28,22,43,22,'#56866d')+block(x+2,y-7,24,23,54,23,'#3e715c')+block(x-17,y-20,25,26,67,20,'#6b9974');
}
function bookshelf(x,y){let s=block(x,y,23,105,0,90,'#5b493c');for(let z=16;z<=70;z+=27){s+=block(x+23,y+5,3,95,z,4,'#b69264');for(let t=0;t<7;t++)s+=block(x+23,y+7+t*13,6,9,z+4,17,['#a7b394','#bda373','#7d9297','#8d7c90'][t%4]);}return s;}
function label(x,y,name,color){const p=iso(x,y,5);return `<g transform="translate(${pt(p)})"><rect x="-6" y="-19" width="${Math.max(88,name.length*6.8+22)}" height="26" rx="5" fill="#111d25" fill-opacity=".92" stroke="${color}" stroke-opacity=".6"/><text x="5" y="-2" fill="${color}" font-size="12" font-weight="700" letter-spacing="1" font-family="Arial,sans-serif">${esc(name)}</text></g>`;}
export function avatar(a,scale=1){
  const c=a.color,skin=a.skin||'#cf9873',hair=a.hair||'#372b27';
  let s=`<ellipse cx="0" cy="4" rx="20" ry="7" fill="#08151e" opacity=".38"/>`;
  s+=`<g class="body-bob">${block(-11,-4,9,10,0,19,'#24303e')}${block(3,-4,9,10,0,19,'#24303e')}${block(-13,-4,28,15,19,27,c)}${block(-20,-3,7,13,20,22,tint(c,-10))}${block(16,-3,7,13,20,22,tint(c,-10))}${block(-20,0,7,10,15,7,skin)}${block(16,0,7,10,15,7,skin)}${block(-12,-4,25,20,47,24,skin)}${block(-14,-6,29,23,69,6,hair)}`;
  // Cubos do corpo usam projeção própria e são reposicionados na origem do personagem.
  s=s.replace(/points="([^"]+)"/g,(_,points)=>`points="${points.split(' ').map(p=>{const [x,y]=p.split(',').map(Number);return pt([x-635,y-195]);}).join(' ')}"`);
  s+=`<path d="M-4 -45l4 6 3-6 -3 20z" fill="${a.human?'#ecdfbf':'#e3e3d8'}"/><rect x="-6" y="-60" width="3" height="3" fill="#2a302d"/><rect x="5" y="-55" width="3" height="3" fill="#2a302d"/>`;
  if(a.accessory==='headset')s+=`<path d="M-16 -58q0-22 19-14l11 12" fill="none" stroke="#202e3b" stroke-width="5"/><rect x="-18" y="-60" width="6" height="12" fill="#4c6676"/><path d="M-15 -48l9 5" stroke="#cdd4cc" stroke-width="2"/>`;
  if(a.accessory==='glasses')s+=`<path d="M-9 -63l8 4v6l-8-4zm12 6l8 4v6l-8-4zM-1 -57l4 2" fill="#e5e7da" fill-opacity=".4" stroke="#2b3438" stroke-width="1.5"/>`;
  if(a.accessory==='gold')s+=`<rect x="4" y="-35" width="5" height="5" fill="#edca75"/>`;
  s+='</g>';
  return `<g transform="scale(${scale})">${s}</g>`;
}
export function agentGroup(a,selected=false){
  const p=iso(a.x,a.y,0),status=STATUS_COLORS[a.status];
  return `<g class="person ${selected?'selected ':''}${a.human?'human':'agent'} ${a.status==='working'?'busy':''}" id="person-${esc(a.id)}" data-agent="${esc(a.id)}" tabindex="0" role="button" aria-label="${esc(a.name+' · '+a.role)}" transform="translate(${pt(p)})" style="--agent-color:${a.color};--delay:${-((a.x+a.y)%8)/3}s"><title>${esc(a.name+' · '+a.role)}</title>${selected?'<ellipse cx="0" cy="4" rx="27" ry="12" fill="none" stroke="#eed39b" stroke-width="2"/>':''}${avatar(a)}<g class="nameplate"><rect x="-52" y="-102" width="104" height="22" rx="5" fill="#101d26" stroke="${status}" stroke-width="1.4" stroke-opacity=".75"/><circle cx="-41" cy="-91" r="3" fill="${status}"/><text x="3" y="-87" text-anchor="middle" fill="#f1ede4" font-size="11.5" font-weight="700" font-family="Arial,sans-serif">${esc(a.name.slice(0,15))}</text></g></g>`;
}
function display(metrics){
  const m=metrics||{processes:128,contracts:7,label:'Esta semana'},n=v=>v===null||v===undefined?'—':esc(v);
  const p=iso(760,5,182);
  return `<g id="wall-dashboard" data-action="metrics" role="button" tabindex="0" aria-label="Ampliar dashboard de métricas" class="wall-screen" transform="matrix(.72 .34 0 1 ${p[0]} ${p[1]})"><title>Clique para ampliar as métricas</title><rect x="-8" y="-8" width="332" height="161" rx="5" fill="#253039" stroke="#d6b673" stroke-width="2"/><rect width="316" height="145" rx="3" fill="#10212b"/><text x="15" y="20" font-size="10" font-family="Arial,sans-serif" fill="#d6b673" letter-spacing="2">PAINEL DA OPERAÇÃO</text><text x="15" y="52" font-size="24" font-weight="bold" font-family="Arial,sans-serif" fill="#f7efdd">${n(m.processes)}</text><text x="15" y="69" font-size="9" font-family="Arial,sans-serif" fill="#9fb2ba">PROCESSOS</text><text x="139" y="52" font-size="24" font-family="Arial,sans-serif" fill="#f7efdd">${n(m.contracts)}</text><text x="139" y="69" font-size="9" font-family="Arial,sans-serif" fill="#9fb2ba">CONTRATOS</text>${m.series?.length?'<path d="M16 121l31-8 26 4 28-21 29 9 30-23 28 8 26-24 25 6 28-17 33 3" stroke="#70c4a1" stroke-width="3" fill="none"/>':'<text x="16" y="112" font-family="Arial,sans-serif" font-size="11" fill="#9fb2ba">LEITURA DO GABINETE</text>'}<path d="M16 132h284" stroke="#34434c"/><text x="117" y="140" font-family="Arial,sans-serif" font-size="8" fill="#d6b673">${m.label==='Gabinete'?'GABINETE':'DADOS DEMO'} · CLIQUE PARA AMPLIAR ↗</text></g>`;
}
export function isometricSceneMarkup(state,selectedId=null,metrics=null){
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 960" id="office-svg" role="group" aria-label="Escritório virtual Daniel Felix; use a lista Equipe para navegar pelos agentes"><defs><radialGradient id="floor-light"><stop stop-color="#c2a56a" stop-opacity=".18"/><stop offset="1" stop-color="#c2a56a" stop-opacity="0"/></radialGradient><linearGradient id="room-bg" x2="0" y2="1"><stop stop-color="#1d2c36"/><stop offset="1" stop-color="#101c25"/></linearGradient></defs><g id="camera"><ellipse cx="744" cy="631" rx="640" ry="260" fill="#060c12" opacity=".5"/>`;
  s+=block(0,0,1120,830,-22,22,'#465159');
  // Duas paredes de fundo; as faces da frente ficam abertas para enxergar o trabalho.
  s+=block(-10,-10,1140,12,0,140,'#435258')+block(-10,0,12,830,0,140,'#38494f');
  s+=plane(4,6,1109,816,1,'#6b716d');
  for(let x=5;x<1120;x+=56)s+=poly([iso(x,5,2),iso(x,824,2)],'none','stroke="#93978b" stroke-opacity=".17"');
  for(let y=5;y<830;y+=56)s+=poly([iso(5,y,2),iso(1114,y,2)],'none','stroke="#93978b" stroke-opacity=".17"');
  // Vidros e iluminação, todos vetoriais.
  for(let i=0;i<3;i++){s+=block(-1,380+i*120,3,100,40,70,'#72918e');s+=poly([iso(2,387+i*120,100),iso(2,470+i*120,50)],'none','stroke="#b1c8bd" stroke-width="2" opacity=".4"');}
  s+=block(10,4,680,4,119,4,'#d7b87e');
  const sign=iso(78,6,115);
  s+=`<g transform="matrix(.72 .34 0 1 ${sign[0]} ${sign[1]})"><rect width="560" height="88" fill="#26373b"/><text x="24" y="42" fill="#e7cc92" font-family="Georgia,serif" font-size="39" letter-spacing="4">DANIEL FELIX</text><text x="26" y="65" fill="#c0c3b6" font-family="Arial,sans-serif" font-size="10" letter-spacing="5">ADVOCACIA · ESCRITÓRIO VIRTUAL</text></g>`;
  s+=display(metrics);
  for(const [id,r] of Object.entries(SECTORS)){
    if(!r.box)continue;
    const [x,y,w,d]=r.box;
    const dim=state.sector!=='all'&&state.sector!==id;
    s+=`<g class="room" data-sector="${id}" opacity="${dim?.35:1}">`+plane(x,y,w,d,3,tint(r.color,-95),'stroke="'+r.color+'" stroke-opacity=".4"')+plane(x,y,w,8,4,r.color)+label(x+14,y+d-12,r.short,r.color)+'</g>';
  }
  // Mesa central dos dois humanos. A coordenação fica próxima, sem duplicar os chefões.
  s+=block(460,474,160,95,0,6,'#303b3e')+block(475,486,12,12,0,44,'#514332')+block(588,541,12,12,0,44,'#514332')+block(458,473,165,100,44,9,'#b59a6d');
  s+=plane(480,485,45,28,54,'#e8dfcb')+plane(550,510,45,28,54,'#21333e')+block(548,509,50,5,54,28,'#21333e');
  const objects=[];
  objects.push({depth:210,svg:bookshelf(10,105)});
  for(const a of state.agents){
    if(a.human){objects.push({depth:a.x+a.y-30,svg:chair(a.x,a.y+10)});}
    else if(a.id==='coordenador')objects.push({depth:a.x+a.y-65,svg:desk(a.x,a.y-35,'#b39a6c',90)+chair(a.x,a.y+5)});
    else objects.push({depth:a.x+a.y-65,svg:desk(a.x,a.y-35,a.sector==='juridico'?'#918496':'#9a8c70',a.sector==='juridico'?85:100)+chair(a.x,a.y+5)});
    const dim=(state.sector!=='all'&&a.sector!==state.sector)||(state.area!=='Todas'&&a.area!==state.area&&a.area!=='Geral');
    objects.push({depth:a.x+a.y,svg:`<g class="agent-wrap" opacity="${dim?.16:1}">${agentGroup(a,a.id===selectedId)}</g>`});
  }
  for(const p of [[70,340],[375,340],[720,330],[1090,330],[435,750],[1090,795]])objects.push({depth:p[0]+p[1],svg:plant(...p)});
  objects.sort((a,b)=>a.depth-b.depth).forEach(o=>s+=o.svg);
  s+=`<g id="walker" visibility="hidden" pointer-events="none"></g>`;
  // Degrau de entrada, com inscrição frontal.
  s+=block(410,827,280,28,-15,13,'#9b8c69');
  return s+'</g></svg>';
}
export function sceneMarkup(state,selectedId=null,metrics=null){return state.view==='iso'?isometricSceneMarkup(state,selectedId,metrics):PixelScene.markup(state,selectedId,metrics);}
export function scenePoint(state,x,y,z=0){return state.view==='iso'?iso(x,y,z):PixelScene.point(x,y,z);}
export function sceneAvatar(state,a){return state.view==='iso'?avatar(a):PixelScene.avatar(a);}
export function sceneRoute(state,a){return state.view==='iso'?null:PixelScene.route(a);}

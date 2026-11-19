/** Adaptador no SERVIDOR. Não importar no navegador. Rotas verificadas no repositório. */
export class FinanceiroRead {
  constructor({baseUrl,token,actor='arao:financeiro',fetcher=fetch}){
    if(!baseUrl||!token)throw Error('Configure a URL da INSTÂNCIA DO CLIENTE e a credencial própria.');
    const u=new URL(baseUrl);
    if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Use HTTPS ou loopback.');
    this.base=baseUrl.replace(/\/$/,'');this.token=token;this.actor=actor;this.fetcher=fetcher;
  }
  async get(route,params={}){
    if(!['/dashboard/metrics','/dashboard/cash-flow','/clients','/contracts'].includes(route))throw Error('Operação fora do escopo deste adaptador de leitura.');
    const u=new URL(this.base+route);for(const [k,v] of Object.entries(params))if(v!=null)u.searchParams.set(k,String(v));
    const r=await this.fetcher(u,{method:'GET',headers:{Authorization:`Bearer ${this.token}`,'x-agent-actor':this.actor,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!r.ok)throw Error(`Financeiro indisponível (${r.status}).`);
    return r.json();
  }
  metrics(from,to){return this.get('/dashboard/metrics',{from,to});}
  cashFlow(from,to){return this.get('/dashboard/cash-flow',{from,to});}
}

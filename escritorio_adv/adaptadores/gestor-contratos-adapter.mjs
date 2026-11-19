/**
 * Adaptador de Integração com mvp_gestor_contratos (/api/v1)
 * Conecta o Escritório Virtual Daniel Felix ao repositório local/remoto de gestão de contratos.
 * Suporta emissão de contratos de honorários, procurações, templates e envio para assinatura.
 */

export class GestorContratosAdapter {
  constructor({ baseUrl = process.env.GESTOR_CONTRATOS_URL || 'http://localhost:3001/api/v1', apiKey = process.env.GESTOR_CONTRATOS_API_KEY || '' } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ erro: `HTTP ${res.status}` }));
        throw new Error(errBody.erro || `Erro na requisição ${url}: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        return {
          offline: true,
          aviso: `Serviço mvp_gestor_contratos não está rodando em ${this.baseUrl}. Usando gerador autônomo local.`,
          erro: err.message
        };
      }
      throw err;
    }
  }

  async listarTemplates() {
    return this._request('/templates');
  }

  async criarCliente(cliente) {
    return this._request('/clientes', {
      method: 'POST',
      body: JSON.stringify({
        tipoPessoa: 'PF',
        nomeRazaoSocial: cliente.name,
        cpfCnpj: cliente.cpf,
        email: cliente.email,
        telefone: cliente.phone,
        endereco: cliente.endereco
      })
    });
  }

  async criarContrato({ templateId, clienteId, titulo, valores = {} }) {
    return this._request('/contratos', {
      method: 'POST',
      body: JSON.stringify({
        templateId,
        clienteId,
        titulo: titulo || 'Contrato de Honorários Advocatícios · Daniel Felix',
        valores
      })
    });
  }

  async enviarParaAssinatura(contratoId) {
    return this._request(`/contratos/${encodeURIComponent(contratoId)}/enviar-assinatura`, {
      method: 'POST'
    });
  }

  async consultarStatus(contratoId) {
    return this._request(`/contratos/${encodeURIComponent(contratoId)}`);
  }

  async baixarPdf(contratoId) {
    return this._request(`/contratos/${encodeURIComponent(contratoId)}/pdf`);
  }
}

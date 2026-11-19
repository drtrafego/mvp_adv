/**
 * Adaptador Habblaud para o Escritório Virtual Daniel Felix Advocacia
 * Converte o estado operacional do escritório (petições, prazos, clientes, finanças, telegram)
 * no protocolo de snapshot e feed do motor isométrico pixel art Habblaud.
 */

export function buildHabblaudSnapshot(officeState) {
  const now = Date.now();
  const clients = officeState.clients || [];
  const petitions = officeState.petitions || [];
  const deadlines = officeState.deadlinesList || [];
  const notices = officeState.noticesList || [];
  const contracts = officeState.contractsList || [];
  const finItems = officeState.financeiro?.items || [];
  const pendingPetitions = petitions.filter(p => p.status === 'review');
  const pendingDeadlines = deadlines.filter(d => d.status === 'Sugestão');

  // 1. Definição das Salas Setoriais no Prédio Habblaud
  const rooms = [
    {
      id: 'room-diretoria',
      name: 'Gabinete & Diretoria',
      path: '/escritorio/diretoria',
      slot: 0,
      seed: 101,
      createdAt: now - 3600000
    },
    {
      id: 'room-juridico',
      name: 'Núcleo Jurídico & Petições',
      path: '/escritorio/juridico',
      slot: 1,
      seed: 202,
      createdAt: now - 3600000
    },
    {
      id: 'room-processual',
      name: 'Processual & Prazos DJEN',
      path: '/escritorio/processual',
      slot: 2,
      seed: 303,
      createdAt: now - 3600000
    },
    {
      id: 'room-comercial',
      name: 'Comercial, Contratos & Caixa',
      path: '/escritorio/comercial',
      slot: 3,
      seed: 404,
      createdAt: now - 3600000
    }
  ];

  // 2. Mapeamento de Agentes Operacionais com Aparência e Atividades
  const agents = [
    // --- DIRETORIA ---
    {
      id: 'daniel',
      kind: 'main',
      roomId: 'room-diretoria',
      name: 'Dr. Daniel Felix',
      look: 'm',
      role: 'Advogado Titular',
      title: 'Revisão Humana de Peças e Prazos',
      sessionId: 'ses-daniel',
      account: 'daniel-felix',
      status: pendingPetitions.length > 0 ? 'waiting' : 'working',
      waitingFor: pendingPetitions.length > 0 ? `revisar ${pendingPetitions[0].code}` : undefined,
      activity: {
        id: 'act-dan-' + now,
        kind: pendingPetitions.length > 0 ? 'ask' : 'edit',
        icon: '⚖️',
        text: pendingPetitions.length > 0
          ? `Revisando ${pendingPetitions[0].code} (${pendingPetitions[0].clientName})`
          : 'Supervisionando teses e homologações',
        detail: 'Dr. Daniel Felix • OAB/SP • Decisão privativa de advogado',
        at: now - 120000
      },
      recent: [],
      tasks: [
        { id: 't-dan-1', title: 'Homologar Inicial PEC-2026-001', status: pendingPetitions.length > 0 ? 'in_progress' : 'completed' },
        { id: 't-dan-2', title: 'Confirmar Prazos Fatais CPC da Clara', status: pendingDeadlines.length > 0 ? 'in_progress' : 'completed' }
      ],
      startedAt: now - 86400000,
      lastEventAt: now,
      statusSince: now - 300000,
      stats: { toolCalls: 84, tokensIn: 45000, tokensOut: 12000, costUSD: 0.85, subagents: 6 },
      seed: 42,
      parts: {
        hairStyle: 'short',
        topStyle: 'shirt_tie',
        top: '#1c2833',
        topAccent: '#d4af37',
        bottomStyle: 'pants',
        bottom: '#17202a',
        accessory: 'glasses'
      }
    },
    {
      id: 'proprietario',
      kind: 'main',
      roomId: 'room-diretoria',
      name: 'Proprietário',
      look: 'm',
      role: 'Gestão Executiva da Banca',
      title: 'Supervisão de Metas e Crescimento',
      sessionId: 'ses-prop',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-prop-' + now,
        kind: 'plan',
        icon: '📊',
        text: 'Acompanhando receita contratada e pipeline',
        at: now - 180000
      },
      recent: [],
      tasks: [
        { id: 't-prop-1', title: 'Planejamento de expansão cível e empresarial', status: 'in_progress' }
      ],
      startedAt: now - 86400000,
      lastEventAt: now,
      statusSince: now - 600000,
      stats: { toolCalls: 32, tokensIn: 18000, tokensOut: 4500, subagents: 2 },
      seed: 77,
      parts: {
        hairStyle: 'side_part',
        topStyle: 'jacket',
        top: '#283747',
        topAccent: '#abb2b9',
        bottomStyle: 'pants',
        bottom: '#1c2833'
      }
    },

    // --- NÚCLEO JURÍDICO ---
    {
      id: 'forense',
      kind: 'main',
      roomId: 'room-juridico',
      name: 'Forense',
      look: 'm',
      role: 'Orquestrador do Squad Jurídico',
      title: 'Coordenação de Pesquisa, Tese e Redação',
      sessionId: 'ses-forense',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-for-' + now,
        kind: 'delegate',
        icon: '🏛️',
        text: 'Distribuindo teses para Maya e Theo',
        at: now - 60000
      },
      recent: [],
      tasks: [
        { id: 't-for-1', title: 'Distribuir Inicial de Indenização', status: 'completed' }
      ],
      startedAt: now - 72000000,
      lastEventAt: now,
      statusSince: now - 240000,
      stats: { toolCalls: 120, tokensIn: 88000, tokensOut: 32000, subagents: 5 },
      seed: 105,
      parts: {
        hairStyle: 'short',
        topStyle: 'jacket',
        top: '#212f3d',
        bottomStyle: 'pants',
        accessory: 'glasses'
      }
    },
    {
      id: 'maya',
      kind: 'sub',
      parentId: 'forense',
      roomId: 'room-juridico',
      name: 'Maya',
      look: 'f',
      role: 'Redatora Forense',
      title: 'Elaboração de Peças e Recursos',
      sessionId: 'ses-maya',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-may-' + now,
        kind: 'write',
        icon: '✍️',
        text: petitions.length > 0 ? `Redigindo minuta ${petitions[0].code}` : 'Formatando petição inicial',
        at: now - 45000
      },
      recent: [],
      tasks: [
        { id: 't-may-1', title: 'Minuta de Tutela de Urgência', status: 'in_progress' }
      ],
      startedAt: now - 36000000,
      lastEventAt: now,
      statusSince: now - 180000,
      stats: { toolCalls: 95, tokensIn: 64000, tokensOut: 24000, subagents: 0 },
      seed: 220,
      parts: {
        hairStyle: 'ponytail',
        topStyle: 'sweater',
        top: '#5b2c6f',
        bottomStyle: 'pants',
        accessory: 'glasses'
      }
    },
    {
      id: 'noah',
      kind: 'sub',
      parentId: 'forense',
      roomId: 'room-juridico',
      name: 'Noah',
      look: 'm',
      role: 'Revisor Jurídico',
      title: 'Auditoria de Citações e Súmulas',
      sessionId: 'ses-noah',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-noa-' + now,
        kind: 'read',
        icon: '🔍',
        text: 'Auditando precedentes vinculantes no STJ',
        at: now - 30000
      },
      recent: [],
      tasks: [
        { id: 't-noa-1', title: 'Checar Súmula 479 do STJ', status: 'completed' }
      ],
      startedAt: now - 36000000,
      lastEventAt: now,
      statusSince: now - 150000,
      stats: { toolCalls: 54, tokensIn: 38000, tokensOut: 9000, subagents: 0 },
      seed: 312,
      parts: {
        hairStyle: 'curly',
        topStyle: 'shirt_tie',
        top: '#1b4f72',
        topAccent: '#aed6f1',
        bottomStyle: 'pants'
      }
    },
    {
      id: 'iris',
      kind: 'sub',
      parentId: 'forense',
      roomId: 'room-juridico',
      name: 'Íris',
      look: 'f',
      role: 'Construtor de Teses',
      title: 'Mapeamento de Fundamentos e Doutrina',
      sessionId: 'ses-iris',
      account: 'daniel-felix',
      status: 'idle',
      activity: {
        id: 'act-iri-' + now,
        kind: 'think',
        icon: '💡',
        text: 'Estruturando tese consumerista',
        at: now - 90000
      },
      recent: [],
      tasks: [
        { id: 't-iri-1', title: 'Fundamentação art. 14 do CDC', status: 'completed' }
      ],
      startedAt: now - 36000000,
      lastEventAt: now,
      statusSince: now - 200000,
      stats: { toolCalls: 40, tokensIn: 29000, tokensOut: 7500, subagents: 0 },
      seed: 415,
      parts: {
        hairStyle: 'bob',
        topStyle: 'blouse',
        top: '#117864',
        bottomStyle: 'skirt'
      }
    },
    {
      id: 'theo',
      kind: 'sub',
      parentId: 'forense',
      roomId: 'room-juridico',
      name: 'Theo',
      look: 'm',
      role: 'Pesquisador de Jurisprudência',
      title: 'Coleta de Acórdãos em Fontes Oficiais',
      sessionId: 'ses-theo',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-the-' + now,
        kind: 'search',
        icon: '📚',
        text: 'Buscando acórdãos unânimes TJSP / STJ',
        at: now - 20000
      },
      recent: [],
      tasks: [
        { id: 't-the-1', title: 'Capturar ementas STJ c/ link oficial', status: 'completed' }
      ],
      startedAt: now - 36000000,
      lastEventAt: now,
      statusSince: now - 110000,
      stats: { toolCalls: 62, tokensIn: 41000, tokensOut: 11000, subagents: 0 },
      seed: 521,
      parts: {
        hairStyle: 'buzz',
        topStyle: 'polo',
        top: '#6e2c00',
        bottomStyle: 'pants',
        accessory: 'glasses'
      }
    },

    // --- PROCESSUAL & PRAZOS ---
    {
      id: 'clara',
      kind: 'main',
      roomId: 'room-processual',
      name: 'Clara',
      look: 'f',
      role: 'Gestora de Prazos (Controladoria)',
      title: 'Motor Determinístico CPC / CPP / CLT',
      sessionId: 'ses-clara',
      account: 'daniel-felix',
      status: pendingDeadlines.length > 0 ? 'waiting' : 'working',
      waitingFor: pendingDeadlines.length > 0 ? 'confirmação humana do Dr. Daniel' : undefined,
      activity: {
        id: 'act-cla-' + now,
        kind: 'plan',
        icon: '📅',
        text: pendingDeadlines.length > 0
          ? `Sugeriu prazo fatal ${pendingDeadlines[0].dataFatal} (${pendingDeadlines[0].clientName})`
          : 'Monitorando marcos processuais',
        detail: 'Art. 224 do CPC: D0 disponibilização -> D1 publicação -> D2 início da contagem',
        at: now - 50000
      },
      recent: [],
      tasks: [
        { id: 't-cla-1', title: 'Auditoria de prazo fatal de contestação', status: 'completed' }
      ],
      startedAt: now - 54000000,
      lastEventAt: now,
      statusSince: now - 180000,
      stats: { toolCalls: 78, tokensIn: 52000, tokensOut: 14000, subagents: 0 },
      seed: 630,
      parts: {
        hairStyle: 'bun',
        topStyle: 'blouse',
        top: '#1f618d',
        bottomStyle: 'pants',
        accessory: 'glasses'
      }
    },
    {
      id: 'breno',
      kind: 'main',
      roomId: 'room-processual',
      name: 'Breno',
      look: 'm',
      role: 'Monitor DJEN & DataJud',
      title: 'Leitura Integral do Diário Oficial',
      sessionId: 'ses-breno',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-bre-' + now,
        kind: 'read',
        icon: '📰',
        text: notices.length > 0 ? `Capturou publicação CNJ ${notices[0].numeroCnj}` : 'Conferindo coletas matinais DJEN',
        at: now - 40000
      },
      recent: [],
      tasks: [
        { id: 't-bre-1', title: 'Varredura diária OAB Dr. Daniel Felix', status: 'completed' }
      ],
      startedAt: now - 54000000,
      lastEventAt: now,
      statusSince: now - 220000,
      stats: { toolCalls: 110, tokensIn: 76000, tokensOut: 20000, subagents: 0 },
      seed: 714,
      parts: {
        hairStyle: 'short',
        topStyle: 'polo',
        top: '#196f3d',
        bottomStyle: 'pants'
      }
    },
    {
      id: 'nina',
      kind: 'sub',
      parentId: 'clara',
      roomId: 'room-processual',
      name: 'Nina',
      look: 'f',
      role: 'Tradutora & Audiências',
      title: 'Tradução de Juridiquês & Agenda',
      sessionId: 'ses-nina',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-nin-' + now,
        kind: 'communicate',
        icon: '💬',
        text: 'Traduzindo despacho judicial para WhatsApp',
        at: now - 35000
      },
      recent: [],
      tasks: [
        { id: 't-nin-1', title: 'Mensagem explicativa para cliente', status: 'completed' }
      ],
      startedAt: now - 40000000,
      lastEventAt: now,
      statusSince: now - 160000,
      stats: { toolCalls: 45, tokensIn: 31000, tokensOut: 8500, subagents: 0 },
      seed: 825,
      parts: {
        hairStyle: 'wavy',
        topStyle: 'blouse',
        top: '#b7950b',
        bottomStyle: 'skirt'
      }
    },

    // --- COMERCIAL, CONTRATOS & FINANCEIRO ---
    {
      id: 'lia',
      kind: 'main',
      roomId: 'room-comercial',
      name: 'Lia',
      look: 'f',
      role: 'SDR WhatsApp & Triagem',
      title: 'Atendimento e Qualificação Civil',
      sessionId: 'ses-lia',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-lia-' + now,
        kind: 'ask',
        icon: '📱',
        text: clients.length > 0 ? `Qualificando caso de ${clients[0].name}` : 'Acolhendo novo contato do WhatsApp',
        at: now - 25000
      },
      recent: [],
      tasks: [
        { id: 't-lia-1', title: 'Triagem e checklist de documentos', status: 'completed' }
      ],
      startedAt: now - 60000000,
      lastEventAt: now,
      statusSince: now - 210000,
      stats: { toolCalls: 85, tokensIn: 58000, tokensOut: 16000, subagents: 0 },
      seed: 902,
      parts: {
        hairStyle: 'bob',
        topStyle: 'tshirt',
        top: '#148f77',
        bottomStyle: 'pants',
        accessory: 'headphones'
      }
    },
    {
      id: 'davi',
      kind: 'sub',
      parentId: 'lia',
      roomId: 'room-comercial',
      name: 'Davi',
      look: 'm',
      role: 'Contratos & Procurações',
      title: 'Emissão Ad Judicia (Art. 105 CPC)',
      sessionId: 'ses-davi',
      account: 'daniel-felix',
      status: contracts.some(c => c.status === 'review') ? 'waiting' : 'working',
      waitingFor: contracts.some(c => c.status === 'review') ? 'aprovação de poderes pelo Dr. Daniel' : undefined,
      activity: {
        id: 'act-dav-' + now,
        kind: 'write',
        icon: '📜',
        text: contracts.length > 0 ? `Gerou Procuração ${contracts[0].code}` : 'Preparando contrato de honorários',
        at: now - 70000
      },
      recent: [],
      tasks: [
        { id: 't-dav-1', title: 'Validação de poderes especiais do mandato', status: 'completed' }
      ],
      startedAt: now - 45000000,
      lastEventAt: now,
      statusSince: now - 190000,
      stats: { toolCalls: 50, tokensIn: 34000, tokensOut: 9800, subagents: 0 },
      seed: 144,
      parts: {
        hairStyle: 'short',
        topStyle: 'shirt_tie',
        top: '#2e4053',
        topAccent: '#f5b041',
        bottomStyle: 'pants'
      }
    },
    {
      id: 'bia',
      kind: 'sub',
      parentId: 'lia',
      roomId: 'room-comercial',
      name: 'Bia',
      look: 'f',
      role: 'Gestora ZapSign',
      title: 'Reconciliação de Signatários',
      sessionId: 'ses-bia',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-bia-' + now,
        kind: 'communicate',
        icon: '✍️',
        text: 'Acompanhando coleta de assinaturas digitais',
        at: now - 30000
      },
      recent: [],
      tasks: [
        { id: 't-bia-1', title: 'Webhook ZapSign de signatário concluído', status: 'completed' }
      ],
      startedAt: now - 45000000,
      lastEventAt: now,
      statusSince: now - 140000,
      stats: { toolCalls: 65, tokensIn: 42000, tokensOut: 11000, subagents: 0 },
      seed: 256,
      parts: {
        hairStyle: 'ponytail',
        topStyle: 'blouse',
        top: '#7d3c98',
        bottomStyle: 'skirt'
      }
    },
    {
      id: 'rui',
      kind: 'main',
      roomId: 'room-comercial',
      name: 'Rui',
      look: 'm',
      role: 'Gestor Financeiro & Caixa',
      title: 'Conciliação e Fila Outbox de Cobrança',
      sessionId: 'ses-rui',
      account: 'daniel-felix',
      status: 'working',
      activity: {
        id: 'act-rui-' + now,
        kind: 'other',
        icon: '💰',
        text: finItems.length > 0 ? `Caixa conciliado: ${finItems.filter(f=>f.status==='paid').length} parcelas pagas` : 'Apurando honorários da carteira',
        at: now - 40000
      },
      recent: [],
      tasks: [
        { id: 't-rui-1', title: 'Conciliação bancária PIX', status: 'completed' },
        { id: 't-rui-2', title: 'Fila de lembretes no Outbox', status: 'in_progress' }
      ],
      startedAt: now - 60000000,
      lastEventAt: now,
      statusSince: now - 170000,
      stats: { toolCalls: 70, tokensIn: 48000, tokensOut: 13000, subagents: 0 },
      seed: 368,
      parts: {
        hairStyle: 'side_part',
        topStyle: 'shirt_tie',
        top: '#1e8449',
        topAccent: '#f4d03f',
        bottomStyle: 'pants',
        accessory: 'glasses'
      }
    }
  ];

  // 3. Contas do Sistema
  const accounts = [
    {
      id: 'daniel-felix',
      short: 'DF',
      name: 'Escritório Daniel Felix Advocacia',
      color: '#d4af37',
      configDir: '.adv',
      sessions: agents.length,
      usage: {
        fiveHour: { utilization: 22 },
        sevenDay: { utilization: 38 },
        source: 'statusline',
        fetchedAt: now
      },
      usageStatus: 'ok'
    }
  ];

  return {
    rev: Date.now(),
    serverTime: now,
    rooms,
    agents,
    accounts,
    meta: {
      demo: false,
      sources: [
        {
          label: 'Gabinete Daniel Felix',
          path: 'd:/Meu Drive/Bilder Ai/mvp_escritorio_adv',
          sessions: agents.length,
          ok: true
        }
      ],
      startedAt: now - 86400000,
      version: '1.0.3 Habblaud Edition'
    }
  };
}

export function buildHabblaudFeed(officeState) {
  const now = Date.now();
  const logs = officeState.logs || [];
  return logs.slice(-30).map((l, i) => ({
    id: `feed-${i}-${now}`,
    agentId: 'daniel',
    roomId: 'room-diretoria',
    kind: 'communicate',
    icon: '🏛️',
    text: l.text,
    at: now - (logs.length - i) * 60000
  }));
}

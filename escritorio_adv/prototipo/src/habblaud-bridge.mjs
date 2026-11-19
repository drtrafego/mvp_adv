/* Adaptador compartilhado entre Escritório Virtual Daniel Felix e o motor 3D Habblaud.
 * Sem imports externos para permitir inclusão direta via prototipo/build.mjs e importação ES em Node. */

export const HABBLAUD_ROOM_BY_SECTOR = {
  diretoria: 'room-diretoria',
  juridico: 'room-juridico',
  comercial: 'room-comercial',
  administrativo: 'room-administrativo',
  contratos: 'room-contratos',
  financeiro: 'room-financeiro',
  etica: 'room-financeiro',
};

export const SECTOR_BY_HABBLAUD_ROOM = {
  'room-diretoria': 'diretoria',
  'room-juridico': 'juridico',
  'room-comercial': 'comercial',
  'room-administrativo': 'administrativo',
  'room-contratos': 'contratos',
  'room-financeiro': 'financeiro',
};

const HABBLAUD_ROOMS_DEF = [
  { id: 'room-diretoria', name: 'Diretoria · Dr. Daniel', path: '/escritorio/diretoria', slot: 0, seed: 101 },
  { id: 'room-juridico', name: 'Núcleo Jurídico', path: '/escritorio/juridico', slot: 1, seed: 202 },
  { id: 'room-comercial', name: 'Comercial & Clientes', path: '/escritorio/comercial', slot: 2, seed: 303 },
  { id: 'room-administrativo', name: 'Processual & Prazos', path: '/escritorio/processual', slot: 3, seed: 404 },
  { id: 'room-contratos', name: 'Contratos & ZapSign', path: '/escritorio/contratos', slot: 4, seed: 505 },
  { id: 'room-financeiro', name: 'Financeiro & Ética', path: '/escritorio/financeiro', slot: 5, seed: 606 },
];

const AGENT_PRESETS = {
  daniel: {
    displayName: 'Dr. Daniel Felix', kind: 'main', look: 'm', icon: '⚖️', actKind: 'edit', seed: 42,
    parts: { hairStyle: 'short', hair: '#2c221e', topStyle: 'shirt_tie', top: '#1c2833', topAccent: '#d4af37', bottomStyle: 'pants', bottom: '#17202a', accessory: 'glasses' },
  },
  proprietario: {
    displayName: 'Proprietário', kind: 'main', look: 'm', icon: '📊', actKind: 'plan', seed: 77,
    parts: { hairStyle: 'side_part', hair: '#3b2f2a', topStyle: 'jacket', top: '#283747', topAccent: '#d5b478', bottomStyle: 'pants', bottom: '#1c2833', accessory: 'none' },
  },
  coordenador: {
    displayName: 'Luana · Coord.', kind: 'main', look: 'f', icon: '🎙️', actKind: 'communicate', seed: 88,
    parts: { hairStyle: 'long', hair: '#3d281f', topStyle: 'jacket', top: '#22495a', topAccent: '#e2c282', bottomStyle: 'pants', bottom: '#18242e', accessory: 'headphones' },
  },
  forense: {
    displayName: 'Forense', kind: 'main', look: 'm', icon: '🏛️', actKind: 'delegate', seed: 105,
    parts: { hairStyle: 'short', hair: '#2e2522', topStyle: 'jacket', top: '#3c2e54', topAccent: '#d8c2f2', bottomStyle: 'pants', bottom: '#1f232e', accessory: 'glasses' },
  },
  tese: {
    displayName: 'Íris', kind: 'sub', parentId: 'forense', look: 'f', icon: '💡', actKind: 'think', seed: 415,
    parts: { hairStyle: 'bob', hair: '#4a2b20', topStyle: 'blouse', top: '#5a3d7a', bottomStyle: 'skirt', bottom: '#232836', accessory: 'glasses' },
  },
  pesquisador: {
    displayName: 'Theo', kind: 'sub', parentId: 'forense', look: 'm', icon: '📚', actKind: 'search', seed: 521,
    parts: { hairStyle: 'buzz', hair: '#252020', topStyle: 'polo', top: '#43386b', bottomStyle: 'pants', bottom: '#1c2430', accessory: 'glasses' },
  },
  analista: {
    displayName: 'Eva', kind: 'sub', parentId: 'forense', look: 'f', icon: '📂', actKind: 'read', seed: 430,
    parts: { hairStyle: 'bun', hair: '#2f221e', topStyle: 'blouse', top: '#6d528f', bottomStyle: 'pants', bottom: '#222733', accessory: 'none' },
  },
  estrategista: {
    displayName: 'Otto', kind: 'sub', parentId: 'forense', look: 'm', icon: '🧭', actKind: 'plan', seed: 445,
    parts: { hairStyle: 'side_part', hair: '#332924', topStyle: 'shirt_tie', top: '#383259', topAccent: '#b89ad9', bottomStyle: 'pants', bottom: '#1b202b', accessory: 'none' },
  },
  redator: {
    displayName: 'Maya', kind: 'sub', parentId: 'forense', look: 'f', icon: '✍️', actKind: 'write', seed: 220,
    parts: { hairStyle: 'ponytail', hair: '#3b241d', topStyle: 'sweater', top: '#6c3483', bottomStyle: 'pants', bottom: '#1f2633', accessory: 'glasses' },
  },
  revisor: {
    displayName: 'Noah', kind: 'sub', parentId: 'forense', look: 'm', icon: '🔍', actKind: 'read', seed: 312,
    parts: { hairStyle: 'curly', hair: '#261f1c', topStyle: 'shirt_tie', top: '#2b4368', topAccent: '#aed6f1', bottomStyle: 'pants', bottom: '#1a202c', accessory: 'glasses' },
  },
  sdr: {
    displayName: 'Lia', kind: 'main', look: 'f', icon: '📱', actKind: 'ask', seed: 902,
    parts: { hairStyle: 'bob', hair: '#362620', topStyle: 'tshirt', top: '#148f77', bottomStyle: 'pants', bottom: '#1d2b34', accessory: 'headphones' },
  },
  closer: {
    displayName: 'Caio', kind: 'sub', parentId: 'sdr', look: 'm', icon: '🤝', actKind: 'communicate', seed: 915,
    parts: { hairStyle: 'spiky', hair: '#28201d', topStyle: 'shirt_tie', top: '#1c6b5a', topAccent: '#90dfc8', bottomStyle: 'pants', bottom: '#1a232b', accessory: 'none' },
  },
  controladoria: {
    displayName: 'Clara', kind: 'main', look: 'f', icon: '📅', actKind: 'plan', seed: 630,
    parts: { hairStyle: 'bun', hair: '#453024', topStyle: 'blouse', top: '#9a6823', bottomStyle: 'pants', bottom: '#232b36', accessory: 'glasses' },
  },
  movimentacoes: {
    displayName: 'Breno', kind: 'main', look: 'm', icon: '📰', actKind: 'read', seed: 714,
    parts: { hairStyle: 'short', hair: '#2b2421', topStyle: 'polo', top: '#875a26', bottomStyle: 'pants', bottom: '#1d242e', accessory: 'glasses' },
  },
  agenda: {
    displayName: 'Nina', kind: 'sub', parentId: 'controladoria', look: 'f', icon: '💬', actKind: 'communicate', seed: 825,
    parts: { hairStyle: 'wavy', hair: '#523426', topStyle: 'blouse', top: '#b7791f', bottomStyle: 'skirt', bottom: '#252b36', accessory: 'headphones' },
  },
  contratos: {
    displayName: 'Davi', kind: 'main', look: 'm', icon: '📜', actKind: 'write', seed: 144,
    parts: { hairStyle: 'short', hair: '#2d2420', topStyle: 'shirt_tie', top: '#2e4053', topAccent: '#92a7e8', bottomStyle: 'pants', bottom: '#1a222d', accessory: 'none' },
  },
  assinaturas: {
    displayName: 'Bia', kind: 'sub', parentId: 'contratos', look: 'f', icon: '✍️', actKind: 'communicate', seed: 256,
    parts: { hairStyle: 'ponytail', hair: '#38251e', topStyle: 'blouse', top: '#3c5588', bottomStyle: 'skirt', bottom: '#1f2633', accessory: 'glasses' },
  },
  financeiro: {
    displayName: 'Rui', kind: 'main', look: 'm', icon: '💰', actKind: 'plan', seed: 368,
    parts: { hairStyle: 'side_part', hair: '#302723', topStyle: 'shirt_tie', top: '#1e8449', topAccent: '#f4d03f', bottomStyle: 'pants', bottom: '#19222b', accessory: 'glasses' },
  },
  etica: {
    displayName: 'Elisa', kind: 'main', look: 'f', icon: '🛡️', actKind: 'read', seed: 512,
    parts: { hairStyle: 'wavy', hair: '#3d2a23', topStyle: 'jacket', top: '#784256', topAccent: '#e6b8c6', bottomStyle: 'pants', bottom: '#1e222b', accessory: 'glasses' },
  },
};

const SECTOR_LEADERS = {
  diretoria: 'daniel',
  juridico: 'forense',
  comercial: 'sdr',
  administrativo: 'controladoria',
  contratos: 'contratos',
  financeiro: 'financeiro',
  etica: 'etica',
};

function sanitizeHex(hex, fallback) {
  return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex.trim()) ? hex.trim().toLowerCase() : fallback;
}

function mapStatusToHabblaud(status) {
  if (status === 'working') return 'working';
  if (status === 'review' || status === 'waiting') return 'waiting';
  return 'idle';
}

function waitingReasonFor(a, officeState) {
  if (a.status !== 'review' && a.status !== 'waiting') return undefined;
  const pendingPets = (officeState?.petitions || []).filter((p) => p.status === 'review');
  const pendingDead = (officeState?.deadlinesList || []).filter((d) => d.status === 'Sugestão');
  const pendingDocs = (officeState?.contractsList || []).filter((c) => c.status === 'review');
  if (a.id === 'daniel' && pendingPets.length > 0) return `revisar ${pendingPets[0].code}`;
  if (a.id === 'controladoria' && pendingDead.length > 0) return `confirmar ${pendingDead[0].dataFatal}`;
  if (a.id === 'contratos' && pendingDocs.length > 0) return `aprovar ${pendingDocs[0].code}`;
  if (a.status === 'review') return 'aprovação de Dr. Daniel Felix';
  return a.task ? String(a.task).slice(0, 60) : 'aguardando retorno';
}

function tasksForAgent(a, officeState) {
  const pets = officeState?.petitions || [];
  const deads = officeState?.deadlinesList || [];
  const docs = officeState?.contractsList || [];
  const items = officeState?.financeiro?.items || [];
  const payables = officeState?.financeiro?.payables || [];

  if (a.id === 'daniel') {
    return [
      ...pets.slice(0, 2).map((p) => ({ id: `tp-${p.id}`, title: `${p.code} · ${p.clientName}`, status: p.status === 'approved' ? 'completed' : 'in_progress' })),
      ...deads.slice(0, 1).map((d) => ({ id: `td-${d.id}`, title: `Prazo ${d.dataFatal} · ${d.clientName}`, status: d.status === 'Sugestão' ? 'in_progress' : 'completed' })),
    ];
  }
  if (a.id === 'redator' || a.id === 'revisor' || a.id === 'forense') {
    return pets.slice(0, 3).map((p) => ({ id: `tp-${p.id}`, title: `${p.code} (${p.version}) · ${p.clientName}`, status: p.status === 'approved' ? 'completed' : 'in_progress' }));
  }
  if (a.id === 'controladoria') {
    return deads.slice(0, 3).map((d) => ({ id: `td-${d.id}`, title: `${d.ato} (${d.dataFatal})`, status: d.status === 'Sugestão' ? 'in_progress' : 'completed' }));
  }
  if (a.id === 'contratos' || a.id === 'assinaturas') {
    return docs.slice(0, 3).map((c) => ({ id: `tc-${c.id}`, title: `${c.code} · ${c.clientName}`, status: c.status === 'completed' ? 'completed' : 'in_progress' }));
  }
  if (a.id === 'financeiro') {
    const overdue = items.filter((i) => i.status === 'overdue').length;
    const payOpen = payables.filter((p) => p.status !== 'paid').length;
    return [
      { id: 'tf-rec', title: `${items.filter((i) => i.status === 'paid').length} parcelas recebidas`, status: 'completed' },
      { id: 'tf-ovd', title: `${overdue} parcela(s) vencida(s) a cobrar`, status: overdue > 0 ? 'in_progress' : 'completed' },
      { id: 'tf-pay', title: `${payOpen} conta(s) a pagar do escritório`, status: payOpen > 0 ? 'in_progress' : 'completed' },
    ];
  }
  return [{ id: `ta-${a.id}`, title: String(a.task || a.role || 'Operação em curso').slice(0, 72), status: a.status === 'available' ? 'completed' : 'in_progress' }];
}

function buildCustomParts(a) {
  const top = sanitizeHex(a.color, '#7a9ec2');
  const skin = sanitizeHex(a.skin, '#cf9873');
  const hair = sanitizeHex(a.hair, '#372b27');
  let topStyle = 'polo';
  let topAccent;
  let accessory = 'none';
  if (a.accessory === 'headset') accessory = 'headphones';
  else if (a.accessory === 'glasses') accessory = 'glasses';
  else if (a.accessory === 'tie') topStyle = 'shirt_tie';
  else if (a.accessory === 'gold') { topStyle = 'jacket'; topAccent = '#d4af37'; }
  return {
    skin,
    hair,
    hairStyle: 'short',
    topStyle,
    top,
    ...(topAccent ? { topAccent } : {}),
    bottomStyle: 'pants',
    bottom: '#1b242d',
    accessory,
  };
}

export function buildHabblaudSnapshotFromState(officeState = {}) {
  const now = Date.now();
  const baseAgents = Array.isArray(officeState.agents) && officeState.agents.length > 0
    ? officeState.agents
    : [];

  const rooms = HABBLAUD_ROOMS_DEF.map((r) => ({
    ...r,
    createdAt: now - 3600000,
  }));

  const agents = baseAgents.map((a, idx) => {
    const preset = AGENT_PRESETS[a.id];
    const roomId = HABBLAUD_ROOM_BY_SECTOR[a.sector] || 'room-juridico';
    const rawName = (preset?.displayName || a.name || a.id).trim();
    const safeName = rawName.length > 24 ? rawName.slice(0, 24) : rawName;
    const status = mapStatusToHabblaud(a.status);
    const waitingFor = waitingReasonFor(a, officeState);
    const kind = preset?.kind || (a.custom ? 'sub' : 'main');
    const parentId = kind === 'sub' ? (preset?.parentId || SECTOR_LEADERS[a.sector] || 'coordenador') : undefined;
    const actText = String(a.task || a.role || 'Em operação').slice(0, 56);

    return {
      id: a.id,
      kind,
      ...(parentId && parentId !== a.id ? { parentId } : {}),
      roomId,
      name: safeName,
      look: preset?.look || 'm',
      role: a.role || 'Agente jurídico',
      title: a.role || 'Escritório Daniel Felix',
      sessionId: `ses-${a.id}`,
      account: 'daniel-felix',
      status,
      ...(waitingFor ? { waitingFor } : {}),
      activity: {
        id: `act-${a.id}-${now}`,
        kind: preset?.actKind || (status === 'waiting' ? 'ask' : 'other'),
        icon: preset?.icon || '⚖️',
        text: actText,
        detail: `${a.role || ''} · ${a.area || 'Geral'}`,
        at: now - (idx + 1) * 15000,
      },
      recent: [],
      tasks: tasksForAgent(a, officeState),
      startedAt: now - 72000000,
      lastEventAt: now,
      statusSince: now - 120000,
      stats: { toolCalls: 24 + idx * 7, tokensIn: 18000 + idx * 2500, tokensOut: 4200 + idx * 700, subagents: kind === 'main' ? 2 : 0 },
      seed: preset?.seed || (1000 + idx * 37),
      parts: preset?.parts || buildCustomParts(a),
    };
  });

  const overdueCount = (officeState?.financeiro?.items || []).filter((i) => i.status === 'overdue').length;
  const pendingPets = (officeState?.petitions || []).filter((p) => p.status === 'review').length;
  const utilization = Math.min(95, 18 + pendingPets * 8 + overdueCount * 6);

  return {
    rev: Date.now(),
    serverTime: now,
    rooms,
    agents,
    accounts: [
      {
        id: 'daniel-felix',
        short: 'DF',
        name: 'Daniel Felix Advocacia',
        color: '#d4af37',
        configDir: '.adv',
        sessions: agents.length,
        usage: {
          fiveHour: { utilization },
          sevenDay: { utilization: Math.min(95, utilization + 16) },
          source: 'statusline',
          fetchedAt: now,
        },
        usageStatus: 'ok',
      },
    ],
    meta: {
      demo: false,
      sources: [
        {
          label: 'Escritório Daniel Felix',
          path: 'mvp_escritorio_adv',
          sessions: agents.length,
          ok: true,
        },
      ],
      startedAt: now - 86400000,
      version: '2.0.0 Habblaud Unificado',
    },
  };
}

export function buildHabblaudFeedFromState(officeState = {}) {
  const now = Date.now();
  const logs = Array.isArray(officeState.logs) ? officeState.logs : [];
  const agents = Array.isArray(officeState.agents) ? officeState.agents : [];
  return logs.slice(-30).map((l, i) => {
    const text = String(l.text || '');
    const lower = text.toLowerCase();
    const matched = agents.find((a) => lower.includes(String(a.name || '').toLowerCase())) || agents.find((a) => a.id === 'daniel') || { id: 'daniel', sector: 'diretoria' };
    return {
      id: `feed-${i}-${now}`,
      agentId: matched.id,
      roomId: HABBLAUD_ROOM_BY_SECTOR[matched.sector] || 'room-diretoria',
      kind: 'communicate',
      icon: '🏛️',
      text,
      at: now - (logs.length - i) * 60000,
    };
  });
}

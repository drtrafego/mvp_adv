-- ============================================================================
-- Gabinete · schema do Supabase / Postgres
-- Fonte da verdade do sistema. O MCP grava aqui, o painel lê daqui, o Realtime
-- acende a tela. A "regra de ouro" (máquina propõe, humano dispõe) vive no
-- campo `origem` de prazos e analises: quando vira 'humana', o motor não sobrescreve.
-- ============================================================================

-- Carteira de processos
create table if not exists processos (
  id uuid primary key default gen_random_uuid(),
  numero_cnj text unique not null,
  tribunal text not null,
  classe text,
  assunto text,
  orgao_julgador text,
  valor_causa numeric,
  grau text,
  partes jsonb,
  cliente_nome text,                      -- cache de leitura; parte real fica em processo_partes
  fase text default 'postulatoria',       -- postulatoria | contestacao | saneamento | instrucao | sentenca | recurso | cumprimento | arquivado
  status text default 'ativo',            -- ativo | arquivado | suspenso
  ultima_sincronizacao timestamptz,
  arquivado_em timestamptz,
  excluido_em timestamptz,                 -- soft-delete
  created_at timestamptz default now()
);

-- Histórico de mudança de fase do processo (auditoria do estágio processual)
create table if not exists fases_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  fase text not null,
  fase_anterior text,
  motivo text,
  autor text default 'advogado',
  origem text default 'humana',            -- humana | maquina
  criado_em timestamptz default now()
);

-- Andamentos: automáticos (DataJud, read-only) + manuais (fonte='manual', editáveis)
create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  codigo_cnj int,
  descricao text not null,
  data_hora timestamptz not null,
  complemento jsonb,
  fonte text default 'datajud',
  criado_por text,
  editado_em timestamptz
);

-- Intimações do DJEN (Comunica)
create table if not exists comunicacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id),
  numero_processo text,
  hash_djen text unique,
  tipo text,
  meio text default 'DJEN',
  inteiro_teor text,
  data_disponibilizacao date,
  data_publicacao date,
  oab_destino text,
  processada boolean default false,
  created_at timestamptz default now()
);

-- PDFs dos autos
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  titulo text,
  tipo text,
  categoria text,
  storage_path text not null,
  paginas int,
  hash_sha256 text,
  texto_extraido boolean default false,
  fonte text,
  descricao text,
  data_documento date,
  created_at timestamptz default now()
);

-- Notas livres do advogado sobre o processo
create table if not exists anotacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  texto text not null,
  autor text default 'advogado',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Cadastro de clientes/partes, reaproveitável entre processos
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  tipo_documento text,                     -- cpf | cnpj
  email text,
  telefone text,
  observacoes text,
  criado_em timestamptz default now()
);

-- Vínculo processo <-> cliente com o papel
create table if not exists processo_partes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  papel text not null,                     -- autor | reu | terceiro | ...
  principal boolean default false,
  unique (processo_id, cliente_id, papel)
);

-- Análises da IA, versionadas
create table if not exists analises (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  documento_id uuid references documentos(id),
  tipo text not null,
  conteudo jsonb not null,
  versao int default 1,
  origem text default 'maquina',          -- maquina | humana
  editado_por text,
  editado_em timestamptz,
  modelo text,
  tokens_input int,
  tokens_output int,
  custo_usd numeric(10,5),
  created_at timestamptz default now()
);

-- O coração: prazos
create table if not exists prazos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id) on delete cascade,
  comunicacao_id uuid references comunicacoes(id),
  ato text not null,
  regra_aplicada text,
  dias int,
  contagem text default 'uteis',          -- uteis | corridos
  data_publicacao date,
  data_inicio date,
  data_fatal_sugerida date not null,
  data_fatal date not null,
  status text default 'sugerido',         -- sugerido | confirmado | editado | cancelado
  origem text default 'maquina',          -- maquina | humana
  justificativa_ia text,
  divergencia jsonb,
  editado_por text,
  editado_em timestamptz,
  alertas_enviados jsonb default '[]',
  created_at timestamptz default now()
);

-- Suspensões e feriados forenses por tribunal
create table if not exists feriados_forenses (
  id uuid primary key default gen_random_uuid(),
  tribunal text not null,
  data date not null,
  descricao text,
  tipo text default 'feriado',
  unique (tribunal, data)
);

-- Registro de coletas: o que foi buscado, quando e com qual resultado.
-- Diferencia "sem intimação" (status ok, itens 0) de "falha na coleta" (status erro).
create table if not exists sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  fonte text not null,                     -- djen | datajud
  escopo text,                             -- ex.: 'OAB 11158/MT' ou numero_cnj
  status text not null,                    -- ok | erro | parcial
  itens int default 0,
  novos int default 0,
  mensagem text,
  iniciado_em timestamptz default now(),
  concluido_em timestamptz
);

create index if not exists idx_prazos_fatal on prazos (data_fatal, status);
create index if not exists idx_comunic_proc on comunicacoes (processada);
create index if not exists idx_mov_proc on movimentacoes (processo_id, data_hora desc);
create index if not exists idx_sinc_fonte on sincronizacoes (fonte, iniciado_em desc);
create index if not exists idx_fases_proc on fases_processo (processo_id, criado_em);
create index if not exists idx_anotacoes_proc on anotacoes (processo_id, criado_em);
create index if not exists idx_clientes_doc on clientes (documento);

-- Dedup de movimentações só vale para o DataJud (automáticas). Manuais podem repetir.
-- Substitui a unique cheia (processo_id, codigo_cnj, data_hora) por índice parcial.
alter table movimentacoes drop constraint if exists mov_unique;
create unique index if not exists mov_unique_datajud
  on movimentacoes (processo_id, codigo_cnj, data_hora)
  where fonte = 'datajud';

-- ============================================================================
-- RLS: no MVP mono-usuário, o painel usa a service role no servidor. Se abrir
-- para multiusuário, habilitar RLS por escritório. Deixamos as políticas
-- comentadas como ponto de partida.
-- ============================================================================
-- alter table processos enable row level security;
-- alter table prazos enable row level security;
-- (definir policies por auth.uid()/escritorio_id quando for multiusuário)

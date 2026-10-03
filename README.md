# Gabinete — escritório virtual

Painel e MCP para organizar clientes, processos, intimações, prazos, documentos,
análises, minutas e honorários de um escritório. O sistema funciona de forma independente,
com o advogado e a equipe usando o painel. O MCP local já existente oferece ferramentas
para uma sessão de terminal, quando necessário.

O painel registra a revisão humana. O agente produz sugestões e rascunhos; não
assume a identidade de quem confirmou um prazo, aprovou uma peça ou recebeu um pagamento.

## O que está implementado

- Carteira de processos, movimentações, partes e pasta do cliente.
- Coleta DataJud e DJEN, com paginação e indicação de erro ou resultado parcial.
- Inteiro teor de intimações paginado pelo MCP e pré-análises vinculadas à comunicação.
- Motor determinístico de prazos com sugestões, revisão, fontes e pendências visíveis.
- Análises, modelos, peças e exportação DOCX; aprovação vinculada ao texto/versão revisados.
- Documentos privados, extração de texto e proteção das rotas e ações de alteração.
- Honorários por cliente, vencimentos, recebimentos, cancelamentos e rascunhos de cobrança.
- Dashboard com atalhos, filtros de urgência, pendências e saúde real das últimas coletas.
- Squad jurídico já existente para sessões assistidas de terminal, com revisão antes da persistência.

Cobranças têm preparação e envio manual pelo WhatsApp; o envio automático exige canal
e fila adicionais. O protocolo de petições é manual. Não há adaptador de envio ao tribunal.

O agente orquestrador do escritório terá o nome escolhido pelo advogado e será baseado
no projeto reutilizável `luana`. Ele será integrado posteriormente como cliente de uma API
autenticada do Gabinete, ainda não implementada. A revisão atual melhora o Gabinete;
não incorpora o agente ao sistema, não conecta Telegram e não cria
uma dependência de agente para usar o painel.

## Estrutura

| Pasta | Função |
| --- | --- |
| `painel/` | Next.js 16, React, Tailwind, Drizzle e autenticação por sessão. |
| `mcp-server/` | MCP stdio, consultas e coleta, motor de prazos e ferramentas financeiras. |
| `.claude/agents/` | Especialistas jurídicos existentes, opcionais para sessões assistidas de terminal. |
| `.claude/skills/` | Instruções jurídicas já existentes no projeto. |
| `painel/drizzle/` | Migrações SQL de implantação. |
| `docs/` | Revisão técnica, implantação e desenho da integração futura. |
| `docs/futuro/` | Exemplos inativos de perfis e configuração para uma integração posterior. |

O Postgres é a fonte da verdade. Painel e MCP usam o mesmo banco e o mesmo Blob
privado **deste escritório**. A instalação é compartilhada pela equipe de um único
escritório; não há isolamento de clientes SaaS/tenants na mesma instância.

## Instalação e validação

Pré-requisitos: Node 22.6+ (recomendado Node 24), pnpm 11+, Postgres/Neon e Blob privado
quando houver anexos. Os lockfiles são versionados. Os arquivos `.env.example` são
modelos sem credenciais reais.

```bash
cd mcp-server
pnpm install --frozen-lockfile
cp .env.example .env
pnpm test
pnpm typecheck
pnpm build
```

```bash
cd painel
pnpm install --frozen-lockfile
cp .env.example .env
pnpm lint
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
node --experimental-strip-types --test scripts/financeiro.test.mts
pnpm build
pnpm dev
```

Preencha os ambientes e aplique as migrações **antes** de implantar. Para banco novo
ou existente, siga [o roteiro de implantação](docs/09_IMPLANTACAO.md). Não use
`db:push` no banco existente sem revisar a proposta de alteração. O journal histórico
não representa toda a sequência manual de migrações.

Na sessão automatizada mantenha `GABINETE_MCP_MODO_HUMANO=0`. Configure administração
pelo `ADMIN_EMAILS`. A rota de cron permanece fechada enquanto `CRON_SECRET` estiver
vazio. O padrão de dia civil do painel é Cuiabá; alinhe o MCP e os agendamentos ao
mesmo fuso.

## Aplicação no VPS e integração futura

O projeto [drtrafego/luana](https://github.com/drtrafego/luana) fornece identidade,
memória, canal Telegram e instruções de supervisão como base reutilizável. O advogado
terá um agente orquestrador próprio, com nome configurável e subagentes especializados.
Esse agente será externo à aplicação do Gabinete no VPS e acessará uma API autenticada
a ser construída em outra etapa. Um MCP poderá funcionar como adaptador dessa API.

O MCP desta versão usa **stdio local**. Ele não é uma API HTTP nem um endpoint MCP
remoto autenticado. As rotas HTTP que já atendem o painel não constituem uma API de
agentes pronta. Consulte [o desenho futuro](docs/07_LUANA_ESCRITORIO.md) e
[as permissões do MCP existente](docs/08_MCP_COLETA_E_PERMISSOES.md).
Os quatro perfis novos e o exemplo VPS ficam em `docs/futuro/`, fora da configuração
ativa. Não são necessários para implantar ou validar esta versão.

O destino previsto para o painel é o VPS como aplicação própria, com banco, documentos
privados e agendamentos configurados. A presença de arquivos Vercel no projeto não obriga
esse destino nem instala os agendamentos no VPS automaticamente.

## Revisão e próximos passos

A [auditoria e o roteiro de evolução](docs/10_AUDITORIA_E_ROADMAP.md) registram o que
foi encontrado, o que mudou, as validações e os limites restantes. Os próximos passos
são validar o sistema independente no ambiente de teste, revisar o catálogo/calendário
por fontes oficiais e ampliar o ciclo dos prazos e a auditoria. A integração externa
com o agente do escritório e o protocolo por agente ficam para uma etapa posterior.

A [referência do sistema financeiro](docs/12_REFERENCIA_FINANCEIRO.md) registra os
padrões que podem orientar uma API futura e os limites de reaproveitamento. O módulo
de honorários desta entrega pertence ao Gabinete; não há incorporação do financeiro pessoal/PF.

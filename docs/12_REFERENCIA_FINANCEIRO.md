# 12. Financeiro do Gabinete: referência e evolução

O financeiro deve continuar **dentro do Gabinete**, usando os clientes e as permissões do escritório. O projeto financeiro de Gastão é uma referência de funções, organização visual e automações. Seu banco, dados pessoais, identidade de atendimento e aplicação não são incorporados ao sistema jurídico.

O Gabinete permanece uma aplicação própria no VPS. O agente orquestrador do advogado terá nome configurável e será um cliente externo de uma API autenticada a ser construída. Consultar títulos, preparar cobrança, enviar mensagem e registrar recebimento são operações diferentes; o painel deve funcionar sem o agente.

## Referência efetivamente examinada

- Repositório: [drtrafego/gerenciador_financeiro](https://github.com/drtrafego/gerenciador_financeiro).
- Branch: `main`.
- Commit inspecionado: `7115e9b550c46cfe610bdbaeb3a49fdcb45ca771`, de 02/10/2026.
- O conector GitHub informou visibilidade **pública** na inspeção.
- A inspeção foi de código, somente leitura. Não foram executados seed, migrações, cron, envio ou chamadas ao banco/canais externos. Não foram lidos os registros pessoais para reutilização.

O projeto usa Next.js `15.6.0-canary.59`, React 19, Tailwind, Drizzle/Postgres, Stack Auth, Recharts, SMTP/Gmail e um serviço externo de WhatsApp. Esses componentes aparecem em `package.json`, `lib/db/schema.ts`, `lib/agent/`, `lib/email/` e `lib/wpp/send.ts`. O Gabinete utiliza Next.js 16, autenticação por sessão própria, seu schema jurídico e MCP stdio local. Copiar páginas, autenticação ou migrações inteiras criaria duas aplicações sobrepostas.

## O que o projeto de referência realmente tem

| Função | Evidência na referência | Uso adequado no Gabinete |
| --- | --- | --- |
| Clientes e contatos | `lib/db/schema.ts` → `clients`; `lib/agent/services/clients.ts` | Usar o cadastro `clientes` já existente, sem manter uma segunda carteira. |
| Contratos comerciais | `lib/agent/services/contracts.ts`; `contracts` no schema | Referência para contrato de honorários e periodicidade; campos de anúncios e tipos comerciais exigem outra modelagem. |
| Parcelamento | `server/actions/transactions.ts`; `lib/agent/services/transactions.ts` → `createTransactionService` | Até 60 lançamentos mensais, com divisão em centavos e ajuste ao último dia do mês. Adaptar para parcelas identificáveis de honorários. |
| Fluxo de caixa e dashboard | `lib/db/queries.ts` → `getDashboardData`, `getCashFlowData`; `components/shared/PeriodBar.tsx` | Reaproveitar seleção de período, leitura por cliente e distinção entre recebido e previsto. |
| Agenda de cobrança | `lib/billing/schedule.ts` → `canonicalDueDateFor`, `firstDueDateFor`, `sendDateFor` | Boa base de regras puras de datas; separar vencimento contratual da data efetiva de envio. |
| Cobrança por etapas | `app/api/cron/send-reminders/route.ts` | Aviso no vencimento e atrasos D+2/D+5, adiados no fim de semana; intervalo mínimo de dois dias úteis entre mensagens efetivas. Isso é política daquela operação, não regra jurídica nem padrão obrigatório deste escritório. |
| Deduplicação e pagamento | `reminders_contract_duedate_stage_unique` no schema; `lib/billing/confirmations.ts` → `confirmPayment`, `cancelPendingDunning` | Referência para chaves únicas e cancelamento de mensagens pendentes após baixa. |
| Templates e lembretes | `lib/agent/services/reminders.ts`; `components/reminders/RemindersClient.tsx` | Modelos editáveis, agenda, cancelamento e situação dos envios. |
| WhatsApp real | `lib/wpp/send.ts` → `sendWhatsApp` | Adaptador chama `/send` de outro serviço. A presença do código não comprova conexão ou entrega em produção. |
| Recibos e fila de e-mail | `lib/billing/receipts.ts`, `lib/billing/sendReceipt.ts`, `app/api/cron/send-receipts/route.ts` | Reivindicação antes de enviar, recuperação de execução presa e até três tentativas; adaptar a outbox do escritório. |
| API de agentes | `app/api/agent/v1/`; `lib/agent/route.ts`; `docs/AGENT_API.md` | Referência concreta de interface HTTP com validação, erros, paginação, token e auditoria. A API remota do Gabinete ainda não existe. |

Há uma distinção importante nos pagamentos da referência. `confirmPayment()` registra uma confirmação por contrato/vencimento e interrompe a cobrança de atraso; **não altera fatura nem lança uma transação**. O painel pode usar a camada adicional `confirmPaymentAndIssueReceipt()` para emitir fatura paga e colocar um recibo na fila. A API de confirmação do agente usa a primeira camada. Essa confirmação não pode ser simplesmente mapeada para o saldo recebido do Gabinete sem definir a regra de recebimento.

## Comparação com o módulo já implementado no Gabinete

| Aspecto | Gabinete nesta revisão | Referência | Evolução proposta |
| --- | --- | --- | --- |
| Cadastro financeiro | `cobrancas` vincula cliente, descrição, centavos BRL e data de vencimento | Contratos, faturas, transações e confirmações separados | Manter `cobrancas` como título a receber; acrescentar contrato/grupo de parcelas quando necessário. |
| Estados | Pendente, pago, cancelado; atraso calculado pela data | Estados próprios de fatura, lembrete e confirmação | Não misturar estado do dinheiro com estado da mensagem. |
| Recebimento | Usuário autenticado confirma data real; autoria registrada | Painel e API podem confirmar ciclos; emissão do recibo usa outra camada | Preservar ato humano autenticado e criar histórico de eventos. |
| Parcelas/recorrência | Cadastro avulso | Parcelamento de lançamentos e contratos mensais | Criar parcelas em lote atômico, com número, grupo e fim explícito. |
| Mensagem | Texto revisável, cópia e link manual WhatsApp | Templates, agenda e envio real pelo serviço externo | Implementar outbox e adaptador separado, após configurar política e canal do escritório. |
| Visão financeira | Totais globais, filtros de situação e busca | Períodos, gráficos e projeção do caixa | Recebido no mês, previsto, vencido e próximos vencimentos por cliente. |
| Listagem | Até 500 registros, com prioridade aos pendentes e aviso de limite | API usa paginação com total | Paginar e filtrar no banco; manter totais do período completos. |
| Agente externo | MCP financeiro é stdio local e somente consulta/preparação | API HTTP versionada tem operações de leitura e escrita | Construir contrato HTTP próprio do Gabinete, com credenciais e escopos próprios. |
| Finanças pessoais | Ausentes | PF, dependentes, cartões, câmbio, IOF e dados históricos próprios | Permanecem fora do sistema do advogado. |

Arquivos atuais do Gabinete que servem de ponto de partida:

- `painel/src/app/(app)/financeiro/page.tsx` e `actions.ts`.
- `painel/src/components/financeiro/`.
- `painel/src/db/financeiro.ts` e `painel/src/lib/financeiro.ts`.
- `painel/drizzle/0005_financeiro.sql`.
- `mcp-server/src/lib/financeiro.ts` e tools locais `listar_cobrancas`/`preparar_cobranca`.

## O que não deve ser transportado sem correção

### Credenciais e dados particulares

Foram encontrados literais de conexão Postgres remota com credenciais em **`migrate-reminders.mjs:3`** e **`PROJETO.md:218`** da referência pública. Os valores, host e usuário não são reproduzidos neste relatório. Não houve tentativa de usar ou verificar essas credenciais.

A correção exige remover os literais do código e dos documentos, usar `POSTGRES_URL` no ambiente e **rotacionar a credencial no provedor**. Apagar apenas a linha no commit atual não resolve a exposição: revisar também o histórico e as cópias existentes. A rotação deve preceder qualquer reaproveitamento desses arquivos; nenhuma rotação foi realizada nesta revisão.

O README identifica `lib/transactionData.ts` como uma base pessoal consolidada. Não importar esse arquivo, seus registros nem as categorias familiares para o advogado. Também não copiar `.env`, URLs do banco, destinatários, números de alerta, chave de pagamento ou outros dados da operação de Gastão.

### Importação e scanner

- O painel anuncia XLS/XLSX em `app/(dashboard)/scan/page.tsx`, mas `lib/ai/spreadsheetParser.ts:145–147` apenas lê `file.text()` e interpreta linhas textuais; não há parser de Excel nesse caminho.
- O reconhecimento de moeda em `spreadsheetParser.ts:220–222` testa `$` antes de `R$`, podendo classificar reais como USD. Um teste isolado com CSV fictício reproduziu esse comportamento, sem usar os dados particulares.
- Ao salvar o lote, `scan/page.tsx:341` define `type: 'expense'`, inclusive para uma receita identificada na importação.
- `lib/ai/receiptScanner.ts:187` devolve `SAMPLE_RECEIPTS[0].mockResult` para o fluxo de imagem/PDF. Esse caminho não é uma integração OCR real.

Esses recursos devem ficar fora da primeira ampliação do financeiro jurídico. Se importação for necessária depois, implementar CSV com prévia e validação de moeda/data/tipo e, separadamente, um parser real de XLSX. Não apresentar resultados de demonstração como leitura de um comprovante.

### Concorrência, entrega e datas

- As parcelas da referência são inseridas uma por vez em `server/actions/transactions.ts` e `lib/agent/services/transactions.ts`, sem transação de banco envolvendo o conjunto. Uma falha intermediária pode deixar somente parte do grupo cadastrada. No Gabinete, usar transação e chave de criação do lote.
- Os lembretes avulsos do cron e o `sendNowReminderService()` leem o registro antes do envio, sem uma reivindicação exclusiva do mesmo tipo usada na fila de recibos. Duas execuções podem disputar o mesmo lembrete. Adaptar a reivindicação antes de enviar; não reutilizar esse fluxo como garantia de entrega única.
- O avanço mensal dos lembretes recorrentes usa `setMonth()` sobre a data vigente, podendo deslocar o dia 31 para outro mês. A agenda canônica do próprio `schedule.ts` já contém uma abordagem melhor para o dia contratual.
- `sendWhatsApp()` não contém timeout explícito nem chave de idempotência de provedor. Falha depois de o provedor aceitar a mensagem exige reconciliação; uma chave única no banco não prova envio exatamente uma vez.
- O cron financeiro da referência fixa UTC−3. O Gabinete adota `America/Cuiaba`. Não copiar o deslocamento fixo nem tratar o calendário financeiro como calendário de prazos processuais.

A fila de recibos é uma referência mais adequada para recuperar trabalho interrompido. Seu próprio `sendReceipt.ts` registra o risco de duplicidade se o processo morrer entre a entrega ao SMTP e a gravação do sucesso. O desenho do Gabinete deve representar esse resultado como incerto até consultar o provedor, quando possível.

### Identidade e autorização

`lib/agent/auth.ts` valida token compartilhado e usa `x-agent-actor` como texto informativo; `lib/agent/rateLimit.ts` limita por esse mesmo ator informado pelo chamador. Não há escopos separados de leitura, cobrança e baixa nesse token. Reaproveitar a forma do wrapper, acrescentando principal de serviço validado, escopos e limite pelo principal autenticado; o ator livre não comprova quem autorizou um recebimento.

`lib/security/ipAllowlist.ts` contém uma origem embutida e depende de headers de proxy. No VPS do advogado, configurar a origem e garantir que o proxy sobrescreva os headers considerados confiáveis. Não copiar endereço fixo nem habilitar acesso irrestrito como configuração de implantação.

`app/api/personal/local-data/route.ts` retorna transações de arquivos locais quando eles existem, sem autenticação própria; o middleware exclui rotas `/api`. Esse acesso não pertence ao sistema jurídico e não deve ser copiado.

Os textos de `lib/wpp/send.ts` usam nome de assistente, marca e instrução de pagamento fixos da agência. No Gabinete, esses dados devem vir das configurações autorizadas do escritório; o nome do orquestrador não será fixado por essa referência.

## Plano concreto de reaproveitamento

### Etapa 1 — Completar a rotina do painel

Preservar o módulo atual e ampliar a interface com período, resumo mensal, histórico por cliente e listagem paginada. Organizar as visões como **Honorários**, **Cobranças**, **Lembretes** e **Configuração**, conforme os recursos forem implementados. Usar `PeriodBar`, tabelas/cards de clientes e apresentação dos lembretes da referência como ideias de interação, adaptadas ao visual do Gabinete.

Acrescentar um grupo de honorários/parcelas e uma regra opcional de recorrência. Cada parcela deve continuar sendo uma cobrança real, com ID próprio, valor em centavos, vencimento e estado. Contrato e processo podem ser vínculos opcionais; honorários de consultoria não exigem processo judicial.

Critérios: soma das parcelas igual ao total contratado, divisão sem perda de centavos, ajuste correto de fevereiro/dia 31, criação atômica, reenvio do mesmo pedido sem duplicar o grupo e nenhuma alteração dos títulos pagos ao regenerar parcelas futuras. Estorno ou correção de baixa deve gerar evento, não apagar o histórico.

### Etapa 2 — Definir agenda e outbox de cobranças

Adaptar `schedule.ts` como biblioteca pura, preservando vencimento canônico e data de envio separados. O escritório escolherá horário, intervalo, etapas e pausa; a política D+2/D+5 da agência é apenas referência. A primeira ativação precisa de data de início para não cobrar meses históricos automaticamente.

Criar ocorrência de lembrete e tentativa de envio persistidas. A chave de unicidade deve considerar cobrança/ocorrência/etapa/canal/destinatário. Antes de enviar, reivindicar a ocorrência com prazo de execução e reler se o título está pago, cancelado ou pausado. Confirmar recebimento e cancelar o título devem invalidar a fila pendente correspondente.

Critérios: dois workers não enviam simultaneamente a mesma ocorrência; execução interrompida pode ser retomada; falha ou resposta incerta ficam visíveis; cliente sem contato gera pendência; nenhuma parcela paga recebe nova cobrança ativa. Destinatário e mensagem precisam corresponder à versão aprovada.

### Etapa 3 — Construir a API e conectar o canal do escritório

A referência demonstra que o agente pode ser um cliente HTTP, sem controlar o banco. Construir uma camada de serviços própria, compartilhada pela página e pela futura API; o contrato abaixo é **proposta, não endpoints disponíveis nesta revisão**.

| Operação proposta | Acesso | Regra |
| --- | --- | --- |
| Listar honorários/vencimentos/atrasados | Serviço, escopo de leitura financeira | Filtros no servidor, paginação, valor inteiro, moeda e fuso explícitos. |
| Ler um título | Serviço, escopo de leitura financeira | Dados mínimos; estado atual e vínculo ao cliente. |
| Preparar um rascunho | Serviço, escopo de preparação | Não envia, não agenda, não dá baixa; devolve destinatário e versão. |
| Solicitar agendamento | Serviço com escopo específico | Política autorizada, chave idempotente e estado persistido; sem envio oculto. |
| Autorizar/despachar envio | Permissão de envio definida pelo escritório | Pacote aprovado e revalidação do título; comprovante técnico do provedor. |
| Confirmar/corrigir recebimento | Usuário humano autenticado | Data real, autoria verificável, idempotência e evento de auditoria. |

Não expor `registrarPagamentoAction()` como rota autorizada apenas por uma chave de automação. Usar o agente para organizar o trabalho e apresentar opções ao advogado; manter a autorização da baixa separada da identificação do agente.

#### Canal e validação da integração

Adicionar um adaptador de WhatsApp ou e-mail do advogado e um worker/agendamento no VPS. Configuração do canal, nome do assistente, assinatura, instruções de pagamento e destinatários são próprios dessa instalação. Telegram e memória permanecem no projeto externo do orquestrador, não no módulo financeiro.

Primeiro validar em modo de prévia e com destinatários de teste: vencimento hoje, sábado/domingo, atraso, recebimento antes do envio, cancelamento, falha de canal, timeout, retomada, dupla execução e contato alterado. Após esses critérios, ativar a política escolhida pelo escritório. Este relatório não ativou nenhum canal ou envio.

## Escopo recomendado

Para o pedido de financeiro simples do advogado, priorizar **honorários, parcelas, recebimentos, vencimentos, agenda e histórico de cobrança**. Despesas básicas e recibo podem entrar em uma etapa seguinte se fizerem parte da rotina. Finanças PF, cartões familiares, câmbio ARS/USD, IOF, orçamento de anúncios e métricas de aquisição continuam no projeto de origem.

Esta etapa produziu a análise e o plano acima. Não ampliou o código funcional indiscriminadamente, não copiou a aplicação de referência, não conectou o agente externo e não modificou o repositório financeiro de Gastão.

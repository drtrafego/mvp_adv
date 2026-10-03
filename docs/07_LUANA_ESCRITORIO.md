# 07. Integração futura: agente orquestrador externo do escritório

O Gabinete é um sistema independente. O advogado e sua equipe usam o painel para
clientes, processos, intimações, prazos, documentos, minutas e honorários. Esta
revisão melhora esse sistema, que será uma aplicação própria no VPS.

O advogado terá um agente orquestrador próprio, com o nome que escolher, baseado no
projeto reutilizável `luana`. Esse agente e seus subagentes terão projeto e implantação
separados. Quando a integração for solicitada, o agente acessará operações do Gabinete
por uma API autenticada com contrato próprio. Essa API ainda precisa ser construída.
Um MCP poderá ser um adaptador da API. O MCP stdio
local já existente no projeto continua útil para sessões assistidas de terminal,
mas não é um endpoint remoto nem um serviço HTTP pronto para esse agente consumir.

## Separação de responsabilidades

| Componente | Papel | Situação nesta entrega |
|---|---|---|
| Gabinete | Cadastro, documentos, prazos, minutas, honorários e revisão humana | Sistema que está sendo melhorado e validado |
| MCP local | Ferramentas de consulta, coleta e persistência por stdio | Componente já existente, com correções de segurança e integridade |
| Squad jurídico local | Análise, pesquisa, tese, redação e revisão em sessão assistida | Especialistas já existentes, com fluxo de persistência corrigido |
| API autenticada | Fronteira para um cliente externo; MCP pode atuar como adaptador | Não implementada; contrato a definir na etapa da integração |
| Orquestrador do escritório | Coordenar subagentes e pedidos; nome escolhido pelo advogado | Projeto externo baseado em `luana`, integração posterior |
| Subagentes do escritório | Operação, jurídico, cobrança e preparação do protocolo | Exemplos inativos em `docs/futuro/agents/` |

O cliente externo não deverá ser uma identidade de sistema do Gabinete. A sessão,
memória, bot Telegram e supervisão do orquestrador pertencem à sua infraestrutura. O banco
e as validações de negócio continuam no Gabinete. Subagentes não precisam de bots
próprios: o orquestrador receberá o pedido e entregará o resultado pelo seu canal.

## Exemplos arquivados, sem ativação

Os seguintes arquivos são rascunhos de uma arquitetura futura:

- `docs/futuro/agents/orquestrador-escritorio.md`
- `docs/futuro/agents/gestor-operacional.md`
- `docs/futuro/agents/financeiro-escritorio.md`
- `docs/futuro/agents/protocolo-assistido.md`
- `docs/futuro/mcp-stdio-vps.example.json`

Eles não ficam em `.claude/agents/` nem na configuração MCP ativa. Não são carregados
para operar esta revisão. O JSON ilustra apenas um processo stdio local com caminhos
absolutos; ele não representa a futura configuração de acesso remoto. Antes de usar
qualquer exemplo, adaptá-lo ao cliente, ao contrato e ao transporte definidos.

## Contrato da integração, quando for construída

A primeira etapa futura será definir e construir a API autenticada e suas operações
permitidas, antes de instalar perfis e canais. Um adaptador MCP poderá consumi-la.
Não expor uma conexão direta
ao banco como substituto desse contrato. A integração deverá ter credencial de
serviço própria, escopos mínimos, identificação do escritório e validação do autor.

Os dados precisam de IDs estáveis, paginação, limites e formatos explícitos de data,
valor e estado. Erro de fonte, coleta parcial e texto incompleto devem permanecer
visíveis ao cliente. O servidor deverá impedir a alteração de registros humanos
pela automação; uma instrução no prompt não substitui a validação no backend.

| Operação futura | Regra do contrato |
|---|---|
| Ler carteira/intimação/documento | Autorização, limites e indicação de texto completo/parcial |
| Propor prazo/análise/minuta | Origem máquina, vínculo ao caso e versão rastreável |
| Confirmar prazo, aprovar peça ou baixar pagamento | Ato humano autenticado, separado da credencial de automação |
| Consultar honorários/preparar cobrança | Título real, valor em centavos e status atualizado |
| Despachar trabalho | ID, estado persistido, chave idempotente e recuperação de falha |
| Entregar notificação | Destinatário validado, tentativa e resultado verificáveis |

Os endpoints ou ferramentas remotas não são criados nesta entrega. A superfície
MCP atual pode orientar o contrato, mas transportá-la para acesso remoto exige
autenticação, autorização e análise específica de cada operação.

## Fluxo jurídico a preservar

A comunicação oficial recebe um ID e vínculo ao processo. Uma coleta concluída não
significa que a análise ou o prazo estejam prontos. `listar_intimacoes` fornece o
índice; `ler_intimacao` permite ler o inteiro teor pelos offsets até o final.

O assistente identifica ato e rito a partir da fonte completa. O motor calcula a
data com o catálogo e o calendário; o resultado é sugestão. O advogado confirma ou
edita no painel. A automação não assume a identidade de quem confirmou.

Na sessão assistida atual, o `forense` recebe as propostas dos especialistas, chama
o revisor quando houver citações e salva a versão revisada. Isso corrige instruções
anteriores que mandavam persistir sem a ferramenta necessária ou sem responsável
pelo gate. A revisão das citações não equivale a aprovação do mérito ou assinatura.

Em uma integração posterior, o agente poderá solicitar esses trabalhos pela API
do Gabinete. O quadro atual de minutas pendentes não despacha automaticamente um
worker. Esse despacho, a fila e a retomada devem ser implementados explicitamente.

## Cobrança e peticionamento futuros

Hoje o financeiro do Gabinete guarda contas a receber e prepara mensagens para
envio manual. `listar_cobrancas` e `preparar_cobranca` são ferramentas locais;
preparar, enviar e receber pagamento são estados diferentes.

Automatizar cobrança depois exige canal, destinatário validado, política do escritório
e outbox com chave única por título/ocorrência/canal/destinatário. Conferir novamente
o status antes de enviar; títulos pagos ou cancelados não podem receber cobrança
ativa. Juros, descontos e instruções de pagamento vêm de dados autorizados reais.

O Gabinete não possui adaptador de protocolo judicial. O envio atual é manual.
Para o agente peticionar no futuro, um adaptador específico deverá receber o pacote
exato aprovado pelo advogado, com IDs, versão/hash, destino, anexos e signatário.
Qualquer edição invalida a autorização do pacote anterior. O resultado precisa de
recibo e número de protocolo verificáveis. Após timeout de envio, reconciliar no
tribunal antes de tentar novamente. DataJud e DJEN não são canais de peticionamento.

## Infraestrutura do agente externo, fora da implantação atual

O projeto `drtrafego/luana` oferece identidade, memória, Telegram e instruções de
supervisão. `tmux` mantém o terminal desacoplado do SSH; não cria a conexão com o
modelo, não supervisiona sozinho a aplicação e não guarda uma fila durável.

O README daquele projeto registra perda possível de trabalho em execução durante
reinícios. Retomar a conversa e salvar memória não substituem persistência de tarefas.
Quando houver integração, a infraestrutura do agente e o despacho do Gabinete precisam
de contrato de retomada, lease, tentativas, resultado e entregas sem duplicidade.

Datas, valores, documentos e estado dos casos continuam no Gabinete. A memória do
orquestrador deverá guardar contexto e preferências mínimos. Credenciais, certificado e
senhas não pertencem a prompts, Git ou logs de texto.

## Validação separada

A implantação desta revisão termina na validação do sistema independente, seguindo
`docs/09_IMPLANTACAO.md`. Não exige Telegram, perfis do agente externo ou novos endpoints.

A etapa futura deverá comprovar, em ambiente autorizado: acesso autenticado do
cliente, respeito aos escopos, leitura integral, sugestões vinculadas ao caso,
preservação das aprovações humanas, retomada de tarefas e resultado de entrega.
Cobrança automática e protocolo terão testes próprios após seus adaptadores existirem.
Nenhum desses canais ou serviços foi acionado nesta revisão.

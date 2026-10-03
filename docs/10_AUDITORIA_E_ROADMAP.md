# Auditoria e roteiro de evolução — Gabinete

Revisão solicitada em 02/10/2026. Base examinada: `mvp_adv` no commit
`b36afbd1af11c1d89e5cb94624f624006724c32d` e `luana` no commit
`2f3676c36ba1b70a9c870472b796b4574dfe23f4`. A implementação desta revisão altera
somente o Gabinete, como aplicação independente para o VPS. O projeto-base `luana`
permanece reutilizável e separado. O advogado terá um agente orquestrador próprio,
com nome configurável, integrado posteriormente por uma API autenticada ainda não construída.

## Avaliação do produto

O projeto já tem uma fundação relevante: registro de clientes e processos, coleta
oficial, documentos privados, prazo determinístico, análises e minutas. Sua principal
fragilidade estava na continuidade operacional: coletar não significava analisar,
validar um resultado não significava entregá-lo, e uma sessão de agente não era uma
fila de trabalho. A interface também mostrava estados mais confiantes do que o backend
podia provar.

A direção recomendada é um escritório organizado por pendências e por caso. O painel
mostra prioridades, dados atuais e material para o advogado decidir. O banco guarda
o histórico operacional. Um agente externo poderá coordenar trabalhos posteriormente,
via API, sem se tornar dependência do sistema nem guardar o cadastro em memória de conversa.

## Problemas encontrados e correções

| Prioridade | Situação anterior | Mudança nesta revisão |
| --- | --- | --- |
| Crítica | Server actions podiam ser invocadas sem sessão própria; o layout autenticado não protegia a mutação. | Sessão checada em cada ação, parâmetros validados e autoria extraída da sessão. |
| Crítica | Cron ficava acessível quando o segredo estava ausente. | Rota desativada sem segredo, token comparado integralmente e webhook com timeout. |
| Alta | Colaboradores podiam administrar acessos. | Administração por `ADMIN_EMAILS`; sem lista, somente o acesso mais antigo administra. |
| Alta | MCP do agente podia declarar confirmação humana ou informar um editor arbitrário. | Operações humanas bloqueadas por padrão; modo humano é configuração de uma sessão separada. |
| Alta | DJEN consultava só a primeira página; falha de uma variante da OAB podia sumir. | Paginação completa, validação de resposta e erros parciais explícitos, preservando os itens recebidos. |
| Alta | Intimação resumida podia ser tratada como leitura integral. | `ler_intimacao` fornece o texto paginado; perfis exigem leitura completa. |
| Alta | Datas impossíveis/NaN podiam produzir resultado incorreto ou loop. | Datas e durações inválidas recusadas antes do cálculo. |
| Alta | Aprovação de peça concorria com atualização do agente em consultas separadas. | Escrita do agente condicionada à origem máquina; aprovação humana vinculada a hash, versão e conteúdo atual. |
| Alta | Geração de prazo ou classificação do modelo encerrava a leitura humana da intimação. | Essas etapas não marcam a comunicação como cuidada; a pendência permanece explícita. |
| Alta | Upload de documento com data antiga falhava; retry/reattach podiam colidir com Blob retido. | Data enviada no handshake, identificador por tentativa, metadados checados e proibição de overwrite. |
| Alta | Trilha de migração não criava todas as tabelas/colunas usadas pelo produto. | Migração de paridade `0006`, além do financeiro `0005`, e instruções separadas para banco novo/existente. |
| Média | Vencidos apareciam depois dos futuros; confirmação rápida escondia divergências. | Vencidos têm seção de atenção e a confirmação abre a revisão com fonte e pendências. |
| Média | Filtro de intimações após LIMIT escondia uma pendência antiga. | Filtro antes do limite, contagens completas e paginação. |
| Média | Dia UTC e fuso do navegador divergiam do dia do escritório. | Dashboard, urgência, cron e financeiro usam o dia civil de Cuiabá. |
| Média | Sidebar exibia “sincronizado” fixo. | Sessão e coletas são estados separados; o dashboard mostra a última execução registrada. |
| Média | Busca limitada, links sem filtro e processos excluídos em contagens/detalhes. | Busca ampliada, limites declarados, links filtrados e exclusão lógica respeitada. |
| Média | Drawer móvel sem tratamento completo de foco/Escape. | Diálogo acessível, fechamento por Escape, foco contido e link para pular ao conteúdo. |

Não houve revisão jurídica integral do catálogo. A entrada da ação rescisória que
aproximava duração em anos por 730 dias está bloqueada para evitar uma data enganosa.
A definição correta precisa de revisão com fonte oficial, termo inicial e regra de calendário.

## Melhorias de interface e função

A tela inicial passa a destacar revisão, urgência e intimações sem prazo. Os prazos
aparecem antes das comunicações recentes, para evitar que uma urgência fique abaixo
de itens já cuidados. A carteira
mostra um recorte com acesso à lista completa; os atalhos levam à preparação de nova
ação, honorários e operação. A página Operação informa a saúde das coletas e oferece
atalhos para os módulos e as pendências do escritório. Os estados vazios não
simulam dados. Há carregamento e recuperação de falha, além de melhor contraste no tema escuro.

O financeiro cobre contas a receber: cliente, descrição, valor em centavos, data de
vencimento, pagamento conferido e cancelamento. Há filtros, busca, totais e rascunhos
para copiar ou abrir no WhatsApp. `listar_cobrancas` e `preparar_cobranca` tornam esses
dados acessíveis por MCP local em sessões assistidas. Uma mensagem preparada não é uma mensagem enviada, e uma
resposta do cliente não comprova pagamento.

A lista financeira prioriza pendentes e informa seu teto de 500 registros. Totais
consideram todo o histórico. Uma operação maior exigirá filtros/paginação no banco.

## Assistência jurídica existente e integração posterior

| Responsável | Entrega |
| --- | --- |
| Forense | Coordenação de tese, pesquisa, estratégia, análise, redação e revisão. |
| Revisor jurídico | Conferência independente de citações e fontes; não assinatura do advogado. |
| Painel financeiro | Vencimentos reais e textos de cobrança vinculados ao título, com envio manual. |
| Painel de operação | Saúde das fontes e pendências registradas do escritório. |

As instruções antigas mandavam especialistas persistir sem lhes dar ferramentas ou
sem coordenar o gate de revisão. Agora o `forense` recebe as propostas, coordena a
revisão e salva a versão adequada em uma sessão assistida de terminal.

Os quatro perfis novos de orquestração, operação, financeiro e protocolo foram
arquivados como exemplos inativos em `docs/futuro/agents/`, junto do exemplo de MCP
stdio em VPS. Não fazem parte da configuração ativa nem da implantação atual.
O orquestrador futuro terá nome escolhido pelo advogado e será baseado no projeto
`luana`. A API autenticada do Gabinete será uma etapa própria; MCP poderá atuar como adaptador.

A referência `drtrafego/gerenciador_financeiro` pode orientar o desenho futuro de
contrato, validação e auditoria de API. Isso não implementa a API do Gabinete nem
autoriza copiar a aplicação financeira pessoal/PF. A análise encontrou credenciais
de banco versionadas nessa referência; nenhum valor é reproduzido nesta entrega.
Não reutilizar esses arquivos literalmente. A rotação e retirada das credenciais
da referência precisam ser tratadas antes de qualquer reaproveitamento. O detalhamento
está em [referência do financeiro](12_REFERENCIA_FINANCEIRO.md).

## Próxima evolução recomendada

1. **Validar o Gabinete independente no VPS.** Aplicar as migrações em uma cópia
   do banco e validar os fluxos do painel com o advogado. Configurar aplicação,
   supervisão, proxy e agendamentos do escritório, sem instalar o agente externo.
2. **Ciclo completo do prazo.** Acrescentar cumprido/concluído, providência, responsável
   e comprovante. Hoje “confirmado” significa data revisada; não significa providência
   realizada. Cancelamento não deve servir como comprovante de cumprimento.
3. **Fonte única do schema e auditoria.** Compartilhar o schema entre painel/MCP;
   acrescentar versionamento/concorrência para análises e eventos imutáveis das operações.
   A deduplicação sequencial dos prazos já existe; execução concorrente precisa de chave
   estável e índice único para impedir inserções simultâneas.
4. **Revisão jurídica e robustez.** Conferir catálogo, feriados e suspensões locais em
   fontes oficiais; ampliar cenários de rito/termo inicial. O motor determinístico só
   é confiável quando a classificação e o calendário de entrada estão corretos.
5. **API autenticada para o cliente externo, em outra etapa.** Definir operações,
   credencial de serviço, escopos, autoria, paginação, idempotência e limites. Integrar
   depois o orquestrador do escritório, com nome escolhido pelo advogado. Não expor
   banco ou ações internas do painel como se já fossem esse contrato de API.
6. **Trabalhos e entregas duráveis, após o contrato de integração.** Registrar pedido,
   caso, estado, tentativas, responsáveis e artefatos. Os pedidos pendentes atuais não
   despacham um worker automaticamente. Notificações/cobranças futuras precisam de canal
   e outbox, com destinatário validado, prova de entrega e conferência do título antes
   do envio. O cron atual alerta por webhook sem deduplicação durável de entregas.
7. **Protocolo por agente, em etapa específica.** Implementar adaptador, testar assinatura
   e anexos, vincular autorização ao hash do pacote e guardar recibo. Em envio incerto,
   reconciliar no tribunal antes de repetir. DataJud/DJEN não são canais de protocolo.

## Limites atuais de produção

- A instância atende um escritório com carteira compartilhada. Administração de
  usuários está separada, mas não existem permissões por processo nem isolamento SaaS.
- Rate limit persistente de login e MFA ainda precisam ser implementados.
- O hash de upload informado pelo navegador não é recalculado pela API; metadados,
  caminho, sessão e autorização do Blob são checados. Hash definitivo no servidor é melhoria futura.
- A extração no painel limita os bytes a 25 MB. Originais maiores continuam acessíveis;
  processamento de arquivos grandes e OCR devem rodar no servidor/worker.
- Algumas ações com várias consultas ainda não são transacionais.
- O gate do MCP pressupõe isolamento da implantação. Um agente com shell e credenciais
  administrativas irrestritas pode alterar banco/configuração fora do MCP.
- `tmux` mantém o terminal, mas não supervisiona a aplicação nem preserva trabalhos.
  O projeto-base `luana` orienta systemd; infraestrutura do agente externo, jobs duráveis
  e entrega idempotente pertencem à integração posterior.

## Validação e implantação

A revisão foi feita sem banco, documentos, mensagens ou petições reais do escritório.
Foram usados testes automatizados, dados fictícios e Postgres WASM local para verificar
migrações e consultas. Os resultados estão registrados em `docs/11_HANDOFF_AGENTE.md`. A criação de branch
remota foi recusada pela integração GitHub com HTTP 403; a entrega inclui código
completo e patch para aplicação pelo acesso autorizado ao repositório.

A validação de código não comprova entrega em Telegram/WhatsApp, acesso real ao
tribunal ou disponibilidade das APIs externas no servidor do advogado. Esses pontos
exigem testes de integração no ambiente autorizado.

Aplique o [roteiro de implantação](09_IMPLANTACAO.md). O
[desenho do agente externo](07_LUANA_ESCRITORIO.md) é uma referência para outra etapa,
sem pré-requisitos adicionais para esta versão. Antes de colocar esta versão no ambiente
atual, preservar o banco, aplicar somente as migrações faltantes e verificar as
variáveis. A reversão do código deve preservar os registros financeiros e demais dados.

# MCP jurídico: permissões, coleta e limites

O MCP stdio local do Gabinete, usado em sessões assistidas de terminal, produz **sugestões**. Não transforma uma
decisão do modelo em aprovação do advogado. `confirmar_prazo`, `editar_prazo` e o caminho humano
de `definir_cliente` recusam a operação por padrão. Um nome de editor ou o parâmetro
`confirmado_pelo_advogado=true` não libera essa permissão.

O caminho normal de confirmação é o painel autenticado. Para compatibilidade com uma sessão
de terminal operada diretamente pelo advogado, o processo MCP aceita
`GABINETE_MCP_MODO_HUMANO=1`. Essa configuração deve existir **somente** em uma sessão separada
do advogado. Não colocá-la no ambiente de subagentes, serviços automatizados ou cron.

Esse MCP já fazia parte do projeto e continua como componente local opcional. O painel
funciona de forma independente. A API autenticada para um agente externo com nome escolhido
pelo advogado ainda não existe; quando for criada, um MCP poderá servir como adaptador.

Isso é uma proteção na superfície MCP. Um agente que também recebe shell irrestrito e as mesmas
credenciais administrativas do banco consegue contornar a superfície por outros caminhos.
Para a implantação, usar usuários/serviços separados, credenciais de banco com permissões
mínimas e não entregar à sessão automatizada a configuração de modo humano.

## Leitura e escrita pelo agente

- `listar_intimacoes` é um índice/resumo. `ler_intimacao` lê o inteiro teor por id, com `offset`
  e `limite` (até 20.000 caracteres). A resposta informa quando o texto está parcial e o próximo
  offset. O especialista deve ler todas as páginas antes de concluir uma análise.
- `calcular_prazo(persistir=true)` grava sugestão, deriva o processo da intimação e recusa vínculo
  com processo diferente. Reexecuções sequenciais para a mesma comunicação e descrição do ato
  reutilizam o prazo vivo, sem alterar a data aprovada ou sugerida. A resposta deixa claro quando
  o novo cálculo foi apenas simulado.
- Criar um prazo não marca a comunicação como leitura encerrada. O vínculo do prazo a retira da
  fila; se o advogado cancelar o prazo, ela volta a ficar pendente. Uma classificação automática
  de “sem prazo” também permanece para revisão humana.
- `salvar_peca` só atualiza linhas com `origem=maquina` no próprio `UPDATE`. Uma aprovação humana
  concorrente impede a escrita, mesmo que aconteça enquanto o agente está redigindo.
- Todos esses caminhos geram rascunhos e metadados. Protocolo judicial e envio de cobranças
  exigem adaptadores específicos em uma etapa posterior, descrita no desenho da integração externa.

## Coleta confiável

A consulta DJEN percorre as páginas, incluindo uma consulta adicional quando a última página
está cheia. Se uma página falhar, a API repetir a mesma página ou uma variante da OAB falhar,
a cobertura fica marcada como incompleta. Os itens já obtidos são preservados quando possível;
nenhuma dessas situações retorna “coleta completa, zero intimações”. Resposta sem a lista `items`
também é erro, e não ausência de publicações.

O DataJud e o DJEN têm timeout de 20 segundos por requisição. O webhook do script de alertas
tem timeout de 15 segundos e HTTP não exitoso retorna falha. Scripts de coleta retornam código
de saída 1 quando a coleta tem falha/parcial ou a OAB está ausente/inválida. O cron/supervisor
deve observar esse código, além do histórico de sincronização.

As datas operacionais usam `GABINETE_TIMEZONE` (padrão `America/Cuiaba`), com aritmética de datas
no calendário. Configure outro fuso IANA se a operação estiver em outra região. Datas impossíveis,
durações não inteiras, NaN e infinito são recusados antes da contagem.

## Limitações que permanecem

- A proteção contra duplicação de prazo cobre reexecuções sequenciais; duas instâncias concorrentes
  ainda exigem migração com chave estável do ato e índice único por comunicação/ato. Uma descrição
  textual diferente é tratada como outro ato. Executar um único worker por carteira até essa migração.
- O catálogo legado representa ação rescisória como 730 dias, embora o próprio cadastro descreva
  prazo em anos. Esse cálculo foi bloqueado: precisa de termo inicial e tratamento por aniversário,
  com revisão das fontes oficiais, em vez de uma aproximação de duração.
- O calendário de suspensões e regras locais depende de revisão do advogado. A validação de datas
  e a aritmética determinística não confirmam a classificação jurídica ou o termo inicial.
- Não foram usados dados reais do banco nem enviadas mensagens, cobranças ou petições na validação.

## Validação local

Na pasta `mcp-server`, executar `pnpm test`, `pnpm typecheck` e `pnpm build`. Os testes
substituem rede e persistência por mocks para verificar paginação, falhas parciais, validação de
datas, recusa de decisão humana pelo agente e proteção de peça contra aprovação concorrente.

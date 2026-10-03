# Entrega para o agente que fará a implantação

A entrega v2 é a revisão do Gabinete como aplicação independente no VPS. O financeiro
pertence ao Gabinete. O agente orquestrador do advogado será um projeto externo, com
nome escolhido por ele e baseado em `luana`, conectado posteriormente por uma API
autenticada ainda não implementada. Não instalar esse agente durante esta implantação.

A revisão foi implementada localmente. A conexão GitHub desta conversa recusou a
criação de branch com HTTP 403 (`Resource not accessible by integration`), portanto
não existe branch remota nem pull request desta entrega.

## Aplicar o patch

Base: `b36afbd1af11c1d89e5cb94624f624006724c32d` de `drtrafego/mvp_adv`.
Os arquivos `gabinete-revisado-v2.zip` e `gabinete-revisao-v2.patch` substituem a
entrega anterior. O patch inclui todos os arquivos novos e alterados.
Use um checkout limpo desse commit, ou revise conflitos se o repositório já evoluiu.

```bash
git clone https://github.com/drtrafego/mvp_adv.git
git -C mvp_adv switch -c melhoria/gabinete-revisao-v2 b36afbd1af11c1d89e5cb94624f624006724c32d
git -C mvp_adv apply --check /caminho/gabinete-revisao-v2.patch
git -C mvp_adv apply --index /caminho/gabinete-revisao-v2.patch
```

O ZIP contém a árvore completa revisada, incluindo o squad jurídico local já existente,
documentação e lockfiles. Os quatro perfis futuros e o exemplo stdio VPS estão em
`docs/futuro/`, como exemplos inativos; não estão na configuração ativa. A opção patch
facilita preservar histórico e revisar o diff.
A instalação não contém credenciais reais. As credenciais da implantação ficam no
ambiente privado do escritório.

## Ordem de implantação

1. Ler `docs/10_AUDITORIA_E_ROADMAP.md` e `docs/09_IMPLANTACAO.md`.
2. Revisar o diff e rodar os comandos de validação do README.
3. Preservar o banco atual e aplicar somente as migrações faltantes. Para banco que
   já possui a base, a atualização normalmente inclui `0005` e `0006`; confirmar o schema.
4. Configurar ambiente do painel: banco, Blob privado, administradores e segredo do cron.
5. Implantar o painel como aplicação própria no VPS e configurar explicitamente
   supervisão, proxy e agendamentos existentes de coleta/alerta. O `vercel.json` não
   instala cron no VPS. Conferir login, prazos, intimações, documentos, aprovação da
   peça e honorários com dados de teste. O MCP stdio é componente local opcional.
6. Se houver destino autorizado de alerta, testar o webhook atual e registrar o resultado.
   Cobranças permanecem com preparação/envio manual; não configurar automação ausente.
7. Fazer commit e publicar a branch pelo acesso autorizado ao GitHub, com uma PR que
   registre as migrações e os limites. Concluir a implantação após conferir os passos anteriores.

Não combinar a identidade do projeto-base `luana` com o contexto ativo do Gabinete.
O repositório-base foi examinado e permanece intacto. `docs/07_LUANA_ESCRITORIO.md`
descreve a arquitetura posterior, sem criar API, bot ou requisito de implantação atual.
`docs/12_REFERENCIA_FINANCEIRO.md` registra a referência técnica do financeiro e os
limites de reaproveitamento; não copiar credenciais ou a aplicação pessoal/PF para o Gabinete.

## Peticionamento

O envio atual é manual. O exemplo inativo `protocolo-assistido` descreve uma conferência
futura. O envio por agente ao tribunal ainda exige
um adaptador específico, autorização do pacote exato, assinatura e recibo. Uma peça
aprovada no painel é um artefato revisado, não prova de protocolo.

## Validação desta entrega

- MCP: 101 testes, TypeScript e build.
- Painel: 19 testes de segurança/aprovação e 5 de financeiro, lint, TypeScript e build.
- PostgreSQL WASM: 27 verificações de consultas/schema; migrações 0000–0006 em base nova
  e reaplicação 0002–0006.
- Navegador: login, dashboard, busca, filtros/paginação, revisão com fontes, drawer e
  cinco telas móveis. Sem transbordamento de largura ou erro de página.
- Financeiro de ponta a ponta no navegador: cadastro com centavos/autor conferidos
  no banco, rascunho copiado exatamente, recebimento e cancelamento persistidos.
  Acesso da equipe validado sem controles de administração.
- Protocolo MCP stdio: permissões humanas fechadas por padrão e tools anunciadas.

Dados usados nas verificações são fictícios. Serviços do advogado, Telegram,
WhatsApp, documentos privados e protocolo judicial não foram acionados.

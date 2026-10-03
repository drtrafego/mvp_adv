# Implantação da revisão do Gabinete

Esta revisão mantém uma instância para um único escritório. Todos os colaboradores autorizados compartilham a carteira. Use banco e Blob separados ao implantar para outro escritório. Não há isolamento entre escritórios dentro da mesma instância.

O destino previsto é o VPS, como aplicação independente do Gabinete. A implantação atual
não exige agente residente, Telegram ou o projeto-base `luana`. O agente orquestrador terá
nome escolhido pelo advogado e projeto próprio em uma etapa posterior; sua API autenticada
de acesso ao Gabinete ainda não está implementada.

## Antes de atualizar

Faça um backup ou crie um branch do banco atual. Registre o commit/deployment anterior e preserve os arquivos privados do Blob. Confirme a titularidade do primeiro acesso em `usuarios` e configure `ADMIN_EMAILS` com o email de quem administrará a equipe.

O schema do painel é `painel/src/db/schema.ts`, espelhado pelo MCP. A trilha suportada de implantação são os SQLs em `painel/drizzle/`. A migração `0006_completar_base.sql` fecha lacunas antigas de peças, modelos, anexos, anotações de cliente/prazo e destinatários do DJEN. O arquivo histórico `supabase/schema.sql` não substitui a sequência de migrações nem serve como atualizador automático de banco existente.

## Banco novo

Execute uma vez, nesta ordem, dentro de `painel/` com `DATABASE_URL` apontando para o banco correto:

```bash
pnpm migrar 0000_gabinete_init.sql
pnpm migrar 0001_fase2_processo.sql
pnpm migrar 0002_auth.sql
pnpm migrar 0003_analise_intimacao.sql
pnpm migrar 0004_partes_e_pasta_cliente.sql
pnpm migrar 0005_financeiro.sql
pnpm migrar 0006_completar_base.sql
```

`0000` e `0001` são migrações iniciais e não podem ser repetidas no mesmo banco. O executor aplica um arquivo por vez e não mantém histórico próprio. Anote os arquivos já aplicados. As migrações `0002` a `0006` usam comandos idempotentes, preservando registros existentes.

Crie o primeiro acesso pelo comando `pnpm criar-advogado`, já existente no projeto, e troque a senha inicial no primeiro login. O argumento de senha desse script aparece na linha de comando: execute em terminal privado e evite guardar a senha no histórico do shell.

## Banco existente

Não rode `0000` ou `0001` novamente. Compare as tabelas/colunas atuais com o schema do painel e aplique somente as migrações que faltam. Instalações que já usam a base antiga devem aplicar `0005_financeiro.sql` e `0006_completar_base.sql` antes de subir esta versão, além de `0002` a `0004` se ainda não tiverem sido aplicadas.

A migração `0006` não apaga dados. Ela permite que `anotacoes.processo_id` fique vazio quando a anotação pertence a cliente ou prazo, sem remover a coluna ou a chave estrangeira. Os índices únicos de hash podem apontar duplicações preexistentes: se a criação falhar, confira os documentos duplicados com o responsável antes de qualquer saneamento. Não apague anexos automaticamente.

O executor atual divide o arquivo por ponto e vírgula. Estes SQLs novos não usam blocos `DO`, funções SQL nem ponto e vírgula dentro de texto. Execute as migrações manuais com `pnpm migrar`; o journal histórico do Drizzle registra somente as duas migrações iniciais, portanto `drizzle migrate` não representa toda esta trilha. Não use `db:push` como substituto sem revisar a proposta de mudança.

## Variáveis no painel

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Banco exclusivo deste escritório. |
| `BLOB_READ_WRITE_TOKEN` | Store privado para os anexos. Use o mesmo store no painel e no MCP deste escritório. |
| `ADMIN_EMAILS` | Emails de administradores separados por vírgula ou ponto e vírgula. Sem valor, somente o usuário mais antigo administra os acessos. Com valor definido, somente os emails da lista administram. |
| `CRON_SECRET` | Segredo enviado pelo Vercel Cron como `Authorization: Bearer …`. Ausente: rota desativada com HTTP 503. Token incorreto: HTTP 401. |
| `ALERTA_DIAS` | Janela de alerta, inteiro entre 1 e 30. Padrão: 3. |
| `ALERTA_WEBHOOK_URL` | Destino opcional do alerta de prazos e da saúde de coleta. Use um destino privado do advogado. |

Não coloque credenciais em variáveis `NEXT_PUBLIC_*`, mensagens, arquivos versionados ou na resposta de assistentes. Mantenha as credenciais deste escritório isoladas. `docs/07_LUANA_ESCRITORIO.md` descreve uma integração externa futura e não acrescenta etapas obrigatórias a esta implantação.

## Aplicação no VPS

Implante o painel compilado como aplicação Next.js própria, com processo supervisionado ou
container e proxy HTTPS do servidor. Configure seu ambiente privado, banco e store Blob.
O uso de Vercel Blob não exige hospedar o painel na Vercel; ele exige o token do store
privado já usado pelo código. O componente MCP stdio pode ser compilado e usado em uma
sessão de terminal quando necessário, sem manter bot ou agente residente.

Configure explicitamente os agendamentos de coleta e alertas no VPS. `painel/vercel.json`
declara cron para a hospedagem Vercel; esse arquivo não instala um agendamento no VPS.
Se usar a rota de alerta existente, o agendador deverá fornecer `CRON_SECRET` e conferir
falha/resultado. Banco, store, proxy, supervisão e canais reais precisam ser validados
no ambiente de implantação. Nenhum desses serviços foi instalado nesta revisão.

As rotas HTTP de upload, documento e cron já existentes atendem funcionalidades do
painel; não constituem a futura API autenticada para agentes. Não expô-las como contrato
de automação sem uma etapa específica de API, autorização e auditoria.

## Conferência após a atualização

```bash
cd painel
node --test tests/seguranca.test.mjs
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Confira no ambiente de teste: login e logout, colaborador sem administração de acessos, criação/edição de cliente, revisão de prazo, upload com data antiga, download privado e cobrança de honorários. Requisições sem sessão às ações de negócio devem falhar. Um prazo cancelado não pode ser confirmado pela mesma ação. Uma peça pendente precisa ser redigida antes de ser confirmada.

O upload aceita até 200 MB. A extração automática no painel tem teto real de 25 MB para proteger a memória da função. Arquivos maiores continuam disponíveis para download e processamento no servidor/MCP. PDF digitalizado exige OCR, que ainda não está implementado.

Cada tentativa nova de envio recebe um UUID no pathname. Reanexar depois de excluir um documento ou repetir um envio cujo registro falhou não sobrescreve o binário anterior. A deduplicação continua pelo hash do conteúdo dentro do processo ou da peça. Blobs órfãos de tentativas interrompidas precisam de rotina de conciliação antes de qualquer limpeza do store.

## Reversão

Se precisar reverter, volte o código/deployment ao commit anterior e preserve o banco expandido. As migrações são aditivas e a versão anterior ignora as colunas/tabelas novas. Não elimine `cobrancas`, peças, anotações ou anexos para reverter a interface. Restaurar o backup é uma medida separada, pois apaga tudo que entrou depois dele.

A atualização não testa a infraestrutura real por conta própria. Confirme as variáveis, o cron, o destino de alertas, o Blob e o acesso do advogado no seu ambiente antes de disponibilizar o painel para a equipe.

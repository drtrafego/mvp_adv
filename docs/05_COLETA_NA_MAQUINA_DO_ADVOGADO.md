# Coleta na máquina do advogado (Brasil)

## Por que roda na máquina do advogado, e não num servidor externo

As intimações vêm do **DJEN (CNJ)**, que **bloqueia acesso de fora do Brasil** (retorna HTTP 403).
Como cada advogado cliente **está no Brasil**, a forma mais simples e barata é a coleta rodar
**na própria máquina dele** (ou num computador do escritório que fique ligado). Não é preciso VPS.

> As **movimentações** (DataJud) funcionam de qualquer lugar; só as **intimações** (DJEN) exigem
> estar no Brasil. O robô faz as duas numa passada.

O painel (site) e o banco continuam na nuvem (Vercel + Neon), acessíveis do celular de qualquer
lugar. O que roda na máquina do advogado é só o **robô de coleta**.

## Setup na máquina do advogado (uma vez)

Pré-requisitos: **Node 20+** e **pnpm** instalados.

1. Copiar a pasta `mcp-server/` para a máquina do advogado.
2. Criar o arquivo `mcp-server/.env` com:
   ```
   DATABASE_URL=postgresql://...        # a string do Neon (a mesma do painel)
   OAB_ADVOGADO=11158/MT;43972/SC       # as OABs do advogado, separadas por ";"
   ```
3. Instalar e compilar:
   ```
   cd mcp-server
   pnpm install
   pnpm build
   ```
4. Testar a coleta manual (puxa os últimos 30 dias):
   ```
   pnpm coleta 30
   ```
   Deve listar as movimentações e intimações gravadas. Elas aparecem no painel na hora.

## Atualização diária automática

Escolha conforme o sistema operacional da máquina do advogado. O comando é sempre
`pnpm coleta 3` (janela de 3 dias, com folga para não perder nada).

### Windows (Agendador de Tarefas)
1. Abra o **Agendador de Tarefas** → **Criar Tarefa Básica**.
2. Nome: "Coleta Gabinete". Disparo: **Diariamente**, ex.: 07:00.
3. Ação: **Iniciar um programa**.
   - Programa: `pnpm` (ou o caminho completo do pnpm)
   - Argumentos: `coleta 3`
   - Iniciar em: o caminho da pasta `mcp-server`.
4. Marque "Executar estando o usuário conectado ou não".

### Mac / Linux (cron)
```
crontab -e
# adicione a linha (troque o caminho):
0 7 * * *  cd /caminho/para/mcp-server && pnpm coleta 3 >> coleta.log 2>&1
```

## O que o robô faz a cada execução

1. **Movimentações**: consulta cada processo da carteira no DataJud e grava as novas.
2. **Intimações**: busca no DJEN pelas OABs do advogado, no período, e grava as novas.
3. **Auto-cadastro**: se uma intimação for de um processo que ainda não está na carteira, cadastra.
4. **Saúde da coleta**: registra na tabela `sincronizacoes` (o painel mostra verde/vermelho).

Tudo nasce como **sugestão** (a máquina propõe); o advogado confirma no painel (o humano dispõe).

## Os dois cenários

| Quem | Onde a coleta roda | Por quê |
|---|---|---|
| **Desenvolvedor** (você, na Argentina) | no seu **servidor/VPS no Brasil** (São Paulo) durante os testes | sua máquina na Argentina toma 403 do DJEN |
| **Cliente final** (advogado, no Brasil) | **local, na máquina do próprio advogado** | ele já está no Brasil; não precisa de servidor |

O setup é o mesmo nos dois casos (Node + pnpm + `.env` + `pnpm coleta`); muda só onde a máquina fica.

### Testando fora do Brasil (sem servidor)

Rodando direto de fora do Brasil, as intimações dão 403. Para o robô reportar isso sem travar
(em vez de tentar o fallback de navegador), defina `COMUNICA_SEM_BROWSER=1`. As movimentações
(DataJud) continuam funcionando normalmente de qualquer lugar.

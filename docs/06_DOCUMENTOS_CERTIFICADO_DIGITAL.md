# Documentos dos autos e o certificado digital (segredo de justiça)

Documento para análise. Explica por que baixar os documentos dos autos depende do certificado
digital do advogado, e como isso funcionaria. É a última fase do roadmap (Fase 9), porque depende
do certificado A1 do Daniel em mãos.

## O problema: os autos não são públicos

O que já coletamos hoje é **metadado e intimação**:
- **Movimentações** (DataJud): a lista do que aconteceu no processo. Pública.
- **Intimações** (DJEN): o teor da comunicação oficial. Pública por OAB.

Mas os **documentos que estão dentro dos autos** (petição inicial, contestação, decisões na
íntegra, provas, laudos, contratos anexados) **não são públicos**, principalmente quando o
processo corre em **segredo de justiça**. O sistema do tribunal (PJe / MNI) só libera esses
documentos para **quem é advogado habilitado naquele processo**.

## Por que o certificado digital

O **certificado digital ICP-Brasil** (A1 ou A3) é a **identidade digital** do advogado, o mesmo
que ele usa para assinar e protocolar peças. Ao acessar os autos, o tribunal exige essa
identidade para provar "sou eu, o advogado da parte" e só então libera os documentos protegidos.
Sem o certificado, não há como um sistema baixar os autos completos, é uma trava do próprio
Judiciário, não do Gabinete.

## Como funcionaria (dois caminhos)

| Caminho | Como funciona | Custo |
|---|---|---|
| **Certificado A1 + MNI** | O arquivo do certificado (`.pfx`/`.p12`, protegido por senha) fica **só na máquina do advogado**. O sistema o usa localmente para autenticar no MNI (Modelo Nacional de Interoperabilidade) do tribunal e baixar os autos. | Gratuito |
| **Intermediário pago** | Serviços como Escavador ou Judit já têm o acesso e expõem uma API; paga-se por consulta e recebe-se o PDF. | Pago por consulta |

## Segurança (regra dura)

- O certificado A1 (`.pfx`) **nunca sai da máquina do advogado**. A senha fica no cofre do sistema
  operacional (Credential Manager no Windows), nunca em texto no código nem em `.env` versionado.
- O certificado é usado **localmente** para autenticar, do Brasil, na máquina do advogado, exatamente
  como a coleta de intimações. Nada de certificado em servidor compartilhado.

## Onde isso mora no sistema

- **Backend**: a ferramenta `baixar_autos` (hoje só uma casca que explica isto) evoluiria para:
  arquivo local vira upload; senão Escavador com consentimento; senão MNI com o A1. Um módulo
  `cert.ts` carregaria o `.pfx` da máquina do advogado.
- **Banco**: os documentos baixados iriam para a tabela `documentos` (com `fonte = mni/escavador/upload`
  e `hash_sha256`).
- **Painel**: um botão "baixar dos autos" na aba Documentos do processo + registro de consentimento.

## Por que é a última fase

Todo o resto do sistema (coleta, prazos, análise, defesa, peças) pode ser construído e testado
**sem** o certificado. A camada de documentos protegidos depende de um recurso externo (o
certificado A1 do Daniel ou a contratação de um intermediário), por isso fica por último no
roadmap. Quando o certificado estiver disponível, esta é a peça a implementar.

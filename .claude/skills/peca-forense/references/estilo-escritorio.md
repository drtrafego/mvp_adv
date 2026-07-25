# Padrão formal do escritório

Advogado responsável: Daniel Francisco Felix, OAB/MT 11.158-B e OAB/SC 43.972.
Foro principal: Cuiabá, Mato Grosso. Tribunal de destino usual: TJMT.

## Endereçamento

Sempre em negrito, maiúsculas e centralizado no topo. Número do processo logo abaixo, também em
negrito.

Formas usadas pela banca:

```
EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [N]ª VARA [TIPO] DA COMARCA DE
CUIABÁ - MT

EXCELENTÍSSIMA SENHORA DOUTORA DESEMBARGADORA PRESIDENTE DO EGRÉGIO TRIBUNAL DE JUSTIÇA DO
ESTADO DE MATO GROSSO

AO JUÍZO DA [N]ª VARA CÍVEL DA COMARCA DE CUIABÁ-MT

AO JUÍZO DO 1º JUIZADO ESPECIAL CÍVEL DA COMARCA DE CUIABÁ/MT
```

Em agravo com pedido de efeito suspensivo, o cabeçalho recebe a tarja:
`URGENTE, PEDIDO DE EFEITO SUSPENSIVO ATIVO` ou `TUTELA ANTECIPADA RECURSAL`.

## Qualificação das partes

Nome da parte em NEGRITO E MAIÚSCULAS, seguido da qualificação completa: nacionalidade, estado
civil, profissão, CPF, RG e endereço completo.

Modelo: **ANA LÚCIA MACHADO PEREIRA REINERS**, brasileira, casada, empresária, inscrita no
CPF/MF sob o nº ___, portadora do RG nº ___, residente e domiciliada em ___.

Dado que não estiver nos autos entra como `[A PREENCHER]`, nunca preenchido por suposição.

## Títulos e subtítulos

Seções principais em negrito e maiúsculas, com numeral romano ou marcador:

```
PARTE I, DAS PRELIMINARES
I, DA INÉPCIA DA PETIÇÃO INICIAL
I, DO CABIMENTO E DA TEMPESTIVIDADE
II, DA DECISÃO AGRAVADA
- DA PRELIMINAR DE NULIDADE
- SÍNTESE DA DENÚNCIA
```

Subseções em negrito, numeradas: `II.1, Do enquadramento legal do valor da causa`;
`III.1, DA ATIPICIDADE DA CONDUTA`.

## Assinatura

```
Cuiabá-MT, [data]


DANIEL FRANCISCO FELIX
OAB/MT 11.158-B, OAB/SC 43.972
FONE: (65) 99629-1980, e-mail: dfelixdireito@gmail.com
```

## Citação de julgado

Ementa em itálico, com os termos centrais em negrito.

STJ e STF: `(STJ, HC ___/__, Rel. Ministro ___, ___ Turma, julgado em __/__/____, DJe
__/__/____)`.

TJMT: `(N.U ______, CÂMARAS ISOLADAS ___, Rel. ___, ___ Câmara ___, julgado em __/__/____)`.

Julgado sem confirmação não entra: descreva a tese e marque `[verificar julgado específico]`.

## Formatação do arquivo exportado

O painel exporta a peça já no padrão forense, e a rota de exportação é a fonte dessa formatação
(`painel/src/app/(app)/pe/[id]/docx/route.ts`): papel A4, margens de 3 cm à esquerda e 2 cm nas
demais, fonte 12, entrelinha 1,5, corpo justificado com recuo de 1,25 cm na primeira linha,
títulos centralizados em negrito e número de página no rodapé.

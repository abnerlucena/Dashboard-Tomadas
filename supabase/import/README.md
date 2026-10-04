# Importação do histórico da planilha

Traz para o banco os nove meses de produção que estão na planilha
`ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx` (20/12/2025 a 21/09/2026).

Decisões: **D35** e seus complementos D35.1 (devolutivas do gestor), D35.2 e
D35.3 (cruzamento coluna a coluna), em [`../../docs/database/03-decisoes.md`](../../docs/database/03-decisoes.md).

## Os quatro passos

| Passo | O quê | Onde |
|---|---|---|
| 1 | Área de preparo no banco | migration `20260925130000_area_de_preparo_importacao.sql` |
| 2 | Extrair a planilha para a área de preparo | `extrair.cjs` + `mapa.cjs` |
| 3 | Carregar da preparo para a produção | a fazer |
| 4 | Conferência mês a mês | a fazer |

## Por que nada vai direto para a produção

A área de preparo existe para o gestor poder **conferir antes** de qualquer
número virar oficial. Cada linha guarda de qual célula da planilha veio, com o
conteúdo original ao lado da interpretação — então uma divergência sempre pode
ser rastreada até a origem, e a conferência pode discordar.

Além disso: um lote inteiro pode ser desfeito sem tocar no que a equipe
apontou à mão, e rodar a extração de novo não duplica nada.

## Os dois arquivos

**`mapa.cjs`** é onde estão as decisões, em forma de dado: qual coluna da
planilha vira qual centro de trabalho, a data de entrada em operação de cada
um, como ler os rótulos de turno, e o que fazer com as células que têm texto
no lugar de número. Quem quiser conferir uma decisão lê esse arquivo, sem
precisar entender código.

**`extrair.cjs`** é só a mecânica: lê a planilha e aplica o mapa. Ele **não se
conecta ao banco** — o repositório é público e não guarda credencial nenhuma.
A saída é um arquivo `.sql` que alguém roda onde quiser.

## Como rodar

```bash
npm install --no-save exceljs
node supabase/import/extrair.cjs "caminho/para/ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx"
```

Gera `supabase/import/preparo.sql` (não versionado — é derivado da planilha) e
imprime um resumo. Depois, rode esse SQL no banco; ele vem dentro de uma
transação, então dá para conferir e desistir com `rollback`.

O id do lote é derivado do nome, do tamanho do arquivo e da janela (abaixo):
rodar de novo com os mesmos argumentos produz o mesmo id, e carregar duas vezes
é impossível — a chave `(lote, aba, célula)` recusa a segunda.

### Carga incremental: `--desde` e `--ate`

Para acrescentar ao banco só o que a planilha ganhou desde a última carga:

```bash
node supabase/import/extrair.cjs planilha.xlsx saida.sql --desde=2026-09-22
```

E para parar na data do congelamento, de modo que linha digitada depois do
corte não entre sem ninguém ter visto:

```bash
node supabase/import/extrair.cjs planilha.xlsx saida.sql --desde=2026-09-22 --ate=2026-10-09
```

Duas coisas importantes sobre a janela:

1. **O corte vale para o que é EMITIDO, não para o que é lido.** A planilha
   arrasta a última meta conhecida para a frente (item 9 da D35), então as metas
   continuam sendo lidas da planilha inteira. Cortar a leitura cedo faria os
   dias novos nascerem sem meta.
2. **Descubra antes qual é o último dia já no banco**, e comece no dia seguinte:

```sql
select max(production_date) from public.production_records;
```

   Começar no mesmo dia reemitiria os apontamentos daquele dia, e a carga
   abortaria na restrição `unique (machine_id, production_date, shift_id,
   work_mode)`. Nada se perde — a transação inteira é desfeita —, mas também
   nada entra.

### `--turno`: completar um dia que entrou pela metade

Quando a exportação anterior foi tirada no meio do expediente, o último dia do
banco tem só o primeiro turno. Um dia pela metade é um dia errado em todo
relatório, e `--desde` não resolve porque corta por dia.

```bash
node supabase/import/extrair.cjs planilha.xlsx saida.sql --desde=2026-09-21 --ate=2026-09-21 --turno=2
```

Antes de usar, confira quais turnos já estão lá:

```sql
select shift_id, count(*) from public.production_records
 where production_date = '2026-09-21' group by 1;
```

### Linhas com a data errada na planilha

A data de uma linha vem da coluna A, e quando falta o extrator repete a de cima
(abril escreve a data só na linha do T1, de propósito). Isso faz com que uma
linha órfã herde a data errada e leve a produção para outro mês.

A correção vai na lista `DATAS` de `mapa.cjs`, **por linha**, depois de alguém
conferir contra a planilha aberta:

```js
const DATAS = [
  { aba: 'SET 26', linha: 53, data: '2026-09-30' },
];
```

O extrator avisa quantas linhas corrigiu em cada rodada.

## O que a extração produziu (planilha de 21/09/2026)

| | |
|---|---|
| Linhas na área de preparo | 6.859 |
| Apontamentos | 2.506 — **17.618.667 peças** |
| Retrabalhos | 2 |
| Paradas de máquina | 4 |
| Observações sem quantidade | 1 |
| Descartados, com motivo | 4.346 |
| Colunas sem destino | **0** |

Os 4.346 descartes são todos zeros, e o motivo fica registrado em cada um:
zero **anterior** à entrada em operação significa que a máquina não estava em
Itajaí; zero **posterior** significa turno sem produção, sem motivo informado
pela planilha.

**Por que os zeros posteriores não viram parada de máquina** (como a D36
propõe): uma célula zerada não informa motivo nenhum, e criar centenas de
paradas "sem motivo" encheria o sistema de registros que não explicam nada.
Como as linhas ficam na área de preparo com o motivo do descarte, o dado não
se perde — se a D36 for implementada, é só reprocessar a mesma área de preparo.

## Um caso que parece erro e não é

Em 02/09 a Embaladora Horizontal N°1 tem duas linhas para o mesmo dia e turno:
a produção normal (célula `E8`) e um retrabalho (`AB8`, 4.800 peças). Não é
duplicata — é **um apontamento com duas ordens**, uma normal e uma marcada
como retrabalho, que é exatamente como o banco modela isso.

## Depois de carregar: a linha do tempo de metas

Cada apontamento importado guarda a meta da planilha no seu dia. Depois de cada
carga de histórico, rode:

```sql
select public.reconstruir_metas_historicas();
```

Ela refaz a linha do tempo de metas anterior a 25/09/2026 a partir dessas metas
(D60). É repetível.

## Meta do retrabalho em texto

Retrabalho escrito em texto, revisado caso a caso em `mapa.cjs`, recebe a meta
do centro naquele dia, pela mesma regra da produção. Até 03/10/2026 ele recebia
a meta do dia da importação, e dois turnos ficaram medidos contra a meta errada
(corrigidos pela migration 0032).

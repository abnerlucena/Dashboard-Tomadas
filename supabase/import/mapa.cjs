// ═══════════════════════════════════════════════════════════════════════════
// Mapa da importação — as decisões do gestor em forma de dado
//
// Este arquivo é a tradução do relatório de pré-importação revisado em
// 25/09/2026. Separado do script de propósito: quem quiser conferir uma
// decisão lê aqui, sem precisar entender código.
//
// Decisões: D35 (itens 8 a 12), D35.1 (devolutivas), D35.3 (cruzamento), D43.
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. Cada coluna da planilha vira qual centro de trabalho ────────────────
// A data é a entrada em operação confirmada pelo gestor: zeros ANTES dela
// significam "a máquina ainda não estava em Itajaí" e são descartados.
//
// Duas colunas caem no mesmo centro em dois casos (D43 e a resposta de 25/09
// sobre a Rebitagem Pinos). Conferido que não há colisão de data e turno.
const CENTROS = {
  'VERTICAL PLACAS / SUP. 2':          { centro: 'EMBALADORA 4X2 SUPORTES/PLACAS N°2',     desde: '2025-12-20' },
  'A GRANEL':                          { centro: 'BANCADA EMBALAGEM A GRANÉL',             desde: '2025-12-20' },
  'MANUAL INTERRUPTOR':                { centro: 'BANCADA N°2 - MONTAGEM INTERRUPTORES',   desde: '2025-12-20' },
  'MONTAGEM DIVERSOS':                 { centro: 'BANCADA N°4 - DIVERSOS',                 desde: '2025-12-20' },
  'KIT 2 PARAFUSO':                    { centro: 'EMBALADORA KIT PARAFUSOS N°2',           desde: '2025-12-22' },
  'TESTE INTERRUPTORES':               { centro: 'BANCADA N°1 - TESTE INTERRUPTORES',      desde: '2026-01-05' },
  'MONTAGEM PLACA REFINATTO':          { centro: 'PRENSA PLACA REFINATTO',                 desde: '2026-01-05' },
  'HORIZONTAL 1':                      { centro: 'EMBALADORA HORIZONTAL N°1',              desde: '2026-02-03' },
  'KIT 1 PARAFUSO':                    { centro: 'EMBALADORA KIT PARAFUSOS N°1',           desde: '2026-04-22' },
  'VERTICAL PLACAS / SUP. 1':          { centro: 'EMBALADORA 4X2 SUPORTES/PLACAS N°1',     desde: '2026-04-30' },
  'VERTICAL MÓDULOS 2':                { centro: 'EMBALADORA VERTICAL MÓDULOS N°2',        desde: '2026-05-21' },
  'VERTICAL MÓDULOS 1':                { centro: 'EMBALADORA VERTICAL MÓDULOS N°1',        desde: '2026-05-29' },
  '2 CONJUNTOS':                       { centro: 'EMBALADORA VERTICAL CONJUNTOS N°2',      desde: '2026-07-02' },
  'MÁQUINA DE PLUG AUTOMÁTICA':        { centro: 'MÁQUINA DE PLUGUE',                      desde: '2026-07-09' },
  'PRENSA TOX':                        { centro: 'PRENSA TOX',                             desde: '2026-07-20' },
  'MÁQUINA INTERRUPTOR':               { centro: 'MÁQUINA DE INTERRUPTORES COMPOSÉ N°1',   desde: '2026-07-21' },
  'INSERÇÃO DOS CONTATOS INTERRUPTOR': { centro: 'PRENSA INSERÇÃO CONTATOS INTERRUPTORES', desde: '2026-07-27' },
  '1 CONJUNTOS':                       { centro: 'EMBALADORA VERTICAL CONJUNTOS N°1',      desde: '2026-07-29' },
  'HORIZONTAL 2':                      { centro: 'EMBALADORA HORIZONTAL N°2',              desde: '2026-08-03' },
  'MÁQUINA DE TOMADAS AUTOMÁTICA':     { centro: 'MÁQUINA DE TOMADAS',                     desde: '2026-08-20' },
  // D43 e resposta de 25/09/2026: duas colunas caem no mesmo centro.
  'REBITAGEM PINOS':                   { centro: 'PRENSA TOX',                             desde: '2026-08-24' },
  'FECHAMENTO TECLA INTERRUPTORES':    { centro: 'BANCADA N°3 - DIVERSOS',                 desde: '2026-08-27' },
  // Nunca produziu em nove meses de planilha. Fica aqui para o extrator
  // registrar o descarte com motivo, em vez de simplesmente ignorar a coluna.
  'MONTAGEM TOMADAS MANUAL':           { centro: 'BANCADA N°3 - DIVERSOS',                 desde: null },
};

// ─── 2. Turno e tipo de trabalho, a partir do rótulo da linha ───────────────
// A planilha usa quatro rótulos além de T1/T2. Os nove casos foram revisados
// um a um pelo gestor (D35.1) e a regra que saiu é simples: só "EXTRA 2°T"
// aconteceu no segundo turno; todo o resto foi no primeiro.
//
// Não existe T3 em nenhuma linha da planilha — o terceiro turno ainda é só
// hora extra de madrugada.
const TURNOS = {
  'T1':          { turno: 1, modo: 'regular'  },
  'T2':          { turno: 2, modo: 'regular'  },
  'EXTRA 1°T':   { turno: 1, modo: 'overtime' },
  'EXTRA 2°T':   { turno: 2, modo: 'overtime' },
  'HORA EXTRA':  { turno: 1, modo: 'overtime' },
  'H. EXTRA':    { turno: 1, modo: 'overtime' },
  // Setembro/26 passou a escrever o turno depois de "HORA EXTRA". Mesmo
  // significado dos rotulos acima, que o gestor ja revisou.
  'HORA EXTRA 1°': { turno: 1, modo: 'overtime' },
  'HORA EXTRA 2°': { turno: 2, modo: 'overtime' },
};

// ─── 2.1 Linhas com a data errada na planilha ──────────────────────────────
// A data de uma linha vem da coluna A, e quando ela falta o extrator repete a
// de cima (abril escreve a data só na linha do T1, de propósito). No pé da aba
// SET 26 isso encontrou duas linhas que ninguém corrigiu:
//
//   L53 — data VAZIA. Acima dela só havia linhas vazias de 25/08, então as
//         96.104 peças do bloco principal iriam parar em agosto.
//   L54 — data 29/09, mas o 29/09 T2 ja esta na L48. Seria o turno em dobro.
//
// O gestor conferiu contra a planilha aberta: as duas sao 30/09, T1 e T2. A
// conferencia foi numero a numero (L53 fecha em 96.104 e L54 em 45.442, os
// mesmos totais que a planilha mostra para o dia 30).
//
// Correcao por LINHA, nao por celula: o que esta errado e a data da linha
// inteira, e o resto dela esta certo.
const DATAS = [
  { aba: 'SET 26', linha: 53, data: '2026-09-30' },
  { aba: 'SET 26', linha: 54, data: '2026-09-30' },
];

// A aba "10 de Jan 26" é um sábado lançado à parte, com o rótulo "T1". O
// gestor confirmou que foi hora extra, no primeiro turno.
const ABAS_HORA_EXTRA = { '10 de Jan 26': { turno: 1, modo: 'overtime' } };

// ─── 3. Células que não são número ──────────────────────────────────────────
// Onde a planilha escreveu texto no lugar da quantidade. Cada uma foi
// revisada pelo gestor; o que não estiver nesta lista vira descarte com o
// texto guardado, para ninguém perder informação por engano.
const CASOS = [
  // O motivo é o CÓDIGO que a tabela de paradas aceita (nomes em inglês no
  // banco, D03). O texto original da planilha fica em raw_value, que é o que
  // aparece na conferência.
  { aba: 'MAR 26', celula: 'I10', vira: 'downtime', motivo: 'preventive_maintenance' },
  { aba: 'MAR 26', celula: 'F14', vira: 'downtime', motivo: 'maintenance' },
  { aba: 'MAR 26', celula: 'F16', vira: 'downtime', motivo: 'preventive_maintenance' },
  { aba: 'MAR 26', celula: 'F24', vira: 'downtime', motivo: 'maintenance' },

  // Número cortado na planilha ("10."). O gestor confirmou 10.000 peças.
  { aba: 'AGO 26', celula: 'X38', vira: 'production', quantidade: 10000,
    nota: 'quantidade confirmada pelo gestor em 25/09/2026 (a planilha trazia "10." cortado)' },
];

// ─── 4. A coluna RETRABALHO GERAL ───────────────────────────────────────────
// Três células preenchidas em nove meses, cada uma revisada. O texto diz a
// qual centro pertence, e por isso não dá para tratar por regra — é caso a
// caso mesmo.
const RETRABALHO = [
  { aba: 'ABR 26', celula: 'AN42', centro: 'PRENSA PLACA REFINATTO',
    vira: 'rework', quantidade: 4510, nota: 'planilha: "Retrabalho Refinatto 4.510"' },
  { aba: 'SET 26', celula: 'AB8', centro: 'EMBALADORA HORIZONTAL N°1',
    vira: 'rework', quantidade: 4800, nota: 'planilha: "H 01 - 4800"' },
  { aba: 'SET 26', celula: 'AB30', centro: 'EMBALADORA VERTICAL MÓDULOS N°2',
    vira: 'note', nota: 'Colagem de etiqueta de correção nas embalagens da modulo 02' },
];

// ─── 5. O que fazer com um zero ─────────────────────────────────────────────
// Todo zero é DESCARTADO, com o motivo registrado. Os dois motivos são
// diferentes e importam:
//
//   • antes da entrada em operação → a máquina não estava em Itajaí;
//   • depois → o turno não produziu, e a planilha não diz por quê.
//
// Por que descartar os dois, e não transformar os de depois em parada de
// máquina (como a D36 propõe): uma célula zerada não informa motivo nenhum.
// Criar centenas de paradas "sem motivo" encheria o sistema de registros que
// não explicam nada. As linhas ficam na área de preparo com o motivo do
// descarte, então o dado não se perde: se um dia a D36 for implementada, é
// só reprocessar a mesma área de preparo.
const ZERO = {
  antes:  'zero anterior à entrada em operação — a máquina ainda não estava em Itajaí',
  depois: 'turno sem produção — a planilha não informa o motivo',
};

module.exports = { DATAS, CENTROS, TURNOS, ABAS_HORA_EXTRA, CASOS, RETRABALHO, ZERO };

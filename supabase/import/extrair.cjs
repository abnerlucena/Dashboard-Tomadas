// ═══════════════════════════════════════════════════════════════════════════
// Extrator do histórico da planilha → área de preparo
//
//   node supabase/import/extrair.cjs <planilha.xlsx> [saida.sql]
//        [--desde=AAAA-MM-DD] [--ate=AAAA-MM-DD] [--turno=1|2|3]
//
// PASSO 2 de 4 da importação (D35). Lê a planilha e escreve um arquivo SQL
// que enche a área de preparo. NÃO se conecta ao banco: o repositório é
// público e não guarda credencial nenhuma. Quem roda o SQL decide onde.
//
// É reproduzível: rodar de novo na mesma planilha dá exatamente o mesmo
// arquivo, com o mesmo id de lote. Carregar duas vezes é impossível — o id do
// lote é fixo e a chave (lote, aba, célula) recusa a segunda.
//
// JANELA (--desde / --ate): emite só os apontamentos dentro dela. O --desde
// serve para acrescentar o que a planilha ganhou desde a última carga; o --ate
// serve para parar na data do congelamento, para que linha digitada depois do
// corte não entre sem ninguém ter visto.
//
// CARGA INCREMENTAL (--desde): emite só os apontamentos a partir daquela data,
// para acrescentar ao banco o que a planilha ganhou desde a última carga. As
// metas continuam sendo lidas da planilha INTEIRA — a planilha arrasta a última
// meta conhecida para a frente, e cortar a leitura cedo faria os dias novos
// nascerem sem meta. O corte vale para o que é EMITIDO, não para o que é lido.
//
// O que ele NÃO faz: não decide nada. Toda decisão está em mapa.cjs, que é a
// tradução do relatório revisado pelo gestor.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATAS, CENTROS, TURNOS, ABAS_HORA_EXTRA, CASOS, RETRABALHO, ZERO } = require('./mapa.cjs');

let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  console.error('Falta a biblioteca exceljs. Rode:  npm install --no-save exceljs');
  process.exit(2);
}

const args = process.argv.slice(2);
const flagDesde = args.find((a) => a.startsWith('--desde='));
const flagAte = args.find((a) => a.startsWith('--ate='));
const flagTurno = args.find((a) => a.startsWith('--turno='));
const posicionais = args.filter((a) => !a.startsWith('--'));
const arquivo = posicionais[0];
const saida = posicionais[1] || path.join(__dirname, 'preparo.sql');
const desde = flagDesde ? flagDesde.slice('--desde='.length) : null;
const ate = flagAte ? flagAte.slice('--ate='.length) : null;
const turno = flagTurno ? Number(flagTurno.slice('--turno='.length)) : null;
if (!arquivo) {
  console.error('Uso: node supabase/import/extrair.cjs <planilha.xlsx> [saida.sql] [--desde=AAAA-MM-DD] [--ate=AAAA-MM-DD]');
  process.exit(2);
}
for (const [nome, valor] of [['--desde', desde], ['--ate', ate]]) {
  if (valor !== null && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor)) {
    console.error(`${nome} precisa ser uma data AAAA-MM-DD (recebi "${valor}").`);
    process.exit(2);
  }
}
if (turno !== null && ![1, 2, 3].includes(turno)) {
  console.error(`--turno precisa ser 1, 2 ou 3 (recebi "${turno}").`);
  process.exit(2);
}
if (desde && ate && ate < desde) {
  console.error(`--ate (${ate}) e anterior a --desde (${desde}): a janela esta vazia.`);
  process.exit(2);
}

// ─── Leitura crua de uma célula ─────────────────────────────────────────────
// Devolve o valor guardado. "undefined" significa fórmula sem resultado salvo
// — a planilha precisaria ser aberta no Excel para calcular, e o extrator não
// inventa número: ele avisa.
const cru = (c) => {
  const x = c.value;
  if (x == null) return null;
  if (typeof x === 'object' && !(x instanceof Date)) {
    if ('result' in x) return x.result ?? null;
    if (x.richText) return x.richText.map((t) => t.text).join('');
    if ('formula' in x || 'sharedFormula' in x) return undefined;
    if (x.error) return '#' + x.error;
    return null;
  }
  return x;
};
const texto = (c) => {
  const v = cru(c);
  return v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// Os cabeçalhos da planilha não batem com os nomes usados no mapa; esta
// tabela faz a ponte. Cada linha veio de conferir a coluna na planilha.
const CABECALHOS = [
  [/^1 HORIZONTAL$/, 'HORIZONTAL 1'],
  [/^2 HORIZONTAL$/, 'HORIZONTAL 2'],
  [/^1 VERTICAL PLACAS ?\/ ?SUP\.?$/, 'VERTICAL PLACAS / SUP. 1'],
  [/^2 VERTICAL PLACAS ?\/ ?SUP\.?$/, 'VERTICAL PLACAS / SUP. 2'],
  [/^1 VERTICAL MODULOS$/, 'VERTICAL MÓDULOS 1'],
  [/^2 VERTICAL MODULOS$/, 'VERTICAL MÓDULOS 2'],
  [/^A GRANEL$/, 'A GRANEL'],
  [/^(MAQUINA DE INTERRUPTOR|INTERRUPTOR MAQUINA)$/, 'MÁQUINA INTERRUPTOR'],
  [/^TESTE INTERRUPTORES$/, 'TESTE INTERRUPTORES'],
  [/^INTERRUPTOR MANUAL( NOVO)?$/, 'MANUAL INTERRUPTOR'],
  [/^MONTAGEM DIVERSOS$/, 'MONTAGEM DIVERSOS'],
  [/^MONTAGEM PLACA REFINATTO$/, 'MONTAGEM PLACA REFINATTO'],
  [/^KIT 1 PARAFUSO$/, 'KIT 1 PARAFUSO'],
  [/^KIT 2 PARAFUSO$/, 'KIT 2 PARAFUSO'],
  [/^MONTAGEM TOMADAS MANUAL$/, 'MONTAGEM TOMADAS MANUAL'],
  [/^MAQUINA DE TOMADAS AUTOMATICA$/, 'MÁQUINA DE TOMADAS AUTOMÁTICA'],
  [/^INSERCAO DOS CONTATOS INTERRUPTOR$/, 'INSERÇÃO DOS CONTATOS INTERRUPTOR'],
  [/^FECHAMENTO TECLA INTERRUPTORES$/, 'FECHAMENTO TECLA INTERRUPTORES'],
  [/^2 CONJUNTOS$/, '2 CONJUNTOS'],
  [/^1 CONJUNTOS$/, '1 CONJUNTOS'],
  [/^REBITAGEM PINOS$/, 'REBITAGEM PINOS'],
  [/^MAQUINA DE PLUG AUTOMATICA$/, 'MÁQUINA DE PLUG AUTOMÁTICA'],
  [/^PRENSA TOX$/, 'PRENSA TOX'],
  [/^RETRABALHO GERAL$/, 'RETRABALHO GERAL'],
];
const nomeDaColuna = (h) => {
  const n = norm(h);
  for (const [re, nome] of CABECALHOS) if (re.test(n)) return nome;
  return null;
};

const casoDe = (aba, celula) => CASOS.find((c) => c.aba === aba && c.celula === celula);
const retrabalhoDe = (aba, celula) => RETRABALHO.find((c) => c.aba === aba && c.celula === celula);

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);

  const linhas = [];
  const avisos = [];
  // Última meta conhecida de cada coluna, arrastada para a frente: é o que a
  // D35 item 9 manda fazer com agosto e setembro, que não têm coluna de meta.
  const ultimaMeta = {};
  const metaDaLinha = {};
  const naoReconhecidos = new Set();
  let semResultado = 0;
  let anteriores = 0;
  let posteriores = 0;
  let corrigidas = 0;
  let outroTurno = 0;

  for (const ws of wb.worksheets) {
    const aba = ws.name.trim();
    if (/grafico/i.test(aba)) continue;

    // Cabeçalhos das máquinas ficam na linha 5, a partir da coluna C.
    // A planilha usa DOIS padrões para a coluna "<== META", e confundi-los faz
    // a meta de uma máquina cair em outra:
    //
    //   EMBALAGENS — a linha 4 nomeia um grupo e a meta vale para o grupo
    //     inteiro:  C "2 CONJUNTOS" | D "1 CONJUNTOS" | E "<== META"
    //               todas com linha 4 = "CONJUNTOS"
    //
    //   MONTAGENS — cada máquina tem a SUA meta logo ao lado, e a linha 4 da
    //     coluna de meta é o próprio "<== META":
    //               T "INTERRUPTOR MÁQUINA" | U "<== META"
    //
    // Regra: se a linha 4 da coluna de meta nomeia um grupo, ela vale para
    // todas as máquinas daquele grupo; se não nomeia, vale só para a máquina
    // imediatamente à esquerda.
    const colunas = [];
    for (let c = 3; c <= ws.columnCount; c++) {
      const h = texto(ws.getRow(5).getCell(c)).replace(/\s+/g, ' ').trim();
      if (!h) continue;
      const n = norm(h);
      const g4 = norm(texto(ws.getRow(4).getCell(c)));
      if (n.includes('META')) {
        const proprio = !g4 || g4.includes('META');
        const grupo = proprio
          ? colunas.filter((x) => x.nome).slice(-1).map((x) => x.nome)
          : colunas.filter((x) => x.nome && x.g4 === g4).map((x) => x.nome);
        colunas.push({ c, letra: ws.getColumn(c).letter, meta: true, grupo });
        continue;
      }
      if (['TOTAL', 'TURNO', 'STATUS', 'FALTA DE MATERIAL', 'FALTAS DE OPERADORES'].includes(n)
          || n.startsWith('EMBALADOS')) continue;
      const nome = nomeDaColuna(h);
      if (!nome) { naoReconhecidos.add(`${aba}!${ws.getColumn(c).letter}: ${h}`); continue; }
      colunas.push({ c, letra: ws.getColumn(c).letter, nome, g4 });
    }

    // A data pode estar só na linha do T1 (abril faz isso); repete para baixo.
    let ultimaData = null;
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      if (r < 6) return;
      const dv = cru(row.getCell(1));
      let data = dv instanceof Date ? dv.toISOString().slice(0, 10) : null;
      // Espacos internos normalizados, nao so as pontas: a planilha de
      // setembro trouxe "HORA EXTRA  1" com espaco duplo, e um .trim() so
      // nao alcanca isso. Um sabado inteiro de hora extra se perdia por um
      // espaco a mais.
      const rotulo = texto(row.getCell(2)).split(' ').filter(Boolean).join(' ').trim().toUpperCase();
      // Linha com data errada na planilha, conferida pelo gestor (mapa.cjs).
      // Vem antes do arrasto: a linha corrigida tambem vira a referencia das
      // linhas de baixo que nao trazem data propria.
      const correcao = DATAS.find((d) => d.aba === aba && d.linha === r);
      if (correcao) { data = correcao.data; corrigidas++; }
      if (!data && rotulo && ultimaData && !/^(META|M[EÉ]DIA|TOTAL)/i.test(rotulo)) data = ultimaData;
      if (data) ultimaData = data;
      if (!data) return;

      const metaAqui = {};
      const t = ABAS_HORA_EXTRA[aba] || TURNOS[rotulo];
      if (!t) {
        // Linha sem rótulo de turno E sem número nenhum é sobra da planilha
        // (um dia em que o T2 ficou em branco, por exemplo). Só avisa quando
        // há dado de verdade, senão o relatório vira ruído.
        const temDado = colunas.some((col) => {
          const v = cru(row.getCell(col.c));
          return v !== null && v !== undefined && String(v).trim() !== '';
        });
        if (temDado) avisos.push(`${aba} linha ${r}: tem dado mas o rótulo de turno não foi reconhecido ("${rotulo}")`);
        return;
      }

      // Meta escrita nesta linha, por máquina do grupo.
      for (const col of colunas.filter((x) => x.meta)) {
        const v = cru(row.getCell(col.c));
        if (typeof v === 'number' && v > 0) for (const nome of col.grupo) ultimaMeta[nome] = v;
        metaDaLinha[aba] = true;
        if (typeof v === 'number' && v > 0) for (const nome of col.grupo) metaAqui[nome] = v;
      }

      // CORTE DA CARGA INCREMENTAL. As metas acima ja foram lidas: o arrasto
      // da ultima meta conhecida continua enxergando a planilha inteira. Daqui
      // para baixo e emissao, e e so dela que o corte trata.
      if (desde && data < desde) { anteriores++; return; }
      if (ate && data > ate) { posteriores++; return; }
      if (turno !== null && t.turno !== turno) { outroTurno++; return; }
      for (const col of colunas) {
        if (col.meta) continue;
        const celula = `${col.letra}${r}`;
        const v = cru(row.getCell(col.c));
        if (v === undefined) { semResultado++; continue; }

        const base = { aba, celula, coluna: col.nome, cru: v === null ? '' : String(v) };

        // Retrabalho e observações: caso a caso, revisados pelo gestor.
        const rt = retrabalhoDe(aba, celula);
        if (rt) {
          // A meta do retrabalho é a do CENTRO naquele dia, pela mesma regra da
          // produção: a escrita na linha, senão a última conhecida. Antes ia
          // "meta_de_hoje", e o apontamento montado com ela ficava medido
          // contra a meta do dia da importação — Horizontal N°1 em 02/09 com
          // 10.000 em vez de 8.000, Refinatto em 27/04 com 0 em vez de 1.000
          // (D60). A coluna do retrabalho é RETRABALHO GERAL, então a meta é
          // procurada pelas colunas que levam a este centro.
          const colunasDoCentro = Object.keys(CENTROS).filter((k) => CENTROS[k].centro === rt.centro);
          const daLinha = colunasDoCentro.map((k) => metaAqui[k]).find((x) => x !== undefined);
          const arrastada = colunasDoCentro.map((k) => ultimaMeta[k]).find((x) => x !== undefined);
          const mc = rt.vira === 'note' ? { meta: null, origem: 'sem_meta' }
            : daLinha !== undefined ? { meta: daLinha, origem: 'planilha' }
            : arrastada !== undefined ? { meta: arrastada, origem: 'planilha_arrastada' }
            : { meta: null, origem: 'meta_de_hoje' };
          linhas.push({ ...base, kind: rt.vira, centro: rt.centro, data, turno: t.turno,
            modo: rt.vira === 'note' ? null : t.modo, qtd: rt.quantidade ?? null, nota: rt.nota,
            meta: mc.meta, metaOrigem: mc.origem });
          continue;
        }
        if (col.nome === 'RETRABALHO GERAL') {
          if (v !== null && String(v).trim() !== '' && v !== 0) {
            avisos.push(`${aba}!${celula}: retrabalho não previsto no mapa — "${String(v).slice(0, 40)}"`);
          }
          continue;
        }

        const destino = CENTROS[col.nome];
        if (!destino) { naoReconhecidos.add(`${aba}!${celula}: ${col.nome} sem destino no mapa`); continue; }

        // Texto no lugar de número: os revisados viram parada; o resto é
        // descartado COM o texto guardado, para ninguém perder informação.
        const caso = casoDe(aba, celula);
        if (caso) {
          if (caso.vira === 'downtime') {
            linhas.push({ ...base, kind: 'downtime', centro: destino.centro, data, turno: t.turno,
              modo: null, qtd: null, nota: caso.motivo });
          } else {
            const mc = metaAqui[col.nome] !== undefined
              ? { meta: metaAqui[col.nome], origem: 'planilha' }
              : ultimaMeta[col.nome] !== undefined
                ? { meta: ultimaMeta[col.nome], origem: 'planilha_arrastada' }
                : { meta: null, origem: 'meta_de_hoje' };
            linhas.push({ ...base, kind: 'production', centro: destino.centro, data, turno: t.turno,
              modo: t.modo, qtd: caso.quantidade, nota: caso.nota, meta: mc.meta, metaOrigem: mc.origem });
          }
          continue;
        }

        if (v === null || String(v).trim() === '') continue;   // célula vazia não é dado

        if (typeof v !== 'number') {
          linhas.push({ ...base, kind: 'discard', centro: destino.centro, data, turno: t.turno,
            descarte: `texto no lugar da quantidade, não revisado: "${String(v).slice(0, 60)}"` });
          continue;
        }

        if (v > 0) {
          const m = metaAqui[col.nome] !== undefined
            ? { meta: metaAqui[col.nome], origem: 'planilha' }
            : ultimaMeta[col.nome] !== undefined
              ? { meta: ultimaMeta[col.nome], origem: 'planilha_arrastada' }
              : { meta: null, origem: 'meta_de_hoje' };   // resolvido na carga
          linhas.push({ ...base, kind: 'production', centro: destino.centro, data, turno: t.turno,
            modo: t.modo, qtd: v, nota: null, meta: m.meta, metaOrigem: m.origem });
        } else {
          const antes = !destino.desde || data < destino.desde;
          linhas.push({ ...base, kind: 'discard', centro: destino.centro, data, turno: t.turno,
            descarte: antes ? ZERO.antes : ZERO.depois });
        }
      }
    });
  }

  // ─── Meta retroativa: a primeira conhecida, puxada para trás ──────────────
  // Sete centros têm meta na planilha, mas os primeiros registros deles são
  // anteriores ao mês em que a coluna de meta começa. Sem isto, esses
  // registros cairiam na meta de HOJE — a Bancada A Granél seria medida em
  // dezembro por 25.000 quando a própria planilha diz que a meta era 15.000.
  //
  // Só vale para quem TEM meta na planilha em algum momento. Quem nunca teve
  // continua com a meta de hoje: não há nada para puxar.
  const primeira = {};
  for (const l of linhas) {
    if (l.metaOrigem !== 'planilha' || l.meta == null) continue;
    if (!primeira[l.coluna] || l.data < primeira[l.coluna].data) {
      primeira[l.coluna] = { data: l.data, meta: l.meta };
    }
  }
  let retro = 0;
  for (const l of linhas) {
    if (l.metaOrigem !== 'meta_de_hoje') continue;
    const p = primeira[l.coluna];
    if (!p || l.data >= p.data) continue;
    l.meta = p.meta;
    l.metaOrigem = 'planilha_retroativa';
    retro++;
  }

  // ─── Id do lote: derivado do arquivo, para ser sempre o mesmo ─────────────
  const digest = crypto.createHash('sha256')
    .update(path.basename(arquivo) + '|' + fs.statSync(arquivo).size
            + (desde ? '|desde=' + desde : '') + (ate ? '|ate=' + ate : '')
            + (turno !== null ? '|turno=' + turno : ''))
    .digest('hex');
  const lote = [digest.slice(0, 8), digest.slice(8, 12), '4' + digest.slice(13, 16),
    '8' + digest.slice(17, 20), digest.slice(20, 32)].join('-');

  // ─── Escreve o SQL ────────────────────────────────────────────────────────
  const datas = linhas.map((l) => l.data).filter(Boolean).sort();
  const esc = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const br = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '?');
  const num = (n) => (n === null || n === undefined ? 'null' : String(n));
  const partes = [];
  partes.push(`-- Gerado por supabase/import/extrair.cjs a partir de ${path.basename(arquivo)}`);
  partes.push(`-- ${linhas.length} linhas. Rodar dentro de uma transação; conferir ANTES de carregar.`);
  partes.push('');
  partes.push('begin;');
  partes.push(`insert into public.import_batches (id, source_file, description)`);
  const janela = datas.length ? `${br(datas[0])} a ${br(datas[datas.length - 1])}` : 'sem linhas';
  const descricao = (desde || ate || turno !== null ? 'Carga incremental ' : 'Histórico ') + janela
    + (turno !== null ? `, turno ${turno}` : '');
  partes.push(`values ('${lote}', ${esc(path.basename(arquivo))}, ${esc(descricao)});`);
  partes.push('');

  for (let i = 0; i < linhas.length; i += 500) {
    const bloco = linhas.slice(i, i + 500);
    partes.push('insert into public.import_rows (batch_id, source_sheet, source_cell, raw_machine, raw_value,');
    partes.push('  kind, machine_id, production_date, shift_id, work_mode, quantity, notes, discard_reason,');
    partes.push('  target_quantity, target_source)');
    partes.push(`select '${lote}', v.aba, v.celula, v.coluna, v.cru, v.kind, m.id, v.data::date,`);
    partes.push('       v.turno::smallint, v.modo, v.qtd, v.nota, v.descarte,');
    // Nível 3: a planilha nunca trouxe meta para este centro, então vale a de hoje.
    partes.push("       coalesce(v.meta, case when v.origem = 'meta_de_hoje' then t.quantity_per_shift end),");
    partes.push('       v.origem');
    partes.push('  from (values');
    partes.push(bloco.map((l) => '    (' + [
      esc(l.aba), esc(l.celula), esc(l.coluna), esc(l.cru), esc(l.kind), esc(l.centro),
      esc(l.data), num(l.turno), esc(l.modo ?? null), num(l.qtd ?? null),
      esc(l.nota ?? null), esc(l.descarte ?? null), num(l.meta ?? null), esc(l.metaOrigem ?? 'sem_meta'),
    ].join(', ') + ')').join(',\n'));
    partes.push('  ) as v(aba, celula, coluna, cru, kind, centro, data, turno, modo, qtd, nota, descarte, meta, origem)');
    partes.push('  left join public.machines m on lower(m.name) = lower(v.centro)');
    partes.push('  left join public.current_machine_targets t on t.machine_id = m.id;');
    partes.push('');
  }
  partes.push('-- Confira antes de confirmar. Para desistir: rollback;');
  partes.push('commit;');
  fs.writeFileSync(saida, partes.join('\n') + '\n');

  // ─── Relatório para quem rodou ────────────────────────────────────────────
  const por = {};
  for (const l of linhas) por[l.kind] = (por[l.kind] || 0) + 1;
  const pecas = linhas.filter((l) => l.kind === 'production').reduce((s, l) => s + (l.qtd || 0), 0);
  console.log(`Lote ${lote}`);
  console.log(`Arquivo gerado: ${saida}  (${linhas.length} linhas)`);
  if (datas.length) console.log(`Janela: ${datas[0]} a ${datas[datas.length - 1]}`);
  if (desde) console.log(`Corte: --desde=${desde}  (${anteriores} linhas da planilha ficaram de fora, por serem anteriores)`);
  if (ate) console.log(`Corte: --ate=${ate}  (${posteriores} linhas da planilha ficaram de fora, por serem posteriores)`);
  if (turno !== null) console.log(`Corte: --turno=${turno}  (${outroTurno} linhas da planilha ficaram de fora, por serem de outro turno)`);
  if (corrigidas) console.log(`${corrigidas} linhas tiveram a data corrigida pelo mapa`);
  console.log('');
  for (const [k, v] of Object.entries(por).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(6)}`);
  }
  console.log('');
  console.log(`  total de peças em apontamentos: ${pecas.toLocaleString('pt-BR')}`);
  const orig = {};
  for (const l of linhas) if (l.kind === 'production' || l.kind === 'rework') orig[l.metaOrigem] = (orig[l.metaOrigem] || 0) + 1;
  console.log('\n  de onde vem a meta de cada apontamento:');
  for (const [k, v] of Object.entries(orig).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(20)} ${String(v).padStart(6)}`);
  if (semResultado) console.log(`\n  ${semResultado} células com fórmula sem resultado salvo (ignoradas, nada foi inventado)`);
  if (naoReconhecidos.size) {
    console.log(`\n  ${naoReconhecidos.size} cabeçalhos sem destino no mapa:`);
    for (const x of [...naoReconhecidos].slice(0, 10)) console.log(`    ${x}`);
  }
  if (avisos.length) {
    console.log(`\n  ${avisos.length} avisos:`);
    for (const x of avisos.slice(0, 10)) console.log(`    ${x}`);
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });

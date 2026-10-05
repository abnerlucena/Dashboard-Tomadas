# Registro de Decisões (ADR)

Cada decisão registra **o contexto**, **o que foi escolhido**, **as alternativas** e **o custo**.
Decisões não são apagadas: quando revistas, recebem o status `Substituída por Dxx`.

Status possíveis: `Aprovada` · `Assumida` (sem confirmação explícita) · `Substituída` · `Proposta` · `Provisória — confirmar com o usuário` (tomada numa sessão autônoma, sem ninguém para consultar).

| ID | Tema | Status | Data |
|---|---|---|---|
| D01 | Id de máquina gerado pelo banco | Aprovada | 14/09/2026 |
| D02 | Nome de máquina único | Aprovada | 14/09/2026 |
| D03 | Nomes em inglês, `snake_case` | Aprovada | 14/09/2026 |
| D04 | Autoria por id, não por nome | Aprovada | 14/09/2026 |
| D05 | Status de máquina com manutenção; paradas para o SFM | Aprovada | 14/09/2026 |
| D06 | Tabela de turnos | Aprovada | 14/09/2026 |
| D07 | Datas como `date`, exibição dd/mm/aaaa | Aprovada | 14/09/2026 |
| D08 | Meta como snapshot no apontamento | Aprovada | 14/09/2026 |
| D09 | Ordens de produção em tabela própria | Aprovada | 14/09/2026 |
| D10 | Um apontamento por máquina + dia + turno | Aprovada | 14/09/2026 |
| D11 | Retrabalho separado da produção boa | Aprovada | 14/09/2026 |
| D12 | Número de operadores por turno | Aprovada | 14/09/2026 |
| D13 | Histórico de metas | Aprovada | 14/09/2026 |
| D14 | Meta igual para todos os turnos | Aprovada | 14/09/2026 |
| D15 | Meta não pode começar no passado | Aprovada — em revisão pela D34 | 14/09/2026 |
| D16 | `calendar_events` com três tipos | Aprovada | 14/09/2026 |
| D17 | Eventos por turno e vários por dia | Aprovada | 14/09/2026 |
| D18 | Importação automática de feriados nacionais | Aprovada | 14/09/2026 |
| D19 | Supabase Auth com login por e-mail | Aprovada | 14/09/2026 |
| D20 | Cadastro aguarda aprovação do gestor | Aprovada | 14/09/2026 |
| D21 | Nº do crachá obrigatório para contas pessoais | Aprovada | 14/09/2026 |
| D22 | Perfil copiado como modelo de permissões | Aprovada | 14/09/2026 |
| D23 | Conta Admin compartilhada com identificação | Aprovada | 14/09/2026 |
| D24 | Edição do próprio apontamento por 24 h | Aprovada | 14/09/2026 |
| D25 | Notificações por destinatário | Aprovada | 15/09/2026 |
| D26 | Log de auditoria por trigger, retenção adiada | Aprovada | 14/09/2026 |
| D27 | Modo de trabalho (hora extra) no apontamento | Aprovada | 16/09/2026 |
| D28 | Recriar `shifts` no banco que estava vazio | Aprovada | 21/09/2026 |
| D29 | Criação e remoção de contas | Aprovada | 21/09/2026 |
| D30 | Novo lançamento no mesmo apontamento acrescenta ordens | Aprovada | 21/09/2026 |
| D31 | Correção da meta de hoje/futura no mesmo dia | Provisória — será absorvida pela D34 | 20/09/2026 |
| D32 | Meta de datas anteriores ao histórico | Aprovada em parte — regra geral mantida na D34 | 21/09/2026 |
| D33 | Autor lê os próprios apontamentos (ligado à permissão) | Aprovada | 21/09/2026 |
| D34 | Gestão de metas por linha do tempo (painel do gestor) | Proposta | 21/09/2026 |
| D35 | Migração do histórico da planilha Excel | Proposta (gestor revisou em 25/09) | 21/09/2026 |
| D36 | Atingimento × disponibilidade (máquinas contínuas e sob demanda) | Proposta | 21/09/2026 |
| D37 | Centro de trabalho e processo (montagem/embalagem) | Aprovada | 25/09/2026 |
| D38 | Metas reais e centros por demanda | Aprovada | 25/09/2026 |
| D39 | Base da meta: por turno ou por operador | Aprovada | 25/09/2026 |
| D40 | Capacidade como alarme, não como cálculo da meta | Aprovada | 25/09/2026 |
| D41 | Máquina planejada e data de entrada em operação | Aprovada | 25/09/2026 |
| D42 | Tempo útil por turno guardado no banco | Aprovada | 25/09/2026 |
| D43 | Destino do histórico das máquinas renomeadas e divididas | Aprovada | 25/09/2026 |
| D44 | A UI de `prototype/` é a interface oficial | Aprovada | 26/09/2026 |
| D45 | Recuperação de senha pelo e-mail do Supabase Auth | Aprovada | 26/09/2026 |
| D46 | Onde a meta por operador é resolvida (base congelada, conta na leitura) | Aprovada | 27/09/2026 |
| D47 | Onde a lotação do posto muda a meta: granel e horizontais | Aprovada | 27/09/2026 |
| D48 | Zero operadores é "não informado", e a regra da meta é uma só (tela = banco) | Aprovada | 27/09/2026 |
| D49 | Teto na meta rateada pela lotação | Aprovada | 30/09/2026 |
| D50 | Migration encontra máquina por id, não por nome | Aprovada | 30/09/2026 |
| D51 | Aposentar o `_consolidado.sql` | Aprovada | 30/09/2026 |
| D52 | Nº de operadores em todo apontamento, e dá para apagar | Aprovada | 30/09/2026 |
| D53 | A base da meta é definida pelo app, junto com o valor | Aprovada | 30/09/2026 |
| D54 | Nº de operadores obrigatório onde a meta é por pessoa | Aprovada | 01/10/2026 |
| D55 | O banco de testes vira o banco de produção | Aprovada | 01/10/2026 |
| D56 | A UI antiga sai; a virada vai com a interface nova | Aprovada | 03/10/2026 |
| D57 | O nº da OP é só números, até 15 | Aprovada | 03/10/2026 |
| D58 | Os números de capacidade não são sigilosos | Aprovada | 03/10/2026 |
| D59 | Mover um apontamento de dia leva a meta junto; o importado guarda a da planilha | Aprovada | 03/10/2026 |
| D60 | A linha do tempo de metas antes de 25/09/2026 vem da planilha | Aprovada | 03/10/2026 |
| D61 | Calendário: vários dias numa operação só, com abrangência | Aprovada | 04/10/2026 |
| D62 | A OP passa a existir por si, com o terreno pronto para o SAP | Aprovada | 04/10/2026 |
| D63 | Cadastro completo de máquinas: meta 0 é por demanda, linha obrigatória, editar | Aprovada | 05/10/2026 |
| D64 | O Google Apps Script e o Dash antigo saem do repositório | Aprovada | 05/10/2026 |

---

### D01 — Id de máquina gerado pelo banco
- **Contexto:** o Apps Script calcula `maior id + 1`; dois cadastros simultâneos podem gerar o mesmo id.
- **Decisão:** `integer generated always as identity`.
- **Custo:** nenhum.

### D02 — Nome de máquina único
- **Contexto:** a checagem de duplicidade existe só no código.
- **Decisão:** índice único em `lower(name)`.
- **Custo:** nenhum.

### D03 — Nomes em inglês, `snake_case`
- **Contexto:** o legado mistura português e inglês; o Postgres converte identificadores para minúsculas.
- **Decisão:** inglês, sem acentos, `snake_case`.
- **Alternativa rejeitada:** português (mais natural para a equipe, mas exige tradução para bancos corporativos).
- **Custo:** menos natural no dia a dia; o frontend mantém rótulos em português.

### D04 — Autoria por id
- **Contexto:** `createdBy`, `savedBy` etc. guardam o nome; renomear um usuário quebra o vínculo.
- **Decisão:** `uuid` com FK para `profiles`.
- **Custo:** exibir o nome exige join.

### D05 — Status de máquina e paradas
- **Contexto:** necessidade de indicar manutenção e preventiva; paradas virão futuramente do SFM.
- **Decisão:** `status` com 4 valores via CHECK; tabela `machine_downtimes` criada sem uso, com `source` + `external_id` únicos.
- **Alternativa rejeitada:** `ENUM` (difícil de alterar, não portável).
- **Custo:** tabela sem uso até a integração.

### D06 — Tabela de turnos
- **Contexto:** turnos eram texto solto; turnos ativos ficavam no `localStorage` de cada navegador.
- **Decisão:** tabela `shifts` com horários e `is_active`. Qualquer usuário aponta qualquer turno.
- **Complemento (16/09/2026):** `start_time`/`end_time` são apenas descritivos. O turno de um apontamento vem sempre do `shift_id` informado, nunca deduzido do horário em que o apontamento foi feito — na prática os apontadores ficam além do horário do turno (passagem de turno, organização interna).
- **Custo:** uma tabela e um join a mais.

### D07 — Datas
- **Contexto:** o Sheets converte datas em textos como `"Thu Apr 03 2026 GMT-0300"`.
- **Decisão:** tipo `date`; o frontend exibe e recebe `dd/mm/aaaa`.
- **Alternativa rejeitada:** guardar `"14/09/2026"` como texto (ordenação e filtros incorretos).

### D08 — Meta como snapshot
- **Contexto:** a meta muda com o tempo, mas o passado não deve mudar junto.
- **Decisão:** manter `target_quantity` no apontamento (duplicação intencional).
- **Alternativa rejeitada:** calcular sempre a partir do histórico (consultas complexas).

### D09 — Ordens em tabela própria
- **Contexto:** as OPs eram um JSON dentro de uma célula.
- **Decisão:** tabela `production_orders`; `order_number` como texto (zeros à esquerda do SAP).
- **Custo:** gravação em duas tabelas, feita por função transacional.

### D10 — Um apontamento por máquina + dia + turno
- **Alterada por D27 (16/09/2026):** a chave de unicidade passa a incluir `work_mode`.
- **Contexto:** o legado tinha `upsert` (substitui) e `append` (duplica) coexistindo.
- **Decisão:** UQ `(machine_id, production_date, shift_id)`; lançamentos adicionais viram ordens do mesmo apontamento. A mesma OP pode aparecer em turnos diferentes; apontar atrasado é permitido.
- **Custo:** o botão "criar novo apontamento" do legado deixa de existir.

### D11 — Retrabalho
- **Contexto:** o legado soma retrabalho na produção, inflando o atingimento de meta.
- **Decisão:** remover `quantity_produced`; view `production_summary` separa produção boa e retrabalho. Meta usa apenas produção boa.
- **Custo:** gráficos do frontend precisam ser ajustados (corrige o bug atual).

### D12 — Operadores por turno
- **Contexto:** produção baixa em feriados e turnos com falta de pessoal distorce a leitura.
- **Decisão:** `machines.standard_operator_count` e `production_records.operator_count` (opcionais, pré-preenchidos). Métricas de lotação e meta ajustada.
- **Alternativa adiada:** registrar quais pessoas operaram (complexidade de uso e questões de RH/LGPD).
- **Substitui:** a proposta de "capacidade esperada no feriado" (rejeitada: estimativa não confiável).

### D13 — Histórico de metas
- **Decisão:** `machine_targets` append-only com `valid_from`; `default_target` removido; ao criar máquina o gestor informa a meta atual.

### D14 — Meta igual para todos os turnos
- **Decisão:** sem `shift_id` em `machine_targets`.

### D15 — Meta não retroativa
- **Em revisão (21/09/2026):** a D34 (Proposta) permite ao gestor/admin alterar metas do passado com rastro. Quando a D34 for implementada, esta decisão passa a `Substituída por D34`.
- **Decisão:** `valid_from` não pode ser anterior a hoje (fuso de Brasília). Correções pontuais em apontamentos são feitas pelo gestor.

### D16 — Três tipos de evento
- **Decisão:** `holiday` e `special_event` são contexto; `excluded_day` retira o dia/turno dos cálculos e prevalece sobre os demais.

### D17 — Eventos por turno e vários por dia
- **Decisão:** tabela de ligação `calendar_event_shifts` (vazia = dia inteiro); sem unicidade de data para eventos manuais.

### D18 — Feriados nacionais automáticos
- **Decisão:** importação anual da BrasilAPI (Supabase Cron + Edge Function); UQ parcial para eventos importados. Estaduais, municipais e da empresa são manuais.
- **Nota de segurança:** a rotina usa credencial interna do Supabase; ela nunca entra no repositório.

### D19 — Supabase Auth
- **Decisão:** login por e-mail (corporativo ou pessoal); proteção contra força bruta pelo limite de tentativas do Supabase. Tabelas `Sessions`, `senhaHash`, `loginAttempts`, `lockedUntil` eliminadas.

### D20 — Aprovação do gestor
- **Decisão:** cadastro nasce `pending` sem permissões; o gestor aprova. `InviteCodes` e o código fixo `ACCESS_CODE` são eliminados.

### D21 — Nº do crachá
- **Decisão:** `badge_number` obrigatório para `account_type = 'personal'`; contas `shared` e `display` isentas.

### D22 — Perfil como modelo
- **Decisão:** na aprovação, as permissões do perfil são copiadas para `user_permissions` e podem ser ajustadas.
- **Alternativa rejeitada:** perfil + exceções (propaga mudanças, mas é mais difícil de entender e depurar).
- **Custo:** alterar um perfil não afeta usuários já aprovados sem "reaplicar perfil".

### D23 — Conta Admin compartilhada
- **Decisão:** conta `shared`; a cada sessão a pessoa informa o nº do crachá, que precisa pertencer a um usuário ativo. Sem identificação, nenhuma permissão. O uso restrito ao PC do gestor é acordo interno, sem controle técnico.
- **Limitação conhecida:** identificação declarada, não comprovada por senha individual.

### D24 — Edição do próprio apontamento
- **Decisão:** `production.edit_own` permite editar/apagar apontamentos próprios até 24 h após a criação (evita o problema do turno 3 atravessando a meia-noite e do servidor em UTC).

### D25 — Notificações
- **Decisão:** uma linha por destinatário; ao aprovar, as notificações relacionadas são marcadas como lidas para todos. Realtime para atualização imediata.
- **Status:** aprovada em 15/09/2026 (antes assumida).

### D26 — Auditoria
- **Decisão:** `audit_logs` gravado por triggers, com snapshot antes/depois e IP; append-only.
- **Adiado:** política de retenção (decidir junto com o plano Supabase ou a migração para a WEG; o plano Free tem 500 MB).

### D27 — Modo de trabalho (hora extra)
- **Contexto:** a fábrica faz hora extra esporádica, combinada previamente com o gestor (inclusive de madrugada, onde o TURNO 3 ainda não opera regularmente). Hoje isso é registrado como uma linha separada na planilha, identificada por texto livre ("hora extra do dia tal"), que o sistema não consegue somar, filtrar nem excluir dos gráficos.
- **Problema:** medir uma hora extra (poucas pessoas, poucas horas) com a meta cheia de um turno produz percentuais falsos — o TURNO 3 apareceria como péssimo sendo que sequer existe como turno. A lotação (D12) corrige "menos gente", mas não corrige "menos horas".
- **Decisão:** coluna `work_mode` em `production_records`: `text not null default 'regular'`, CHECK `regular`/`overtime`. O apontamento fica no turno real em que a produção ocorreu.
- **Regras de leitura:** produção total inclui hora extra; atingimento de meta por turno considera apenas `regular`; hora extra vira indicador próprio.
- **Consequência estrutural:** a unicidade de D10 passa a ser `(machine_id, production_date, shift_id, work_mode)`, para que trabalho normal e hora extra do mesmo turno coexistam como linhas separadas — como já acontece na planilha.
- **Alternativas rejeitadas:** lançar no turno 1/2 (dado mentiroso); ativar o TURNO 3 e aceitar o percentual ruim; criar um "turno HORA EXTRA" (hora extra não é turno — pode ocorrer em qualquer um).
- **Formato:** texto com CHECK em vez de booleano, para acomodar futuros modos (`training`, `trial`) sem coluna nova.
- **Custo:** uma coluna a mais e uma marcação na tela de apontamento; os gráficos do frontend precisam respeitar a regra.
- **Quando o TURNO 3 virar regular:** nada muda na estrutura — os apontamentos novos simplesmente deixam de ser marcados como `overtime`, e o passado continua verdadeiro.

### D28 — Recriar `shifts` no banco que estava vazio
- **Status:** Aprovada em 21/09/2026. *Atualizado em 30/09/2026: o `_consolidado.sql` foi aposentado — ver D51.* *Atualizado em 01/10/2026: este projeto **deixou de ser de testes e virou o de produção** — ver D55. A ordem de instalação do zero, para quem precisar montar outro, está em [`supabase/INSTALAR.md`](../../supabase/INSTALAR.md) e tem duas armadilhas que este parágrafo não previa.*
- **Contexto:** a documentação registrava `shifts` como criada em 16/09/2026, mas o banco apontado pelo arquivo de segredos estava com o schema `public` **vazio**, sem nenhum rastro de criação ou remoção da tabela. Detalhes em [notas/2026-09-20-verificacao-inicial.md](notas/2026-09-20-verificacao-inicial.md).
- **Decisão:** aplicar as duas migrations versionadas de `shifts` sem nenhuma alteração, antes das demais.
- **Alternativas rejeitadas:** trabalhar só offline (atrasaria toda a verificação real); reescrever a migration de `shifts` (mudaria o histórico versionado).
- **Por que é seguro:** a ação é só aditiva. Se `shifts` existir em outro projeto, ele não é tocado.
- **~~A confirmar:~~ Respondido em 01/10/2026 (D55):** o projeto oficial é este mesmo.

### D29 — Criação e remoção de contas
- **Status:** Aprovada em 21/09/2026 (as duas partes).
- **Contexto:** a regra D21 (crachá obrigatório para conta pessoal) precisava de um comportamento concreto no gatilho `handle_new_user`, e as chaves estrangeiras para `profiles` (autoria, aprovação, auditoria) precisavam de uma regra de remoção.
- **Decisão 1 — cadastro sem crachá:** o gatilho **recusa** o cadastro pessoal sem crachá, com a mensagem "O nº do crachá é obrigatório para contas pessoais." Contas `shared` (Admin) e `display` (TV) são criadas enviando `account_type` nos metadados do cadastro.
- **Consequência:** criar usuário pelo botão "Add user" do painel do Supabase (que não envia metadados) falha. Usar a tela de cadastro do app ou a API com `options.data`.
- **Alternativa rejeitada:** criar o perfil mesmo sem crachá (exigiria afrouxar a regra D21 no banco).
- **Decisão 2 — remoção:** as chaves estrangeiras para `profiles` usam o padrão "impedir" (sem `ON DELETE`). Quem já tem histórico não pode ser apagado; o caminho é bloquear (`status = 'blocked'`), preservando a rastreabilidade (D04, D26).
- **Alternativa rejeitada:** `ON DELETE SET NULL` (apagaria a autoria do histórico).
- **A confirmar:** se a LGPD exigir remoção de dados pessoais no futuro, a saída prevista é anonimizar `full_name`/`badge_number`, não apagar a linha.

### D30 — Novo lançamento no mesmo apontamento acrescenta ordens
- **Status:** Aprovada em 21/09/2026. Confirmação do usuário: um novo apontamento no mesmo "filtro" (máquina + dia + turno) só **acrescenta** à lista; para substituir, usa-se a função **Editar**, que já existe.
- **Contexto:** o `upsert` do legado **substitui** a lista de ordens quando alguém salva de novo a mesma máquina + dia + turno; a D10 diz que "lançamentos adicionais viram ordens do mesmo apontamento" e a visão geral diz que o sistema "completa o apontamento existente".
- **Decisão:** `save_production_record` **acrescenta** as ordens enviadas às existentes (segue D10). Para editar/corrigir, `update_production_record` (ou `p_replace_orders = true`) substitui a lista.
- **Consequência:** salvar duas vezes a mesma ordem gera duas linhas (no legado, a segunda sobrescrevia a primeira). A edição de uma ordem errada passa a ser feita na tela de edição, não salvando de novo.
- **Alternativa rejeitada:** manter a substituição do legado (contraria D10 e perde lançamentos feitos por outra pessoa no mesmo turno).
- **Encerrado:** o aviso "já existe apontamento — substituir?" não será feito; a correção é pela edição.

### D31 — Correção da meta de hoje/futura no mesmo dia
- **Status:** Provisória — será absorvida pela D34 (21/09/2026): corrigir a meta de hoje vira um caso de "alterar a meta de um trecho" no painel. Até a D34 ser implementada, vale o comportamento abaixo.
- **Contexto:** `machine_targets` é append-only (D13) e tem unicidade `(machine_id, valid_from)`. Um erro de digitação ao salvar a meta de hoje ficaria sem correção até amanhã.
- **Decisão:** `save_machine_targets` corrige a meta já cadastrada para a **mesma data**, desde que essa data seja hoje ou futura. Metas que já valeram (antes de hoje) continuam imutáveis — o gatilho `validate_target_valid_from` recusa. Toda correção fica no log de auditoria (antes/depois).
- **Consequência:** apontamentos feitos hoje **antes** da correção guardam a meta antiga (foto, D08); o gestor corrige esses pontualmente.
- **Alternativa rejeitada:** recusar e obrigar a vigência de amanhã (bloqueia a correção de um erro óbvio).

### D32 — Meta de datas anteriores ao histórico
- **Status:** Aprovada em parte (21/09/2026). Regra confirmada pelo usuário: o apontamento recebe a **meta vigente na data do apontamento** — se a meta no dia X é N, o apontamento do dia X recebe N. É o que `machine_target_on(máquina, data)` já faz. **Em aberto:** confirmar que, num apontamento atrasado, "data do apontamento" é a data da produção (`production_date`) e não o dia em que foi digitado; e se a regra da meta mais antiga para datas antes do histórico continua.
- **Contexto:** o histórico de metas começa na data da carga inicial (20/09/2026). Um apontamento atrasado de antes disso não teria meta vigente.
- **Decisão:** `machine_target_on` usa a meta **mais antiga conhecida** para datas anteriores ao início do histórico, em vez de zero.
- **Alternativa rejeitada:** meta zero (o atingimento ficaria indefinido e os gráficos mostrariam "—").
- **A confirmar:** quando os dados do Sheets forem migrados, o `target_quantity` de cada apontamento antigo virá da própria planilha (coluna `meta`), e esta regra só valerá para apontamentos atrasados novos.

### D33 — Autor lê os próprios apontamentos
- **Status:** Aprovada em 21/09/2026. O usuário confirmou a lógica "apenas para o Operador" e escolheu a forma recomendada: a regra fica ligada à **permissão** `production.edit_own`, não ao nome do perfil (migration 0.10.2).
- **Contexto:** a referência dizia "leitura de produção: `history.view` OR `dashboard.view` OR `tv_mode.view`". O perfil Operador não tem nenhuma dessas, mas tem `production.edit_own` (corrigir o próprio apontamento por 24 h, D24) — e não dá para corrigir o que não se vê.
- **Decisão:** a política de leitura de `production_records` também libera os apontamentos em que `created_by` é o próprio usuário **e** ele tem `production.edit_own`. As ordens seguem o apontamento-pai.
- **Por que permissão e não perfil:** as permissões são ajustáveis por pessoa (D22). Tirar de alguém o direito de corrigir também tira o de ver os próprios; com os perfis de fábrica, só o Operador depende desta regra — os demais já veem toda a produção.
- **Alternativa rejeitada:** travar pelo perfil "Operador" (ignoraria os ajustes individuais).
- **Alternativa rejeitada:** dar `history.view` ao Operador (ele passaria a ver a produção de todos).

### D34 — Gestão de metas por linha do tempo (painel do gestor)
- **Status:** Proposta (21/09/2026) — desenhada com o usuário; ainda não implementada. Próximo passo: protótipo navegável do painel e, depois, as migrations.
- **Contexto:** a D15 proíbe meta no passado e a D31 tratava só a correção do dia. O usuário quer um fluxo completo: definir metas por máquina, ver a meta ao longo do tempo e corrigir qualquer trecho, inclusive no passado, com responsabilidade.
- **Decisão (pontos confirmados pelo usuário):**
  1. **Quem:** só gestor e admin (a permissão `targets.manage` que já existe; sem permissão separada para o passado). Na conta Admin compartilhada, o rastro registra a pessoa identificada pelo crachá (D23).
  2. **Para quem:** uma meta por **máquina**, igual para todos os turnos (D14 mantida). Hora extra e dia anulado continuam fora do cálculo (D16, D27).
  3. **Linha do tempo:** a meta vale **até existir uma nova**; a meta atual não tem data de fim. Nunca há duas metas ao mesmo tempo na mesma máquina (o banco impede sobreposição).
  4. **Editar um trecho** (ex.: de 03/03 a 28/03 → 550): o sistema grava a mudança no início e, no dia seguinte ao fim, **volta sozinho** à meta que valia antes. Mudanças que existiam dentro do trecho são substituídas.
  5. **Até onde:** qualquer data em que exista apontamento daquela máquina no passado, além de datas futuras (metas "agendadas").
  6. **Apontamentos acompanham a linha do tempo:** ao mudar um trecho, a meta guardada em cada apontamento do trecho é recalculada (D08 mantida como "foto", mas com recálculo oficial). **Não existe mais correção avulsa** da meta de um apontamento: a meta vem sempre da linha do tempo.
  7. **Rastro:** motivo obrigatório; antes/depois de cada meta e de cada apontamento recalculado no log de auditoria (D26); **prévia do impacto** antes de confirmar (quantos apontamentos mudam, atingimento antes e depois).
  8. **Transparência:** gráficos e relatórios mostram um aviso nos períodos alterados ("meta alterada em … por …"); o painel lista as mudanças com o botão **Desfazer** (uma nova mudança no sentido contrário, também registrada).
  9. **Concorrência:** se dois gestores editam a mesma máquina ao mesmo tempo, o segundo é avisado de que a linha do tempo mudou e precisa recarregar.
- **Painel:** por máquina, gráfico da meta em "degraus" ao longo do tempo com a produção real diária por trás; metas futuras tracejadas; selecionar um trecho no gráfico abre a edição com prévia.
- **Consequências:** D15 será substituída; D31 deixa de existir isolada; a regra geral da D32 (meta vigente na data da produção) continua. `machine_targets` ganha o motivo da mudança; nasce uma função de recálculo auditada.
- **Em aberto:** (a) montar a linha do tempo do passado a partir da planilha de apontamentos que o usuário vai enviar (a meta gravada em cada linha); (b) **fechamento mensal** — discutir depois, como um arquivo pronto com os indicadores do mês.
- **Alternativas rejeitadas:** metas com data de fim obrigatória (não dá para prever quando haverá meta nova); preservar correções avulsas em apontamentos (criaria metas "escondidas" diferentes do gráfico); permissão separada para alterar o passado (o usuário preferiu manter só gestor/admin).

### D35 — Migração do histórico da planilha Excel
- **Status:** Proposta (21/09/2026) — **revisão do gestor concluída em 25/09/2026** (ver D35.1). Datas de entrada em operação confirmadas e cruzamento coluna a coluna feito (D35.3). **Sem pendências de informação** — falta implementar.
- **Contexto:** o histórico real está na planilha `ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx` (20/12/2025 em diante, uma aba por mês, linha = data + turno, coluna = máquina, sem nº de OP). O app atual (Google Sheets + Apps Script) registra a **mesma** produção e será abandonado quando o sistema novo estiver em uso.
- **Decisão (pontos confirmados pelo usuário):**
  1. **Fonte única do histórico = a planilha Excel.** O Google Sheets do app serve só para conferência (importar os dois contaria em dobro).
  2. **Virada:** uma **data de corte**, precedida de uma rodagem em paralelo curta (a equipe aponta no sistema; a planilha segue só para comparação). Depois do corte, só o sistema.
  3. **A planilha nunca é alterada.** A extração é um script reproduzível (rodar de novo dá o mesmo resultado).
  4. **Área de preparo** no banco, separada das tabelas de produção; cada valor guarda a origem (aba e célula, ex.: `JUN 26!F12`).
  5. **Pendências revisadas caso a caso** pelo gestor antes da carga: hora extra (rótulos "HORA EXTRA", "H. EXTRA", "EXTRA 1°T/2°T"; sábado 10/01), textos no lugar de números ("Preventiva", "Manutenção" → paradas de máquina), anotações de retrabalho.
  6. **Carga em lote** identificado e reversível; cada apontamento marcado como vindo da planilha, com a célula de origem; passa pela auditoria.
  7. **Conferência obrigatória:** total por máquina e mês no sistema = total na planilha.
  8. **Data de entrada em operação** por máquina: sugerida como o 1º dia com produção e confirmada pelo gestor. Zeros **antes** dela = máquina ainda não existia em Itajaí (descartados). A linha do tempo de metas (D34) começa nessa data.
  9. **Metas:** a meta do grupo na planilha vale **para cada máquina** do grupo (ex.: "Horizontais 500" → Horizontal 1 = 500 e Horizontal 2 = 500). Agosto e setembro continuam com as metas de julho. Máquinas sem meta na planilha ficam **sem meta** até o gestor definir no painel (D34).
  10. **Máquinas:** entram as que não existem no app (2 CONJUNTOS, 1 CONJUNTOS, REBITAGEM PINOS, MÁQUINA DE PLUG AUTOMÁTICA); **PRENSA TOX** entra como **Montagem Diversos**.
  11. **Retrabalho:** nomenclatura antiga respeitada no histórico (só 3 anotações na planilha, tratadas uma a uma); a boa prática nova vale a partir da entrada em produção do sistema.
  12. **OP:** apontamentos importados entram sem nº de OP ("importado da planilha"). A OP informada passa a ser boa prática nova, com integração futura ao SAP.
- **Impacto no banco (a implementar):** data de entrada/saída de operação em `machines`; origem e lote em `production_records`; tabela da área de preparo; tipo da máquina (D36). Tudo aditivo.
- **Alternativas rejeitadas:** importar também o Google Sheets (duplicaria); tratar todo zero como "não rodou" (misturaria máquinas que ainda não existiam); gravar direto nas tabelas de produção sem área de preparo (sem revisão nem desfazer).


#### D35.1 — Devolutivas do gestor (25/09/2026)

O relatório de pré-importação voltou revisado. As 17 pendências que dependiam
dele estão fechadas; o que segue é o que vale na importação.

**Hora extra — em qual turno cada caso aconteceu.** Nenhum caiu no T3, o que
bate com o T3 ainda ser só hora extra de madrugada.

| Data | Rótulo na planilha | Turno |
|---|---|---|
| sáb 10/01/2026 | aba separada, "T1" | hora extra, **T1** |
| sáb 16/05/2026 | "HORA EXTRA" | T1 |
| sáb 23/05/2026 | "HORA EXTRA" | T1 |
| sex 05/06/2026 | "EXTRA 2°T" | T2 |
| seg 15/06/2026 | "EXTRA 1°T" | T1 |
| seg 15/06/2026 | "EXTRA 2°T" | T2 |
| sáb 27/06/2026 | "H. EXTRA" | T1 |
| sáb 11/07/2026 | "H. EXTRA" | T1 |
| dom 12/07/2026 | "H. EXTRA" | T1 |

**Textos no lugar de números.** Os quatro viram parada de máquina no turno,
com o motivo que a planilha escreveu:

| Data · turno | Célula | Escrito | Vira |
|---|---|---|---|
| qua 04/03 · T1 | `MAR 26!I10` | "Preventiva" | parada por manutenção preventiva — 4x2 Suportes/Placas N°2 |
| sex 06/03 · T1 | `MAR 26!F14` | "Manutenção" | parada por manutenção — Horizontal N°1 |
| seg 09/03 · T1 | `MAR 26!F16` | "Preventiva" | parada por manutenção preventiva — Horizontal N°1 |
| sex 13/03 · T1 | `MAR 26!F24` | "Manutenção" | parada por manutenção — Horizontal N°1 |

**Retrabalho e observações.**

| Célula | Escrito | Vira |
|---|---|---|
| `ABR 26!AN42` | "Retrabalho Refinatto 4.510" | 4.510 peças de retrabalho na Prensa Placa Refinatto, 27/04 · T1 |
| `SET 26!AB8` | "H 01 - 4800" | 4.800 peças de retrabalho na Embaladora Horizontal N°1 |
| `SET 26!AB30` | "Colagem de etiqueta de correção nas embalagens da modulo 02" | **observação do dia, sem quantidade**, na Vertical Módulos N°2 |

**Número cortado.** `AGO 26!X38` trazia "10." na Máquina de Tomadas
Automática, 25/08 · T1. O gestor confirmou: **10.000 peças**.

#### D35.2 — O que as decisões D37 a D43 mudaram nesta decisão

O desenho da fábrica foi refeito **depois** que a D35 foi escrita, então dois
pontos dela ficaram desatualizados:

- **Item 10 está superado.** Ele dizia que a `PRENSA TOX` entraria como
  "Montagem Diversos". Pela D37 ela é um **centro de trabalho próprio** e já
  está cadastrada. O mesmo vale para as duas Conjuntos e para a "Máquina de
  Plug Automática", que hoje é a `MÁQUINA DE PLUGUE SLIN - AUMAQ`.
- **Mapeamento das colunas da planilha** passa a seguir a D43: a coluna de
  `MONTAGEM DIVERSOS` vai para a **Bancada N°4**, e as de `MONTAGEM TOMADAS
  MANUAL` e `FECHAMENTO TECLA INTERRUPTORES` vão para a **Bancada N°3**.
- **Item 9 continua valendo** para os degraus do **passado** (horizontais
  8.000, placas 7.000, a granel 15.000). As metas de **hoje** já estão no
  banco pela D38 e não vêm mais da planilha.

**Resolvido em 25/09/2026:** a coluna `REBITAGEM PINOS` vai para a **Prensa Tox**. Todas as 23 colunas da planilha passam a ter destino — ver D35.3.


#### D35.3 — Cruzamento coluna a coluna (25/09/2026)

As 23 colunas da planilha de produção contra os 22 centros de trabalho. As
datas de entrada em operação foram confirmadas pelo gestor; o resto vem da
leitura da planilha (20/12/2025 a 21/09/2026, 2.505 turnos-máquina com
produção).

| Coluna da planilha | Vira o centro | Entrou em operação | Turnos c/ produção | Zeros depois |
|---|---|---|---|---|
| VERTICAL PLACAS / SUP. 2 | Embaladora 4X2 Suportes/Placas N°2 | 20/12/2025 | 305 | 22 |
| A GRANEL | Bancada Embalagem A Granél | 20/12/2025 | 279 | 34 |
| MANUAL INTERRUPTOR | Bancada N°2 - Montagem Interruptores | 20/12/2025 | **10** | 283 |
| MONTAGEM DIVERSOS | Bancada N°4 - Diversos | 20/12/2025 | 224 | 90 |
| KIT 2 PARAFUSO | Embaladora Kit Parafusos N°2 | 22/12/2025 | 148 | 155 |
| TESTE INTERRUPTORES | Bancada N°1 - Teste Interruptores | 05/01/2026 | 116 | 135 |
| MONTAGEM PLACA REFINATTO | Prensa Placa Refinatto | 05/01/2026 | 95 | 199 |
| HORIZONTAL 1 | Embaladora Horizontal N°1 | 03/02/2026 | 273 | 16 |
| KIT 1 PARAFUSO | Embaladora Kit Parafusos N°1 | 22/04/2026 | 58 | 150 |
| VERTICAL PLACAS / SUP. 1 | Embaladora 4X2 Suportes/Placas N°1 | 30/04/2026 | 194 | 11 |
| VERTICAL MÓDULOS 2 | Embaladora Vertical Módulos N°2 | 21/05/2026 | 167 | 12 |
| VERTICAL MÓDULOS 1 | Embaladora Vertical Módulos N°1 | 29/05/2026 | 157 | 9 |
| 2 CONJUNTOS | Embaladora Vertical Conjuntos N°2 | 02/07/2026 | 106 | 10 |
| MÁQUINA DE PLUG AUTOMÁTICA | Máquina de Plugue Slin - AUMAQ | 09/07/2026 | 92 | 2 |
| PRENSA TOX | Prensa Tox | 20/07/2026 | **2** | 17 |
| MÁQUINA INTERRUPTOR | Máquina de Interruptores Composé N°1 | 21/07/2026 | 78 | 12 |
| INSERÇÃO DOS CONTATOS INTERRUPTOR | Prensa Inserção Contatos Interruptores | 27/07/2026 | **16** | 46 |
| 1 CONJUNTOS | Embaladora Vertical Conjuntos N°1 | 29/07/2026 | 74 | 5 |
| HORIZONTAL 2 | Embaladora Horizontal N°2 | 03/08/2026 | 67 | 4 |
| MÁQUINA DE TOMADAS AUTOMÁTICA | Máquina de Tomadas Composé - AUMAQ | 20/08/2026 | 34 | 4 |
| REBITAGEM PINOS | **Prensa Tox** (confirmado em 25/09) | 24/08/2026 | **9** | 7 |
| FECHAMENTO TECLA INTERRUPTORES | Bancada N°3 - Diversos | 27/08/2026 | **1** | 4 |
| MONTAGEM TOMADAS MANUAL | Bancada N°3 - Diversos | — | **0** | 0 |

**Duas colunas por centro, em dois casos.** A Bancada N°3 recebe
`FECHAMENTO TECLA` e `MONTAGEM TOMADAS MANUAL`; a Prensa Tox recebe
`PRENSA TOX` e `REBITAGEM PINOS`. Conferido: **não há colisão de data e
turno** em nenhum dos dois (Prensa Tox produziu só em julho, Rebitagem Pinos
só em agosto e setembro; Montagem Tomadas Manual nunca produziu). A junção
não perde nem sobrepõe nenhum registro.

**Um centro fica sem histórico:** a `BANCADA N°5 - ELETRÔNICOS` não tem coluna
na planilha. Começa a vida no sistema novo, sem passado.

##### O que não faz sentido levar adiante

- **`MONTAGEM TOMADAS MANUAL`: nada a importar.** Zero turnos com produção em
  nove meses de planilha. A coluna existe e está inteiramente vazia. Não é
  perda de dado: não há dado.
- **Zeros anteriores à entrada em operação: descartados**, como já dizia o
  item 8 da D35. São 2.663 células que significam "a máquina ainda não estava
  em Itajaí", não "produziu zero".
- **Zeros de centros por demanda: descartados.** Turno sem pedido não é
  parada. São os 283 da Bancada N°2, 199 da Placa Refinatto, 155 e 150 dos
  Kits, 135 da Bancada N°1, 90 da Bancada N°4 e 46 da Prensa Inserção.
- **Zeros de centros contínuos: viram turnos parados** (D36), com o motivo
  quando a planilha informa. São poucos e concentrados nas embaladoras: 34 da
  A Granél, 22 da 4X2 N°2, 16 da Horizontal N°1, 12 da Módulos N°2, 11 da 4X2
  N°1, 10 da Conjuntos N°2, 9 da Módulos N°1, 5 da Conjuntos N°1, 4 da
  Horizontal N°2, 4 da Tomadas, 2 da Plugue Slin.

##### O que vale a pena levar, mesmo sendo pouco

Quatro centros têm histórico curto demais para sustentar qualquer indicador,
mas o custo de importar é zero e o dado é real: Prensa Tox (2 turnos próprios
+ 9 da Rebitagem Pinos), Fechamento Tecla (1), Prensa Inserção Contatos (16) e
Bancada N°2 (10). Ficam no sistema como registro histórico, não como base de
média.

##### Pendência fechada em 25/09/2026

A folha de revisão perguntava sobre a `MANUAL INTERRUPTOR`: *"Produziu em
dez/jan e uma vez em 05/06; depois só zeros. Foi desativada?"*. Resposta do
usuário: **não foi desativada — ela é sob demanda**, e a produção dela vai
para o centro correspondente, a **Bancada N°2 - Montagem Interruptores**
(o mapeamento que já estava registrado).

Consequências:
- os **283 zeros são descartados** (turno sem pedido não é parada);
- a Bancada N°2 **não precisa de data de saída** de operação;
- os 10 turnos com produção entram normalmente no histórico dela.

Com isso **todas as pendências da D35 estão fechadas**: as 23 colunas têm
destino, as datas de entrada em operação estão confirmadas e os casos
especiais foram revisados um a um. O que falta é construir — área de preparo,
script de extração e carga em lote reversível.

#### D35.4 — Carga incremental, e o que o ensaio de 01/10/2026 encontrou

A primeira carga trouxe nove meses de uma só vez. A virada para produção pede
outra coisa: acrescentar o que a planilha ganhou **desde** a última carga, sem
reescrever o que já está no banco.

- **Decisão:** o extrator ganha `--desde` e `--ate`. O corte vale para o que é
  **emitido**, nunca para o que é **lido** — a planilha arrasta a última meta
  conhecida para a frente (item 9 da D35), e cortar a leitura cedo faria os dias
  novos nascerem sem meta. O id do lote passa a incluir a janela, para que dois
  recortes da mesma planilha sejam dois lotes distintos e reproduzíveis.
- **A descrição do lote passa a contar a janela real.** Estava fixa no período da
  primeira carga, o que fazia um lote incremental se descrever como se trouxesse
  os nove meses inteiros.

##### Rótulo de turno: espaços internos normalizados

Setembro/26 passou a escrever `"HORA EXTRA  1°"` — com **espaço duplo** e o turno
no fim. O rótulo era lido com `.trim()`, que só alcança as pontas, e a linha
inteira caía como "turno não reconhecido": **um sábado de hora extra, 18.144
peças em quatro centros, perdido por um espaço a mais**.

Agora os espaços internos são normalizados antes da consulta, e `HORA EXTRA 1°`
e `HORA EXTRA 2°` entram no mapa. Significam o mesmo que `HORA EXTRA` e
`EXTRA 1°T`, que o gestor já havia revisado.

##### Duas linhas da planilha com a data errada — resolvido em 01/10/2026

No pé da aba `SET 26` havia duas linhas com números de verdade e data que não
fechava. O gestor conferiu contra a planilha aberta e mandou o print:

| Linha | Data na planilha | **É, na verdade** | Como se provou |
|---|---|---|---|
| L53 | **vazia** | **30/09 T1** | 4.815 · 2.520 · 14.442 … fecha em **96.104** |
| L54 | 29/09 (já ocupado pela L48) | **30/09 T2** | 3.180 · 1.185 · 4.013 … fecha em **45.442** |

A conferência foi número a número contra o print do gestor: os dois totais são
exatamente os que a planilha mostra para o dia 30.

**Decisão:** a correção entra em `mapa.cjs`, na lista `DATAS`, **por linha e não
por célula** — o que está errado é a data da linha inteira, o resto dela está
certo. A correção é aplicada **antes** do arrasto da data, para que uma linha
corrigida também sirva de referência às de baixo que não trazem data própria.

Repetir a data para baixo continua sendo proposital (abril escreve a data só na
linha do T1). Não era a regra que estava errada — era a planilha que tinha linha
órfã.

**Efeito colateral bom:** a divergência de **25/08** (planilha 45 × banco 30)
desapareceu sozinha. Era inteiramente a L53 sem data caindo em agosto, porque as
linhas imediatamente acima dela eram sobras vazias de 24 e 25/08. Com a data
corrigida, 25/08 dá 30 — o mesmo que o banco.

##### `--turno`: completar um dia que entrou pela metade

O banco tinha só o T1 do dia 21/09: a exportação anterior foi tirada no meio do
expediente. Um dia pela metade é um dia errado em todo relatório.

Completar é aditivo — o T2 é turno diferente do que está lá, e a restrição
`unique (machine_id, production_date, shift_id, work_mode)` garante que nada se
sobrescreve. Mas `--desde` corta por **dia**: incluir o 21/09 reemitiria os 17
apontamentos do T1 e a carga abortaria na restrição.

Daí `--turno`, que existe só para este caso. Conferido antes de usar: a planilha
tem 17 no T1 e 13 no T2 do dia 21 — o T1 está completo no banco, e `--turno=2`
não deixa nada para trás.

##### Resultado da carga de 01/10/2026

Três lotes, todos reversíveis:

| Lote | Janela | Apontamentos | Peças |
|---|---|---|---|
| A | 22/09 a 28/09 | 133 | 927.624 |
| B | 21/09, turno 2 | 13 | 57.684 |
| C | 29/09 a 30/09 | 59 | 451.036 |

O banco foi de **2.507 para 2.712 apontamentos** e de 17.627.977 para
**19.064.321 peças**. Os 22 dias de setembro batem com a planilha, dia a dia,
sem exceção.

##### O que ficou de fora, por decisão do gestor

Uma divergência sobrou: **27/04 — a planilha produz 10 apontamentos e o banco tem
11**. O banco guarda um apontamento que a planilha de hoje não gera mais; algum
valor foi apagado ou editado desde a primeira carga.

O gestor decidiu em 01/10/2026 **ignorar as divergências anteriores a setembro**.
O registro fica aqui porque um dia alguém vai somar abril e achar 1 a mais.
### D36 — Atingimento × disponibilidade (máquinas contínuas e sob demanda)
- **Status:** Proposta (21/09/2026) — opção escolhida pelo usuário; **a classificação das máquinas precisa ser revisada pelo gestor**.
- **Contexto:** um turno com produção zero pode ser parada (máquina contínua) ou simplesmente falta de pedido (máquina sob demanda). Contar todo zero no atingimento castiga as máquinas sob demanda; ignorar todo zero esconde as paradas das contínuas.
- **Decisão:** dois indicadores separados.
  - **Atingimento:** mede só os turnos em que a máquina rodou ("quando roda, rende o esperado?").
  - **Disponibilidade:** só para máquinas **contínuas** — turnos em que rodou ÷ turnos programados, com os motivos das paradas ("ficou parada quando devia rodar?").
- **Cadastro:** cada máquina é marcada como **contínua** ou **sob demanda** (o gestor pode mudar depois). Sugestão inicial a revisar: contínuas = embaladoras (horizontais, verticais placas/suporte e módulos, a granel), conjuntos e máquina de plug; sob demanda = kits, Refinatto, Teste Interruptores, Montagem Diversos e demais montagens.
- **Na importação:** zeros de máquinas contínuas depois da entrada em operação viram **turnos parados** (com o motivo quando a planilha informa); zeros de máquinas sob demanda são ignorados.
- **No dia a dia:** máquina contínua sem apontamento num turno normal gera aviso ("Horizontal 1 sem apontamento no T2 de ontem"); quem aponta informa o motivo ou lança a produção esquecida.
- **Alternativas rejeitadas:** ignorar zeros em todas; contar zeros em todas; misturar paradas no atingimento das contínuas (um número só esconde se a máquina está lenta ou parada).
- **Relação:** amplia a D05 (paradas de máquina) — `machine_downtimes` passará a ter motivos como falta de material e falta de operador.

---

> **Fonte das decisões D37 a D43:** planilha `ITAJAÍ_TI_CAPACIDADE_VS_PESSOAS 2026_2027_REV01.xlsx` (atualizada em 09/09/2026) somada às confirmações do usuário em 25/09/2026. O desenho resultante está em `cadernos/07-mapa-da-fabrica.pdf`.

### D37 — Centro de trabalho e processo (montagem/embalagem)
- **Status:** Aprovada (25/09/2026).
- **Contexto:** o banco tem 18 "máquinas" numa lista plana, com nomes que não correspondem aos da fábrica. A planilha de capacidade mostra a fábrica organizada em dois processos, e o usuário confirmou: "cada nome é um centro de trabalho que deve ser contado e interpretado no contexto".
- **Decisão:** a ficha da máquina passa a representar um **centro de trabalho** e ganha o campo **processo**: `montagem` ou `embalagem`. São **22 centros ativos** — 13 em montagem, 9 em embalagem.
- **Por quê:** resolve três necessidades com um campo só — indicador por processo, parada de um setor inteiro no calendário com um evento (hoje exigiria um evento por máquina) e desambiguação de nomes (a "Embaladora Kit Parafusos" pertence a **montagem**, apesar do nome).
- **Alternativas rejeitadas:** grupo livre de máquinas criado pelo gestor (flexível demais para dois valores que a fábrica trata como fixos); nenhum agrupamento (mantém o problema das paradas de setor).
- **Custo:** um campo obrigatório a mais no cadastro. Se um dia a fábrica ganhar um terceiro processo, é um valor novo na lista, não uma migração.

### D38 — Metas reais e centros por demanda
- **Status:** Aprovada (25/09/2026). Substitui os valores de reserva do seed (`MACHINES_DEFAULT`, 150 a 600), que nunca foram reais.
- **Decisão:** **12 centros com meta** (peças por turno): Horizontais N°1 e N°2 **10.000**; 4x2 Suportes/Placas N°1 e N°2 **7.500**; Vertical Módulos N°1 e N°2 **13.000**; Vertical Conjuntos N°1 e N°2 **5.000**; A Granel **25.000 por pessoa**; Tomadas Composé–AUMAQ **12.500**; Plugue Slin–AUMAQ **6.500**; Interruptores Composé N°1 **4.500**.
- **10 centros por demanda**, sem meta (`has_target = false`), todos em montagem: Kit Parafusos N°1 e N°2, Bancadas N°1 a N°5, Prensa Inserção Contatos, Prensa Tox e Prensa Placa Refinatto. Motivo informado pelo usuário: são máquinas por demanda de fábrica, onde a meta não faz sentido.
- **Consequência que o gestor precisa saber:** o atingimento passa a falar de **12 centros, não de 22**. O número não fica pior nem melhor de propósito — fica sobre outra coisa. A produção dos 10 continua somando no total.
- **Relação:** confirma a classificação sugerida na **D36** (sob demanda = kits, Refinatto, Teste Interruptores, Diversos e demais montagens), que estava marcada como "a revisar pelo gestor".

### D39 — Base da meta: por turno ou por operador
- **Status:** Aprovada (25/09/2026).
- **Contexto:** A Granel é medida em **25.000 peças por pessoa no turno**; todas as outras são um número fixo por turno.
- **Decisão:** a meta ganha o campo **base**: `por_turno` (padrão, 11 centros) ou `por_operador` (A Granel). Quando a base é por operador, a meta efetiva do apontamento é `quantidade × número de operadores informado`.
- **Alternativa rejeitada:** guardar 25.000 como meta fixa e dividir depois na tela — some a intenção do dado e cada leitor precisa lembrar da exceção.
- **Custo:** o cálculo de atingimento deixa de ser uma comparação direta e passa a depender do número de operadores do apontamento, que hoje é opcional. Apontamento de A Granel **sem operadores informados** precisa cair na lotação padrão da máquina.

### D40 — Capacidade como alarme, não como cálculo da meta
- **Status:** Aprovada (25/09/2026).
- **Contexto:** a planilha calcula, por centro, `peças por minuto × tempo útil do turno = capacidade técnica`, e `× eficiência (0,60 a 0,90) = capacidade realista`. Era tentador derivar a meta desse número.
- **Decisão:** guardar **peças por minuto** e **eficiência** na ficha da máquina e usá-los **só como alarme** — meta acima da capacidade técnica é fisicamente impossível, e o sistema avisa no momento em que o gestor digita. A meta continua sendo digitada por ele.
- **Por que não derivar:** as metas acordadas ficam entre **62% e 86%** da capacidade técnica, sem fator único (Horizontais 62%, Placas 71%, Conjuntos 73%, Interruptores 77%, A Granel 79%, Módulos 83%, Plugue 83%, Tomadas 86%). Qualquer fórmula automática seria uma solução que só parece resolver.
- **Custo:** dois campos que alguém precisa manter atualizados. Desatualizados, o alarme fica errado — é o caso suspeito da Plugue Slin, cuja eficiência de 0,60 na planilha não bate com a meta acordada.

### D41 — Máquina planejada e data de entrada em operação
- **Status:** Aprovada (25/09/2026).
- **Contexto:** sete centros aparecem em amarelo na planilha — já previstos ou comprados, sem funcionamento real hoje: Interruptores (Nova Base), Plugue Fêmea, Tomadas N°2, Lufati Klin Padrão, Lufati PL+SUP 4x4, Vertical Plugues e Vertical Conjuntos N°3.
- **Decisão:** a situação da máquina ganha o valor **`planejada`**, e a ficha ganha uma **data de entrada em operação**. Centro planejado não aparece na tela de apontamento nem entra em nenhum indicador; antes da data de entrada, os turnos não são cobrados.
- **Por quê:** cadastrar hoje uma máquina que chega em março faria o indicador contar dezenas de turnos zerados de um equipamento inexistente. É o mesmo remédio do problema dos zeros antigos levantado na **D35**.
- **Alternativa rejeitada:** cadastrar só quando a máquina chegar — perde-se o planejamento e o cadastro vira correria no dia da instalação.

### D42 — Tempo útil por turno guardado no banco
- **Status:** Aprovada (25/09/2026).
- **Contexto:** os três turnos têm tempos bem diferentes. T1 04:55–14:18, **493 min úteis**; T2 14:18–23:24, **481**; T3 23:24–05:00, **271**. Os descontos são iguais nos três: 30 de refeição, 10 de ginástica laboral, 10 de intervalo e 15 de troca de turno e limpeza.
- **Decisão:** guardar **minutos brutos** e **minutos úteis** na ficha do turno agora, mesmo sem uso imediato. O horário continua informativo e **não precisa fechar por subtração** com o tempo útil: no T1, os 5 minutos entre 04:55 e 05:00 são entrada e preparação, não produção.
- **Por quê:** o T3 hoje só existe como hora extra, que já fica fora do cálculo de meta — então a regra atual (uma meta única, igual para os três turnos) não machuca ninguém. Quando o T3 virar turno normal, ele terá **271 minutos contra 493 do T1 (55%)** e nascerá reprovado com a mesma meta. Com o tempo útil já no banco, a correção vira uma conta; sem ele, vira migração de emergência.
- **Alternativa rejeitada:** esperar o T3 virar turno normal para tratar o assunto.
- **Pendente de propósito:** a regra de proporcionalidade (meta do turno = meta base × minutos úteis do turno ÷ minutos úteis do T1) **não** será implementada agora, só quando o T3 entrar em operação normal.

### D43 — Destino do histórico das máquinas renomeadas e divididas
- **Status:** Aprovada (25/09/2026).
- **Contexto:** três centros do banco não correspondem um-para-um aos 22 da fábrica. Máquina com produção **não pode ser apagada** — o caminho é inativar (D05) —, então renomear preserva o histórico — mas é preciso dizer para onde ele vai.
- **Decisão:**
  - `MONTAGEM TOMADAS MANUAL` e `FECHAMENTO TECLA INTERRUPTORES`, renomeadas e readequadas na fábrica, têm todo o histórico levado para **BANCADA N°3 — DIVERSOS**.
  - `MONTAGEM DIVERSOS`, que virou dois centros na fábrica (Bancadas N°3 e N°4), tem todo o histórico levado para **BANCADA N°4 — DIVERSOS**.
- **Custo assumido:** a produção antiga de três centros fica concentrada em duas bancadas e **não tem como ser separada depois** — a planilha nunca registrou essa distinção. Vale só para o passado; a partir da migração, cada bancada recebe o seu próprio apontamento.
- **Alternativas rejeitadas:** criar centros "legado" só para segurar o histórico (polui a lista de apontamento para sempre); descartar o histórico (perde produção real).

### D44 — A UI de `prototype/` é a interface oficial
- **Status:** Aprovada (26/09/2026).
- **Contexto:** o projeto passou a ter **duas interfaces**. A de `src/` está
  ligada aos dados reais (Apps Script e Supabase, atrás de `VITE_DATA_SOURCE`)
  mas é a antiga; a de `prototype/`, construída sobre um sistema de tokens com
  a marca WEG, é a que o usuário quer levar adiante — mas roda com dados
  fictícios e não conhece o banco.
- **Decisão:** a interface de `prototype/` é a **interface do sistema**, não um
  protótipo. A UI de `src/` será substituída por ela. A camada de dados de
  `src/lib/repositories/` é o que fica, e é para dentro da UI nova que ela vai.
- **O que NÃO muda agora:** o nome da pasta. Renomear `prototype/` mexe em mais
  de cem arquivos e quebraria qualquer branch em andamento. O nome é corrigido
  quando a transição começar de fato; até lá, o `README.md` da pasta avisa em
  letras grandes o que ela é.
- **Consequências:**
  - toda tela nova nasce em `prototype/`, não em `src/`;
  - `src/pages/` e `src/components/` passam a ser código com data de validade —
    consertar bug ali só se atrapalhar alguém hoje;
  - `src/lib/repositories/`, `src/contexts/AuthContext.tsx` e
    `src/lib/database.types.ts` continuam sendo a fonte da verdade sobre dados;
  - os dois modos (`gas` e `supabase`) precisam continuar funcionando durante a
    transição: o Apps Script ainda é o sistema em produção.
- **Alternativas rejeitadas:** levar a UI nova para dentro de `src/` agora (um
  único commit gigante, sem como testar em pedaços); manter as duas interfaces
  vivas (dobra o custo de toda mudança e garante que uma delas fica para trás).

#### D44.1 — O que a transição exige, em ordem

1. **`MACHINES_DEFAULT` em `src/lib/api.ts` está mentindo.** Ainda lista as 18
   máquinas antigas com metas inventadas (`HORIZONTAL 1` com meta 500). Hoje o
   app tem duas realidades: em modo `gas` mostra isso, em modo `supabase`
   mostra os 22 centros reais. É a primeira coisa a acertar — enquanto estiver
   assim, quem comparar as duas telas vai achar que o banco está errado.
2. **A UI nova precisa de uma camada de dados.** Nenhum arquivo de
   `prototype/src/` menciona Supabase, repositório ou `fetch`: são dados
   fictícios. Ligar é trocar as fontes fictícias pelas funções de
   `src/lib/repositories/`, tela por tela.
3. **Tela por tela, não tudo de uma vez.** A ordem sugerida segue o risco:
   apontamento (o que a fábrica usa todo dia), dashboard, metas, histórico,
   calendário, usuários, TV.
4. **Duas pendências do banco afetam telas que a UI nova vai reconstruir**, e
   valem antes: a **recuperação de senha** (não existe, e é o único que bloqueia
   o uso hoje) e a **meta por operador** da Bancada A Granél, que hoje aparece
   como 25.000 em vez de 25.000 × pessoas (D39).
   > **Atualização de 26/09/2026:** a recuperação de senha está feita no app
   > (**D45**); falta a configuração no painel do Supabase, que só o dono do
   > projeto pode fazer. A meta por operador continua pendente.

### D45 — Recuperação de senha pelo e-mail do Supabase Auth
- **Status:** Aprovada (26/09/2026) e **em uso desde 27/09/2026** — painel configurado e fluxo percorrido inteiro: pedir o link, receber o e-mail, definir a senha nova e entrar com ela.
- **Contexto:** no modo Supabase, quem esquecia a senha não tinha saída. A tela
  de login dizia "fale com o administrador", e o administrador também não tinha
  o que fazer: o Supabase Auth guarda só o hash da senha, e trocá-la exige ou a
  chave de administrador do projeto (`service_role`) ou o próprio usuário. Era o
  item apontado em **D44.1** como o único que bloqueava o uso hoje.
- **Decisão:** usar a recuperação por e-mail **do próprio Supabase Auth**
  (`resetPasswordForEmail` para pedir o e-mail, `updateUser` para gravar a senha
  nova). **Nenhuma tabela, função ou coluna nova** — o schema não muda.
- **Como fica para quem usa:** o cartão de login passa a ter quatro telas —
  entrar, criar conta, *pedir o e-mail de recuperação* e *definir a senha nova*.
  O link do e-mail abre direto na terceira. Depois de salvar, a pessoa entra com
  a senha nova, que assim é testada na hora.
- **Privacidade:** a resposta ao pedido é **sempre a mesma**, exista a conta ou
  não ("se existir uma conta com esse e-mail, o link foi enviado"). Dizer "essa
  conta não existe" contaria a qualquer estranho quem tem acesso ao sistema.
- **Detalhe técnico que custou código:** o app usa `HashRouter`, então o hash do
  endereço **é a rota**. O Supabase devolve o token no hash
  (`#access_token=...&type=recovery`), que não é rota nenhuma — sem tratamento, o
  link cairia na página "não encontrada". E quem lê o token é o `supabase-js`, no
  instante em que o cliente é criado. Por isso a chegada pelo link é resolvida em
  `src/lib/recovery.ts`, **antes de a tela montar** (chamado em `src/main.tsx`):
  ele cria o cliente de propósito, deixa o token ser lido, apaga o token do
  endereço e do histórico do navegador, e devolve o hash que o roteador espera.
  Também descarta o login antigo guardado neste navegador — senão o app abriria o
  dashboard e a tela de senha nova nunca apareceria.
- **Configuração feita em 27/09/2026** pelo dono do projeto, com os endereços de
  `/Dashboard-Tomadas/` (o repositório foi renomeado; ver o commit do caminho base).
  O fluxo foi percorrido inteiro e funciona.
- **O que exige configuração no painel do Supabase** (não dá para versionar, e
  sem isso a recuperação não funciona):
  1. **Authentication → URL Configuration:** a *Site URL* e a lista de *Redirect
     URLs* precisam incluir os endereços do app — `http://localhost:<porta>/Dashboard-Tomadas/*` (8080 é o padrão do projeto; no computador do dono roda em 8081 — libere a que for usada)
     em desenvolvimento e a URL publicada (`https://<usuario>.github.io/Dashboard-Tomadas/*`).
     Endereço fora da lista faz o Supabase devolver o link **sem** o token, e a
     tela mostra "o link expirou ou já foi usado".
  2. **SMTP próprio (Authentication → Emails):** o serviço de e-mail embutido do
     Supabase é só para teste — poucos e-mails por hora e, em projetos novos,
     entrega apenas para os endereços da equipe do projeto. **Enquanto não houver
     SMTP próprio, a recuperação não serve para a fábrica.**
  3. Opcional: traduzir para português o template *Reset Password*.
- **Modo `gas`:** não existe recuperação por e-mail — o Apps Script guarda a
  senha na planilha e não envia e-mail. A tela continua mandando falar com o
  administrador, e a camada de dados responde com esse mesmo aviso se alguém
  chamar a operação. Fingir que existe seria pior do que dizer a verdade.
- **Alternativas rejeitadas:**
  - **código de recuperação próprio numa tabela** — reinventa o que o Auth já
    faz e passa a guardar mais um segredo no banco;
  - **o gestor define a senha nova de quem pediu** — exigiria a chave
    `service_role` dentro do navegador, ou seja, a chave de administrador do
    banco na mão de quem abrir o DevTools. Inaceitável;
  - **só o dono trocar pelo painel** — não escala e deixa a fábrica dependendo
    de uma pessoa estar disponível.
- **Custo assumido:** o e-mail não é do sistema, é do Supabase. Entrega, spam e
  limite de envio passam a depender do SMTP configurado.

### D46 — Onde a meta por operador é resolvida
- **Status:** Aprovada (27/09/2026). Implementa no cálculo a **D39**, que só havia
  criado o campo.
- **Contexto:** desde 25/09 a meta da Bancada Embalagem A Granél está gravada
  como `basis = 'per_operator'` — 25.000 peças **por pessoa** no turno. Nenhuma
  parte do sistema lia esse campo: o apontamento copiava 25.000 e o dashboard
  comparava a produção do turno inteiro com esse número. Três pessoas na bancada
  produzindo 75.000 peças apareciam como **300% de atingimento**.
- **Decisão:** duas partes.
  1. **A base fica congelada no apontamento** (`production_records.target_basis`),
     ao lado da meta que já era congelada (D08). Apontamento antigo continua
     sendo lido como era, mesmo que a meta mude de base depois.
  2. **A multiplicação acontece na leitura**, na view `production_summary`
     (coluna nova `effective_target`). Se alguém corrigir o nº de operadores
     depois, a meta efetiva se corrige sozinha.
- **Quando o nº de operadores não foi informado:** cai na lotação padrão da
  máquina (D39); sem lotação padrão cadastrada, multiplica por 1 — o número cru,
  que é o menor palpite possível. Nunca por zero: meta zero significa "não conta
  para meta" no resto do sistema, e seria uma mentira diferente.
- **O histórico não foi recalculado.** Os 2.507 apontamentos importados (D35) e
  qualquer apontamento anterior a esta migration ficaram `per_shift`, que é o
  default da coluna nova. A planilha nunca distinguiu meta por turno de meta por
  pessoa, e inventar a distinção agora mudaria a história com base num palpite.
  **Custo assumido:** o atingimento histórico de A Granél continua inflado. É
  reversível — um `update` futuro corrige, se o gestor decidir qual era a
  intenção de cada mês.
- **Consequência que é dado, não código:** a lotação padrão de A Granél está
  cadastrada como **1 pessoa**. Enquanto for assim, o apontamento que não
  informar operadores continuará valendo 25.000. Ou a equipe informa quantas
  pessoas trabalharam — a tela de apontamento agora mostra a conta acontecendo
  (`25.000 × 3 = 75.000`) e cobra o campo quando está vazio —, ou o gestor
  corrige a lotação padrão da bancada.
- **Alternativas rejeitadas:**
  - **multiplicar na hora de salvar** (gravar 75.000 no apontamento): a conta
    fica velha assim que alguém corrige o nº de operadores, e a meta gravada
    deixa de ser comparável com a meta cadastrada;
  - **multiplicar em cada tela:** é exatamente o que a D39 rejeitou — cada
    leitor precisaria lembrar da exceção, e quem esquecesse mostraria 300% de
    novo;
  - **descobrir a base pela máquina, sem congelar:** um apontamento de março
    passaria a ser lido com a base de hoje;
  - **recalcular o histórico:** mudaria números já apresentados, sem ter como
    saber o que a planilha queria dizer.

### D47 — Onde a lotação do posto muda a meta
- **Status:** Aprovada (27/09/2026), pelo gestor, com a fábrica na frente.
- **Contexto:** a D39 tinha criado uma distinção só (meta por turno × meta por
  pessoa) e a D46 a colocou no cálculo. Ao revisar, o gestor esclareceu que a
  regra real tem **três** casos, e que o nº de operadores só interessa em dois
  postos:
  - **Bancada Embalagem A Granél** — trabalho manual: cada pessoa embala. Dobrar
    as pessoas dobra a produção, e a meta acompanha.
  - **Embaladoras Horizontais N°1 e N°2** — a linha precisa das 4 pessoas da
    lotação padrão para render as 10.000 do turno. Com 3 pessoas, render 7.500 é
    o esperado, **não um fracasso**.
  - **Todas as outras** — quem dita o ritmo é a máquina. Mais gente na volta não
    faz sair mais peça, e cobrar meta maior por isso seria errado.
- **Decisão:** `machine_targets.basis` (e a foto dela no apontamento) passa a ter
  **três** valores:

  | Base | O número gravado é | Meta do turno |
  |---|---|---|
  | `per_shift` | a meta do turno | o próprio número (padrão) |
  | `per_shift_prorated` | a meta do turno **com a lotação padrão** | número × pessoas ÷ lotação padrão |
  | `per_operator` | a meta de **cada pessoa** | número × pessoas |

  A conta do meio é a que a **D12** já calculava em `adjusted_target` desde
  20/09, como informação que ninguém usava. Agora ela vale como meta — **só onde
  a base disser**. É por isso que a base ganhou um terceiro valor em vez de a
  conta passar a valer para todas as máquinas.
- **Consequência na tela de apontamento:** o campo *nº de operadores* passa a
  aparecer **somente** nesses postos, e com a conta à vista
  (`10.000 com 4 · 3 pessoas no turno` → meta 7.500). Nos outros o campo sai da
  tela: perguntar algo que não muda nada só ocupa o operador.
- **Buraco consertado no caminho:** `save_machine_targets` — a função do botão
  *Salvar Metas* — gravava a meta nova **sem a base**, e a coluna tem default
  `per_shift`. Bastava o gestor corrigir o número de A Granél na tela para o
  "por pessoa" virar "por turno", sem aviso, e o atingimento voltar a mentir. A
  função passa a carregar a base que a máquina já tinha: **mudar o número nunca
  muda a regra de leitura.** Trocar a base é ato deliberado, e não tem tela.
- **Quando o nº de operadores não é informado:** cai na lotação padrão do posto,
  como na D39. Para a meta rateada isso dá exatamente a meta cheia — o palpite
  certo, porque "não informaram" não é "trabalharam sozinhos".
- **O passado não foi remendado:** as horizontais recebem um **degrau novo** de
  meta, válido de hoje em diante, com o mesmo número (10.000) e a base nova. Os
  turnos anteriores foram medidos com a régua antiga e continuam sendo lidos
  assim — mesmo princípio da D46.
- **Alternativas rejeitadas:**
  - **ratear a meta de toda máquina pela lotação** (usar `adjusted_target` para
    todos): puniria o posto onde o ritmo é da máquina — dois operadores numa
    máquina de um não produzem o dobro, e a meta cairia à metade quando um
    faltasse;
  - **transformar a meta das horizontais em "por pessoa" (2.500)**: o número que
    a fábrica conhece é 10.000 do turno; trocá-lo por 2.500 mudaria a conversa
    de todo mundo para ganhar nada;
  - **um campo novo em `machines`** (por exemplo `staffing_sensitive`): criaria
    duas fontes de verdade sobre como ler a meta, e a base já é a resposta dessa
    pergunta;
  - **pedir o nº de operadores em todas as máquinas** (o que a D12 permitia):
    dado que ninguém usa, num campo a mais na tela que a fábrica usa todo dia.

- **Como o app usa (30/09/2026):** a tela de apontamento busca a meta e a base
  **pela data apontada**, não pelas de hoje. Quem lança um turno atrasado teria
  gravado a foto errada — e foto de meta não se reescreve, então o erro ficaria
  para sempre. A consulta é `targets.getMetasEm(data)` na camada de dados; no
  modo Apps Script, que não guarda histórico de metas, devolve as de hoje.

### D48 — Zero operadores é "não informado", e a regra da meta é uma só
- **Data:** 27/09/2026 · **Status:** Aprovada · **Migration:** `20260927120000_zero_pessoas_nao_informado.sql` (0023)
- **Contexto:** a revisão da PR 23 achou a tela de apontamento (`src/lib/metas.ts`)
  e a view (`production_summary.effective_target`) fazendo contas diferentes:
  com **0 operadores**, a tela usava a lotação padrão e a view multiplicava por
  zero. Meta 0 quer dizer "não conta para meta", e o turno sumia do atingimento
  sem aviso. A coluna aceita 0 (`check >= 0`), então o caso acontece de verdade.
  Em outro caso-limite (meta por pessoa sem lotação padrão) a tela devolvia
  "desconhecida" e o banco multiplicava por 1.
- **Decisão:** uma regra só, igual nos dois lados, com teste nos dois lados
  (`src/test/metas.test.ts` e casos 13–14 de `supabase/tests/06`):
  pessoas = informadas **> 0**, senão lotação padrão **> 0**, senão nenhuma.
  Sem ninguém para contar, a meta por pessoa vale × 1 e a rateada vale cheia. A
  tela recebe o mesmo número, com a marca `estimada`, e continua pedindo o dado.
- **Alternativas rejeitadas:**
  - **proibir 0 com `check (operator_count > 0)`**: mudaria dados antigos da
    importação e recusaria um salvamento que hoje funciona;
  - **meta nula quando não há pessoas**: o app cai em `target_quantity` quando a
    coluna é nula, e o resultado seria o mesmo × 1, só que escondido.

### D49 — Teto na meta rateada pela lotação
- **Status:** Aprovada (30/09/2026).
- **Contexto:** a base `per_shift_prorated` (D47) rateia a meta do turno pela
  lotação: `meta × pessoas ÷ lotação padrão`. A fórmula não tinha limite. Numa
  horizontal com lotação padrão de 4, um turno com 5 pessoas gerava meta de
  12.500 em vez de 10.000 — bastava um reforço para a meta subir sozinha.
- **Decisão:** a meta para de crescer na lotação padrão.

  > meta efetiva = meta × **menor(pessoas, lotação padrão)** ÷ lotação padrão

  Com meta 10.000 e lotação 4: três pessoas dão 7.500, quatro dão 10.000, oito
  dão 10.000. Gente a **menos** continua reduzindo proporcionalmente; gente a
  **mais** não soma.
- **Por quê:** quem limita a produção é a **máquina**, não a quantidade de
  gente. Pôr uma quinta pessoa numa embaladora não a faz embalar mais rápido.
- **O teto é no número de pessoas, não no valor da meta.** Trocar a meta de
  10.000 para 15.000 não muda a regra, só a escala: três de quatro passam a dar
  11.250. E se a lotação padrão mudar de 4 para 5, o teto se move junto, porque
  a regra lê `machines.standard_operator_count`.
- **Não vale para `per_operator`.** Ali cada pessoa embala por conta própria (A
  Granél), então mais gente é mesmo mais meta, sem limite.
- **Alternativa rejeitada:** deixar sem teto. Faria sentido se a máquina não
  fosse o gargalo e pôr gente a mais realmente aumentasse o que sai — não é o
  caso das embaladoras.
- **Onde a regra vive:** em dois lugares, e eles mudam juntos (D48) — o `least`
  na view `production_summary` e o `Math.min` em `src/lib/metas.ts`, que é o que
  a tela usa para mostrar a meta antes de salvar. Divergirem significa a tela
  mostrar um número e o relatório outro.
- **Deixado de fora de propósito:** as colunas `adjusted_target` e
  `staffing_ratio`, da D12, que têm fórmula parecida e **não são lidas por
  nenhuma tela** hoje. Mexer nelas seria mudar o significado de um indicador que
  ninguém está usando. Candidatas a serem aposentadas numa limpeza futura.

### D50 — Migration encontra máquina por id, não por nome
- **Status:** Aprovada (30/09/2026).
- **Contexto:** a migration 0022 (D47) criou o degrau de meta das horizontais
  procurando-as pelo **nome**: `where name = 'EMBALADORA HORIZONTAL N°1'`.
  Funcionou, e está aplicada — mas é frágil de um jeito silencioso: se alguém
  renomear a máquina, a migration não encontra nada, **não dá erro**, e a meta
  simplesmente não é criada. Ninguém descobre até o indicador sair errado.
- **Agrava o risco:** este projeto **renomeia máquinas**. A migration 0014
  renomeou dezessete centros de uma vez, e a D43 prevê que isso volte a
  acontecer quando a fábrica reorganizar postos.
- **Decisão:** migration que precise apontar para uma máquina específica usa o
  **id**. O id é gerado pelo banco e nunca muda (D01); o nome é rótulo de tela e
  muda quando a fábrica muda.
- **Quando o nome for inevitável** — por exemplo, um dado externo que só traz o
  nome, como a importação da planilha —, a migration precisa **falhar alto** se
  não encontrar, em vez de seguir em silêncio:

  ```sql
  if not found then
    raise exception 'Máquina % não encontrada: a migration não pode continuar.', p_nome;
  end if;
  ```

- **A 0022 não se edita.** Já está aplicada, e reescrever migration aplicada é
  pior que conviver com ela. Conferido em 30/09/2026 que ela fez o que devia: o
  degrau `per_shift_prorated` existe para os ids 1 e 2, com meta 10.000 e
  vigência de 27/09/2026.
- **Alternativa rejeitada:** nada fazer. O custo de lembrar é zero enquanto
  alguém lembra; a decisão existe para quando ninguém lembrar.

### D51 — Aposentar o `_consolidado.sql`
- **Status:** Aprovada (30/09/2026).
- **Contexto:** `supabase/migrations/_consolidado.sql` juntava todas as migrations
  num arquivo só, para colar no SQL Editor e montar um projeto novo de uma vez.
  A geração era **manual**: cada migration nova precisava ser acrescentada a ele
  à mão, e ninguém lembrava. Ele parou na **v0.13.0** enquanto o schema chegou à
  **v0.19.3** — seis versões atrás.
- **O problema não é estar desatualizado, é mentir.** O arquivo se anuncia como
  "schema completo". Quem confiasse nele montaria um banco sem a meta por
  operador, sem as três bases, sem a área de preparo da importação — e acharia
  que estava certo, porque o script roda sem erro nenhum.
- **Decisão:** apagar o arquivo. Projeto novo se monta rodando as migrations de
  `supabase/migrations/` **em ordem de nome**, seguidas do seed estrutural. O
  `README.md` da pasta de documentação ganhou a seção com o passo a passo.
- **Por que isso já funciona:** o nome de cada migration começa com data e hora,
  então a ordem é óbvia; e todas são idempotentes, então rodar de novo não
  quebra. É o mesmo caminho que esta sessão usou para aplicar as 0021 a 0025.
- **Alternativa rejeitada:** gerar por script, juntando as migrations em ordem.
  Manteria a conveniência de um arquivo só, ao custo de mais um script para
  manter e lembrar de rodar — exatamente o tipo de passo que foi esquecido e
  produziu o problema atual. Um arquivo que ninguém regenera é pior que arquivo
  nenhum.
- **Consequência:** quem tinha o hábito de colar um arquivo só passa a colar
  vários. É mais trabalho uma vez por projeto novo, que acontece raramente.

### D52 — O nº de operadores é pedido em todo apontamento, e dá para apagar
- **Status:** Aprovada (30/09/2026). Ajusta a **D47**, que tinha escondido o campo.
- **Contexto:** quando as três bases entraram (D47), o campo "nº de operadores"
  passou a aparecer **só** nas máquinas cuja meta depende da lotação — A Granél e
  as horizontais. A ideia era não ocupar a tela do operador com uma pergunta que
  não muda nada. O efeito colateral: nas outras vinte máquinas o número deixou de
  ser coletado, e com ele o indicador de presença do time (**D12**), que compara
  quantas pessoas estavam no posto com a lotação padrão.
- **Decisão:** o campo volta em **todas** as máquinas. Onde a meta depende da
  lotação, ele muda o número; onde não depende, fica registrado — e o texto de
  ajuda diz isso, para ninguém achar que digitar ali mexe na meta.
- **Custo assumido:** mais um campo para preencher em todo turno. Continua
  opcional: vazio não impede salvar.
- **E dá para apagar.** `save_production_record` gravava com
  `coalesce(p_operator_count, operator_count)`: quem digitasse 3 por engano e
  limpasse o campo não conseguia desfazer, porque a tela mandava "nada" e "nada"
  queria dizer "mantenha o que está lá".
- **Como o nó foi desatado:** um valor só — nulo — precisava dizer duas coisas
  diferentes. A saída usa o que a **D48** já tinha decidido, que **zero é "não
  informado"**:

  | O que chega | O que acontece |
  |---|---|
  | nada (nulo) | mantém o que estava |
  | zero | apaga |
  | um número | grava |

  A tela manda **zero** quando o campo está vazio, em vez de omitir o parâmetro.
- **Por que grava nulo e não zero:** nulo é o que o resto do banco entende como
  ausência — a view já usa `nullif(operator_count, 0)`. Deixar dois valores
  significando a mesma coisa em lugares diferentes é pedir confusão.
- **Alternativa rejeitada:** um parâmetro à parte, tipo `p_apagar_operadores`.
  Resolveria, ao custo de mais um argumento numa função que já tem oito, e de
  uma regra a mais para lembrar. Reusar o zero aproveita uma decisão que já
  existia.

### D53 — A base da meta é definida pelo app, junto com o valor
- **Status:** Aprovada (30/09/2026).
- **Contexto:** as três bases (D47) existiam no banco desde a 0022, mas **só
  mudavam por SQL**. Máquina nova sempre nascia `per_shift`, e trocar a base de
  uma existente exigia alguém com acesso ao banco escrevendo um `insert` à mão.
  A aba Metas já edita o valor e já respeita a vigência ("vale a partir de") —
  falta uma coluna ao lado, com as três opções.
- **Decisão:** a base entra como parâmetro **opcional** da
  `save_machine_targets`, a mesma função que o botão "Revisar e salvar" já
  chama. A `create_machine` ganha o mesmo parâmetro, para máquina nova já nascer
  com a base certa.
- **Por que junto, e não numa função separada:** meta e base mudam na mesma
  vigência. Numa chamada só elas entram na mesma transação, e não existe o
  estado intermediário de "a meta mudou mas a base ainda não" — que seria uma
  meta lida do jeito errado até a segunda chamada chegar.
- **Quem não informar base não muda nada.** Máquina que não aparecer no
  parâmetro mantém a base que tinha. Era o buraco que a 0022 tapou: antes,
  bastava o gestor editar a meta de A Granél para ela deixar de ser por pessoa,
  sem aviso nenhum.
- **Mudar a base cria um degrau novo**, com a data em que passa a valer (D13).
  O passado nunca é reescrito: os apontamentos antigos guardam a base que valia
  no dia deles (D46). E salvar um valor idêntico ao atual **não** cria degrau —
  isso encheria o histórico de metas de movimento sem nada ter acontecido.
- **Continua exigindo `targets.manage`**, como qualquer mudança de meta.
- **Alternativas rejeitadas:** uma RPC `set_machine_target_basis` separada (duas
  chamadas para uma mudança só, com estado intermediário errado); e mudar o
  formato do parâmetro de metas para `{"1": {"meta": 500, "base": "..."}}`, que
  quebraria quem já chama.

#### D53.1 — Armadilha do PostgreSQL encontrada aqui
Acrescentar um parâmetro **com valor padrão** a uma função **não a substitui**:
cria uma segunda, com outra assinatura. As duas passam a existir, e a chamada
antiga vira erro:

```
function public.save_machine_targets(jsonb, date) is not unique
```

Toda migration que acrescentar parâmetro precisa **derrubar a assinatura antiga**
antes (`drop function if exists ... (tipos antigos)`).

E função criada do zero nasce executável por **qualquer um, inclusive anônimo** —
diferente do `create or replace`, que preserva as permissões. As duas funções
checam permissão por dentro, então uma chamada anônima falharia; mas deixar a
porta destrancada porque há um cadeado atrás dela não é o padrão deste banco. A
migration revoga de `public` e `anon`, e concede a `authenticated`.

### D54 — Nº de operadores obrigatório onde a meta é por pessoa
- **Status:** Aprovada (01/10/2026).
- **Contexto:** o gestor confirmou que a lotação padrão da A Granél é **1** —
  e que o posto **tem rotatividade constante de pessoas**. As duas coisas
  juntas são o problema. A meta ali é por pessoa
  (`meta_cadastrada × nº de pessoas`), e quando ninguém informava o número a
  função preenchia com a lotação padrão. Um turno de 3 pessoas era comparado
  com a meta de uma, e a máquina aparecia com 300% sem ninguém desconfiar.
- **A evidência:** dos 289 turnos importados da A Granél, nenhum tem o número.
  A produção deles, dividida pela meta de uma pessoa, se espalha assim:

  | Produção sugere | Turnos | |
  |---|---|---|
  | menos de 1 pessoa | 118 | 40,8% |
  | 1 a 2 pessoas | 123 | 42,6% |
  | 2 a 3 pessoas | 38 | 13,1% |
  | 3 ou mais | 10 | 3,5% |

  Com essa dispersão não dá para separar "turno fraco" de "tinha menos gente".
- **Decisão:** `save_production_record` passa a **exigir** o número quando a
  base da meta daquela máquina, naquela data, é `per_operator`. Também recusa
  **apagar** o número (o `0` da D52) nessas máquinas — senão bastaria esvaziar
  o campo para voltar ao problema de origem.
- **Só nessa base, e por quê:** em `per_shift` o campo não entra na conta; em
  `per_shift_prorated` esquecer é **conservador**, porque a meta fica a cheia e
  nunca maior. Só em `per_operator` o esquecimento deixa a meta pequena demais
  e o atingimento grande demais, em silêncio.
- **Alterar sem mandar o número continua permitido.** "Não veio no pedido"
  ainda quer dizer "mantém o que estava" (D52): recusar aí impediria corrigir
  uma observação sem redigitar a lotação.
- **O passado fica como está, e é lido como 1 pessoa.** Decisão explícita do
  gestor. Os 289 turnos importados não têm o número e nunca vão ter — a
  planilha nunca teve essa coluna (D35). O `coalesce(...,
  standard_operator_count, 1)` da `production_summary` **fica**, e passa a
  valer só para eles. Em consequência, **o atingimento da A Granél anterior à
  virada é informativo, não medição** — ninguém deve tirar conclusão de 2026
  achando que está comparando desempenho.
- **Por que na função e não numa restrição ou gatilho:** `production_records`
  só tem política de `select`, então a RLS já impede escrita direta — as
  funções são a única porta. Uma restrição `check` também teria de nascer
  `not valid` para não brigar com os 289 turnos antigos, e restrição
  `not valid` é a que todo mundo esquece que existe.
- **Alternativas rejeitadas:** deixar opcional e só avisar na tela (o aviso se
  ignora, e o número errado fica para sempre no histórico); e inferir o número
  de pessoas a partir da produção (seria inventar dado, e a dispersão acima
  mostra que nem daria para inferir com honestidade).

### D55 — O banco de testes vira o banco de produção
- **Status:** Aprovada (01/10/2026). Não substitui a D28 — aquela decide outra
  coisa (recriar `shifts`). O que esta fecha é a **pendência** dela: *"A
  confirmar: qual é o projeto oficial"*.
- **Contexto:** a D28 previa criar um projeto oficial separado para a virada.
  Chegada a hora, o projeto de testes já era o estado final: 28 migrations,
  os 22 centros com as metas confirmadas pelo gestor, 2.712 apontamentos
  conferidos dia a dia contra a planilha, 28 feriados e a conta do
  administrador. O gestor criou um projeto novo e perguntou se não era mais
  fácil seguir no atual.
- **Decisão:** seguir no atual. O projeto novo foi descartado.
- **Por quê:** instalar do zero produziria exatamente o estado que já existe,
  e cada repetição é uma chance nova de errar — inclusive nas duas armadilhas
  de ordem registradas em `supabase/INSTALAR.md`, uma das quais falha **em
  silêncio** e deixaria o administrador sem permissão de importação.
- **O que foi conferido antes de decidir:**

  | | |
  |---|---|
  | Região | **us-east-2 nos dois** — não havia ganho de latência |
  | Plano | **free nos dois** — não havia ganho de recurso |
  | Dados inventados | **zero**: os 2.712 apontamentos vieram todos da planilha, em 4 lotes rastreáveis, e nenhum foi digitado à mão |
  | Resíduo de teste | 4 contas, 3 já bloqueadas; a 4ª (`teste02`) foi removida pelo gestor, sem deixar perfil órfão |

- **Limpeza feita:** o projeto foi renomeado no painel, e a conta de teste
  ativa removida. As três contas bloqueadas ficam: duas são fixtures
  `@example.com` e a terceira é a conta antiga do gestor, que segura o crachá
  `11145-antigo` (D54 registra o conflito).

#### D55.1 — A consequência do plano free: não há backup

O plano gratuito do Supabase **não faz backup automático**, e PITR é recurso
pago. A partir da virada este banco passa a ser a única cópia da produção da
fábrica — a planilha congela e vira consulta.

**Isso é incompatível com produção e precisa de decisão do gestor.** As saídas:

| Saída | Custo | O que dá |
|---|---|---|
| Plano Pro | ~US$ 25/mês | backup diário automático, 7 dias de retenção |
| Backup próprio | zero | um script exporta as tabelas periodicamente para arquivo |

Espaço **não** é o problema: o banco tem 26 MB, dos quais 10 MB são a área de
preparo da importação e a auditoria. Os apontamentos crescem ~286 por mês, uns
poucos MB por ano, contra um limite de 500 MB.

O problema é só a ausência de cópia. **Backup que nunca foi restaurado não é
backup** — qualquer que seja a saída escolhida, a restauração precisa ser
ensaiada antes da virada.

### D56 — A UI antiga sai; a virada vai com a interface nova
- **Status:** Aprovada (03/10/2026), pelo gestor. Complementa a D44.
- **Contexto:** a D44 fez da interface de `prototype/` a oficial, mas as telas
  antigas de `src/` continuavam no repositório, e o plano de virada de 01/10
  previa abrir com elas, porque eram as únicas que já gravavam no banco.
- **Decisão:** o projeto ainda não foi para produção e as telas antigas não têm
  uso. Elas saíram do repositório (PR #27), a interface nova passa a ser
  publicada na raiz do Pages, e **a virada vai com ela**.
- **O que fica em `src/`:** só a camada de dados (`src/lib/**`) e os testes dela,
  que a interface nova usa.
- **Consequência para a data da virada:** a interface nova ainda só lê. A
  virada passa a depender de ela gravar apontamento, histórico, metas,
  calendário e máquinas — não só do banco.
- **Pendências registradas pela interface** (sem pressa): o cache de `api.ts`,
  `completeOnboarding` e as funções só do Apps Script podem sair; renomear
  `prototype/` fica para uma PR combinada.

### D57 — O nº da OP é só números, até 15
- **Status:** Aprovada (03/10/2026). Migration 0029.
- **Contexto:** enquanto não havia OP de verdade, o banco aceitava qualquer
  texto, até vazio (D35). A interface nova pede a OP em todo apontamento.
- **Decisão do gestor:** só números, no máximo 15 dígitos. Espaço nas pontas é
  tirado; vazio, letra e símbolo são recusados.
- **Onde:** em `insert_production_orders`, a única porta de escrita do app
  (`production_orders` só tem política de leitura). O histórico `IMPORTADO`
  não passa por ela e fica como está.
- **Alternativa rejeitada:** restrição `check` — teria de nascer `not valid`
  para conviver com o histórico (mesmo raciocínio da D54).
- **Em aberto:** o formato real da OP na WEG tem um tamanho fixo? Se tiver, o
  limite pode virar exato; hoje é "até 15".

### D58 — Os números de capacidade não são sigilosos
- **Status:** Aprovada (03/10/2026), pelo gestor.
- **Contexto:** o simulador de capacidade da interface usava valores
  fictícios, por tratar peças/minuto, eficiência e lotação como sigilosos.
  Os valores reais, porém, já estavam no banco e no seed, que é público.
- **Decisão:** não são sigilosos. O simulador pode ler do banco os valores
  reais, e o seed continua no repositório como está.
- **Consequência:** a próxima etapa é o contrato entregar `pieces_per_minute`,
  `efficiency` e `started_on` da máquina, e os tempos dos turnos. A lotação por
  turno e os descontos de cada turno (refeição, ginástica, pausa, troca) ainda
  não existem no banco.

### D59 — Mover um apontamento de dia leva a meta junto; o importado guarda a da planilha
- **Status:** Aprovada (03/10/2026), com o gestor. Migration 0030.
- **Contexto:** a tela de Histórico da interface nova corrige um apontamento,
  inclusive a data. Ao conferir as funções, apareceu um defeito: mover de dia
  não atualizava a meta, e o apontamento ficava comparado com a meta do dia
  antigo. Como cada apontamento guarda uma foto da meta do seu dia (D08), mudar
  o dia tem de mudar a foto.
- **A armadilha que impediu a correção ingênua:** antes de 25/09/2026, a linha
  do tempo de metas do banco guarda os valores de reserva do app antigo (500,
  600, 160), que nunca foram reais (D38). As metas verdadeiras daquela época
  estão na foto de cada apontamento importado, vindas da planilha. Recalcular
  um importado trocaria, por exemplo, 7.000 por 500.
- **Decisão:**
  - apontamento feito pelo app → ao mudar de data, pega a meta e a base do dia
    de destino;
  - apontamento importado → mantém a meta da planilha;
  - trocar só o turno não mexe na meta (ela é do dia, não do turno).
- **Por que a regra continua certa no futuro:** se a linha do tempo antiga for
  corrigida um dia, o recálculo de um importado daria o mesmo valor da planilha.
  A exceção deixaria de ser necessária, mas não ficaria errada.
- **Junto, porque a mesma função estava desatualizada:** `update_production_record`
  passou a seguir D52, D54 (na data final) e D57. E corrigir a quantidade de um
  importado não exige trocar a OP `IMPORTADO` — sem isso nenhum número do
  histórico seria corrigível.
- **Alternativa rejeitada:** recalcular sempre, inclusive os importados. Trocaria
  metas reais da planilha por valores de reserva.
- **~~Em aberto~~ Resolvido pela D60:** a linha do tempo de metas anterior a
  25/09/2026 continua com os valores de reserva. Isso aparece em dois lugares
  para o usuário: o histórico de metas (`getHistory`) mostra os degraus de
  reserva, e `getMetasEm` de uma data antiga devolve 500. Corrigir é trocar esses
  degraus pelos reais, derivados da planilha — decisão do gestor, porque reescreve
  a linha do tempo (D13).

### D60 — A linha do tempo de metas antes de 25/09/2026 vem da planilha
- **Status:** Aprovada (03/10/2026), pelo gestor. Migrations 0031 a 0033.
- **Contexto:** os 18 degraus anteriores a 25/09 eram valores de reserva do app
  antigo (150 a 600), que nunca foram reais (D38). As metas verdadeiras daquela
  época estavam gravadas em cada apontamento importado, vindas da planilha.
- **Decisão:** reconstruir a linha do tempo a partir dessas metas. Para cada
  máquina, um degrau começa no primeiro dia de cada valor diferente. Os degraus
  de 25/09 em diante, que são as metas acordadas, não mudam.
- **Por que não fere a D13:** a D13 protege o que foi meta de verdade, para um
  mês fechado continuar batendo. Os degraus de reserva nunca foram meta de
  ninguém. E nenhum apontamento muda de meta por causa disto: eles são a fonte.
- **Uma função, e não valores escritos na migration:** numa instalação do zero
  as migrations rodam antes da importação. A função é chamada de novo depois de
  cada carga de histórico (`INSTALAR.md`, passo 5).
- **O que a reconstrução revelou:** duas células de retrabalho em texto tinham
  recebido a meta do dia da importação. Dois turnos foram corrigidos pela regra
  `planilha_arrastada` (0032), e o extrator também.
- **E um defeito dela mesma:** na 0031 uma máquina sem histórico e sem meta
  acordada ficou sem degrau nenhum. A 0033 só apaga os degraus antigos de quem
  tem o que pôr no lugar, e devolveu o degrau perdido a partir da auditoria.
- **Consequência para a D59:** a exceção dos importados ao mover de dia continua,
  mas deixou de ser necessária. Hoje o recálculo daria o mesmo valor.
- **Alternativa rejeitada:** apagar os degraus de reserva e não pôr nada no
  lugar. Antes da primeira meta acordada não haveria meta nenhuma, e os
  apontamentos antigos não teriam com o que ser comparados.

### D61 — Calendário: vários dias numa operação só, com abrangência
- **Status:** Aprovada (04/10/2026). Migration 0035.
- **Contexto:** a tela de Calendário da interface cadastrava um intervalo (férias
  coletivas, ponte) como uma chamada por dia. Se uma falhasse no meio, as
  anteriores ficavam, e o calendário ficava pela metade sem ninguém pedir. E
  tudo entrava como "da empresa", embora o gestor vá cadastrar os feriados de SC
  e de Itajaí (decisão de 03/10: ele mesmo cadastra, pelo site).
- **Decisão:** uma função que recebe a lista de dias e grava tudo ou nada, com a
  abrangência (`national`, `state`, `municipal`, `company`) que a coluna `scope`
  já aceitava desde a criação da tabela.
- **Por que função, e não `insert` direto da tela:** só uma função consegue ser
  tudo ou nada numa chamada só da API. As permissões são as da RLS: `calendar.manage`.
- **Alternativa rejeitada:** `addHoliday` com `dateTo`. Uma lista de dias
  deixa a tela pular sábado e domingo, ou escolher dias soltos, sem o banco
  precisar saber dessas regras.
- **O que a tela afirma, e foi conferido:** o feriado não muda o cálculo da
  meta, e a produção dele conta; o dia anulado tira o dia ou o turno da meta,
  inclusive de apontamentos já feitos, porque `is_excluded_day` é calculado na
  leitura da `production_summary` (D16).

### D62 — A OP passa a existir por si, com o terreno pronto para o SAP
- **Status:** Aprovada (04/10/2026). As quatro regras de negócio são do gestor. Migration 0036.
- **Contexto:** a OP era só um número em cada linha de apontamento (D09). As
  telas de OPs e de Feedbacks tratam a OP como coisa própria. Era a maior lacuna
  do banco para a interface nova.
- **Regras do gestor:**
  1. **Origem:** por enquanto o distribuidor cadastra a OP no app. O objetivo é
     puxar do SAP. → coluna `source` e uma função de carga (`importar_ops_do_sap`)
     prontas, para a integração ser só "mandar a lista".
  2. **OP não cadastrada no apontamento:** entra, e a OP nasce "a conferir"
     (`pending_review`). Não trava o chão de fábrica se a liberação atrasar.
  3. **Material:** pertence à OP, não ao apontamento.
  4. **Conversa:** como a tela desenha. O operador não entra, mas a observação
     dele no apontamento aparece na conversa.
- **Decisões de desenho tiradas da tela:** as passagens de situação são as que
  a tela oferece (liberar, pausar com motivo, retomar, concluir, reabrir); cada
  uma vira mensagem do sistema; OP concluída encerra a conversa.
- **Ligação pelo número, sem chave estrangeira:** o histórico tem 2.713 linhas
  `IMPORTADO`, que não são OP nenhuma (D57).
- **SAP manda nos dados, a fábrica manda na situação:** uma OP em produção não
  volta para "aguardando" porque o SAP a mandou de novo.
- **A observação do operador não é copiada para a conversa:** a view junta as
  duas na leitura. Copiar criaria duas versões do mesmo texto, que divergiriam
  quando a observação fosse corrigida no Histórico.
- **Permissão nova `work_orders.manage`:** a tela usava `feedbacks.view` para
  as OPs porque só lia. Cadastrar e mudar a situação é outra coisa, e o gestor
  disse que é o distribuidor quem cadastra.
- **Em aberto:** a mesma OP apontada em outra máquina não é barrada. A OP
  continua na máquina em que foi cadastrada.

### D63 — Cadastro completo de máquinas: meta 0 é por demanda, linha obrigatória, editar
- **Status:** Aprovada (05/10/2026), pelo gestor, respondendo às três perguntas da
  interface (nota 2026-10-04-cadastro-de-maquinas.md). Migration 0037.
- **Decisões:**
  1. **Meta 0 sem dizer o contrário = por demanda.** "Com meta" e meta zero se
     contradizem (D38). As duas combinações contraditórias são recusadas, em vez
     de o banco escolher uma por conta própria.
  2. **A linha (montagem ou embalagem) é obrigatória.** Sem ela a máquina some
     dos agrupamentos por linha.
  3. **Nome, linha e lotação se editam** por uma função. Meta e base, não: têm
     vigência e histórico (D13, D53), e mudam pela tela de Metas.
- **A linha obrigatória em dois passos:** a tela de Cadastro já estava na `main`
  com o contrato antigo, que não manda a linha. Exigir no banco de uma vez a
  quebraria, e ela é da outra sessão. O contrato novo exige já; o banco passa a
  exigir quando a tela trocar.
- **A lotação não se apaga pela edição:** é o divisor da meta rateada (D47) e o
  valor de reserva da meta por pessoa (D54). Só se troca por outro número.
- **E a base rateada exige lotação no cadastro**, pelo mesmo motivo.

### D64 — O Google Apps Script e o Dash antigo saem do repositório
- **Status:** Aprovada (05/10/2026), pelo gestor.
- **Contexto:** o repositório guardava o `Main.gs` (Google Apps Script) e uma
  camada de dados que falava com ele (`gas.ts`, `api()`), que era o padrão
  quando nenhuma fonte era escolhida. A conferência de 05/10 mostrou que:
  - o `Main.gs` não tem tela própria: é só uma API, e a única tela dele era o
    app antigo;
  - o app antigo saiu do ar em 03/10 (D56), e a publicação nem aceita mais o
    Apps Script como fonte;
  - **a fábrica não usava nenhum dos dois**: a produção é registrada à mão na
    planilha `.xlsx`, e foi dela que veio todo o histórico do banco (D35).
- **Decisão:** tirar o Apps Script e todo resquício do Dash antigo do
  repositório. Até a virada, a planilha `.xlsx` é a fonte da produção, e entra
  no banco pelo extrator (carga incremental, D35.4).
- **O que saiu:** `Main.gs`; `src/lib/repositories/gas.ts`; o endereço do
  script, a sessão e o cache do app antigo em `src/lib/api.ts` (que ficou só com
  os tipos); as operações que só o Apps Script tinha (criar usuário pelo
  painel, redefinir senha pelo painel, código de convite, apresentação inicial,
  configuração de alertas). O padrão da camada de dados passou a ser o Supabase.
- **O que ficou, de propósito, e por quê:**
  - **o literal `"gas"` no tipo `DataSourceKind`, e três campos marcados
    `@deprecated`** (`inviteCode`, o cadastro que "entrava direto" e
    `onboardingDone`): a interface ainda tem ramos "se for Apps Script" em oito
    arquivos. Tirar os tipos agora quebraria a compilação dela, e os arquivos
    são da outra sessão. Saem quando ela tirar os ramos;
  - **os formatos de resposta herdados do Apps Script** (status "ativo",
    turno "TURNO 1", data em texto): a interface converte a partir deles.
    Simplificar é mudança de contrato a combinar com ela;
  - **o registro histórico**: decisões, ata de mudanças e notas antigas citam
    o Apps Script, e decisão antiga não se apaga.
- **A permissão `alerts.manage`** continua no catálogo do banco, sem função
  por trás. Fica para quando houver alertas de verdade.

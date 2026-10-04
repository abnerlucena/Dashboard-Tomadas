# Plano de virada — do Apps Script para o Supabase

> Rascunho de 01/10/2026, escrito pelo lado do **banco**, a pedido do gestor.
> A ideia original: congelar na sexta, carregar no fim de semana, abrir na
> segunda. A ideia está certa. As datas e dois pontos de atenção abaixo.
>
> **Revisado no fim do dia 01/10** com as respostas do gestor: sete contas em
> vez da fábrica inteira, e-mail pessoal por enquanto, conferência contra o
> arquivo dos distribuidores. O SMTP da WEG deixou de ser caminho crítico.
>
> **A data não está decidida** — depende do ensaio do extrator (§ 3).

---

> **Atualizado em 03/10/2026 — este § 1 deixou de valer (D56).** As telas
> antigas saíram do repositório e a virada vai com a interface nova. Abrir
> passa a ser cadastrar no GitHub a variável `DATA_SOURCE=supabase` e os
> segredos `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A data agora depende
> também de a interface nova gravar (apontamento, histórico, metas, calendário
> e máquinas). O texto abaixo fica como registro do raciocínio de 01/10.

## 1. ~~A virada vai com as telas ANTIGAS, não com a UI nova~~

A UI nova (`prototype/`) ainda não fala com o banco — a nota de
[direcionamento](2026-10-01-direcionamento-para-a-ui.md) lista o que falta.

As telas antigas (`src/`), em modo Supabase, **já falam**. Conferido hoje, o
adaptador não tem lacuna funcional:

| O que | Apps Script | `src/` em modo Supabase |
|---|---|---|
| Apontamento, ordens, retrabalho | sim | **sim** |
| Dashboard, histórico, relatórios | sim | **sim** |
| Metas com vigência | não (meta plana) | **sim, melhor** |
| Calendário de paradas | sim | **sim** |
| Feedbacks | sim | **sim** |
| Usuários e aprovação | sim | **sim** |
| Alertas por e-mail | **não existe** | não existe |

Ou seja: a virada não perde função nenhuma, e ganha o histórico de metas, a
auditoria e o nº de operadores. A UI nova entra depois, sem segunda virada —
troca de tela, não troca de banco.

**Consequência:** a sessão de UI **não é caminho crítico** da virada. Ela pode
trabalhar em paralelo sem pressa de data.

---

## 2. Contas: sete pessoas, e-mail pessoal por enquanto

> **Revisado em 01/10 com as respostas do gestor.** A versão anterior desta
> seção tratava o SMTP da WEG como caminho crítico. **Não é mais.**

São **sete contas**, não a fábrica inteira:

| Quantas | Perfil no banco | Tipo de conta | Crachá |
|---|---|---|---|
| 4 distribuidores | `distributor` — Distribuidor | pessoal | **obrigatório** |
| 2 gestores | `manager` — Gestor | pessoal | **obrigatório** |
| 1 Adm | `admin` — Admin | **compartilhada** | isenta |

Os três perfis **já existem** no banco (`supabase/seed/01_estrutural.sql`), com
as permissões prontas. O Distribuidor é exatamente quem aponta e edita em massa;
não precisa inventar perfil nenhum.

**D21: conta pessoal exige nº de crachá.** Então preciso dos **seis números de
crachá** antes do cadastro. A conta Adm é compartilhada e se identifica por
crachá a cada sessão (D23) — essa não precisa de e-mail pessoal.

### Com sete pessoas, o remetente embutido basta

O problema do remetente do Supabase é o limite de poucos e-mails por hora. Isso
derrubaria a fábrica se cadastrando na mesma manhã — **não derruba sete pessoas
cadastradas ao longo de uma semana.** A única regra prática: não tentar as sete
na mesma hora.

**A TI sai do caminho crítico.** O SMTP da WEG continua necessário **depois**,
quando o resto da fábrica entrar — não para abrir.

### Trocar o e-mail depois é seguro, e aqui está o porquê

O gestor perguntou se dá para entrar com Gmail e trocar para o e-mail WEG
depois. **Dá, e sem risco para os dados.**

O motivo é que **nenhuma tabela nossa guarda e-mail.** A `profiles` tem nome,
crachá, tipo de conta, status, perfil e aprovação — e-mail não está lá. O e-mail
vive só em `auth.users`, que é do Supabase, e a identidade de verdade é um
`uuid`.

```
   auth.users  ──uuid──▶  profiles  ──▶  apontamentos, aprovações, permissões
   (e-mail)                (nome, crachá, perfil)
      ▲
      └── trocar aqui não mexe em nada à direita
```

Trocar o e-mail muda **só com o que a pessoa faz login**. Histórico, permissões,
crachá, aprovações e autoria dos apontamentos ficam todos presos ao `uuid`, e
não se mexem.

**Como trocar, quando chegar a hora:** pelo painel do Supabase
(Authentication → Users → editar o e-mail). **Não** por `UPDATE` direto em
`auth.users`: aquelas tabelas são do Supabase e têm bookkeeping próprio
(confirmação, tabela de identidades) que um `UPDATE` cru deixa inconsistente.

O que a pessoa precisa saber no dia da troca: **ela passa a entrar com o e-mail
novo**. A senha continua a mesma.

---

## 3. A data: 05/10 voltou a ser possível

Sem a dependência da TI, a conta muda. O que falta é trabalho nosso, não espera
de terceiro:

| Falta | De quem | Tamanho |
|---|---|---|
| Projeto oficial + 27 migrations + admin + backup | banco | meio dia |
| 22 centros e metas acordadas | banco | junto com o acima |
| Feriados e paradas 2026/2027 | gestor | uma sentada |
| Confirmar a lotação de A Granél | gestor | uma resposta |
| 6 números de crachá | gestor | uma lista |
| 7 contas cadastradas, aprovadas e **testadas** | gestor + banco | ao longo da semana |
| **Ensaiar o extrator contra uma exportação nova** | banco | **precisa do .xlsx de hoje** |

**A única coisa que pode estourar é o ensaio do extrator.** Ele foi escrito
contra a planilha até 21/09; a de hoje tem linhas novas e pode ter coluna fora
de lugar. Esse ensaio tem de acontecer **antes** do congelamento.

| Se… | Então |
|---|---|
| o `.xlsx` atual chegar hoje e o ensaio passar | **congela sexta 02/10, abre segunda 05/10** |
| o ensaio achar problema, ou o .xlsx não chegar | **congela sexta 09/10, abre terça 13/10** |

O 13/10 continua sendo a opção mais folgada — três dias de janela, porque
**segunda 12/10 é feriado** (N. Sra. Aparecida). E o feriado ainda testaria o
cadastro de feriados: se o dia 12 aparecer como meta zero em vez de dia perdido,
está certo.

**Não é preciso escolher agora.** A escolha é o resultado do ensaio.

---

## 4. Roteiro

### Antes do congelamento — preparo (nada de produção é tocado)

| # | O quê | Quem |
|---|---|---|
| 1 | ~~Criar o projeto Supabase oficial~~ — **feito de outro jeito:** o projeto atual virou o de produção (D55), já com tudo carregado | — |
| 2 | Rodar as 27 migrations na ordem, do zero | banco |
| 3 | `select public.bootstrap_admin('<e-mail do gestor>');` | banco |
| 4 | Ligar **backup/PITR** e **ensaiar uma restauração** | banco |
| 5 | URLs de redirect do Auth (o SMTP da WEG fica para depois, § 2) | banco |
| 6 | Carregar os 22 centros e as metas acordadas | banco |
| 7 | Cadastrar feriados e paradas de 2026/2027, por turno | gestor |
| 8 | Confirmar a **lotação padrão de A Granél** (hoje está 1) | gestor |
| 9 | Os **6 números de crachá** e os 7 e-mails (pessoais servem, § 2) | gestor |
| 10 | Cadastrar, aprovar e **testar o login** das 7 contas | gestor + banco |
| 11 | **Ensaiar o extrator** contra uma exportação nova da planilha | **banco — primeiro de todos** |

O item 11 vem primeiro, não último: é o único que pode **mudar a data** (§ 3).
O extrator foi escrito contra a planilha até 21/09/2026; a de hoje tem linhas
novas e pode ter coluna fora de lugar. Descobrir isso **na sexta à noite** é o
jeito ruim de descobrir.

### Sexta, fim do T3 — congelamento

- Último apontamento entra no Apps Script.
- A planilha vira **somente-leitura** para todos (não apagar: é a prova).
- Exportar o `.xlsx` e guardar uma cópia com data no nome.

### Sábado — carga

Os quatro passos da importação, já construídos e reversíveis:

| Passo | O quê |
|---|---|
| 1 | Área de preparo (migration, já no banco) |
| 2 | `extrair.cjs` lê a planilha e escreve na preparo — **nada oficial ainda** |
| 3 | Carga da preparo para a produção |
| 4 | Conferência mês a mês |

Cada linha da preparo guarda **de qual célula da planilha veio**, com o conteúdo
original ao lado da interpretação. Divergência se rastreia até a origem, e o
**lote inteiro se desfaz** sem tocar no que a equipe já digitou.

### Domingo — conferência

Os distribuidores mantêm um **arquivo de controle feito à mão**. É a conferência
ideal: fonte independente, que não saiu da mesma planilha. O critério de
fechamento é a **data do mês** — o mês inteiro bate ou não bate.

**E o domingo não é prazo.** A reversão do lote **não expira na virada**: a
função `reverter_lote_importacao` apaga só o que o lote criou — o apontamento
importado carrega a marca `import_batch_id`, e o que a equipe digita à mão
nasce sem marca. Dá para desfazer e recarregar o histórico **na quarta-feira,
com a fábrica já apontando no sistema novo**, sem perder uma linha do que foi
digitado.

Isso tira a pressão da conferência. Ela pode ser feita com calma, mês a mês, na
semana seguinte.

### Segunda ou terça — abertura

- `VITE_DATA_SOURCE=supabase` no ambiente publicado.
- Alguém do banco acompanhando o **primeiro T1 inteiro**, de 04:55 às 14:18.
- O Apps Script fica de pé, **somente-leitura**, por pelo menos um mês.

---

## 5. Sem digitação dupla, e por quê

O gestor não quer digitação dupla, e está certo: dois lugares para o mesmo
número produzem duas verdades, e ninguém sabe qual vale. O corte é limpo.

O que substitui a rede de proteção:

- a planilha **continua legível** por um mês (consulta, não escrita);
- o lote da importação **se desfaz inteiro a qualquer momento**, sem tocar no que
  a equipe já digitou (ver o domingo, no § 4);
- o arquivo de controle dos distribuidores é a conferência independente;
- o `.xlsx` congelado na sexta é a prova do que existia na virada.

---

## 6. O que fica para depois da virada, de propósito

Nada disso impede abrir — mas vale estar dito, para ninguém descobrir sozinho:

| Item | Efeito de não ter |
|---|---|
| Material e motivo de retrabalho (lacunas 1 e 2) | o retrabalho entra como hoje: só a quantidade |
| D34 — painel de metas | o gestor edita metas na tela antiga |
| D36 — atingimento × disponibilidade | o indicador não desconta parada |
| Degraus históricos de meta | meses antigos usam a meta atual puxada para trás |
| UI nova | entra depois, sem segunda virada |

---

## 7. O que ainda falta o gestor mandar

As três perguntas de manhã foram respondidas (§ 2 e § 4). Ficaram três entregas:

1. **A exportação atual do `.xlsx`** — é o que decide 05/10 ou 13/10 (§ 3).
2. **Os 6 números de crachá** e os 7 e-mails (pessoais servem).
3. **Os feriados e paradas** de 2026/2027, por turno — e a confirmação da
   **lotação padrão de A Granél**, hoje cadastrada como 1.

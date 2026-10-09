# Copiar o banco da nuvem para um PostgreSQL comum, só com o pgAdmin

Leva o banco inteiro do Supabase da nuvem para um **PostgreSQL instalado
direto no servidor** (Windows ou Linux), **sem Docker**. Vão as tabelas, os
dados, as regras de acesso (RLS), as funções, os gatilhos e as contas de login
com as senhas criptografadas. Tudo pelo **pgAdmin**: um Backup na nuvem, um
Restore no servidor novo e uma conferência dos dois lados. Decisão **D68**.

> **Ensaiado em 09/10/2026.** Uma cópia de um banco montado com as 40
> migrations e o seed saiu com conferência idêntica, tabela por tabela. As 16
> suítes de `supabase/tests/` deram o mesmo resultado, caso a caso, no
> original e na cópia.

| Arquivo | Onde roda | Quando |
|---|---|---|
| `01_preparar_banco_novo.sql` | no banco **novo** | uma vez, antes do Restore |
| `02_conferencia.sql` | na **nuvem** e no banco **novo** | depois do Restore, para comparar |

---

## Antes de começar: o que esta cópia não resolve

O app (`prototype/`) não conversa com o PostgreSQL direto. Ele fala com o
**serviço de login** (GoTrue) e com a **API** (PostgREST), que no Supabase
vêm prontos. Esta pasta leva **o banco**, e o banco funciona sozinho: as
regras, as funções e as permissões estão todas nele. Mas, para o app usar este
PostgreSQL no lugar da nuvem, ainda faltam esses dois programas instalados no
servidor. **Enquanto eles não existirem, a produção continua na nuvem** (D65),
e a cópia serve de ensaio, de consulta e de backup fora do Supabase.

---

## O que é preciso

| Item | Detalhe |
|---|---|
| PostgreSQL | **a mesma versão principal da nuvem, ou mais nova.** Veja na nuvem com `select version();`. Em 10/2026 os projetos novos do Supabase estão no **17**. No Windows, o instalador oficial (EDB) já traz o pgAdmin |
| pgAdmin 4 | **versão 8 ou mais nova** (precisa da aba *Objects* no Backup) |
| Acesso à nuvem | os dados do *Session pooler*: no painel do Supabase, botão **Connect** → *Session pooler*. A senha do banco fica com quem administra o projeto. **Nunca a coloque no repositório** |

---

## Passo a passo

### 1. Registrar a nuvem no pgAdmin

*Object Explorer* → botão direito em **Servers** → **Register → Server…**

| Aba | Campo | Valor |
|---|---|---|
| General | Name | `Dash — nuvem` |
| Connection | Host | o host do *Session pooler* (ex.: `aws-0-us-east-2.pooler.supabase.com`) |
| | Port | `5432` |
| | Maintenance database | `postgres` |
| | Username | `postgres.<ref do projeto>` |
| | Password | a senha do banco; **deixe *Save password* desligado** num computador compartilhado |
| Parameters | SSL mode | `require` |

O endereço direto do banco (`db.<ref>.supabase.co`) só responde por IPv6.
Por isso o caminho é o *pooler*.

### 2. Fazer o Backup da nuvem

Em `Dash — nuvem` → **Databases → postgres** → botão direito → **Backup…**

| Aba | O que marcar |
|---|---|
| General | **Filename:** por exemplo `C:\copias\nuvem-2026-10-09.backup` · **Format:** `Custom` · **Encoding:** `UTF8` |
| Objects | desmarque tudo e marque **só os schemas `auth` e `public`**, inteiros (a caixa do schema, não tabelas soltas) |
| As outras | deixe como estão |

Clique **Backup** e espere, no painel *Processes*, *Successfully completed*.

- **Por que `auth` junto com `public`:** em `auth` ficam as contas e as senhas.
  E as duas partes se cruzam: o perfil (`public.profiles`) aponta para a conta
  (`auth.users`), e a conta tem o gatilho que cria o perfil
  (`handle_new_user`). Num backup só, o Restore põe cada peça na ordem certa.
- **Erro "server version mismatch":** o pgAdmin está usando um `pg_dump` mais
  velho que a nuvem. Em **File → Preferences → Paths → Binary paths**, aponte
  para a pasta `bin` do PostgreSQL 17 (ou da versão da nuvem).
- **O arquivo tem as senhas criptografadas e os dados de todo mundo.** Guarde-o
  numa pasta só sua, **nunca no repositório**, e apague-o quando a cópia
  estiver conferida.

### 3. Criar o banco novo e prepará-lo

No servidor **novo** (registre-o no pgAdmin como o da nuvem, com o usuário
`postgres`):

1. **Databases** → botão direito → **Create → Database…**
   - **General:** Database `dash_producao` · Owner `postgres`
   - **Definition:** Encoding `UTF8` · Template `template0`
2. Clique no banco `dash_producao` → **Tools → Query Tool**.
3. Abra `01_preparar_banco_novo.sql` (ícone de pasta) e execute (**F5**).
   Tem de aparecer *Pronto. Agora faça o Restore…*

O script **para sem mexer em nada** se o banco não estiver vazio ou se você
não for o `postgres`. O que ele faz, e por quê, está no cabeçalho dele.

### 4. Fazer o Restore no banco novo

Em `dash_producao` → botão direito → **Restore…**

| Aba | O que marcar |
|---|---|
| General | **Format:** `Custom or tar` · **Filename:** o arquivo do passo 2 · **Role name:** `postgres` |
| Query Options (ou Options, conforme a versão) | ligue **Single transaction** |
| As outras | deixe como estão (não ligue *Clean before restore*) |

Clique **Restore** e espere *Successfully completed*.

Com *Single transaction*, o Restore é **tudo ou nada**. Se falhar, nada fica
no banco: abra *View details* no painel *Processes*, corrija o motivo e rode o
**Restore de novo**. O passo 3 não precisa ser repetido.

| Se o erro diz | O que fazer |
|---|---|
| `role "xyz" does not exist` | um papel do Supabase que o passo 3 não criou. No Query Tool: `create role xyz nologin;` e Restore de novo |
| `unrecognized configuration parameter "transaction_timeout"` | o PostgreSQL novo é mais velho que o `pg_dump` que fez o backup. Instale a mesma versão da nuvem |
| `schema "public" already exists` | o passo 3 não foi rodado neste banco |

### 5. Conferir

Abra o Query Tool **na nuvem** e **no banco novo**, rode o
`02_conferencia.sql` nos dois e compare as tabelas (dá para salvar cada
resultado com o botão *Save results to file* e comparar os arquivos).

- Tem de sair **igual, linha por linha**: o fuso, a versão do login, a
  contagem de objetos e, para cada tabela, as **linhas** e a **assinatura**
  (um resumo do conteúdo inteiro, que muda se qualquer valor mudar).
- Só a linha `postgresql` pode diferir, se as versões menores forem diferentes.
- Se só as tabelas de produção divergirem, alguém gravou na nuvem depois do
  backup. No ensaio, tudo bem. Na troca, a nuvem tem de estar parada.

### 6. Entrar com uma conta real (o teste que importa)

No Query Tool do banco novo, simule uma pessoa e veja o que ela enxerga:

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'seu.email@empresa.com.br'),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) from public.production_summary;   -- o que essa pessoa vê
rollback;
```

É o mesmo caminho que a API do Supabase faz: as regras de acesso (RLS) valem
aqui como valem na nuvem.

---

## Ensaio e troca

- **Ensaio:** os passos 1 a 6 a qualquer hora. A nuvem não sofre nada: o
  Backup só lê. Para ensaiar de novo, apague o `dash_producao` e comece do
  passo 3.
- **Troca** (só quando o app tiver login e API apontando para este servidor,
  ver acima):
  1. avisar a fábrica e **parar os apontamentos na nuvem**;
  2. passos 2 a 5, num banco novo;
  3. a conferência tem de bater **inteira**, inclusive as tabelas de produção;
  4. só então trocar o endereço do site.

## Depois da cópia

- **Migrations novas:** cada arquivo novo de `supabase/migrations/` roda
  **uma vez** no Query Tool, na ordem do nome, **nos dois bancos** enquanto
  os dois existirem (D65). As migrations não são idempotentes: anote qual foi
  a última aplicada.
- **Backup do banco novo:** o mesmo Backup do passo 2, feito neste servidor
  (só `auth` e `public`, formato *Custom*). Assim ele volta pelo mesmo caminho
  (passos 3 a 5). Guarde uma cópia **fora do servidor**.
- **O fuso do banco é UTC**, como na nuvem. Os horários aparecem em UTC no
  pgAdmin; o app e as funções convertem para Brasília onde precisa.

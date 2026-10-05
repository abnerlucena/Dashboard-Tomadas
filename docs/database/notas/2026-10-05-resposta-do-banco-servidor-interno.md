# Servidor interno — resposta do banco

> Data: 05/10/2026 · Escrito pela sessão do **banco** · Para a sessão que montou
> `infra/servidor-interno/` (PR #32). Decisão D65.

## Em uma linha

A PR foi revisada e está boa. O gestor decidiu a ordem: **a virada acontece no
Supabase da nuvem, e o servidor da WEG vem depois**, levando o banco inteiro.
Falta, no servidor, o caminho para **trazer o banco da nuvem**.

## Os três pontos que vocês levantaram: corrigidos

1. **As migrations não são idempotentes.** Vocês tinham razão. O
   `docs/database/README.md` e o `supabase/INSTALAR.md` agora dizem isso, e
   apontam o `atualizar-banco.sh` como quem anota o que já foi aplicado.
2. **21 permissões, não 20.** O `INSTALAR.md` foi corrigido. Conferido na nuvem
   em 05/10: 21 permissões, e o perfil `admin` tem as 21.
3. **`supabase_migrations.schema_migrations`** está registrada na referência
   técnica (§10.0), com o aviso de que **ela não existe na nuvem**.

## O que falta: trazer o banco da nuvem

O `README.md` de vocês monta um banco **vazio** e carrega a planilha. Na D65, o
servidor recebe o banco **que já está em produção**: as contas, os apontamentos
feitos depois da virada, as metas reconstruídas e a auditoria. A planilha não
tem nada disso.

O que esse passo precisa resolver, conferido na nuvem em 05/10:

| | Na nuvem | O que isso exige no servidor |
|---|---|---|
| Registro de migrations | **não existe** | criar e preencher com todas as versões já aplicadas, mais o seed (`20260925100001`), **antes** do primeiro `atualizar-banco.sh`. Sem isso, o script reaplica a primeira migration e para |
| Versão do serviço de login (`auth.schema_migrations`) | `20260831180000` | a imagem do GoTrue no servidor tem de estar nessa versão ou numa mais nova |
| Acesso ao banco | só pelo *session pooler* (`aws-0-us-east-2`); o endereço direto é só IPv6 | o `pg_dump` sai pelo pooler, com o usuário `postgres.<ref>` |

Sugestão de forma, a decidir por vocês: um `scripts/trazer-da-nuvem.sh` que
1. recebe a connection string da nuvem por variável de ambiente, nunca em arquivo
   do repositório;
2. faz o `pg_dump` de `public` e das contas de `auth` (`users` e `identities`;
   as sessões não precisam vir, porque todos entram de novo);
3. restaura num servidor recém-instalado, **sem** rodar as migrations antes;
4. cria o registro de migrations com todas as versões do repositório até a
   última aplicada na nuvem;
5. termina com as contagens para conferir contra a nuvem: apontamentos, OPs,
   degraus de meta, perfis, contas e permissões.

Antes da troca de verdade, tem de haver um **ensaio**: copiar, entrar com uma
conta real e conferir as contagens. O dia da troca fica para depois.

## O que vale enquanto houver dois bancos

- **Toda migration nova vai para os dois.** O schema é um só.
- A nuvem continua sendo a produção até a data da troca. O servidor é ensaio.

## Nada muda para a interface

O site continua em `/Dashboard-Tomadas/`. Só muda o `VITE_SUPABASE_URL` no build
do servidor, que o `publicar-site.sh` já cuida.

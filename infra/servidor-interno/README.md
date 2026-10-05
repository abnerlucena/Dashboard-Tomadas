# Dash de Produção no servidor da empresa

Guia para a TI instalar o Dash num servidor Linux da rede interna.
O banco é o mesmo PostgreSQL/Supabase que o app já usa. Só muda o lugar onde ele roda.

> Testado de ponta a ponta em 05/10/2026, com as 36 migrations atuais. No
> navegador: cadastro, aprovação do administrador, login, apontamento gravado,
> recuperação de senha pelo link do e-mail, backup e restauração num banco zerado.

---

## Como fica

```mermaid
flowchart LR
  PC[Computadores da rede<br/>navegador] -- HTTPS 443 --> WEB
  subgraph Servidor Linux — Docker
    WEB[web · Nginx<br/>site + porta única]
    AUTH[auth · GoTrue<br/>login e senhas]
    REST[rest · PostgREST<br/>API dos dados]
    DB[(db · PostgreSQL)]
    WEB -- /auth/v1 --> AUTH
    WEB -- /rest/v1 --> REST
    AUTH --> DB
    REST --> DB
  end
  AUTH -- SMTP --> O365[Office 365<br/>e-mail de recuperação]
```

| Endereço | O que é |
|---|---|
| `https://<servidor>/Dashboard-Tomadas/` | o app |
| `https://<servidor>/auth/v1/` | login (o app chama sozinho) |
| `https://<servidor>/rest/v1/` | dados (o app chama sozinho) |

Só a porta **443** (e a 80, que redireciona) fica aberta para a rede. O banco
escuta apenas em `127.0.0.1:5432`, dentro do próprio servidor.

Ficam de fora do Supabase completo, porque o app não usa: Storage, Realtime,
Edge Functions, Studio (o painel web) e Analytics.

---

## O que é preciso

| Item | Detalhe |
|---|---|
| Servidor | Linux (Ubuntu 22.04/24.04 ou similar), 2 núcleos, 4 GB de RAM, 40 GB de disco |
| Software | Docker Engine com o plugin Compose, Git e OpenSSL |
| Nome na rede | um nome DNS interno, por exemplo `producao.empresa.local`, apontando para o servidor |
| Certificado | emitido pela CA interna da empresa para esse nome (ver `certificados/LEIA-ME.md`) |
| Internet de saída | só na instalação e nas atualizações: baixar as imagens Docker e os pacotes npm |
| E-mail | Office 365. Ver [E-mail](#e-mail-office-365) |

---

## Instalação

Tudo roda na pasta `infra/servidor-interno` do repositório.

```bash
# 1. Código
git clone https://github.com/abnerlucena/dashboard-tomadas.git
cd dashboard-tomadas/infra/servidor-interno

# 2. Configuração: cria o .env com senhas e chaves novas
sh scripts/gerar-segredos.sh
nano .env          # NOME_DO_SERVIDOR, ENDERECO e o bloco de e-mail

# 3. Certificado: copie servidor.crt e servidor.key para certificados/
#    (para testar antes de ter o da CA: sh scripts/gerar-segredos.sh --certificado-provisorio)

# 4. Site: compila o app apontando para este servidor
sh scripts/publicar-site.sh

# 5. Sobe tudo
docker compose up -d --wait

# 6. Banco: migrations, seed e feriados, na ordem certa
sh scripts/atualizar-banco.sh
```

O passo 6 termina com uma conferência: **22 máquinas ativas, 21 permissões,
7 perfis, 3 turnos**.

### Primeiro administrador

1. Abra `https://<servidor>/` e use **Criar conta**.
2. No servidor, rode:

```bash
docker compose exec db psql -U postgres -c "select public.bootstrap_admin('seu.email@empresa.com.br', 'admin');"
```

3. Entre no app. Daí em diante, os cadastros novos são aprovados pela tela **Usuários**.

### Histórico da planilha (opcional)

Para trazer os meses já apontados na planilha, siga `supabase/import/README.md`.
O `extrair.cjs` gera um `.sql`; rode-o no banco assim:

```bash
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 < caminho/do/preparo.sql
```

Depois faça a carga e a reconstrução das metas históricas, como manda o
`supabase/INSTALAR.md` (passo 5).

---

## E-mail (Office 365)

O e-mail só é usado para **recuperar senha** (e para confirmar cadastro, se
`CONFIRMAR_CADASTRO_AUTOMATICAMENTE=false`). O resto do app funciona sem ele.

O serviço de login (GoTrue) sabe enviar e-mail **só com usuário e senha**. Ele
não faz o login moderno da Microsoft (OAuth). Isso deixa dois caminhos:

### Caminho A — caixa com SMTP AUTH (rápido, mas com prazo)

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USUARIO=dash.producao@empresa.com.br
SMTP_SENHA=<senha da caixa>
SMTP_REMETENTE=dash.producao@empresa.com.br
```

A TI precisa:
- criar uma caixa para o sistema (ou usar uma existente), **sem MFA**;
- ligar **SMTP autenticado** nessa caixa (Microsoft 365 admin → Usuários → a
  caixa → E-mail → Gerenciar aplicativos de e-mail);
- conferir se os "padrões de segurança" do tenant não bloqueiam o SMTP AUTH.

**Prazo:** a Microsoft vai desligar a senha simples no SMTP **por padrão no fim
de dezembro de 2026** (dá para religar) e removê-la de vez **em 2027**. Use o
caminho A para começar, mas planeje o B.

### Caminho B — relay por conector (definitivo)

O servidor entrega o e-mail direto ao Exchange Online, que o reconhece pelo IP
público fixo da empresa. Não há senha.

```env
SMTP_HOST=empresa-com-br.mail.protection.outlook.com   # o MX do domínio
SMTP_PORT=25
SMTP_USUARIO=
SMTP_SENHA=
SMTP_REMETENTE=dash.producao@empresa.com.br             # endereço do domínio da empresa
```

A TI precisa:
- criar, no Exchange admin center, um **conector** de entrada do tipo "Servidor
  de e-mail da organização" que aceite o **IP público fixo** de saída da empresa;
- liberar a saída do servidor para a internet na **porta 25**;
- incluir esse IP no registro **SPF** do domínio.

A configuração sem usuário e senha foi testada aqui com um servidor de e-mail
de teste. O conector em si é do lado da Microsoft e só a TI consegue testar.

### O link do e-mail só abre dentro da rede

O link de recuperação aponta para o servidor interno. Aberto no celular fora do
Wi-Fi da empresa, ele não carrega. Isso é esperado num sistema só de rede interna.

---

## Rotina

### Atualizar quando o código mudar

```bash
cd dashboard-tomadas && git pull
cd infra/servidor-interno
sh scripts/backup.sh            # antes de mexer, sempre
sh scripts/atualizar-banco.sh   # aplica só as migrations novas
sh scripts/publicar-site.sh     # recompila o site (o Nginx pega na hora)
```

O `atualizar-banco.sh` anota cada migration aplicada em
`supabase_migrations.schema_migrations` (a mesma tabela que a CLI do Supabase
usa). Por isso pode ser rodado quantas vezes quiser: só aplica o que falta.
Cada migration roda numa transação. Se uma falhar, ela não deixa resto e o
script para ali.

### Backup

```bash
sh scripts/backup.sh     # gera backups/dash-AAAA-MM-DD_HHMMSS.dump
```

Agende todo dia às 2h (`crontab -e`, com o usuário que roda o Docker):

```cron
0 2 * * * cd /caminho/dashboard-tomadas/infra/servidor-interno && sh scripts/backup.sh >> backups/backup.log 2>&1
```

- Guarda 30 dias (mude com `DIAS=60 sh scripts/backup.sh`).
- **Copie a pasta `backups/` para outra máquina** (compartilhamento de rede,
  outro servidor). Backup no mesmo disco não sobrevive ao disco.
- O backup leva os dados, as contas (com as senhas criptografadas) e o
  registro das migrations.

### Restaurar

```bash
sh scripts/restaurar-backup.sh backups/dash-2026-10-05_020000.dump
```

Pede para digitar `RESTAURAR`, faz um backup do estado atual antes e então
substitui o banco. Faça um teste de restauração de vez em quando: backup que
nunca foi restaurado não é garantia.

### Ver o banco com uma ferramenta gráfica

DBeaver ou pgAdmin, com **túnel SSH** até o servidor:
host `127.0.0.1`, porta `5432`, usuário `postgres`, senha `POSTGRES_PASSWORD` do `.env`.

### Problemas

```bash
docker compose ps              # todos "Up" / "healthy"?
docker compose logs auth --tail 50
docker compose logs rest --tail 50
docker compose logs web --tail 50
```

---

## Segurança

- **`.env`, `certificados/`, `backups/` e `site/` nunca vão para o Git.** O
  repositório é público. O `.gitignore` desta pasta já cuida disso.
- **`ANON_KEY`** vai dentro do site e qualquer um que abra o app pode vê-la. É
  assim por desenho: quem protege os dados são as regras do banco (RLS).
- **`SERVICE_ROLE_KEY`** ignora todas as regras. Fica só no `.env`; o app não
  a usa.
- Não troque o `JWT_SECRET` com o sistema em uso: todos são deslogados e o
  site precisa ser republicado.
- Tentativas de login são limitadas a 10 por minuto por computador (Nginx).

## Versões

As imagens são as do docker-compose oficial do Supabase em 05/10/2026:
`supabase/postgres:17.6.1.136`, `supabase/gotrue:v2.196.0`,
`postgrest/postgrest:v14.17` e `nginx:1.28-alpine`. Para atualizar, troque a
versão no `docker-compose.yml`, faça backup e rode `docker compose up -d`.

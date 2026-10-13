# Preferências e foto de perfil: o que a interface precisa do banco

> Data: 13/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Pede decisão: guardar as preferências na conta, a foto de perfil e a troca de senha logado. **Nada disso bloqueia a interface.**

## Em uma linha

A interface ganhou **Perfil** e **Preferências**, tudo pessoal (cada conta tem as suas).
Hoje as preferências ficam no navegador, uma chave por pessoa. Para acompanharem a
pessoa em qualquer computador, e para a foto e a troca de senha, falta o banco.

## O que a interface faz hoje

- **Preferências** (`prototype/src/features/preferences/`): tema, página inicial
  (Dashboard, Apontamento ou última tela), barra lateral aberta, controles de 44px no
  Apontamento e rascunho. Salvam sozinhas em `localStorage`, chave `dash.prefs.v1:<usuário>`.
  Tudo passa por **um ponto só**, o `PrefsStore` (`prefs.ts`): trocar o armazenamento
  não mexe nas telas.
- **Perfil:** nome, perfil e tipo de conta, lidos da sessão. A senha troca pelo link
  por e-mail (`auth.requestPasswordReset`), com a pessoa digitando o e-mail, porque a
  `Session` não traz o e-mail.

## O que a sessão do banco precisa decidir

1. **Preferências na conta.** Sugestão: `profiles.preferences jsonb not null default '{}'`,
   lido e gravado só pela própria pessoa (RLS), e no contrato
   `preferences.get(): Promise<Record<string, unknown>>` e `preferences.save(prefs)`.
   O banco guarda o objeto sem interpretar; a interface valida o que lê (já faz, em
   `sanitizePrefs`). Quando existir, a interface troca o `localPrefsStore` por um que
   chama o contrato, com o navegador como cópia local.
2. **Foto de perfil.** Sugestão: Supabase Storage, um bucket `avatars` privado, um
   arquivo por pessoa (`<user_id>.jpg`), com regra para só a própria pessoa gravar e
   apagar, e leitura por quem usa o Dash. `profiles.avatar_path text null`, e no contrato
   `Session.avatarUrl?: string` (URL assinada e curta) mais `profile.saveAvatar(file)` e
   `profile.removeAvatar()`. A interface já recorta em quadrado e reduz para 256 px
   (poucos KB) antes de enviar; aceita JPG, PNG ou WebP até 5 MB. **Remover precisa
   apagar o arquivo de verdade.** É dado pessoal: sem foto em relatórios nem no Modo TV.
3. **Trocar a senha logado.** `auth.changePassword(current, next)`, conferindo a
   senha atual. Hoje só existe o link por e-mail.
4. **E-mail na sessão.** `Session.email?: string` evitaria a pessoa digitar o e-mail
   para pedir o link de senha.

Quando cada item existir no `types.ts`, a interface liga a parte dela.

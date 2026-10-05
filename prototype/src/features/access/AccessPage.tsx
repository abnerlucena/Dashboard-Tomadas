import { ArrowLeft, CircleCheck, Eye, EyeOff, IdCard, Info, LogIn, MailCheck, UserPlus, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { codigoDoErro, mensagemDeErro } from "../../../../src/lib/erros";
import { Button, IconButton } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/Feedback";
import { WegTile } from "@/components/ui/Misc";
import { TextField } from "@/components/ui/TextField";
import { useAccess } from "./AccessContext";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, simulateRecoveryLink } from "./demoClient";

/*
 * Área de acesso: entrar, crachá (conta compartilhada, D23), criar conta
 * (fica pendente até um gestor aprovar, D19–D23), recuperar senha e definir a
 * senha nova (chegada pelo link do e-mail, D45).
 */

type View = "entrar" | "cracha" | "cadastro" | "cadastroEnviado" | "recuperar" | "emailEnviado" | "novaSenha" | "senhaAlterada";

const MIN_PASSWORD = 6;

export function AccessPage() {
  const { client, login, recovery, clearRecovery, notice } = useAccess();
  const isDemo = client.kind === "demo";

  const [view, setView] = useState<View>(recovery?.tela === "novaSenha" ? "novaSenha" : recovery ? "recuperar" : "entrar");
  const [error, setError] = useState<string | null>(recovery?.tela === "recuperar" ? recovery.erro : null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", senha2: "", cracha: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // A recuperação só vale nesta visita: depois de usada, some
  useEffect(() => {
    if (recovery) clearRecovery();
  }, [recovery, clearRecovery]);

  const go = (v: View) => {
    setView(v);
    setError(null);
    setTried(false);
  };

  /** Envio comum: valida, chama, trata erro em português */
  const run = async (e: FormEvent, valid: boolean, action: () => Promise<void>) => {
    e.preventDefault();
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(mensagemDeErro(err));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Validação ---------- */
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim());
  const errEmail = tried && !emailOk ? "Informe um e-mail válido" : null;
  const errSenha = tried && !form.senha ? "Informe a senha" : null;
  const errSenhaNova = tried && form.senha.length < MIN_PASSWORD ? `Use pelo menos ${MIN_PASSWORD} caracteres` : null;
  const errSenha2 = tried && form.senha2 !== form.senha ? "As senhas não são iguais" : null;
  const errCracha = tried && !form.cracha.trim() ? "Informe o nº do crachá" : null;
  const errNome = tried && !form.nome.trim() ? "Informe seu nome completo" : null;

  let body: ReactNode;
  if (view === "entrar") {
    body = (
      <form noValidate onSubmit={(e) => run(e, emailOk && !!form.senha, () => entrar())} className="flex flex-col gap-200">
        <Heading title="Entrar" hint="Use a conta que o gestor aprovou." />
        {notice && !error && <Note icon={Info}>{notice}</Note>}
        {error && <ErrorMessage title="Não foi possível entrar">{error}</ErrorMessage>}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="username"
          autoFocus
          value={form.email}
          onChange={set("email")}
          error={errEmail}
        />
        <PasswordField label="Senha" autoComplete="current-password" value={form.senha} onChange={set("senha")} error={errSenha} />
        <Button type="submit" appearance="primary" iconBefore={LogIn} isLoading={busy}>
          Entrar
        </Button>
        <div className="flex flex-wrap justify-between gap-100">
          <Button appearance="subtle" spacing="compact" onClick={() => go("recuperar")}>
            Esqueci minha senha
          </Button>
          <Button appearance="subtle" spacing="compact" iconBefore={UserPlus} onClick={() => go("cadastro")}>
            Criar conta
          </Button>
        </div>
        {isDemo && <DemoAccounts onPick={(email) => setForm((f) => ({ ...f, email, senha: DEMO_PASSWORD }))} />}
      </form>
    );
  } else if (view === "cracha") {
    body = (
      <form noValidate onSubmit={(e) => run(e, !!form.cracha.trim(), () => entrar(form.cracha))} className="flex flex-col gap-200">
        <Heading
          title="Conta compartilhada"
          hint="Esta conta é usada por mais de uma pessoa. Informe o nº do seu crachá: é ele que diz quem está apontando."
        />
        {error && <ErrorMessage title="Não foi possível entrar">{error}</ErrorMessage>}
        <TextField
          label="Nº do crachá"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={form.cracha}
          onChange={(e) => setForm((f) => ({ ...f, cracha: e.target.value.replace(/\D/g, "") }))}
          error={errCracha}
          elemAfter={<IdCard aria-hidden className="size-icon-small text-icon-subtle" />}
          inputClassName="tabular-nums"
        />
        <Button type="submit" appearance="primary" iconBefore={LogIn} isLoading={busy}>
          Entrar
        </Button>
        <BackButton onClick={() => go("entrar")} />
      </form>
    );
  } else if (view === "cadastro") {
    const valid =
      !!form.nome.trim() &&
      emailOk &&
      form.senha.length >= MIN_PASSWORD &&
      form.senha2 === form.senha &&
      !!form.cracha.trim();
    body = (
      <form noValidate onSubmit={(e) => run(e, valid, cadastrar)} className="flex flex-col gap-200">
        <Heading title="Criar conta" hint="Preencha seus dados para pedir acesso ao Dash." />
        {/* O cadastro não entra direto: dizer isso antes evita a frustração depois */}
        <Note icon={Info}>
          <strong className="font-semibold">Seu acesso não é liberado na hora.</strong> Depois de enviar, um gestor precisa aprovar o
          cadastro e escolher o seu perfil. Só então você consegue entrar.
        </Note>
        {error && <ErrorMessage title="Não foi possível criar a conta">{error}</ErrorMessage>}
        <TextField label="Nome completo" autoComplete="name" autoFocus value={form.nome} onChange={set("nome")} error={errNome} />
        <TextField label="E-mail" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errEmail} />
        <TextField
          label="Nº do crachá"
          inputMode="numeric"
          value={form.cracha}
          onChange={(e) => setForm((f) => ({ ...f, cracha: e.target.value.replace(/\D/g, "") }))}
          error={errCracha}
          inputClassName="tabular-nums"
        />
        <PasswordField
          label="Senha"
          autoComplete="new-password"
          helper={`Pelo menos ${MIN_PASSWORD} caracteres.`}
          value={form.senha}
          onChange={set("senha")}
          error={errSenhaNova}
        />
        <PasswordField label="Repita a senha" autoComplete="new-password" value={form.senha2} onChange={set("senha2")} error={errSenha2} />
        <Button type="submit" appearance="primary" iconBefore={UserPlus} isLoading={busy}>
          Enviar cadastro para aprovação
        </Button>
        <BackButton onClick={() => go("entrar")} />
      </form>
    );
  } else if (view === "cadastroEnviado") {
    body = (
      <Done icon={CircleCheck} title="Cadastro enviado" action={{ label: "Voltar para entrar", onClick: () => go("entrar") }}>
        <p>
          Agora é com a gestão: um gestor precisa <strong className="font-semibold">aprovar o seu cadastro</strong> e escolher o seu perfil.
        </p>
        <p>Até lá, a entrada fica bloqueada. Se tiver pressa, avise o seu líder de turno.</p>
      </Done>
    );
  } else if (view === "recuperar") {
    body = (
      <form
        noValidate
        onSubmit={(e) =>
          run(e, emailOk, async () => {
            await client.auth.requestPasswordReset(form.email.trim());
            go("emailEnviado");
          })
        }
        className="flex flex-col gap-200"
      >
        <Heading title="Recuperar senha" hint="Enviamos um link para você criar uma senha nova." />
        {error && <ErrorMessage title="Não foi possível continuar">{error}</ErrorMessage>}
            <TextField
              label="E-mail da conta"
              type="email"
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={set("email")}
              error={errEmail}
            />
            <Button type="submit" appearance="primary" isLoading={busy}>
              Enviar link
            </Button>
        <BackButton onClick={() => go("entrar")} />
      </form>
    );
  } else if (view === "emailEnviado") {
    body = (
      <Done icon={MailCheck} title="Confira o seu e-mail" action={{ label: "Voltar para entrar", onClick: () => go("entrar") }}>
        {/* Mesma mensagem tenha a conta ou não: não conta a estranhos quem tem acesso */}
        <p>
          Se existir uma conta com <strong className="font-semibold">{form.email.trim()}</strong>, enviamos um link para criar uma senha
          nova. Olhe também a caixa de spam.
        </p>
        <p>O link vale por pouco tempo e só uma vez.</p>
        {isDemo && (
          <div className="flex flex-col gap-100 rounded-large border border-dashed p-150">
            <span className="font-body-small font-semibold text-subtle">Demonstração: simular o clique no link do e-mail</span>
            <span className="flex flex-wrap gap-100">
              <Button
                spacing="compact"
                onClick={() => {
                  simulateRecoveryLink("valid");
                  go("novaSenha");
                }}
              >
                Link válido
              </Button>
              <Button
                spacing="compact"
                onClick={() => {
                  simulateRecoveryLink("expired");
                  go("recuperar");
                  setError("O link de recuperação expirou. Peça um novo e-mail.");
                }}
              >
                Link expirado
              </Button>
            </span>
          </div>
        )}
      </Done>
    );
  } else if (view === "novaSenha") {
    body = (
      <form
        noValidate
        onSubmit={(e) =>
          run(e, form.senha.length >= MIN_PASSWORD && form.senha2 === form.senha, async () => {
            await client.auth.setNewPassword(form.senha);
            // A sessão temporária do link não vira login: entra de novo com a senha nova
            await client.auth.logout(null).catch(() => {});
            setForm((f) => ({ ...f, senha: "", senha2: "" }));
            go("senhaAlterada");
          })
        }
        className="flex flex-col gap-200"
      >
        <Heading title="Criar senha nova" hint="Escolha a senha que você vai usar daqui em diante." />
        {error && <ErrorMessage title="Não foi possível trocar a senha">{error}</ErrorMessage>}
        <PasswordField
          label="Senha nova"
          autoComplete="new-password"
          autoFocus
          helper={`Pelo menos ${MIN_PASSWORD} caracteres.`}
          value={form.senha}
          onChange={set("senha")}
          error={errSenhaNova}
        />
        <PasswordField
          label="Repita a senha nova"
          autoComplete="new-password"
          value={form.senha2}
          onChange={set("senha2")}
          error={errSenha2}
        />
        <Button type="submit" appearance="primary" isLoading={busy}>
          Salvar senha nova
        </Button>
      </form>
    );
  } else {
    body = (
      <Done icon={CircleCheck} title="Senha alterada" action={{ label: "Entrar", onClick: () => go("entrar") }}>
        <p>Entre com o seu e-mail e a senha nova.</p>
      </Done>
    );
  }

  async function entrar(badge?: string) {
    try {
      await login(form.email, form.senha, badge);
    } catch (err) {
      // Conta compartilhada: o login pede o crachá e é repetido com ele (D23)
      if (codigoDoErro(err) === "BADGE_REQUIRED") {
        setView("cracha");
        setTried(false);
        return;
      }
      throw err;
    }
  }

  async function cadastrar() {
    // O cadastro fica pendente de aprovação do gestor (D20)
    await client.auth.register({ nome: form.nome.trim(), senha: form.senha, email: form.email.trim(), badgeNumber: form.cracha.trim() });
    setForm((f) => ({ ...f, senha: "", senha2: "" }));
    go("cadastroEnviado");
  }

  return (
    <main className="flex min-h-dvh items-start justify-center bg-surface-sunken px-200 py-600 s:items-center">
      <div className="flex w-full max-w-modal flex-col gap-300">
        <div className="flex items-center gap-100">
          <WegTile />
          <span className="flex flex-col">
            <span className="font-heading-xsmall text-default">Dash de Produção</span>
            <span className="font-body-small text-subtle">Tomadas &amp; Interruptores · Itajaí</span>
          </span>
        </div>
        <section aria-live="polite" className="rounded-xlarge bg-surface-raised p-300 shadow-raised">
          {body}
        </section>
        {isDemo && (
          <p className="text-center font-body-small text-subtlest">Modo de demonstração · contas e cadastros fictícios, sem servidor</p>
        )}
      </div>
    </main>
  );
}

/* ---------- Peças ---------- */
function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <header>
      <h1 className="font-heading-large text-default">{title}</h1>
      <p className="mt-050 text-subtle">{hint}</p>
    </header>
  );
}

function Note({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex gap-150 rounded-large bg-information p-200 text-default">
      <Icon aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-information" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Done({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-200">
      <span className="flex size-empty-icon items-center justify-center rounded-large bg-success">
        <Icon aria-hidden className="size-icon-large text-icon-success" />
      </span>
      <h1 className="font-heading-large text-default">{title}</h1>
      <div className="flex flex-col gap-100 text-subtle">{children}</div>
      <Button appearance="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button appearance="subtle" iconBefore={ArrowLeft} onClick={onClick} className="self-start">
      Voltar
    </Button>
  );
}

function PasswordField(props: {
  label: string;
  autoComplete: string;
  autoFocus?: boolean;
  helper?: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  error: string | null;
}) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      elemAfter={
        <IconButton
          icon={shown ? EyeOff : Eye}
          label={shown ? "Esconder senha" : "Mostrar senha"}
          spacing="compact"
          showTooltip={false}
          onClick={() => setShown((s) => !s)}
        />
      }
    />
  );
}

function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  return (
    <details className="group rounded-large border border-dashed">
      <summary className="cursor-pointer list-none px-150 py-100 font-body-small font-semibold text-subtle">
        Contas de demonstração <span className="font-normal text-subtlest">· senha {DEMO_PASSWORD}</span>
      </summary>
      <ul className="flex flex-col border-t py-050">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              onClick={() => onPick(a.email)}
              className="ds-pressable flex w-full flex-col px-150 py-075 text-left hover:bg-neutral-subtle-hovered"
            >
              <span className="font-code text-default">{a.email}</span>
              <span className="font-body-small text-subtlest">{a.what}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

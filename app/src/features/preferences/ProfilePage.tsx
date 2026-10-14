import { useState } from "react";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Misc";
import { Lozenge } from "@/components/ui/Lozenge";
import { TextField } from "@/components/ui/TextField";
import { mensagemDeErro } from "../../../../src/lib/erros";
import type { Notify } from "@/lib/utils";
import { useAccess } from "@/features/access/AccessContext";

/*
 * Perfil: quem a pessoa é no sistema. Nome, perfil e tipo de conta vêm da sessão
 * e são mantidos pelo administrador (tela Usuários). A senha troca pelo link por
 * e-mail; trocar logado, informando a atual, e a foto de perfil dependem do banco
 * (recado em docs/database/notas/2026-10-13-preferencias-e-foto-de-perfil.md).
 */

const ACCOUNT_TYPE = { personal: "Conta pessoal", shared: "Conta compartilhada", display: "Tela de TV" } as const;

export function ProfilePage({ notify }: { notify: Notify }) {
  const { session, client, logout } = useAccess();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);
  if (!session) return null;
  const shared = session.accountType === "shared";
  const type = ACCOUNT_TYPE[session.accountType ?? "personal"];
  const perfil = session.roleName ?? (session.role === "admin" ? "Administrador" : "Usuário");
  const emailError = tried && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Informe um e-mail válido" : null;

  const sendLink = async () => {
    setTried(true);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setSending(true);
    try {
      await client?.auth.requestPasswordReset(email.trim());
      // A resposta é sempre a mesma: não diz se o e-mail existe
      notify("Link enviado", "Se o e-mail tiver conta, chega uma mensagem para definir a senha nova.");
      setEmail("");
      setTried(false);
    } catch (e) {
      notify("Não foi possível enviar o link", mensagemDeErro(e), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title="Perfil" description="Quem você é no sistema." />
      <PageBody>
        <section aria-label="Identificação" className="flex flex-wrap items-center gap-200 rounded-xlarge bg-surface-raised p-250 shadow-raised">
          <Avatar name={session.nome} size="medium" />
          <div className="min-w-0">
            <h2 className="font-heading-large text-default">{session.nome}</h2>
            <p className="mt-050 flex flex-wrap gap-050">
              <Lozenge appearance="information">{perfil}</Lozenge>
              <Lozenge appearance="neutral">{type}</Lozenge>
            </p>
          </div>
        </section>

        <section aria-labelledby="minha-conta" className="flex flex-col gap-100 rounded-xlarge bg-surface-raised p-250 shadow-raised">
          <h2 id="minha-conta" className="font-heading-small text-default">
            Minha conta
          </h2>
          <dl className="flex flex-col">
            {(
              [
                ["Nome", session.nome],
                ["Perfil", perfil],
                ["Tipo de conta", type],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-100 border-t py-100 first:border-t-0">
                <dt className="text-subtle">{k}</dt>
                <dd className="font-medium text-default">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="senha" className="flex flex-col gap-100 rounded-xlarge bg-surface-raised p-250 shadow-raised">
          <h2 id="senha" className="font-heading-small text-default">
            Senha
          </h2>
          {shared ? (
            <p className="text-subtle">Conta compartilhada: quem entra é identificado pelo crachá, e a senha é da área. Peça a troca ao administrador.</p>
          ) : (
            <>
              <p className="text-subtle">Enviamos um link para o seu e-mail; ao abrir, você define a senha nova.</p>
              <div className="flex flex-wrap items-start gap-100">
                <TextField
                  label="Seu e-mail"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailError}
                  className="min-w-0 flex-1 basis-field-op s:max-w-search-width"
                />
                <Button appearance="primary" isLoading={sending} onClick={() => void sendLink()} className="s:mt-250">
                  Enviar link para trocar a senha
                </Button>
              </div>
            </>
          )}
        </section>

        <div className="flex justify-end">
          <Button appearance="default" onClick={() => void logout()}>
            Sair do Dash
          </Button>
        </div>
      </PageBody>
    </>
  );
}

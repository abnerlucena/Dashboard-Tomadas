import { useState, type ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { OptionCards } from "@/components/ui/OptionCards";
import { Switch } from "@/components/ui/Switch";
import { cn, plural } from "@/lib/utils";
import { clearUserDrafts, listDrafts } from "@/features/entry/draft";
import { usePrefs } from "./PreferencesContext";
import type { StartPref, ThemePref } from "./prefs";

/*
 * Preferências: escolhas pessoais de quem está logado. Salvam sozinhas, sem botão
 * de salvar, e valem só para esta conta (outra pessoa neste computador tem as dela).
 */

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-150 rounded-xlarge bg-surface-raised p-250 shadow-raised", className)} aria-label={title}>
      <div>
        <h2 className="font-heading-small text-default">{title}</h2>
        {hint && <p className="mt-025 text-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Option({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-200 border-t pt-150 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="font-medium text-default">{title}</p>
        <p className="font-body-small text-subtle">{text}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function PreferencesPage() {
  const { prefs, setPref, reset, user } = usePrefs();
  const [drafts, setDrafts] = useState(() => listDrafts(user).length);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const h = prefs.toque ? "h-touch-target" : "h-control";

  return (
    <>
      <PageHeader title="Preferências" description="Suas escolhas para usar o Dash. Salvam sozinhas e valem só para a sua conta." />
      <PageBody>
        <Section title="Aparência" hint="Só para você: outras pessoas que usam este computador têm as delas.">
          <OptionCards<ThemePref>
            label="Tema"
            value={prefs.tema}
            onChange={(v) => setPref("tema", v)}
            options={[
              { value: "light", label: "Claro", hint: "Fundo branco" },
              { value: "dark", label: "Escuro", hint: "Menos brilho" },
              { value: "auto", label: "Igual ao sistema", hint: "Segue o aparelho" },
            ]}
          />
        </Section>

        <div className="grid grid-cols-1 gap-300 m:grid-cols-2">
          <Section title="Ao entrar" hint="Para onde o Dash leva depois do login.">
            <OptionCards<StartPref>
              label="Página inicial"
              value={prefs.inicio}
              onChange={(v) => setPref("inicio", v)}
              options={[
                { value: "dashboard", label: "Dashboard", hint: "Visão geral" },
                { value: "apontamento", label: "Apontamento", hint: "Direto para apontar" },
                { value: "ultima", label: "Última tela", hint: "Onde parei" },
              ]}
            />
            <Option
              title="Barra lateral aberta"
              text="Abre ou recolhe a navegação por padrão. No dia a dia, Ctrl+[ continua alternando."
              checked={prefs.nav}
              onChange={(v) => setPref("nav", v)}
            />
          </Section>

          <Section title="Apontamento" hint="Ajustes da tela de apontamento.">
            <Option
              title="Campos e botões maiores"
              text="44px em vez de 32px: melhor para tablet e luva."
              checked={prefs.toque}
              onChange={(v) => setPref("toque", v)}
            />
            <div aria-hidden className="flex flex-wrap items-center gap-100 rounded-large border border-dashed bg-surface-sunken p-150">
              <span className={cn("flex w-field-op items-center justify-end rounded-medium border border-input bg-surface px-100 text-subtlest", h)}>4501234</span>
              <span className={cn("flex items-center rounded-medium bg-brand-bold px-150 font-medium text-inverse", h)}>Concluir</span>
            </div>
            <Option
              title="Guardar rascunho"
              text="O que você digitou e não concluiu volta se a energia cair ou o navegador fechar. Fica só neste computador, por 48 horas."
              checked={prefs.rascunho}
              onChange={(v) => {
                setPref("rascunho", v);
                setDrafts(0);
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-100 border-t pt-150">
              <span className="font-body-small text-subtle">
                {drafts ? `${drafts} ${plural(drafts, "rascunho", "rascunhos")} neste computador` : "Nenhum rascunho neste computador"}
              </span>
              <Button appearance="outline" isDisabled={!drafts} onClick={() => setConfirmWipe(true)}>
                Apagar rascunhos
              </Button>
            </div>
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-100">
          <p className="font-body-small text-subtle">Salvam sozinhas, sem botão. São da sua conta.</p>
          <Button appearance="default" onClick={() => setConfirmReset(true)}>
            Restaurar padrões
          </Button>
        </div>
      </PageBody>

      <Modal
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Apagar os rascunhos?"
        primary={{
          label: "Apagar",
          appearance: "danger",
          onClick: () => {
            clearUserDrafts(user);
            setDrafts(0);
            setConfirmWipe(false);
          },
        }}
        cancelLabel="Cancelar"
      >
        O que foi digitado e não concluído em {drafts === 1 ? "1 apontamento" : `${drafts} apontamentos`} será perdido. O que já foi concluído continua gravado.
      </Modal>
      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restaurar os padrões?"
        primary={{
          label: "Restaurar",
          onClick: () => {
            reset();
            setDrafts(0);
            setConfirmReset(false);
          },
        }}
        cancelLabel="Cancelar"
      >
        Tema, página inicial, barra lateral e Apontamento voltam ao padrão, e os rascunhos deste computador são apagados.
      </Modal>
    </>
  );
}

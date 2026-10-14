import { LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { installBackendData } from "@/data/machines";
import { loadBackendData } from "@/data/fromBackend";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/Feedback";
import { Spinner } from "@/components/ui/Spinner";
import { useAccess } from "@/features/access/AccessContext";

/*
 * Com backend configurado, as telas só montam depois que os dados de produção
 * do banco foram carregados e instalados em machines.ts. Na demonstração
 * (`client.reads` nulo), passa direto.
 *
 * Os dados ficam valendo para a pessoa que entrou: outra pessoa no mesmo
 * navegador (RLS diferente) carrega de novo.
 */

/** De quem são os dados instalados (no módulo: sobrevive à remontagem das telas) */
let installedFor: string | null = null;

export function BackendGate({ children }: { children: ReactNode }) {
  const { client, session, logout } = useAccess();
  const owner = session ? (session.userId ?? session.nome) : null;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() => (installedFor === owner ? "ready" : "loading"));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!client.reads || !owner) return;
    if (installedFor === owner) {
      setStatus("ready");
      return;
    }
    let alive = true;
    setStatus("loading");
    loadBackendData(client.reads, session)
      .then((d) => {
        if (!alive) return;
        installBackendData(d);
        installedFor = owner;
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(mensagemDeErro(e, "Não foi possível carregar os dados de produção."));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
    // A sessão muda de objeto a cada renovação de token; o que importa é de quem ela é
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, owner, attempt]);

  if (!client.reads || (status === "ready" && installedFor === owner)) return <>{children}</>;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken px-200">
      {status === "error" ? (
        <div className="w-full max-w-search-width">
          <ErrorMessage
            title="Não foi possível carregar os dados de produção"
            actions={
              <>
                <Button iconBefore={RefreshCw} onClick={() => setAttempt((n) => n + 1)}>
                  Tentar de novo
                </Button>
                <Button appearance="subtle" iconBefore={LogOut} onClick={() => logout()}>
                  Sair
                </Button>
              </>
            }
          >
            {error}
          </ErrorMessage>
        </div>
      ) : (
        <Spinner label="Carregando os dados de produção" />
      )}
    </div>
  );
}

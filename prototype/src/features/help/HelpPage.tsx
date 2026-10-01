import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, ClipboardList, FileText, History, LifeBuoy, Search, SearchX, Target, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { DATA_ORIGIN, PERIOD_LABEL, STATUS_META, WORKING_DAYS, type Status } from "@/data/machines";
import { type Notify } from "@/lib/utils";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Kbd } from "@/components/ui/Kbd";
import { Lozenge } from "@/components/ui/Lozenge";
import { TextField } from "@/components/ui/TextField";

const SHORTCUTS: Array<[string[], string]> = [
  [["Ctrl", "["], "Recolher ou expandir a navegação lateral"],
  [["/"], "Ir para a busca"],
  [["Ctrl", "S"], "Salvar o apontamento"],
  [["Esc"], "Fechar painel, menu ou janela"],
  [["↑", "↓"], "Percorrer as linhas de uma tabela"],
  [["Enter"], "Abrir as ordens de produção da máquina"],
  [["←", "→"], "Percorrer os dias num gráfico ou no Modo TV"],
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Como faço um apontamento?",
    a: "Abra Apontamento, escolha a data e o turno e preencha, para cada máquina, o número da OP (7 dígitos) e a quantidade. Uma máquina pode ter várias OPs. Salve com o botão ou Ctrl+S.",
  },
  {
    q: "Posso corrigir um apontamento já salvo?",
    a: "Sim. Em Histórico, escolha o dia no calendário e use o menu da linha para editar, mover para outra data ou excluir. Dá para agir em vários de uma vez selecionando as linhas. Toda ação pode ser desfeita logo depois pela notificação.",
  },
  {
    q: "O que significa cada cor de status?",
    a: "Crítico: abaixo de 70% da meta. Atenção: de 70% a 89%. Próximo: de 90% a 99%. Atingido: 100% ou mais. A cor sempre vem acompanhada do nome do status.",
  },
  {
    q: "Por que o atingimento do mês está baixo se os dias apontados vão bem?",
    a: "O atingimento compara a produção com a meta do mês inteiro. Dias sem apontamento contam como zero. Veja a aba Detalhado da tela Máquinas: os traços (–) mostram os dias que ficaram sem registro.",
  },
  {
    q: "Como marco uma OP como retrabalho?",
    a: "No apontamento, marque a caixa Retrabalho ao lado da OP. Os motivos e as taxas aparecem em Análises › Retrabalho.",
  },
  {
    q: "Quem pode alterar as metas?",
    a: "Gestores. Em Metas, use Editar metas, ajuste a meta por turno e escolha a data de vigência. As metas novas nunca mudam números de dias que já passaram.",
  },
  {
    q: "Como exporto os dados?",
    a: "Em Relatórios, escolha o tipo, o período, as máquinas e os turnos. O PDF serve para imprimir; a planilha (CSV) abre direto no Excel. O botão Exportar da tela Máquinas baixa a visão atual.",
  },
  {
    q: "O que é o Modo TV?",
    a: "Um telão para o meio da fábrica. Cada TV mostra uma área (fábrica inteira, Montagem, Embalagem ou Granel) e compara turnos e máquinas: placar dos turnos, ranking, peças por minuto, OPs concluídas e destaques do mês. Nunca mostra nomes de operadores. Pause com a barra de espaço e saia com Esc.",
  },
  {
    q: "O que é uma OP e como ela anda?",
    a: "Cada ordem de produção entra em OPs como Aguardando liberação. Quando vai para a máquina, é liberada (Em produção) e recebe os apontamentos dos turnos. Pode ser pausada com um motivo. Ao atingir a quantidade pedida, aparece como Pronta para concluir: um líder ou gestor confirma, e ela fica Concluída.",
  },
  {
    q: "Como funcionam os Feedbacks?",
    a: "Cada OP tem uma conversa. A observação que o operador escreve no apontamento vira uma mensagem ali; líderes e gestor respondem, e liberar, pausar e concluir aparecem como avisos do sistema. Quando a OP é concluída, a conversa se encerra e fica guardada para consulta.",
  },
  {
    q: "Por que algumas máquinas não aparecem no atingimento?",
    a: "Kit parafusos, bancadas e prensas trabalham por demanda e não têm meta. Elas aparecem no Apontamento, nas OPs, nos Feedbacks e nas linhas, mas ficam fora do atingimento e dos gráficos de meta.",
  },
];

const LINKS: Array<{ href: string; title: string; text: string; icon: LucideIcon }> = [
  { href: "#/apontamento", title: "Fazer um apontamento", text: "Registrar a produção do turno", icon: ClipboardList },
  { href: "#/historico", title: "Corrigir apontamentos", text: "Editar, mover ou excluir registros", icon: History },
  { href: "#/metas", title: "Ajustar metas", text: "Meta por turno e vigência", icon: Target },
  { href: "#/relatorios", title: "Gerar um relatório", text: "PDF ou planilha do período", icon: FileText },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpPage({ notify }: { notify: Notify }) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const faq = FAQ.filter((f) => !q || normalize(f.q + " " + f.a).includes(q));

  return (
    <>
      <PageHeader title="Ajuda" description="Respostas rápidas sobre o Dash de Produção." />
      <PageBody>
        <TextField
          label="Buscar na ajuda"
          hideLabel
          placeholder="Buscar na ajuda (ex.: retrabalho, metas, exportar)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          elemAfter={<Search aria-hidden className="size-icon-small" />}
          className="max-w-search-width"
        />

        {!q && (
          <nav aria-label="Atalhos para tarefas comuns">
            <ul className="flex flex-wrap gap-200">
              {LINKS.map((l) => (
                <li key={l.href} className="flex min-w-0 flex-1 basis-kpi-min">
                  <a
                    href={l.href}
                    className="ds-pressable flex w-full items-start gap-150 rounded-large bg-surface-raised p-200 shadow-raised hover:bg-surface-raised-hovered"
                  >
                    <l.icon aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-brand" />
                    <span>
                      <span className="block font-heading-xsmall text-default">{l.title}</span>
                      <span className="mt-025 block font-body-small text-subtle">{l.text}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section aria-labelledby="faq" className="flex flex-col gap-150">
          <h2 id="faq" className="font-heading-medium text-default">
            Perguntas frequentes
          </h2>
          {faq.length === 0 ? (
            <div className="rounded-xlarge border">
              <EmptyState
                icon={SearchX}
                title="Nada encontrado"
                hint={`Nenhuma resposta fala de "${query}". Tente outra palavra ou fale com o suporte.`}
                action={{ label: "Limpar busca", onClick: () => setQuery("") }}
              />
            </div>
          ) : (
            <Accordion.Root type="multiple" className="flex flex-col overflow-hidden rounded-xlarge border">
              {faq.map((f) => (
                <Accordion.Item key={f.q} value={f.q} className="border-t first:border-t-0">
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center gap-150 px-200 py-150 text-left font-heading-xsmall text-default transition-colors duration-hover ease-out hover:bg-neutral-subtle-hovered">
                      <span className="flex-1">{f.q}</span>
                      <ChevronDown
                        aria-hidden
                        className="size-icon-small shrink-0 text-icon-subtle transition-transform duration-menu ease-out group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="px-200 pb-200 text-subtle">{f.a}</Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          )}
        </section>

        {!q && (
          <div className="flex flex-wrap gap-300">
            <section aria-labelledby="shortcuts" className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-150">
              <h2 id="shortcuts" className="font-heading-medium text-default">
                Atalhos de teclado
              </h2>
              <table className="w-full overflow-hidden rounded-xlarge border">
                <caption className="sr-only">Atalhos de teclado</caption>
                <tbody>
                  {SHORTCUTS.map(([keys, what]) => (
                    <tr key={what} className="border-t first:border-t-0">
                      <td className="w-1000 px-200 py-100">
                        <span className="flex gap-050">
                          {keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </td>
                      <td className="px-200 py-100 text-default">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section aria-labelledby="legend" className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-150">
              <h2 id="legend" className="font-heading-medium text-default">
                Status e metas
              </h2>
              <ul className="flex flex-col overflow-hidden rounded-xlarge border">
                {(Object.keys(STATUS_META) as Status[]).map((s) => (
                  <li key={s} className="flex items-center gap-150 border-t px-200 py-100 first:border-t-0">
                    <Lozenge appearance={STATUS_META[s].appearance}>{STATUS_META[s].label}</Lozenge>
                    <span className="text-default">{STATUS_META[s].range} da meta</span>
                  </li>
                ))}
              </ul>
              <p className="text-subtle">
                {DATA_ORIGIN === "backend"
                  ? "A meta de um período é a soma das metas gravadas em cada turno apontado. Hora extra e dia anulado não entram, e o retrabalho não conta como produção."
                  : `Meta por dia = meta por turno × turnos ativos. Meta do mês = meta por dia × ${WORKING_DAYS} dias úteis.`}
              </p>
            </section>
          </div>
        )}

        <section aria-labelledby="support" className="flex flex-wrap items-center gap-200 rounded-large bg-surface-sunken p-250">
          <LifeBuoy aria-hidden className="size-icon-large shrink-0 text-icon-subtle" />
          <div className="min-w-0 flex-1">
            <h2 id="support" className="font-heading-small text-default">
              Precisa de mais ajuda?
            </h2>
            <p className="mt-025 text-subtle">Fale com o suporte de TI da fábrica. Versão do protótipo 0.4 · {DATA_ORIGIN === "backend" ? "dados reais, só leitura" : `dados de demonstração de ${PERIOD_LABEL}`}.</p>
          </div>
          <Button onClick={() => notify("Chamado aberto", "O suporte vai responder pelo seu e-mail corporativo (simulado).")}>
            Falar com o suporte
          </Button>
        </section>
      </PageBody>
    </>
  );
}

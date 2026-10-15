import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, ClipboardList, FileText, History, LifeBuoy, Search, SearchX, Target, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { DATA_ORIGIN, PERIOD_LABEL, STATUS_META, WORKING_DAYS, type Status } from "@/data/machines";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/Feedback";
import { Kbd } from "@/components/ui/Kbd";
import { Lozenge } from "@/components/ui/Lozenge";
import { TextField } from "@/components/ui/TextField";

const SHORTCUTS: Array<[string[], string]> = [
  [["Ctrl", "["], "Abrir ou fechar o menu lateral"],
  [["/"], "Ir para a busca"],
  [["Ctrl", "S"], "Salvar o apontamento"],
  [["Esc"], "Fechar o painel, o menu ou a janela aberta"],
  [["↑", "↓"], "Andar pelas linhas de uma tabela"],
  [["Enter"], "Abrir as OPs da máquina selecionada"],
  [["←", "→"], "Passar os dias de um gráfico ou as telas do Modo TV"],
];

/**
 * Uma resposta é uma sequência de blocos curtos: parágrafo (texto), passos
 * numerados ({ steps }) ou lista de itens ({ items }). Escreva como quem explica
 * no chão de fábrica: frase curta, o nome do botão como aparece na tela, um
 * assunto por pergunta.
 */
type Block = string | { steps: string[] } | { items: string[] };
type Faq = { q: string; a: Block[] };

const FAQ_GROUPS: Array<{ title: string; faq: Faq[] }> = [
  {
    title: "Apontamento",
    faq: [
      {
        q: "Como faço um apontamento?",
        a: [
          "Clique em Apontamento. A tela fica só para o apontamento, em três passos:",
          {
            steps: [
              "Turno: escolha a data, o turno e o regime.",
              "Máquinas: em cada máquina, digite a quantidade e o número da OP e clique em Concluir (ou tecle Enter). O Dash grava e passa para a próxima.",
              "Conferir e terminar: veja o resumo e os avisos e termine o turno.",
            ],
          },
          "A lista ao lado mostra o que ainda falta. Clique numa máquina da lista para ir direto a ela. Salvar tudo (Ctrl+S) grava todas de uma vez.",
          "Para voltar ao Dash, use Sair. O botão no canto de cima, à esquerda, abre o menu sem sair do apontamento.",
        ],
      },
      {
        q: "E se eu não souber o número da OP?",
        a: [
          "Por enquanto, pode deixar em branco: o apontamento vai como OP não informada. Quando tiver o número, digite só os algarismos.",
          "Dá para completar depois, editando o registro no Histórico.",
        ],
      },
      {
        q: "A máquina não produziu. O que eu faço?",
        a: [
          "Clique em Não produziu e escolha o motivo (ou escreva outro). A máquina fica registrada no turno, sem peças.",
          {
            items: [
              "Manutenção e Setup / troca são paradas planejadas: saem da meta do turno.",
              "Os outros motivos são paradas não planejadas: a meta continua contando.",
            ],
          },
        ],
      },
      {
        q: "Como marco uma OP como retrabalho?",
        a: [
          "No apontamento, marque Retrabalho ao lado da OP e escolha o motivo. Retrabalho não conta como produção.",
          "Os motivos e as taxas ficam em Análises › Retrabalho.",
        ],
      },
      {
        q: "Como registro material que faltou ou alguém que faltou?",
        a: [
          "No último passo do apontamento, Conferir e terminar, fica a seção Ocorrências do turno. Nada ali é obrigatório.",
          {
            items: [
              "Materiais faltantes: busque pelo código ou por parte da descrição. Se o material não aparecer, digite código e descrição. A máquina afetada é opcional.",
              "Falta de pessoas: escolha a pessoa na lista e diga se faltou, saiu mais cedo ou chegou atrasada. O horário é opcional.",
            ],
          },
          "Se uma máquina não produziu por falta de material, o Dash já pergunta qual material faltou. Os nomes só aparecem para líderes e gestor.",
        ],
      },
      {
        q: "A luz caiu no meio do apontamento. Perdi tudo?",
        a: [
          "Não. O que você digitou e ainda não concluiu fica guardado neste computador por 48 horas. Ao abrir o Apontamento de novo, aparece um aviso: clique em Restaurar para continuar de onde parou.",
          "O rascunho fica só neste computador e é apagado quando você sai da conta. Dá para desligá-lo em Preferências.",
        ],
      },
    ],
  },
  {
    title: "Consultar e corrigir",
    faq: [
      {
        q: "Como corrijo um apontamento já salvo?",
        a: [
          {
            steps: [
              "Abra o Histórico e escolha o dia no calendário.",
              "No menu da linha, escolha editar, mover para outra data ou excluir.",
            ],
          },
          "Para agir em vários registros de uma vez, selecione as linhas. Antes de excluir, o Dash pede confirmação.",
        ],
      },
      {
        q: "Como vejo o Histórico sem algumas máquinas?",
        a: [
          "Abra o filtro Máquinas no Histórico. Você pode:",
          {
            items: [
              "desmarcar as que não devem entrar na conta;",
              "buscar pelo nome (por exemplo, kit) e usar Tirar as encontradas;",
              "usar Desmarcar todas e marcar só as que quer ver.",
            ],
          },
          "O calendário, a produção, o atingimento e a tabela passam a contar só as máquinas marcadas. As que ficaram de fora aparecem acima do calendário, com um ✕ para trazê-las de volta. Limpar filtro volta a todas.",
          "O filtro fica no endereço da página: dá para mandar o link para alguém.",
        ],
      },
      {
        q: "Como filtro o Ranking de máquinas?",
        a: [
          "Em Análises › Ranking de máquinas, escolha o período, as máquinas e o turno. O filtro de motivo só funciona quando o ranking é de retrabalho. Limpar filtros volta ao mês atual, com todas as máquinas e turnos.",
        ],
      },
      {
        q: "Como cadastro um colaborador?",
        a: [
          "Em Administração › Colaboradores, clique em Cadastrar colaborador e informe nome e sobrenome, o número de cadastro (opcional), o turno e a linha.",
          "Quem sai da empresa é inativado, não apagado: as faltas antigas continuam com o nome. Líderes também podem cadastrar alguém na hora, pela busca da Falta de pessoas.",
          "No Histórico, cada turno do dia mostra as ocorrências, com um botão para copiar no formato da planilha.",
        ],
      },
      {
        q: "Como exporto os dados?",
        a: [
          "Em Relatórios, escolha o tipo, o período, as máquinas e os turnos.",
          {
            items: [
              "PDF: para imprimir.",
              "Planilha do Excel: resumo com gráficos, tabela por máquina, mapa diário e todos os apontamentos.",
            ],
          },
          "Na tela Máquinas, o botão Exportar baixa o que está na tela, no mesmo formato.",
        ],
      },
    ],
  },
  {
    title: "Metas e números",
    faq: [
      {
        q: "O que significa cada cor de status?",
        a: [
          {
            items: ["Crítico: abaixo de 70% da meta.", "Atenção: de 70% a 89%.", "Próximo: de 90% a 99%.", "Atingido: 100% ou mais."],
          },
          "A cor sempre vem junto com o nome do status.",
        ],
      },
      {
        q: "Por que o atingimento do mês está baixo se os dias apontados vão bem?",
        // Com o banco, a meta é a soma das metas gravadas nos turnos apontados (D08): dia sem apontamento não entra na conta
        a:
          DATA_ORIGIN === "backend"
            ? [
                "O atingimento compara a produção com a soma das metas dos turnos apontados. Turno sem apontamento fica fora da conta: não baixa o atingimento, mas também não soma produção.",
                "Para achar o motivo, abra a aba Detalhado da tela Máquinas e veja os dias abaixo da meta.",
              ]
            : [
                "O atingimento compara a produção com a meta do mês inteiro, e dia sem apontamento conta como zero.",
                "Na aba Detalhado da tela Máquinas, os traços (–) mostram os dias sem registro.",
              ],
      },
      {
        q: "Por que algumas máquinas não aparecem no atingimento?",
        a: [
          "Kit parafusos, bancadas e prensas trabalham por demanda e não têm meta. Por isso ficam fora do atingimento e dos gráficos de meta.",
          "Elas continuam no Apontamento, nas OPs, nos Feedbacks e nas linhas. Na Montagem, aparecem numa lista própria, Postos por demanda, com a produção.",
        ],
      },
      {
        q: "Quem pode mudar as metas?",
        a: [
          "Gestores. Em Metas, clique em Editar metas, ajuste a meta por turno e escolha a partir de quando ela vale. Meta nova nunca muda os números de dias que já passaram.",
        ],
      },
    ],
  },
  {
    title: "OPs e Feedbacks",
    faq: [
      {
        q: "Como uma OP anda até ser concluída?",
        a: [
          {
            steps: [
              "Aguardando liberação: a OP entrou, mas ainda não foi para a máquina.",
              "Em produção: foi liberada e recebe os apontamentos dos turnos. Pode ser pausada, com um motivo.",
              "Pronta para concluir: atingiu a quantidade pedida.",
              "Concluída: um líder ou gestor confirmou.",
            ],
          },
        ],
      },
      {
        q: "Como funcionam os Feedbacks?",
        a: [
          "Cada OP tem uma conversa. A observação que o operador escreve no apontamento vira uma mensagem ali, e líderes e gestor respondem.",
          "Liberar, pausar e concluir a OP aparecem na conversa como avisos do sistema. Quando a OP é concluída, a conversa fecha e fica guardada para consulta.",
        ],
      },
      {
        q: "O que é o Modo TV?",
        a: [
          "É a tela para o telão da fábrica. Cada TV mostra uma área (fábrica inteira, Montagem, Embalagem ou Granel) com o placar dos turnos, o ranking, as peças por minuto, as OPs concluídas e os destaques do mês.",
          "Nunca mostra nome de operador. Barra de espaço pausa, Esc sai.",
        ],
      },
    ],
  },
  {
    title: "Sua conta",
    faq: [
      {
        q: "Como mudo o tema e outras preferências?",
        a: [
          "Clique no seu avatar e escolha Preferências. Lá você escolhe:",
          {
            items: [
              "o tema: claro, escuro ou igual ao do computador;",
              "a página que abre quando você entra;",
              "se o menu lateral começa aberto ou fechado;",
              "no Apontamento, o tamanho dos campos e o rascunho.",
            ],
          },
          "As preferências são só suas e salvam sozinhas.",
        ],
      },
      {
        q: "Como troco minha senha?",
        a: ["Clique no seu avatar, abra Perfil e peça o link para trocar a senha. Ele chega no seu e-mail."],
      },
    ],
  },
];

const textOf = (blocks: Block[]) => blocks.map((b) => (typeof b === "string" ? b : "steps" in b ? b.steps.join(" ") : b.items.join(" "))).join(" ");

function Answer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-100">
      {blocks.map((b, i) =>
        typeof b === "string" ? (
          <p key={i}>{b}</p>
        ) : "steps" in b ? (
          <ol key={i} className="flex list-decimal flex-col gap-050 pl-300">
            {b.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-050 pl-300">
            {b.items.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

const LINKS: Array<{ href: string; title: string; text: string; icon: LucideIcon }> = [
  { href: "#/apontamento", title: "Fazer um apontamento", text: "Registrar o que cada máquina fez no turno", icon: ClipboardList },
  { href: "#/historico", title: "Corrigir apontamentos", text: "Editar, mover ou excluir no Histórico", icon: History },
  { href: "#/metas", title: "Ajustar metas", text: "Mudar a meta por turno de cada máquina", icon: Target },
  { href: "#/relatorios", title: "Gerar um relatório", text: "Baixar PDF ou planilha do período", icon: FileText },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpPage() {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const groups = FAQ_GROUPS.map((g) => ({ ...g, faq: g.faq.filter((f) => !q || normalize(f.q + " " + textOf(f.a)).includes(q)) })).filter(
    (g) => g.faq.length > 0,
  );

  return (
    <>
      <PageHeader title="Ajuda" description="Como usar o Dash de Produção, em respostas curtas." />
      <PageBody>
        <TextField
          label="Buscar na ajuda"
          hideLabel
          placeholder="Buscar na ajuda (ex.: retrabalho, OP, senha)"
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

        <section aria-labelledby="faq" className="flex flex-col gap-200">
          <h2 id="faq" className="font-heading-medium text-default">
            Perguntas frequentes
          </h2>
          {groups.length === 0 ? (
            <div className="rounded-xlarge border">
              <EmptyState
                icon={SearchX}
                title="Nada encontrado"
                hint={`Nenhuma resposta fala de "${query}". Tente outra palavra ou fale com o suporte.`}
                action={{ label: "Limpar busca", onClick: () => setQuery("") }}
              />
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.title} className="flex flex-col gap-100">
                <h3 className="font-heading-xsmall text-subtle">{g.title}</h3>
                <Accordion.Root type="multiple" className="flex flex-col overflow-hidden rounded-xlarge border">
                  {g.faq.map((f) => (
                    <Accordion.Item key={f.q} value={f.q} className="border-t first:border-t-0">
                      <Accordion.Header asChild>
                        <h4>
                        <Accordion.Trigger className="group flex w-full items-center gap-150 px-200 py-150 text-left font-heading-xsmall text-default transition-colors duration-hover ease-out hover:bg-neutral-subtle-hovered">
                          <span className="flex-1">{f.q}</span>
                          <ChevronDown
                            aria-hidden
                            className="size-icon-small shrink-0 text-icon-subtle transition-transform duration-menu ease-out group-data-[state=open]:rotate-180"
                          />
                        </Accordion.Trigger>
                        </h4>
                      </Accordion.Header>
                      <Accordion.Content className="px-200 pb-200 text-subtle">
                        <Answer blocks={f.a} />
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </div>
            ))
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
                  ? "A meta de um período é a soma das metas de cada turno apontado. Hora extra e dia anulado ficam fora, e retrabalho não conta como produção."
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
            <p className="mt-025 text-subtle">Fale com o TI da fábrica. Versão 0.5 · {DATA_ORIGIN === "backend" ? "dados do banco" : `dados de demonstração de ${PERIOD_LABEL}`}.</p>
          </div>
        </section>
      </PageBody>
    </>
  );
}

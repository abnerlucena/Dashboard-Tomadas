import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gauge,
  Maximize,
  Medal,
  Minimize,
  Minus,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DATA_ORIGIN, LINE_ACCENT, REFERENCE_DATE, SHIFTS, SHIFT_META, STATUS_META, plantSeries, statusFor, type Status } from "@/data/machines";
import { cn, formatDecimal, formatNumber, formatShortDate, plural, readToken } from "@/lib/utils";
import { BurnupChart, ShiftStackBars } from "@/components/echarts";
import { BURNUP_LEGEND } from "@/components/echarts/legends";
import { Legend, type LegendItem } from "@/components/data/Chart";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { IconButton } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/Menu";
import { Tag } from "@/components/ui/Tag";
import { WegTile } from "@/components/ui/Misc";
import { useOps } from "@/features/ops/OpsStore";
import {
  CATEGORIES,
  TV_SCOPES,
  highlights,
  machineMonths,
  machineRanking,
  machinesIn,
  opsPerDay,
  shiftScores,
  type TvScope,
} from "./tvMetrics";

const FILL: Record<Status, string> = {
  critical: "bg-danger-bold",
  attention: "bg-warning-bold",
  near: "bg-information-bold",
  achieved: "bg-success-bold",
};
// Tom de status em tamanho grande (mesma dupla dos lozenges)
const STATUS_TONE: Record<Status, string> = {
  critical: "bg-danger text-danger",
  attention: "bg-warning text-warning",
  near: "bg-information text-information",
  achieved: "bg-success text-success",
};
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
// Sem minutos produtivos (o banco ainda não guarda por OP) não há ritmo: "–", não "0,0"
const perMin = (v: number) => (v ? formatDecimal(v) : "–");
// Sem cadastro de OP no banco, "OPs concluídas" não é zero: é desconhecido
const opsCount = (n: number) => (DATA_ORIGIN === "backend" ? "–" : formatNumber(n));
// Na TV, só o nome do turno: horário é poluição visual de longe
const SHIFT_LEGEND_TV: LegendItem[] = SHIFTS.map((s) => ({ label: SHIFT_META[s].label, shape: "rect", colorClass: SHIFT_FILL[s] }));

/**
 * Modo TV: telão no meio da fábrica, entre as máquinas. Cada TV mostra uma
 * área (fábrica inteira ou uma linha). Os slides comparam TURNOS e MÁQUINAS —
 * nunca pessoas — para gerar espírito de equipe sem expor ninguém.
 * Sempre no tema escuro. ← → navegam, Espaço pausa, F tela cheia, Esc sai.
 */
export function TvMode({ scope: scopeParam, onExit }: { scope?: string; onExit: () => void }) {
  const scope: TvScope = TV_SCOPES.some((s) => s.id === scopeParam) ? (scopeParam as TvScope) : "fabrica";
  const scopeLabel = TV_SCOPES.find((s) => s.id === scope)!.label;
  const { ops } = useOps();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(new Date());
  const [fullscreen, setFullscreen] = useState(false);

  const machines = useMemo(() => machinesIn(scope), [scope]);
  const withTarget = machines.filter((m) => m.hasTarget);
  const scores = useMemo(() => shiftScores(machines, ops), [machines, ops]);
  const ranking = useMemo(() => machineRanking(machines), [machines]);
  const months = useMemo(() => machineMonths(scope === "fabrica" ? withTarget : machines, ops), [machines, withTarget, ops, scope]);
  const perDay = useMemo(() => opsPerDay(machines, ops), [machines, ops]);
  const best = useMemo(() => highlights(machines, machineMonths(machines, ops), scores), [machines, ops, scores]);

  const slides: Array<{ title: string; body: ReactNode }> = [
    { title: "Placar dos turnos", body: <ShiftBoard scores={scores} /> },
    ...(ranking.length >= 2 ? [{ title: "Ranking das máquinas", body: <MachineRanking ranking={ranking} /> }] : []),
    {
      title: scope === "fabrica" ? "Máquinas com meta no mês" : "Máquina a máquina no mês",
      body: <MachineCards months={months} />,
    },
    {
      title: "Ritmo da produção",
      body: (
        <div className="grid h-full grid-cols-1 gap-400 l:grid-cols-[minmax(0,1fr)_var(--dash-size-tv-value)]">
          <div className="flex min-h-0 flex-col gap-200">
            <div className="flex flex-wrap items-center justify-between gap-200">
              <h2 className="font-tv-body text-default">OPs concluídas por dia</h2>
              <Legend items={SHIFT_LEGEND_TV} className="[&>li]:font-tv-body" />
            </div>
            <div className="min-h-0 flex-1">
              <ShiftStackBars days={perDay} label="OPs concluídas por dia, por turno" unit="OPs concluídas" />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-300">
            <span className="font-tv-body text-subtle">Peças por minuto</span>
            {scores.map((s) => (
              <span key={s.shift} className="flex items-center gap-200">
                <span aria-hidden className={cn("size-200 shrink-0 rounded-full", SHIFT_FILL[s.shift])} />
                <span className="flex-1 font-tv-body text-default">{SHIFT_META[s.shift].label}</span>
                <span className="font-tv-metric tabular-nums text-default">{perMin(s.perMinute)}</span>
              </span>
            ))}
          </div>
        </div>
      ),
    },
    { title: "Destaques do mês", body: <Highlights data={best} hasRanking={ranking.length >= 2} /> },
    {
      title: "Produção acumulada vs meta",
      body: (
        <div className="flex h-full flex-col gap-200">
          <Legend items={BURNUP_LEGEND} className="[&>li]:font-tv-body" />
          <div className="min-h-0 flex-1">
            <BurnupChart series={plantSeries(withTarget)} label={`Produção acumulada vs meta · ${scopeLabel}`} heightClass="h-full" variant="tv" />
          </div>
        </div>
      ),
    },
  ];

  const count = slides.length;
  const go = useCallback((dir: number) => setSlide((s) => (s + dir + count) % count), [count]);
  const index = Math.min(slide, count - 1);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Rotação automática; a troca manual reinicia o tempo (a key reinicia a barra)
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => go(1), readToken("--dash-tv-slide-duration"));
    return () => window.clearTimeout(t);
  }, [slide, paused, go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") setPaused((p) => !p);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement) onExit();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen, onExit]);

  const current = slides[index];

  return (
    // data-color-mode="dark" aplica os tokens escuros só neste bloco
    <div data-color-mode="dark" className="flex h-dvh flex-col bg-surface text-default">
      <header className="flex flex-wrap items-center gap-300 border-b px-400 py-200">
        <span className="flex items-center gap-150">
          <WegTile />
          <span className="flex flex-col">
            <span className="font-heading-small">Dash de Produção · {scopeLabel}</span>
            <span className="font-body-small text-subtle">Tomadas &amp; Interruptores · Itajaí</span>
          </span>
        </span>
        <h1 className="min-w-0 flex-1 truncate text-center font-tv-title">{current.title}</h1>
        <span className="flex flex-col items-end">
          <span className="font-tv-body tabular-nums">{clock.format(now)}</span>
          {/* hora ao vivo; a data é a do último dado (pode ser ontem, cedo): o rótulo diz isso */}
          <span className="font-body-small text-subtle">Dados até {today.format(REFERENCE_DATE)}</span>
        </span>
      </header>

      <main aria-live="polite" className="min-h-0 flex-1 overflow-hidden px-600 py-400">
        <div key={`${scope}-${index}`} className="h-full animate-fade-in">
          {current.body}
        </div>
      </main>

      <footer className="flex items-center gap-200 border-t px-400 py-150">
        <span className="flex items-center gap-050">
          <IconButton icon={ChevronLeft} label="Slide anterior" shortcut="←" onClick={() => go(-1)} />
          <IconButton icon={paused ? Play : Pause} label={paused ? "Retomar rotação" : "Pausar rotação"} shortcut="Espaço" onClick={() => setPaused((p) => !p)} />
          <IconButton icon={ChevronRight} label="Próximo slide" shortcut="→" onClick={() => go(1)} />
        </span>
        <ol aria-label="Slides" className="flex flex-1 items-center gap-100">
          {slides.map((s, i) => (
            <li key={s.title} className="flex-1">
              <button
                type="button"
                aria-label={`${i + 1}. ${s.title}`}
                aria-current={i === index ? "step" : undefined}
                onClick={() => setSlide(i)}
                className="block h-control-compact w-full"
              >
                <span className="relative block h-050 overflow-hidden rounded-full bg-neutral">
                  {i < index && <span className="absolute inset-0 bg-neutral-bold" />}
                  {i === index && (
                    <span key={`${index}-${paused}`} className={cn("absolute inset-0 origin-left bg-brand-bold", paused ? "" : "animate-tv-progress")} />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <Lozenge>{paused ? "Pausado" : `${index + 1} de ${count}`}</Lozenge>
        {/* Cada telão mostra uma área da fábrica */}
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="ds-pressable h-control rounded-medium border px-150 font-body text-default hover:bg-neutral-subtle-hovered"
              aria-label={`Área exibida: ${scopeLabel}`}
            >
              Área: <span className="font-semibold">{scopeLabel}</span>
            </button>
          </MenuTrigger>
          <MenuContent align="end" side="top" data-color-mode="dark">
            <MenuLabel>Esta TV mostra</MenuLabel>
            <MenuRadioGroup
              value={scope}
              onValueChange={(v) => {
                setSlide(0);
                window.location.hash = v === "fabrica" ? "/tv" : `/tv/${v}`;
              }}
            >
              {TV_SCOPES.map((s) => (
                <MenuRadioItem key={s.id} value={s.id}>
                  {s.label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} shortcut="F" onClick={toggleFullscreen} />
        <IconButton icon={X} label="Sair do Modo TV" shortcut="Esc" onClick={onExit} />
      </footer>
    </div>
  );
}

/* ---------- Slides ---------- */

function ShiftBoard({ scores }: { scores: ReturnType<typeof shiftScores> }) {
  return (
    <ol className="grid h-full grid-cols-1 content-center gap-300 m:grid-cols-3">
      {scores.map((s, i) => {
        const st = statusFor(s.percent);
        const leader = i === 0 && s.competing;
        const row = (key: keyof typeof CATEGORIES, value: string) => (
          <li className="flex items-center gap-150 border-t py-150 first:border-t-0">
            <span className="flex-1 font-tv-body text-subtle">{CATEGORIES[key].label}</span>
            <span className="font-tv-body font-semibold tabular-nums text-default">{value}</span>
            <span className="flex w-300 justify-end">
              {s.wins.includes(key) && <Trophy aria-label="melhor da fábrica nesta categoria" className="size-icon-large text-icon-warning" />}
            </span>
          </li>
        );
        return (
          <li
            key={s.shift}
            className={cn(
              "flex flex-col gap-200 rounded-xlarge p-400",
              s.competing ? "bg-surface-raised shadow-raised" : "bg-surface-sunken",
              leader ? "border-thick border-selected" : "border-thick border-transparent",
            )}
          >
            <span className="flex items-center gap-150">
              {s.competing && <span className="font-tv-metric tabular-nums text-subtle">{i + 1}º</span>}
              <span aria-hidden className={cn("size-200 rounded-full", SHIFT_FILL[s.shift])} />
              <span className="font-tv-body font-semibold text-default">{SHIFT_META[s.shift].label}</span>
              {leader && <Trophy aria-label="Líder do mês" className="ml-auto size-600 text-icon-warning" />}
            </span>
            <span className="flex flex-wrap items-baseline gap-200">
              {s.target > 0 ? (
                <>
                  <span className="font-tv-hero tabular-nums text-default">{s.percent}%</span>
                  <span className={cn("rounded-small px-150 py-050 font-tv-body", STATUS_TONE[st])}>{STATUS_META[st].label}</span>
                </>
              ) : (
                // Turno só com hora extra: produz, mas não tem meta (D27)
                <span className="font-tv-hero tabular-nums text-default">{formatNumber(s.produced)}</span>
              )}
            </span>
            <span className="font-tv-body text-subtlest">{s.target > 0 ? "da meta do turno" : "peças, sem meta neste turno"}</span>
            <ul>
              {row("perMinute", perMin(s.perMinute))}
              {row("opsDone", opsCount(s.opsDone))}
              {row("reworkRate", `${formatDecimal(s.reworkRate)}%`)}
            </ul>
            <span className="font-tv-body text-subtle">
              {!s.competing
                ? "Hora extra · fora da disputa"
                : s.wins.length
                  ? `Melhor em ${s.wins.length} de ${Object.keys(CATEGORIES).length} categorias`
                  : "Na briga em todas as categorias"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MachineRanking({ ranking }: { ranking: ReturnType<typeof machineRanking> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-150">
      <p aria-hidden className="grid grid-cols-tv-rank items-center gap-300 font-body-large text-subtlest">
        <span />
        <span>Máquina</span>
        <span>Atingimento da meta do mês</span>
        <span className="text-right">%</span>
        <span className="text-center">Semana</span>
        <span className="text-right">Peças/min</span>
      </p>
      <ol className="flex flex-col gap-150">
        {ranking.slice(0, 10).map((r) => {
          const MoveIcon = r.move > 0 ? ArrowUp : r.move < 0 ? ArrowDown : Minus;
          return (
            <li key={r.machine.id} className="grid grid-cols-tv-rank items-center gap-300">
              <span className="flex items-center gap-100 font-tv-metric tabular-nums text-default">
                {r.position}º
                {r.position <= 3 && <Medal aria-label={`${r.position}º lugar`} className="size-icon-large text-icon-warning" />}
              </span>
              <span className="truncate font-tv-body text-default">{r.machine.name}</span>
              <span className="relative h-300 rounded-r-small bg-neutral">
                <span aria-hidden className={cn("absolute inset-y-0 left-0 rounded-r-small", FILL[r.machine.status])} style={{ width: `${Math.min(r.percent, 100)}%` }} />
              </span>
              <span className="text-right font-tv-body font-semibold tabular-nums text-default">{r.percent}%</span>
              <span
                className={cn(
                  "flex items-center justify-center gap-050 font-tv-body tabular-nums",
                  r.move > 0 ? "text-success" : r.move < 0 ? "text-danger" : "text-subtlest",
                )}
                aria-label={r.move === 0 ? "mesma posição da semana passada" : `${r.move > 0 ? "subiu" : "caiu"} ${plural(Math.abs(r.move), "posição", "posições")}`}
              >
                <MoveIcon aria-hidden className="size-icon-large" />
                {r.move !== 0 && Math.abs(r.move)}
              </span>
              <span className="text-right font-tv-body tabular-nums text-default">{perMin(r.perMinute)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MachineCards({ months }: { months: ReturnType<typeof machineMonths> }) {
  return (
    // auto-rows-fr: as linhas dividem a altura toda; o conteúdo do cartão fica centralizado na vertical
    <ul className="grid h-full auto-rows-fr grid-cols-tv-cards gap-200">
      {months.map(({ machine: m, perMinute, opsDone, daysOnTarget, streak }) => (
        <li key={m.id} className="flex min-h-0 flex-col justify-center gap-150 rounded-xlarge bg-surface-raised p-300 shadow-raised">
          <span className="flex items-start justify-between gap-100">
            <span className="line-clamp-2 font-tv-body font-semibold text-default">{m.name}</span>
            {!m.hasTarget && <Tag accent={LINE_ACCENT["Por demanda"]}>Por demanda</Tag>}
          </span>
          {m.hasTarget ? (
            <span className="flex items-center gap-150">
              <span className="font-tv-metric tabular-nums text-default">{m.percent}%</span>
              <span className={cn("rounded-small px-100 py-025 font-body-large font-semibold", STATUS_TONE[m.status])}>{STATUS_META[m.status].label}</span>
            </span>
          ) : (
            <span className="flex items-baseline gap-100">
              <span className="font-tv-metric tabular-nums text-default">{formatNumber(m.produced)}</span>
              <span className="font-body-large text-subtle">peças</span>
            </span>
          )}
          {/* Valor grande em cima, rótulo curto embaixo: três colunas sem atropelar */}
          <dl className="grid grid-cols-3 items-start gap-150">
            {[
              ["peças/min", perMin(perMinute)],
              ["OPs feitas", opsCount(opsDone)],
              [m.hasTarget ? "dias na meta" : "dias", m.hasTarget ? daysOnTarget : m.days],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex min-w-0 flex-col-reverse justify-end">
                <dt className="font-body-large text-subtlest">{label}</dt>
                <dd className="font-tv-body font-semibold tabular-nums text-default">{value}</dd>
              </div>
            ))}
          </dl>
          {streak >= 2 && (
            <span className="flex items-center gap-075 font-tv-body font-semibold text-warning">
              <Flame aria-hidden className="size-icon-large" />
              {streak} dias seguidos na meta
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Highlights({ data, hasRanking }: { data: ReturnType<typeof highlights>; hasRanking: boolean }) {
  const cards: Array<{ icon: LucideIcon; label: string; value: string; detail: string } | null> = [
    hasRanking && data.climber && data.climber.move > 0
      ? { icon: TrendingUp, label: "Subiu no ranking", value: `+${data.climber.move}`, detail: `${data.climber.machine.name} ganhou ${plural(data.climber.move, "posição", "posições")} desde a semana passada` }
      : null,
    data.improved
      ? { icon: Sparkles, label: "Maior evolução", value: `+${formatDecimal(data.improved.gain)} p.p.`, detail: `${data.improved.m.name}, no atingimento desde a semana passada` }
      : null,
    data.record?.bestDay
      ? { icon: Trophy, label: "Recorde do mês", value: formatNumber(data.record.bestDay.value), detail: `peças em um dia · ${data.record.machine.name}, ${formatShortDate(data.record.bestDay.date)}` }
      : null,
    data.streak && data.streak.streak >= 2
      ? { icon: Flame, label: "Sequência na meta", value: `${data.streak.streak} dias`, detail: `${data.streak.machine.name} bate a meta diária sem parar` }
      : null,
    data.fastest?.perMinute ? { icon: Gauge, label: "Mais rápida", value: `${perMin(data.fastest.perMinute)}/min`, detail: data.fastest.machine.name } : null,
    data.cleanest
      ? { icon: ShieldCheck, label: "Menos retrabalho", value: SHIFT_META[data.cleanest.shift].label, detail: `${formatDecimal(data.cleanest.reworkRate)}% das peças retrabalhadas` }
      : null,
  ];
  return (
    // Feito para ser lido de longe: valor no maior tamanho da TV, rótulo e detalhe em fonte de TV
    <ul className="grid h-full auto-rows-fr grid-cols-1 gap-300 m:grid-cols-3">
      {cards.filter(Boolean).map((c) => {
        const Icon = c!.icon;
        return (
          <li key={c!.label} className="flex min-h-0 flex-col justify-center gap-200 rounded-xlarge bg-surface-raised p-400 shadow-raised">
            <span className="flex items-center gap-150 font-tv-body font-semibold text-default">
              <Icon aria-hidden className="size-500 shrink-0 text-icon-warning" />
              {c!.label}
            </span>
            <span className="font-tv-hero tabular-nums text-default">{c!.value}</span>
            <span className="line-clamp-2 font-tv-body text-subtle">{c!.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}

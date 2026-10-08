import * as Popover from "@radix-ui/react-popover";
import {
  Bell,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Cog,
  Boxes,
  Factory,
  PackageOpen,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  Sun,
  Target,
  Trophy,
  Tv,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DATA_ORIGIN, PERIOD_LABEL, SHIFTS, SHIFT_META, TARGET_MACHINES, aggregate, type Shift } from "@/data/machines";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { Lozenge } from "@/components/ui/Lozenge";
import { AppRoot, Banner, Main } from "@/components/layout/AppRoot";
import { useLayout } from "@/components/layout/LayoutContext";
import { SideNav, SideNavBody, SideNavFooter, SideNavItem, SideNavSection } from "@/components/layout/SideNav";
import {
  SideNavToggleButton,
  TopNav,
  TopNavContent,
  TopNavEnd,
  TopNavMiddle,
  TopNavStart,
} from "@/components/layout/TopNav";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, FlagStack, type FlagData } from "@/components/ui/Feedback";
import { Kbd } from "@/components/ui/Kbd";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/Menu";
import { Avatar, WegTile } from "@/components/ui/Misc";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { MachinesPage, type DemoState } from "@/features/machines/MachinesPage";
import { EntryPage } from "@/features/entry/EntryPage";
import { MetasPage } from "@/features/metas/MetasPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { MachineRegistryPage } from "@/features/registry/MachineRegistryPage";
import { RankingPage } from "@/features/analysis/RankingPage";
import { ReworkPage } from "@/features/analysis/ReworkPage";
import { FeedbacksPage } from "@/features/feedbacks/FeedbacksPage";
import { OpsPage } from "@/features/ops/OpsPage";
import { useOps } from "@/features/ops/OpsStore";
import { OpsProvider } from "@/features/ops/OpsProvider";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { TvMode } from "@/features/tv/TvMode";
import { HelpPage } from "@/features/help/HelpPage";
import { AccessPage } from "@/features/access/AccessPage";
import { useAccess } from "@/features/access/AccessContext";
import { AccessProvider } from "@/features/access/AccessProvider";
import { accessLabel } from "@/features/access/permissions";
import { UsersPage } from "@/features/access/UsersPage";
import { BackendGate } from "@/features/data/BackendGate";
import { Spinner } from "@/components/ui/Spinner";
import { useColorMode, type ColorModePreference } from "@/lib/hooks";
import { cn, plural, readToken, storageGet, storageSet, type Notify } from "@/lib/utils";

/* ---------- Navegação ---------- */
type NavEntry = { id: string; label: string; icon?: LucideIcon; count?: number; dot?: string };

const NAV_MAIN: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "apontamento", label: "Apontamento", icon: ClipboardList },
  { id: "ops", label: "OPs", icon: ScrollText },
  { id: "historico", label: "Histórico", icon: History },
  { id: "metas", label: "Metas", icon: Target },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "feedbacks", label: "Feedbacks", icon: MessageSquare },
  { id: "relatorios", label: "Relatórios", icon: FileText },
];
const NAV_SECTIONS: Array<{ title: string; items: NavEntry[] }> = [
  {
    title: "Linhas",
    items: [
      { id: "linha-montagem", label: "Montagem", icon: Factory },
      { id: "linha-embalagem", label: "Embalagem", icon: PackageOpen },
      { id: "linha-granel", label: "Granel", icon: Boxes },
    ],
  },
  {
    title: "Análises",
    items: [
      { id: "ranking", label: "Ranking de máquinas", icon: Trophy },
      { id: "retrabalho", label: "Retrabalho", icon: RotateCcw },
    ],
  },
  {
    title: "Turnos",
    // Mesma cor do turno nos gráficos (paleta categórica validada); não indica status
    items: [
      { id: "turno-1", label: "Turno 1", dot: "bg-chart-categorical-1" },
      { id: "turno-2", label: "Turno 2", dot: "bg-chart-categorical-2" },
      { id: "turno-3", label: "Turno 3", dot: "bg-chart-categorical-3" },
    ],
  },
  {
    // Cada item só aparece para quem tem a permissão dele (users.approve, machines.manage)
    title: "Administração",
    items: [
      { id: "usuarios", label: "Usuários", icon: Users },
      { id: "cadastro-maquinas", label: "Cadastro de máquinas", icon: Cog },
    ],
  },
];
const ALL_NAV = [...NAV_MAIN, ...NAV_SECTIONS.flatMap((s) => s.items), { id: "tv", label: "Modo TV" }, { id: "ajuda", label: "Ajuda" }];

/* Linhas e turnos reaproveitam a tela Máquinas com um recorte fixo */
const LINE_ROUTES: Record<string, { title: string; breadcrumbs: string[]; groupId: string }> = {
  "linha-montagem": { title: "Montagem", breadcrumbs: ["Linhas"], groupId: "montagem" },
  "linha-embalagem": { title: "Embalagem", breadcrumbs: ["Linhas"], groupId: "embalagem" },
  "linha-granel": { title: "Granel", breadcrumbs: ["Linhas"], groupId: "granel" },
};
const SHIFT_ROUTES: Record<string, { title: string; breadcrumbs: string[]; presetShift: Shift; titleAccessory: ReactNode }> =
  Object.fromEntries(
    SHIFTS.map((s) => [
      `turno-${s}`,
      {
        title: SHIFT_META[s].label,
        breadcrumbs: ["Turnos"],
        presetShift: s,
        titleAccessory: (
          <Lozenge>
            <span aria-hidden className={cn("size-dot rounded-full", SHIFT_FILL[s])} />
            {SHIFT_META[s].hours}
          </Lozenge>
        ),
      },
    ]),
  );

/** O Dash atende uma única seção: Produção Tomadas & Interruptores, em Itajaí */
const SECTION_LABEL = "Tomadas & Interruptores · Itajaí";


/** "#/feedbacks/4510000" → rota "feedbacks", parâmetro "4510000" */
function useHashRoute() {
  const read = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, "")) || "dashboard";
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onHash = () => setPath(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [route, param] = path.split("/");
  return { route, param };
}

export default function App() {
  return (
    <AccessProvider
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-surface-sunken">
          <Spinner label="Carregando o Dash de Produção" />
        </div>
      }
    >
      <Gate />
    </AccessProvider>
  );
}

/**
 * Porta de entrada: sem sessão válida, só a tela de acesso. Tela de TV
 * (conta "display") só abre o Modo TV. Esconder na tela é conveniência;
 * quem barra de verdade é o banco (RLS).
 */
function Gate() {
  const { session, logout, canOpen } = useAccess();
  const { route, param } = useHashRoute();
  if (!session)
    return (
      <TooltipProvider>
        <AccessPage />
      </TooltipProvider>
    );
  // Com backend, as telas só montam depois de os dados de produção chegarem
  if (session.accountType === "display" || (route === "tv" && canOpen("tv")))
    return (
      <BackendGate>
        <OpsProvider>
          <TooltipProvider>
            <TvMode
              scope={route === "tv" ? param : undefined}
              onExit={() => (session.accountType === "display" ? logout() : (window.location.hash = "/dashboard"))}
            />
          </TooltipProvider>
        </OpsProvider>
      </BackendGate>
    );
  return (
    <BackendGate>
      <OpsProvider>
        <Shell />
      </OpsProvider>
    </BackendGate>
  );
}

function Shell() {
  const { route: rawRoute, param } = useHashRoute();
  const { canOpen } = useAccess();
  // Início: o Dashboard; quem não pode vê-lo cai na primeira tela liberada
  const home = [...NAV_MAIN, ...NAV_SECTIONS.flatMap((s) => s.items)].find((n) => canOpen(n.id))?.id ?? "ajuda";
  const route = rawRoute === "dashboard" && !canOpen("dashboard") ? home : rawRoute;
  const { totalUnread } = useOps();
  const colorMode = useColorMode();
  const [search, setSearch] = useState("");
  const [demoState, setDemoState] = useState<DemoState>("live");
  const [flags, setFlags] = useState<FlagData[]>([]);
  const [bannerOpen, setBannerOpen] = useState(() => !storageGet("dash-proto.banner.dismissed", false));
  const flagId = useRef(0);

  const notify = useCallback<Notify>((title, description, appearance = "success", action) => {
    setFlags((f) => [...f.slice(-2), { id: ++flagId.current, title, description, appearance, action }]);
  }, []);
  const dismissFlag = useCallback((id: number) => setFlags((f) => f.filter((x) => x.id !== id)), []);

  // "Tentar novamente" / estado de carregamento de demonstração volta sozinho
  useEffect(() => {
    if (demoState !== "loading") return;
    const t = window.setTimeout(() => setDemoState("live"), readToken("--ds-motion-duration-skeleton"));
    return () => window.clearTimeout(t);
  }, [demoState]);


  const current = ALL_NAV.find((n) => n.id === route);

  return (
    <TooltipProvider>
      <AppRoot
        banner={
          bannerOpen && (
            <Banner
              onDismiss={() => {
                setBannerOpen(false);
                storageSet("dash-proto.banner.dismissed", true);
              }}
            >
              {DATA_ORIGIN === "backend"
                ? `Dados do banco · ${PERIOD_LABEL}`
                : `Modo de demonstração · dados fictícios de ${PERIOD_LABEL}`}
            </Banner>
          )
        }
        topNav={
          <TopNav>
            <TopNavStartArea />
            <TopNavContent>
              <TopNavMiddle>
                <SearchField value={search} onChange={setSearch} />
              </TopNavMiddle>
              <TopNavEnd>
                <Notifications unreadFeedbacks={totalUnread} />
                {/* No mobile, ajuda fica no menu lateral e tema/estados vão para o menu do avatar (estados só na demonstração) */}
                <span className="hidden items-center gap-050 s:flex">
                  <IconButton icon={CircleHelp} label="Ajuda" onClick={() => (window.location.hash = "/ajuda")} />
                  <ThemeMenu preference={colorMode.preference} resolved={colorMode.resolved} onChange={colorMode.setPreference} />
                  {DATA_ORIGIN === "demo" && <DemoMenu value={demoState} onChange={setDemoState} />}
                </span>
                <UserMenu
                  colorMode={colorMode.preference}
                  onColorModeChange={colorMode.setPreference}
                  demoState={demoState}
                  onDemoStateChange={setDemoState}
                />
              </TopNavEnd>
            </TopNavContent>
          </TopNav>
        }
        sideNav={
          <SideNav header={<SectionBrand />}>
            <SideNavBody>
              <SideNavSection>
                {NAV_MAIN.filter((n) => canOpen(n.id)).map((n) => (
                  <SideNavItem
                    key={n.id}
                    href={`#/${n.id}`}
                    label={n.label}
                    icon={n.icon}
                    count={n.id === "feedbacks" && totalUnread > 0 ? totalUnread : undefined}
                    isCurrent={route === n.id}
                  />
                ))}
              </SideNavSection>
              {NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((n) => canOpen(n.id)) }))
                .filter((section) => section.items.length > 0)
                .map((section) => (
                  <SideNavSection key={section.title} title={section.title}>
                    {section.items.map((n) => (
                      <SideNavItem
                        key={n.id}
                        href={`#/${n.id}`}
                        label={n.label}
                        icon={n.icon}
                        isCurrent={route === n.id}
                        elemBefore={n.dot && <span className={cn("size-dot rounded-full", n.dot)} />}
                      />
                    ))}
                  </SideNavSection>
                ))}
            </SideNavBody>
            <SideNavFooter>
              {canOpen("tv") && <SideNavItem href="#/tv" label="Modo TV" icon={Tv} isCurrent={route === "tv"} />}
              <SideNavItem href="#/ajuda" label="Ajuda" icon={CircleHelp} isCurrent={route === "ajuda"} />
              <SideNavUser />
            </SideNavFooter>
          </SideNav>
        }
      >
        <Main>
          {current && !canOpen(route) ? (
            <div className="px-200 pt-300 m:px-400">
              <h1 className="font-heading-large text-default">{current.label}</h1>
              <EmptyState
                icon={Lock}
                title="Sem permissão para esta tela"
                hint="O seu perfil não inclui esta área. Se precisar dela para o seu trabalho, peça ao gestor para liberar a permissão."
                action={{ label: "Ir para o início", icon: LayoutDashboard, onClick: () => (window.location.hash = `/${home}`) }}
              />
            </div>
          ) : route === "dashboard" || LINE_ROUTES[route] || SHIFT_ROUTES[route] ? (
            <MachinesPage
              key={route}
              {...(LINE_ROUTES[route] ?? SHIFT_ROUTES[route] ?? {})}
              search={search}
              onClearSearch={() => setSearch("")}
              demoState={demoState}
              onDemoStateChange={setDemoState}
              notify={notify}
            />
          ) : route === "apontamento" ? (
            <EntryPage notify={notify} />
          ) : route === "metas" ? (
            <MetasPage notify={notify} />
          ) : route === "calendario" ? (
            <CalendarPage notify={notify} />
          ) : route === "historico" ? (
            <HistoryPage key={param ?? ""} machineParam={param} notify={notify} />
          ) : route === "ranking" ? (
            <RankingPage />
          ) : route === "retrabalho" ? (
            <ReworkPage />
          ) : route === "feedbacks" ? (
            <FeedbacksPage opParam={param} notify={notify} />
          ) : route === "ops" ? (
            <OpsPage notify={notify} />
          ) : route === "relatorios" ? (
            <ReportsPage notify={notify} />
          ) : route === "cadastro-maquinas" ? (
            <MachineRegistryPage notify={notify} />
          ) : route === "usuarios" ? (
            <UsersPage notify={notify} />
          ) : route === "ajuda" ? (
            <HelpPage />
          ) : (
            <div className="px-200 pt-300 m:px-400">
              <h1 className="font-heading-large text-default">{current?.label ?? "Página não encontrada"}</h1>
              <EmptyState
                icon={current?.icon ?? LayoutDashboard}
                title="Página não encontrada"
                hint="Este endereço não existe no Dash de Produção. Use o menu ao lado para escolher uma tela."
                action={{ label: "Ir para o Dashboard", icon: LayoutDashboard, onClick: () => (window.location.hash = "/dashboard") }}
              />
            </div>
          )}
        </Main>
      </AppRoot>
      <FlagStack flags={flags} onDismiss={dismissFlag} />
    </TooltipProvider>
  );
}

/* ---------- Top nav: início ---------- */
function TopNavStartArea() {
  const { isSideNavInline, isMedium } = useLayout();
  return (
    <TopNavStart>
      {isSideNavInline ? (
        // Expandida: o cabeçalho da side nav sobe para cá → barra lateral de altura total
        <>
          <div className="min-w-0 flex-1">
            <SectionBrand />
          </div>
          <SideNavToggleButton />
        </>
      ) : (
        <>
          <SideNavToggleButton />
          <a href="#/dashboard" className="flex items-center gap-100 rounded-medium pr-050" aria-label="Dash de Produção, início">
            <WegTile />
            {isMedium && <span className="font-heading-xsmall text-default">Dash de Produção</span>}
          </a>
        </>
      )}
    </TopNavStart>
  );
}

/** Identificação da seção (única): logo, nome do produto e a seção atendida */
function SectionBrand() {
  return (
    <a
      href="#/dashboard"
      aria-label={`Dash de Produção, ${SECTION_LABEL}. Ir para o início`}
      className="ds-pressable flex w-full min-w-0 items-center gap-100 rounded-medium p-050 hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed"
    >
      <WegTile />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-heading-xsmall text-default">Dash de Produção</span>
        <span className="truncate font-body-small text-subtle">{SECTION_LABEL}</span>
      </span>
    </a>
  );
}

/* ---------- Top nav: busca ---------- */
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { isMedium } = useLayout();
  // < 768px: a busca vira um botão; aberta, ocupa a top nav inteira
  const [expanded, setExpanded] = useState(false);
  const compact = !isMedium;

  useEffect(() => {
    if (expanded) ref.current?.focus();
  }, [expanded]);
  useEffect(() => {
    if (isMedium) setExpanded(false);
  }, [isMedium]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        if (compact) setExpanded(true);
        else ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  if (compact && !expanded) {
    return (
      <div className="flex w-full justify-end">
        <IconButton icon={Search} label={value ? `Buscar: ${value}` : "Buscar"} isSelected={!!value} onClick={() => setExpanded(true)} />
      </div>
    );
  }

  const field = (
    <label className="group relative flex w-full max-w-search-width items-center">
      <span className="sr-only">Buscar máquinas e linhas</span>
      <Search aria-hidden className="pointer-events-none absolute left-100 size-icon-small text-icon-subtle" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          onChange("");
          if (compact) setExpanded(false);
          else e.currentTarget.blur();
        }}
        placeholder="Buscar máquinas e linhas"
        className="h-control w-full min-w-0 rounded-medium border border-input bg-input pl-400 pr-400 font-body text-default transition-colors duration-hover ease-out placeholder:text-subtlest hover:bg-input-hovered focus:border-focused"
      />
      <span className="pointer-events-none absolute right-100 hidden s:flex group-focus-within:hidden">
        <Kbd>/</Kbd>
      </span>
    </label>
  );

  if (!compact) return field;
  return (
    <div className="absolute inset-0 z-sticky flex items-center gap-100 border-b bg-surface px-150">
      {field}
      <Button appearance="subtle" onClick={() => setExpanded(false)}>
        Cancelar
      </Button>
    </div>
  );
}

/* ---------- Top nav: fim ---------- */
const NOTIFICATIONS = [
  { id: 1, dot: "bg-icon-danger", status: "Crítico", title: "Meta de março em risco", body: "", time: "há 12 min" },
  { id: 3, dot: "bg-icon-warning", status: "Atenção", title: "Turno 3 sem apontamento", body: "Máquina de tomadas Composé não registrou produção no Turno 3 em 26/03.", time: "ontem" },
];

function Notifications({ unreadFeedbacks }: { unreadFeedbacks: number }) {
  // Os avisos são de exemplo: com dados reais não aparecem (alertas de verdade são outra etapa)
  // O exemplo de meta em risco usa o atingimento de verdade (o texto fixo dizia 49% com o Dashboard em 76%)
  const examples =
    DATA_ORIGIN === "demo"
      ? NOTIFICATIONS.map((n) =>
          n.id === 1 ? { ...n, body: `Atingimento geral em ${aggregate(TARGET_MACHINES).percent}% a 2 dias úteis do fim do mês.` } : n,
        )
      : [];
  // O aviso de feedbacks acompanha o mesmo contador de não lidos do menu
  const items = [
    ...examples.slice(0, 1),
    ...(unreadFeedbacks > 0
      ? [
          {
            id: 2,
            dot: "bg-icon-brand",
            status: "Novo",
            title: plural(unreadFeedbacks, "feedback novo", "feedbacks novos"),
            body: "Observações dos operadores aguardando leitura.",
            // sem horário: o contador não sabe quando chegou a última
          },
        ]
      : []),
    ...examples.slice(1),
  ];
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton icon={Bell} label={`Notificações, ${plural(items.length, "não lida", "não lidas")}`} className="data-[state=open]:bg-neutral-subtle-pressed">
          {items.length > 0 && (
            <span aria-hidden className="absolute right-075 top-075 size-status-dot rounded-full border-thick border-surface bg-icon-danger" />
          )}
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-menu w-popover max-w-full origin-popover rounded-large bg-surface-overlay text-default shadow-overlay data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in"
        >
          <div className="flex items-center justify-between border-b px-200 py-150">
            <h2 className="font-heading-small">Notificações</h2>
            <span className="font-body-small text-subtlest">{plural(items.length, "não lida", "não lidas")}</span>
          </div>
          {items.length === 0 && <p className="px-200 py-200 text-subtle">Nada novo por aqui.</p>}
          <ul className="py-050">
            {items.map((n) => (
              <li key={n.id} className="flex gap-150 px-200 py-150 transition-colors duration-hover ease-out hover:bg-neutral-subtle-hovered">
                <span aria-hidden className={cn("mt-075 size-dot shrink-0 rounded-full", n.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="sr-only">{n.status}: </span>
                    {n.title}
                  </p>
                  <p className="mt-025 text-subtle">{n.body}</p>
                  {"time" in n && n.time && <p className="mt-050 font-body-small text-subtlest">{n.time}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ThemeMenu({
  preference,
  resolved,
  onChange,
}: {
  preference: ColorModePreference;
  resolved: "light" | "dark";
  onChange: (p: ColorModePreference) => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton icon={resolved === "dark" ? Moon : Sun} label="Tema" className="data-[state=open]:bg-neutral-subtle-pressed" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Tema</MenuLabel>
        <MenuRadioGroup value={preference} onValueChange={(v) => onChange(v as ColorModePreference)}>
          <MenuRadioItem value="light">
            <Sun aria-hidden className="size-icon-small text-icon-subtle" /> Claro
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <Moon aria-hidden className="size-icon-small text-icon-subtle" /> Escuro
          </MenuRadioItem>
          <MenuRadioItem value="auto">
            <Monitor aria-hidden className="size-icon-small text-icon-subtle" /> Igual ao sistema
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function DemoMenu({ value, onChange }: { value: DemoState; onChange: (s: DemoState) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton
          icon={FlaskConical}
          label="Estados de demonstração"
          isSelected={value !== "live"}
          className="data-[state=open]:bg-neutral-subtle-pressed"
        />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Estado dos dados</MenuLabel>
        <MenuRadioGroup value={value} onValueChange={(v) => onChange(v as DemoState)}>
          <MenuRadioItem value="live">Normal</MenuRadioItem>
          <MenuRadioItem value="loading">Carregando</MenuRadioItem>
          <MenuRadioItem value="empty">Vazio</MenuRadioItem>
          <MenuRadioItem value="error">Erro</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function UserMenuItems() {
  const { session, logout } = useAccess();
  return (
    <>
      <MenuLabel>{session?.nome}</MenuLabel>
      <MenuItem icon={UserRound}>Perfil</MenuItem>
      <MenuItem icon={Settings}>Preferências</MenuItem>
      <MenuSeparator />
      <MenuItem icon={LogOut} onSelect={() => logout()}>
        Sair
      </MenuItem>
    </>
  );
}

interface UserMenuProps {
  colorMode: ColorModePreference;
  onColorModeChange: (p: ColorModePreference) => void;
  demoState: DemoState;
  onDemoStateChange: (s: DemoState) => void;
}

function UserMenu({ colorMode, onColorModeChange, demoState, onDemoStateChange }: UserMenuProps) {
  const { isMedium } = useLayout();
  const name = useAccess().session?.nome ?? "";
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${name}`}
          className="ds-pressable ml-050 flex size-control items-center justify-center rounded-full hover:bg-neutral-subtle-hovered"
        >
          <Avatar name={name} />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        {!isMedium && (
          <>
            <MenuLabel>Tema</MenuLabel>
            <MenuRadioGroup value={colorMode} onValueChange={(v) => onColorModeChange(v as ColorModePreference)}>
              <MenuRadioItem value="light">Claro</MenuRadioItem>
              <MenuRadioItem value="dark">Escuro</MenuRadioItem>
              <MenuRadioItem value="auto">Igual ao sistema</MenuRadioItem>
            </MenuRadioGroup>
            {DATA_ORIGIN === "demo" && (
              <>
                <MenuSeparator />
                <MenuLabel>Estados de demonstração</MenuLabel>
                <MenuRadioGroup value={demoState} onValueChange={(v) => onDemoStateChange(v as DemoState)}>
                  <MenuRadioItem value="live">Normal</MenuRadioItem>
                  <MenuRadioItem value="loading">Carregando</MenuRadioItem>
                  <MenuRadioItem value="empty">Vazio</MenuRadioItem>
                  <MenuRadioItem value="error">Erro</MenuRadioItem>
                </MenuRadioGroup>
              </>
            )}
            <MenuSeparator />
          </>
        )}
        <UserMenuItems />
      </MenuContent>
    </Menu>
  );
}

function SideNavUser() {
  const L = useLayout();
  const { session } = useAccess();
  if (!session) return null;
  return (
    <div className="mt-100 flex items-center gap-100 rounded-medium px-050 py-050">
      <Avatar name={session.nome} size="medium" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-default">{session.nome}</span>
        <span className="truncate font-body-small text-subtlest">{accessLabel(session)}</span>
      </span>
      <Menu onOpenChange={L.setSideNavMenuOpen}>
        <MenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label="Opções da conta" className="data-[state=open]:bg-neutral-subtle-pressed" />
        </MenuTrigger>
        <MenuContent align="end" side="top">
          <UserMenuItems />
        </MenuContent>
      </Menu>
    </div>
  );
}

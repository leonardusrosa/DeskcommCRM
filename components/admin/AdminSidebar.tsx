"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  ChatsCircle,
  Buildings,
  ClipboardText,
  Scales,
  Warning,
  ChartBar,
  Users,
  ShieldCheck,
  Palette,
  ArrowRight,
  MonitorPlay,
  Kanban,
  UsersThree,
  Sparkle,
  Globe,
  ChartLineUp,
  DownloadSimple,
  ClockCountdown,
  PuzzlePiece,
  Phone,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";

interface NavItem {
  href: string;
  label: string;
  icon: PhosphorIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/revenue", label: "Executive Revenue", icon: ChartBar },
  { href: "/admin/intelligence", label: "Intelligence", icon: Sparkle },
  { href: "/admin/demo-center", label: "Demo Center", icon: Sparkle },
  { href: "/admin/demo-center/live", label: "Live Center", icon: Sparkle },
  { href: "/admin/demo-center/health", label: "Observability", icon: ShieldCheck },
  { href: "/admin/demo-center/integrations", label: "Integrations", icon: PuzzlePiece },
  { href: "/admin/sales", label: "Sales Workspace", icon: Kanban },
  { href: "/sales/mobile", label: "Sales Mobile", icon: Phone },
  { href: "/admin/sales/performance", label: "Performance", icon: ChartLineUp },
  { href: "/admin/sales/sla", label: "SLA Analytics", icon: ClockCountdown },
  { href: "/admin/demos", label: "Demos", icon: MonitorPlay },
  { href: "/admin/demos/analytics", label: "Demo Analytics", icon: ChartBar },
  { href: "/admin/demos/cohorts", label: "Demo Cohorts", icon: UsersThree },
  { href: "/admin/demos/marketing", label: "Marketing", icon: Globe },
  { href: "/admin/demos/export", label: "Export Demos", icon: DownloadSimple },
  { href: "/admin/inbox", label: "Inbox", icon: ChatsCircle },
  { href: "/admin/tenants", label: "Tenants", icon: Buildings },
  { href: "/admin/audit", label: "Audit", icon: ClipboardText },
  { href: "/admin/lgpd", label: "LGPD", icon: Scales },
  { href: "/admin/incidents", label: "Incidents", icon: Warning },
  { href: "/admin/usage", label: "Usage", icon: ChartBar },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/platform-admins", label: "Platform Admins", icon: ShieldCheck },
  // A porta da tela de marca. Ela NÃO entra em `lib/navigation/registry.ts`:
  // aquele registro descreve a navegação do tenant (`app/app/**`) e o teste de
  // completude que o vigia varre só aquela raiz. O admin de plataforma tem
  // navegação própria, e é esta lista.
  { href: "/admin/marca", label: "Marca", icon: Palette },
];

interface AdminSidebarProps {
  userEmail: string;
  /** "mobile" = conteúdo desta MESMA navegação dentro do drawer que `AdminShell`
   * abre abaixo de `lg` — mesmo padrão de `components/shell/Sidebar.tsx`. */
  variant?: "desktop" | "mobile";
}

export function AdminSidebar({ userEmail, variant = "desktop" }: AdminSidebarProps) {
  const isMobile = variant === "mobile";
  const pathname = usePathname();
  // Por PROP do servidor, e nunca `branding()`: aquela função lê fontes
  // diferentes nos dois lados da fronteira (`window.__PUBLIC_ENV__` no
  // navegador, `process.env` no servidor), e desde que o layout raiz passou a
  // injetar a marca do BANCO as duas divergem — o nome renderizado no SSR não
  // batia com o hidratado, que é hydration mismatch. Ver `lib/branding/contexto.tsx`.
  const marca = useMarcaDaInstalacao();

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card",
        isMobile ? "h-full w-full" : "hidden w-60 shrink-0 lg:flex",
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {marca.name}
          </span>
          <span className="text-sm font-semibold tracking-tight">Admin Plataforma</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Navegação plataforma">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t p-3">
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <ArrowRight size={14} aria-hidden />
          <span>Voltar pra app</span>
        </Link>
        <p className="truncate px-2 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Users,
  LayoutDashboard,
  CreditCard,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  UserPlus,
  UsersRound,
  Megaphone,
  MessageCircle,
  Trophy,
  Tent,
  Package,
  BookOpen,
  CalendarDays,
  Upload,
  Bell,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/players", label: "Zawodnicy", icon: Users, roles: ["ADMIN", "COACH"] },
  { href: "/dashboard/groups", label: "Grupy", icon: UsersRound, roles: ["ADMIN", "COACH"] },
  { href: "/dashboard/payments", label: "Składki", icon: CreditCard, roles: ["ADMIN", "PARENT"] },
  { href: "/dashboard/schedule", label: "Harmonogram", icon: Calendar, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/attendance", label: "Obecności", icon: ClipboardList, roles: ["ADMIN", "COACH"] },
  { href: "/dashboard/announcements", label: "Ogłoszenia", icon: Megaphone, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/messages", label: "Wiadomości", icon: MessageCircle, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/tournaments", label: "Turnieje", icon: Trophy, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/camps", label: "Obozy", icon: Tent, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/training", label: "Szkolenie", icon: BookOpen, roles: ["ADMIN", "COACH", "PARENT"] },
  { href: "/dashboard/notifications", label: "Powiadomienia", icon: Bell, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/calendar", label: "Kalendarz", icon: CalendarDays, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
  { href: "/dashboard/organizer", label: "Organizer", icon: ListTodo, roles: ["ADMIN"] },
  { href: "/dashboard/equipment", label: "Sprzęt", icon: Package, roles: ["ADMIN", "COACH"] },
  { href: "/dashboard/shop", label: "Sklep sprzętu", icon: Package, roles: ["PARENT"] },
  { href: "/dashboard/my-orders", label: "Moje zamówienia", icon: ClipboardList, roles: ["PARENT"] },
  { href: "/dashboard/catalogs", label: "Katalogi", icon: Package, roles: ["ADMIN"] },
  { href: "/dashboard/orders", label: "Zamówienia", icon: ClipboardList, roles: ["ADMIN"] },
  { href: "/dashboard/equipment-requests", label: "Zapotrzebowanie", icon: ClipboardList, roles: ["ADMIN", "COACH", "PARENT"] },
  { href: "/dashboard/invitations", label: "Zaproszenia", icon: UserPlus, roles: ["ADMIN"] },
  { href: "/dashboard/recruitment", label: "Nabór", icon: UserPlus, roles: ["ADMIN", "COACH"] },
  { href: "/dashboard/import", label: "Import danych", icon: Upload, roles: ["ADMIN"] },
  { href: "/dashboard/import-payments", label: "Import wpłat", icon: CreditCard, roles: ["ADMIN"] },
  { href: "/dashboard/settings", label: "Ustawienia", icon: Settings, roles: ["ADMIN", "COACH", "PARENT", "PLAYER"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const role = session?.user?.role || "PARENT";

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const navContent = (
    <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
      {/* Logo / brand */}
      <div className="flex items-center gap-3 px-3 py-5 mb-2">
        <div className="rounded-xl bg-white/10 p-2">
          <Shield className="h-7 w-7 text-sky-300" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight text-white">SWH Manager</h1>
          <p className="text-[11px] text-sky-300/70">Wybieram Hokej Siedlce</p>
        </div>
      </div>

      {/* Nav items */}
      {filteredNav.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/60 hover:bg-white/8 hover:text-white/90"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", isActive && "text-sky-300")} />
            {item.label}
          </Link>
        );
      })}

      {/* Footer: user info + logout */}
      <div className="mt-auto border-t border-white/10 pt-3 mx-1">
        {session?.user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-white/90">{session.user.name}</p>
            <p className="text-[11px] text-white/40">{session.user.email}</p>
            <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-300">
              {role}
            </span>
          </div>
        )}
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 hover:bg-white/8 hover:text-white/80 transition-colors"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-[18px] w-[18px]" />
          Wyloguj
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden bg-white/80 backdrop-blur-sm shadow-sm"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-dvh w-64 bg-sidebar flex flex-col transition-transform duration-200 md:translate-x-0 md:static md:z-auto pb-[env(safe-area-inset-bottom)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}

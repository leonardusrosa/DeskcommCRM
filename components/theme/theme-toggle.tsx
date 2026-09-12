"use client";

import { useTheme } from "@/lib/theme";
import { useHotkeys } from "react-hotkeys-hook";
import { Sun, Moon, MonitorPlay, Check, Palette } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    setTheme(
      theme === "light"
        ? "dark"
        : theme === "dark"
          ? "classic"
          : theme === "classic"
            ? "classic-dark"
            : theme === "classic-dark"
              ? "system"
              : "light",
    );
  };

  useHotkeys("mod+shift+l", cycle, { preventDefault: true }, [theme]);

  const Icon =
    theme === "dark"
      ? Moon
      : theme === "classic"
        ? Palette
        : theme === "classic-dark"
          ? Moon
          : theme === "system"
            ? MonitorPlay
            : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={"Tema: " + theme + ". Clique para escolher ou use Cmd+Shift+L."}
        >
          <Icon size={16} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2">
            <Sun size={16} aria-hidden />
            <span>Claro</span>
          </span>
          {theme === "light" && <Check size={14} className="text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2">
            <Moon size={16} aria-hidden />
            <span>Escuro</span>
          </span>
          {theme === "dark" && <Check size={14} className="text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("classic")} className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2">
            <Palette size={16} aria-hidden />
            <span>Clássico</span>
          </span>
          {theme === "classic" && <Check size={14} className="text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("classic-dark")} className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2">
            <Moon size={16} aria-hidden />
            <span>Clássico Escuro</span>
          </span>
          {theme === "classic-dark" && <Check size={14} className="text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2">
            <MonitorPlay size={16} aria-hidden />
            <span>Sistema</span>
          </span>
          {theme === "system" && <Check size={14} className="text-accent" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  CalendarClock, 
  Menu,
  Activity
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scans", label: "Security Scans", icon: ShieldAlert },
  { href: "/schedules", label: "Scheduler", icon: CalendarClock },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#161616] border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-border bg-[#161616]">
          <Activity className="h-6 w-6 text-primary mr-3" />
          <span className="font-bold text-lg tracking-tight">Watsonx Scanner</span>
        </div>

        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary group border-l-4",
                isActive 
                  ? "bg-secondary/50 text-white border-primary" 
                  : "text-gray-400 border-transparent hover:text-white hover:border-secondary"
              )}>
                <item.icon className={cn("h-5 w-5 mr-3", isActive ? "text-primary" : "text-gray-400 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-[#161616]">
          <div className="flex items-center text-xs text-gray-500">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
            System Online
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center">
          <Activity className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold">Watsonx Scanner</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-400">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

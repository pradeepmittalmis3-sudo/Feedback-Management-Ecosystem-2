import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Bell, Search, User, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profileName, role } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background/95">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Professional Header Section */}
          <header className="h-16 flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50 px-4 md:px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="shrink-0" />
              
              <div className="hidden md:flex items-center relative">
                <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
                <Input 
                  placeholder="Search feedback, stores..." 
                  className="pl-9 w-[280px] lg:w-[350px] bg-background/50 border-border/50 focus-visible:ring-primary/20 h-9 rounded-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full text-muted-foreground hover:text-foreground mr-1"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground rounded-full">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse border border-card" />
              </Button>
              
              <div className="h-8 w-px bg-border/50 mx-1" />

              <div className="flex items-center gap-3 pl-1">
                <div className="flex flex-col items-end hidden sm:flex">
                  <div className="flex items-center gap-2">
                    {role === 'superadmin' && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">Master</span>
                    )}
                    <span className="text-sm font-semibold text-foreground leading-none">{profileName || 'Admin User'}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">{user?.email || 'admin@rajmandir.com'}</span>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${role === 'superadmin' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-primary/10 border-primary/20'}`}>
                  <User className={`w-4 h-4 ${role === 'superadmin' ? 'text-amber-600' : 'text-primary'}`} />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

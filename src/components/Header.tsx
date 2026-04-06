import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  LayoutGrid, 
  List, 
  Calendar as CalendarIcon, 
  Search, 
  LogOut, 
  Sun, 
  Moon,
  ChevronDown,
  FileDown
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ViewMode } from '../types';
import { cn } from '../lib/utils';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onAddEmployee: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  onExportExcel: () => void;
  hideControls?: boolean;
}

export default function Header({ 
  viewMode, 
  setViewMode, 
  onAddEmployee,
  searchQuery,
  setSearchQuery,
  isDarkMode,
  toggleTheme,
  onExportExcel,
  hideControls = false
}: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-border bg-brand-bg/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-2 md:px-4 h-14 md:h-16 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-8">
          <h1 className="text-lg md:text-2xl font-bold text-brand-primary whitespace-nowrap font-playful tracking-wide">
            Liga Positiva
          </h1>
          
          {!hideControls && (
            <div className="hidden md:flex items-center bg-brand-card rounded-md border border-brand-border px-2 py-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'grid' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'list' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === 'calendar' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
                )}
              >
                <CalendarIcon size={18} />
              </button>
            </div>
          )}
        </div>

        {!hideControls && (
          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-card border border-brand-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 md:gap-3">
          {!hideControls && (
            <>
              <button 
                onClick={onAddEmployee}
                className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg font-bold py-2 px-2 md:px-4 rounded-md transition-colors text-sm"
              >
                <Plus size={18} />
                <span className="hidden lg:inline">Adicionar Funcionário</span>
              </button>

              <button 
                onClick={onExportExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2 md:px-4 rounded-md transition-colors text-sm"
                title="Exportar Mês para Excel"
              >
                <FileDown size={18} />
                <span className="hidden lg:inline">Exportar Excel</span>
              </button>
            </>
          )}

          <button 
            onClick={toggleTheme}
            className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {user ? (
            <div className="flex items-center gap-1.5 md:gap-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || ""} 
                className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-brand-border"
              />
              <button 
                onClick={handleLogout}
                className="bg-brand-card hover:bg-red-500/10 text-gray-300 hover:text-red-500 p-1.5 md:px-3 md:py-1.5 rounded-md text-sm font-medium transition-colors border border-brand-border flex items-center gap-2"
                title="Sair"
              >
                <LogOut size={16} className="md:hidden" />
                <span className="hidden md:inline">Sair</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-brand-card hover:bg-brand-primary/10 text-brand-primary px-2 md:px-4 py-1.5 md:py-2 rounded-md text-sm font-bold transition-colors border border-brand-border"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
      
      {/* Mobile Search & View Toggle */}
      {!hideControls && (
        <div className="sm:hidden px-4 pb-3 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-card border border-brand-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>
          <div className="flex items-center bg-brand-card rounded-md border border-brand-border px-2 py-1 w-fit">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'grid' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'list' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === 'calendar' ? "bg-brand-bg text-brand-primary" : "text-gray-400 hover:text-white"
              )}
            >
              <CalendarIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
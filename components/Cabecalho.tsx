import React from 'react';
import { ViewMode } from '../types';
import { UserPlusIcon, ListBulletIcon, Squares2x2Icon, SunIcon, MoonIcon } from './icones';

interface HeaderProps {
    employeeCounimport React from 'react';
import { ViewMode } from '../types';
import { UserPlusIcon, ListBulletIcon, Squares2x2Icon, SunIcon, MoonIcon } from './icones';

interface HeaderProps {
    employeeCount: number;
    viewMode: ViewMode;
    theme: 'light' | 'dark';
    onAddEmployee: () => void;
    onSetViewMode: (mode: ViewMode) => void;
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ employeeCount, viewMode, theme, onAddEmployee, onSetViewMode, onToggleTheme }) => {
    return (
        <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-primary">
                        Liga Positiva | Controle de Diárias
                    </h1>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        {employeeCount > 0 && (
                            <div className="hidden sm:flex items-center bg-slate-200 dark:bg-slate-700 rounded-md p-1">
                                <button
                                    onClick={() => onSetViewMode('card')}
                                    className={`p-1.5 rounded-md text-slate-600 dark:text-slate-300 ${viewMode === 'card' ? 'bg-white dark:bg-slate-900' : 'hover:bg-white/60 dark:hover:bg-slate-900/40'}`}
                                    aria-label="Visualização em Card"
                                >
                                    <Squares2x2Icon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => onSetViewMode('list')}
                                    className={`p-1.5 rounded-md text-slate-600 dark:text-slate-300 ${viewMode === 'list' ? 'bg-white dark:bg-slate-900' : 'hover:bg-white/60 dark:hover:bg-slate-900/40'}`}
                                    aria-label="Visualização em Lista"
                                >
                                    <ListBulletIcon className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onAddEmployee}
                            className="flex items-center space-x-2 bg-brand-primary hover:opacity-90 text-white font-semibold py-2 px-3 rounded-md transition-opacity duration-200"
                        >
                            <UserPlusIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Adicionar Funcionário</span>
                        </button>
                        <button
                            onClick={onToggleTheme}
                            className="p-2 rounded-full text-slate-600 dark:text-slate-300 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            aria-label="Alternar tema"
                        >
                            {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;t: number;
    viewMode: ViewMode;
    theme: 'light' | 'dark';
    onAddEmployee: () => void;
    onSetViewMode: (mode: ViewMode) => void;
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ employeeCount, viewMode, theme, onAddEmployee, onSetViewMode, onToggleTheme }) => {
    return (
        <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-primary">
                        Liga Positiva | Controle de Diárias
                    </h1>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        {employeeCount > 0 && (
                            <div className="hidden sm:flex items-center bg-slate-200 dark:bg-slate-700 rounded-md p-1">
                                <button
                                    onClick={() => onSetViewMode('card')}
                                    className={`p-1.5 rounded-md text-slate-600 dark:text-slate-300 ${viewMode === 'card' ? 'bg-white dark:bg-slate-900' : 'hover:bg-white/60 dark:hover:bg-slate-900/40'}`}
                                    aria-label="Visualização em Card"
                                >
                                    <Squares2x2Icon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => onSetViewMode('list')}
                                    className={`p-1.5 rounded-md text-slate-600 dark:text-slate-300 ${viewMode === 'list' ? 'bg-white dark:bg-slate-900' : 'hover:bg-white/60 dark:hover:bg-slate-900/40'}`}
                                    aria-label="Visualização em Lista"
                                >
                                    <ListBulletIcon className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onAddEmployee}
                            className="flex items-center space-x-2 bg-brand-primary hover:opacity-90 text-white font-semibold py-2 px-3 rounded-md transition-opacity duration-200"
                        >
                            <UserPlusIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Adicionar Funcionário</span>
                        </button>
                        <button
                            onClick={onToggleTheme}
                            className="p-2 rounded-full text-slate-600 dark:text-slate-300 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            aria-label="Alternar tema"
                        >
                            {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
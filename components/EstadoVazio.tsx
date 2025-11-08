import React from 'react';
import { UserPlusIcon } from './icones';

interface EmptyStateProps {
    onAddFirstEmployee: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAddFirstEmployee }) => {
    return (
        <div className="text-center mt-16 sm:mt-24 px-4">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-brand-light dark:bg-brand-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.962a3.75 3.75 0 1 0-7.5 0 3.75 3.75 0 0 0 7.5 0ZM10.5 1.5a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 7.5 3v2.25" />
                </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo ao Controle de Diárias!</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
                Ainda não há funcionários cadastrados. Comece adicionando o primeiro.
            </p>
            <div className="mt-8">
                <button
                    onClick={onAddFirstEmployee}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary/50 transition-transform transform hover:scale-105"
                >
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Cadastrar Primeiro Funcionário
                </button>
            </div>
        </div>
    );
};

export default EmptyState;
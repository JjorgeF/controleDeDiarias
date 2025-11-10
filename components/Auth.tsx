import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { GoogleIcon } from './icons';

const Auth: React.FC = () => {

    const handleGoogleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Erro ao fazer login com Google:", error);
            alert("Não foi possível fazer o login. Verifique o console para mais detalhes e informe o Tio Cacheado.");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen -mt-16 px-4 text-center">
             <div className="max-w-md w-full">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-primary mb-4">
                    Bem-vindo!
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                    Acesse sua conta para gerenciar os dados dos seus funcionários de forma segura e em qualquer dispositivo.
                </p>
                <button
                    onClick={handleGoogleLogin}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-[#4285F4] hover:bg-[#357ae8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4285F4] transition-transform transform hover:scale-105"
                >
                    <GoogleIcon className="w-5 h-5 mr-3" />
                    Entrar com Google
                </button>
            </div>
        </div>
    );
};

export default Auth;

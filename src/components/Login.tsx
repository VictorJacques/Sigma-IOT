import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogIn, ShieldCheck, Mail, Lock, AlertCircle, UserPlus, ArrowLeft, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthMode = 'login' | 'first-access' | 'forgot-password';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("E-mail não encontrado ou senha incorreta. Se for seu primeiro acesso, clique abaixo.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Senha incorreta.");
      } else {
        setError("Erro ao entrar. Verifique seus dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      // 1. Verificar se o email está autorizado no Firestore (usando o email como ID)
      // O admin padrão victorjacques2207@gmail.com ignora essa verificação
      const isAdminEmail = email === "victorjacques2207@gmail.com";
      const docRef = doc(db, 'users', email);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists() && !isAdminEmail) {
        setError("Este email não está autorizado. Entre em contato com o administrador.");
        setLoading(false);
        return;
      }

      // 2. Criar o usuário no Firebase Auth (Se já existe, o Firebase lança email-already-in-use)
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess("Conta criada com sucesso! Redirecionando...");
    } catch (err: any) {
      console.error("First access error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este email já possui uma conta ativa. Use a opção 'Esqueci minha senha' se não lembrar a senha.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("O login por email/senha não está ativado no Firebase Console.");
      } else {
        setError("Erro ao configurar acesso. Verifique seus dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Por favor, digite seu e-mail.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error("Reset error:", err);
      setError("Erro ao enviar e-mail. Verifique se o e-mail está correto.");
    } finally {
      setLoading(false);
    }
  };

  const renderTitle = () => {
    if (mode === 'first-access') return 'Criação de Senha';
    if (mode === 'forgot-password') return 'Recuperar Acesso';
    return 'Monitoramento de Cisterna';
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card rounded-[32px] p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-border-gray"
      >
        <div className="text-center mb-10">
          <div className="text-primary-blue font-black text-4xl tracking-tighter mb-2">SIGMA IOT</div>
          <p className="text-text-muted font-medium">
            {renderTitle()}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.form 
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin} 
              className="space-y-6"
            >
              <div>
                <label className="label-minimal">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="label-minimal !mb-0">Senha</label>
                  <button 
                    type="button"
                    onClick={() => { setMode('forgot-password'); setError(null); }}
                    className="text-[10px] font-bold text-primary-blue uppercase hover:underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-blue hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Entrando...' : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Entrar
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('first-access');
                    setError(null);
                  }}
                  className="text-text-muted text-[10px] font-bold uppercase tracking-widest hover:text-primary-blue transition-colors"
                >
                  Primeiro Acesso? <span className="text-primary-blue">Criar Senha</span>
                </button>
              </div>
            </motion.form>
          )}

          {mode === 'first-access' && (
            <motion.form 
              key="first-access"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleFirstAccess} 
              className="space-y-6"
            >
              <div>
                <label className="label-minimal">Email Autorizado</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="O email que o admin cadastrou"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label-minimal">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label-minimal">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="Repita a senha"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 p-3 rounded-xl">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-gray-200 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Criando...' : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Criar Minha Senha
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="w-full text-text-muted text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para Login
              </button>
            </motion.form>
          )}

          {mode === 'forgot-password' && (
            <motion.form 
              key="forgot-password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleForgotPassword} 
              className="space-y-6"
            >
              <div>
                <label className="label-minimal">Email da Conta</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-border-gray rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 transition-all text-sm"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 p-3 rounded-xl">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-blue hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Enviando...' : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Enviar Recuperação
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className="w-full text-text-muted text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para Login
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-center gap-2 text-text-muted text-[10px] font-bold uppercase tracking-widest">
          <ShieldCheck className="w-3 h-3" />
          <span>Acesso Restrito SIGMA IOT</span>
        </div>
      </motion.div>
    </div>
  );
}

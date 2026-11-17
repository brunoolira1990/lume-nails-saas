import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BrandLogo } from './BrandLogo';

export interface AdminLoginViewProps {
  onSignIn: (email: string, password: string) => Promise<{ error: unknown }>;
  onSuccessLogin: () => void;
  onBackToSite: () => void;
}

/**
 * Autenticação exclusiva do Painel Superadmin.
 * Componente isolado: não reutiliza o modal do painel operacional.
 */
export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onSignIn,
  onSuccessLogin,
  onBackToSite,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const { error } = await onSignIn(email.trim(), password);
      if (error) {
        setErrorMessage(
          'Não foi possível autenticar. Confira o e-mail e a senha e tente novamente.'
        );
        return;
      }
      onSuccessLogin();
    } catch {
      setErrorMessage('Falha de conexão com o serviço de autenticação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:26px_26px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-[120px]"
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          Console administrativo
        </div>

        <Card className="w-full max-w-md gap-0 rounded-3xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-2xl shadow-black/50 ring-0 sm:p-9">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo size="sm" />
            <Badge
              variant="outline"
              className="h-auto rounded-full border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600"
            >
              Restrito
            </Badge>
          </div>

          <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Lock className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-zinc-950 sm:text-[26px]">
            Acesso Restrito - Superadmin
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Autentique-se com uma conta administrativa para gerenciar salões, assinaturas e
            acessos do Lume Nails.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-zinc-700">
                E-mail corporativo
              </Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@lumenails.com"
                aria-invalid={Boolean(errorMessage)}
                className="h-10 rounded-xl border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-500 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-zinc-700">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha de administrador"
                  aria-invalid={Boolean(errorMessage)}
                  className="h-10 rounded-xl border-zinc-300 bg-white pr-11 text-zinc-900 placeholder:text-zinc-500 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white shadow-lg shadow-zinc-950/20 hover:bg-zinc-800 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Entrar no Painel Administrativo
            </Button>
          </form>

          <div className="my-6 h-px w-full bg-zinc-200" />

          <p className="text-center text-xs leading-relaxed text-zinc-500">
            Acesso monitorado. Apenas contas com a role{' '}
            <span className="font-semibold text-zinc-700">superadmin</span> são admitidas neste
            console.
          </p>
        </Card>

        <button
          type="button"
          onClick={onBackToSite}
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao site
        </button>
      </div>
    </div>
  );
};

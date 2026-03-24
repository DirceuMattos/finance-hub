import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Loader2 } from "lucide-react";
import { getUserErrorMessage } from "@/lib/errorMessages";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(getUserErrorMessage(error));
      return;
    }

    // Check if user has verified TOTP factor
    const factors = data.user?.factors ?? [];
    const hasVerifiedTotp = factors.some(
      (f) => f.factor_type === "totp" && f.status === "verified"
    );

    if (hasVerifiedTotp) {
      navigate("/mfa-verify");
    } else {
      navigate("/");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email de recuperação enviado. Verifique sua caixa de entrada.");
    setResetMode(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Finance Hub</span>
          </div>
          <CardTitle>{resetMode ? "Recuperar Senha" : "Entrar"}</CardTitle>
          <CardDescription>
            {resetMode
              ? "Informe seu email para receber o link de recuperação"
              : "Faça login para acessar o sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetMode ? handleResetPassword : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {resetMode ? "Enviar link" : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm space-y-2">
            <button
              type="button"
              onClick={() => setResetMode(!resetMode)}
              className="text-primary hover:underline"
            >
              {resetMode ? "Voltar ao login" : "Esqueceu a senha?"}
            </button>
            {!resetMode && (
              <p className="text-muted-foreground">
                Não tem conta?{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  Criar conta
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

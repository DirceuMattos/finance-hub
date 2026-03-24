import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DollarSign, Loader2, ShieldCheck, QrCode } from "lucide-react";

export default function MfaSetup() {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Finance Hub TOTP",
    });
    setEnrolling(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;

    setLoading(true);
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      toast.error(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });
    setLoading(false);

    if (verifyError) {
      toast.error("Código inválido. Tente novamente.");
      setCode("");
      return;
    }

    setSuccess(true);
    toast.success("MFA ativado com sucesso!");
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-2" />
            <CardTitle>MFA Ativado!</CardTitle>
            <CardDescription>
              Seu fator de autenticação TOTP está ativo. A partir de agora, você
              precisará informar o código do aplicativo autenticador ao fazer login.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/configuracoes")}>
              Voltar às Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <DollarSign className="h-6 w-6 text-primary mx-auto mb-2" />
          <CardTitle>Configurar MFA</CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança à sua conta usando um aplicativo
            autenticador (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrCode ? (
            <div className="text-center space-y-4">
              <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para gerar o QR code de configuração.
              </p>
              <Button onClick={handleEnroll} disabled={enrolling} className="w-full">
                {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
                Gerar QR Code
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={qrCode}
                  alt="QR Code para MFA"
                  className="w-48 h-48 rounded-lg border"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escaneie o QR code acima com seu aplicativo autenticador e informe
                o código de 6 dígitos gerado.
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificação</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="text-center text-lg tracking-widest"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verificar e ativar
              </Button>
            </form>
          )}

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

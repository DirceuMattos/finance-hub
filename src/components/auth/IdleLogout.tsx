import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatCountdown, idleState, startingActivity, IDLE_STORAGE_KEY } from "@/lib/idleSession";

const EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"] as const;

function readStored(): number | null {
  try { const v = Number(localStorage.getItem(IDLE_STORAGE_KEY)); return v > 0 ? v : null; } catch { return null; }
}
function writeStored(v: number) {
  try { localStorage.setItem(IDLE_STORAGE_KEY, String(v)); } catch { /* sem armazenamento: vale só nesta aba */ }
}

/**
 * Desloga após 15 min sem atividade, com aviso 3 min antes.
 * A atividade é compartilhada entre abas (localStorage), então usar uma aba mantém as outras.
 * Durante o aviso, só o botão "Continuar conectado" renova a sessão.
 */
export function IdleLogout({ lastSignInAt }: { lastSignInAt?: string | null }) {
  const navigate = useNavigate();
  const last = useRef<number>(Date.now());
  const warningRef = useRef(false);
  const loggingOut = useRef(false);
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const touch = useCallback((force = false) => {
    if (warningRef.current && !force) return;
    const now = Date.now();
    if (!force && now - last.current < 5000) return; // limita gravações
    last.current = now;
    writeStored(now);
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setWarning(false);
    try { localStorage.removeItem(IDLE_STORAGE_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
    toast.info("Sessão encerrada após 15 minutos sem atividade.");
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const signIn = lastSignInAt ? Date.parse(lastSignInAt) : null;
    last.current = startingActivity(readStored(), Number.isFinite(signIn) ? signIn : null, Date.now());
    writeStored(last.current);

    const onActivity = () => touch();
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    // Atividade em outra aba.
    const onStorage = (e: StorageEvent) => {
      if (e.key === IDLE_STORAGE_KEY && e.newValue) {
        const v = Number(e.newValue);
        if (v > last.current) { last.current = v; warningRef.current = false; setWarning(false); }
      }
    };
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      const shared = readStored();
      if (shared && shared > last.current) last.current = shared;
      const s = idleState(Date.now(), last.current);
      if (s.phase === "expired") { logout(); return; }
      const isWarning = s.phase === "warning";
      warningRef.current = isWarning;
      setWarning(isWarning);
      if (isWarning) setRemaining(s.remaining);
    }, 1000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [lastSignInAt, logout, touch]);

  const stay = () => {
    warningRef.current = false;
    setWarning(false);
    touch(true);
  };

  return (
    <AlertDialog open={warning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sua sessão vai expirar</AlertDialogTitle>
          <AlertDialogDescription>
            Por segurança, o sistema sai sozinho após 15 minutos sem atividade.
            Saída em <span className="font-mono font-semibold text-foreground">{formatCountdown(remaining)}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={logout}>Sair agora</Button>
          <Button onClick={stay} autoFocus>Continuar conectado</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

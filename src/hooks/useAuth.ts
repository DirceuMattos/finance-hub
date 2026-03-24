import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasMfaPending = (): boolean => {
    if (!session) return false;
    const factors = user?.factors ?? [];
    const hasVerifiedTotp = factors.some(
      (f) => f.factor_type === "totp" && f.status === "verified"
    );
    if (!hasVerifiedTotp) return false;
    // Use official Supabase MFA API to check assurance level
    const aal = session?.user?.aal ?? "aal1";
    return aal !== "aal2";
  };

  const checkMfaLevel = async (): Promise<boolean> => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel !== "aal2" && data?.nextLevel === "aal2";
  };

  return { session, user, loading, signOut, hasMfaPending };
}

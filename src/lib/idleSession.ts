// Encerramento de sessão por inatividade: regras puras (o componente fica em components/auth/IdleLogout.tsx).

export const IDLE_LIMIT_MS = 15 * 60 * 1000; // desloga após 15 min sem atividade
export const IDLE_WARNING_MS = 3 * 60 * 1000; // avisa 3 min antes
export const IDLE_STORAGE_KEY = "fh-last-activity";

export type IdlePhase = "active" | "warning" | "expired";

export function idleState(now: number, lastActivity: number, limit = IDLE_LIMIT_MS, warning = IDLE_WARNING_MS) {
  const remaining = Math.max(0, limit - (now - lastActivity));
  const phase: IdlePhase = remaining === 0 ? "expired" : remaining <= warning ? "warning" : "active";
  return { phase, remaining };
}

/**
 * Ponto de partida da contagem: a última atividade registrada (compartilhada entre abas),
 * mas nunca anterior ao último login (um login novo não pode herdar inatividade antiga).
 */
export function startingActivity(stored: number | null, lastSignIn: number | null, now: number): number {
  const candidates = [stored, lastSignIn].filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v <= now);
  return candidates.length ? Math.max(...candidates) : now;
}

/** "2:59" */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

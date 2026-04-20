import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as extSupabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

async function getExtToken() {
  const { data } = await extSupabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}

async function invokeManageUsers(method: string, body?: any) {
  const token = await getExtToken();
  const res = await fetch(`${FUNCTIONS_BASE}/manage-users`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Erro na requisição");
  return data;
}

export function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ["app-users"],
    queryFn: () => invokeManageUsers("GET"),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return invokeManageUsers("POST", { action: "create", email, password });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-users"] });
      toast.success("Usuário criado com sucesso");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar usuário");
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return invokeManageUsers("POST", { action: "delete", userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-users"] });
      toast.success("Usuário removido");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao remover usuário");
    },
  });
}

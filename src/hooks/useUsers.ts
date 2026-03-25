import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export function useUsers() {
  return useQuery<AppUser[]>({
    queryKey: ["app-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        method: "GET",
      });
      if (error) throw error;
      return data as AppUser[];
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email, password },
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      return data;
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

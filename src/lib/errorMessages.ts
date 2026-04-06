/**
 * Maps raw Supabase/PostgREST errors to safe, user-friendly messages.
 * Raw details are logged to console for debugging only.
 */
export function getUserErrorMessage(error: unknown): string {
  const raw = error as any;
  const code = raw?.code;
  const message = typeof raw?.message === 'string' ? raw.message : JSON.stringify(raw?.message ?? error);
  const details = raw?.details;
  const hint = raw?.hint;

  // Log full details for debugging (never shown to user)
  console.error("[App Error]", { message, code, details, hint, raw: error });

  // PostgreSQL error codes
  if (code === "42501") {
    return "Sem permissão para realizar esta operação. Verifique suas credenciais.";
  }
  if (code === "23503") {
    return "Não é possível realizar esta ação: existem registros vinculados.";
  }
  if (code === "23505") {
    return "Já existe um registro com esses dados.";
  }
  if (code === "23502") {
    return "Campos obrigatórios não foram preenchidos.";
  }
  if (code === "23514") {
    if (message.includes("system_parameters_value_type_check")) {
      return "Tipo de parâmetro inválido. Use Texto, Número, Booleano ou JSON.";
    }
    return "Os dados informados não atendem às regras de validação.";
  }

  // Database constraint errors (fallback string matching)
  if (message.includes("foreign key") || message.includes("violates foreign key")) {
    return "Não é possível realizar esta ação: existem registros vinculados.";
  }
  if (message.includes("unique") || message.includes("duplicate key")) {
    return "Já existe um registro com esses dados.";
  }
  if (message.includes("not-null") || message.includes("null value")) {
    return "Campos obrigatórios não foram preenchidos.";
  }
  if (message.includes("check constraint")) {
    if (message.includes("system_parameters_value_type_check")) {
      return "Tipo de parâmetro inválido. Use Texto, Número, Booleano ou JSON.";
    }
    return "Os dados informados não atendem às regras de validação.";
  }
  if (message.includes("row-level security") || code === "42501") {
    return "Você não tem permissão para realizar esta operação no banco atual. Verifique se está logado no ambiente correto.";
  }

  // Auth errors — generic to avoid confirming email existence
  if (message.includes("Invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (message.includes("Email not confirmed")) {
    return "Sua conta ainda não foi confirmada. Verifique seu email.";
  }
  if (message.includes("User already registered")) {
    return "Não foi possível criar a conta. Verifique os dados e tente novamente.";
  }
  if (message.includes("Password") || message.includes("password")) {
    return "Erro ao processar a senha. Verifique os requisitos e tente novamente.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  // Generic fallback
  return "Ocorreu um erro inesperado. Tente novamente.";
}

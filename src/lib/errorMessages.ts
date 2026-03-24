/**
 * Maps raw Supabase/PostgREST errors to safe, user-friendly messages.
 * Raw details are logged to console for debugging only.
 */
export function getUserErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Log full details for debugging (never shown to user)
  console.error("[App Error]", message);

  // Database constraint errors
  if (message.includes("foreign key") || message.includes("violates")) {
    return "Não é possível realizar esta ação: existem registros vinculados.";
  }
  if (message.includes("unique") || message.includes("duplicate key")) {
    return "Já existe um registro com esses dados.";
  }
  if (message.includes("not-null") || message.includes("null value")) {
    return "Campos obrigatórios não foram preenchidos.";
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

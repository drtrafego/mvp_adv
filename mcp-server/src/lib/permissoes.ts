/**
 * O MCP de agentes só produz sugestões. Modo humano é configuração do processo,
 * nunca um argumento enviado pelo modelo ou um nome de editor escolhido pelo agente.
 * Use uma sessão separada do advogado; não configure esta variável na Luana ou nos cron jobs.
 */
export function exigirModoHumano(): void {
  if (process.env.GABINETE_MCP_MODO_HUMANO !== "1") {
    throw new Error(
      "Operação reservada ao advogado. O MCP de agentes não confirma decisões humanas; " +
        "confirme ou edite pelo painel autenticado. GABINETE_MCP_MODO_HUMANO=1 é exclusivo " +
        "de uma sessão separada, operada diretamente pelo advogado.",
    );
  }
}

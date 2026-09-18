const PT_PT: Record<string, string> = {
  Contatos: "Contactos",
  "Buscar contatos…": "Pesquisar contactos…",
  "Nenhum contato": "Nenhum contacto",
  "Ver contato": "Ver contacto",
  "Nova tag…": "Nova etiqueta…",
  "Todas as tags": "Todas as etiquetas",
  "Buscar mensagens…": "Pesquisar mensagens…",
  Buscar: "Pesquisar",
  "Buscar...": "Pesquisar...",
  "Buscar telas": "Pesquisar páginas",
  "Buscar telas do sistema…": "Pesquisar páginas do sistema…",
  Equipe: "Equipa",
  "Sua conta": "A sua conta",
  "Sua empresa": "A sua empresa",
  Configurações: "Definições",
  Salvar: "Guardar",
  "Salvando…": "A guardar…",
  "Guardando…": "A guardar…",
  "Carregando…": "A carregar…",
  "Carregando a agenda": "A carregar a agenda",
  "Atualizando…": "A atualizar…",
  Excluir: "Eliminar",
  "Plano e cobrança.": "Plano e faturação.",
  "Tipos de agendamento": "Tipos de marcação",
  "Tipo de agendamento criado.": "Tipo de marcação criado.",
  "Novo tipo de agendamento": "Novo tipo de marcação",
  "Consulta agendada": "Consulta marcada",
  "Aguardando confirmação": "A aguardar confirmação",
  "Não compareceu": "Não compareceu",
  "Sem responsável": "Sem responsável",
  "Nome de exibição": "Nome de apresentação",
  "Retenção de mídia (dias)": "Retenção de multimédia (dias)",
  "Dados da empresa, retenção de mídia, DPO. Admin only.":
    "Dados da empresa, retenção de multimédia e DPO. Apenas administradores.",
  "Quem trabalha aqui, com qual papel e quanta conversa cada um aguenta.":
    "Quem trabalha aqui, com que função e quantas conversas cada pessoa consegue acompanhar.",
  "Quem recebe cada cliente novo, e o que cada atendente enxerga.":
    "Quem recebe cada novo cliente e o que cada membro da receção consegue ver.",
};

export function traduzirPtPt(texto: string): string {
  return PT_PT[texto] ?? texto;
}

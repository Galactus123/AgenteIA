export type Specialty = {
  name: string;
  slug: string;
  description: string;
  url: string;
};

export const SPECIALTIES: Specialty[] = [
  {
    name: "Clínica Geral",
    slug: "clinica-geral",
    description: "Agendamento automático para consultas de clínica geral pelo WhatsApp.",
    url: "/agendamento-clinica-geral",
  },
  {
    name: "Pediatria",
    slug: "pediatria",
    description: "A IA entende os sintomas da criança e marca a consulta com o pediatra.",
    url: "/agendamento-pediatria",
  },
  {
    name: "Ginecologia",
    slug: "ginecologia",
    description: "Atendimento humanizado e agendamento rápido para consultas ginecológicas.",
    url: "/agendamento-ginecologia",
  },
  {
    name: "Dermatologia",
    slug: "dermatologia",
    description: "Agende consultas dermatológicas automaticamente, 24 horas por dia.",
    url: "/agendamento-dermatologia",
  },
  {
    name: "Odontologia",
    slug: "odontologia",
    description: "Consultas odontológicas agendadas sem filas e sem espera no WhatsApp.",
    url: "/agendamento-odontologia",
  },
  {
    name: "Oftalmologia",
    slug: "oftalmologia",
    description: "Agendamento inteligente para consultas e exames oftalmológicos.",
    url: "/agendamento-oftalmologia",
  },
  {
    name: "Fisioterapia",
    slug: "fisioterapia",
    description: "Sessões de fisioterapia remarcadas e confirmadas automaticamente.",
    url: "/agendamento-fisioterapia",
  },
  {
    name: "Psicologia",
    slug: "psicologia",
    description: "Agendamento discreto e humanizado para consultas de psicologia.",
    url: "/agendamento-psicologia",
  },
  {
    name: "Laboratórios",
    slug: "laboratorios",
    description: "Coletas e exames laboratoriais agendados pelo WhatsApp com IA.",
    url: "/agendamento-laboratorios",
  },
  {
    name: "Centros Médicos",
    slug: "centros-medicos",
    description: "Multi-especialidades em um só lugar, com gestão completa da agenda.",
    url: "/agendamento-centros-medicos",
  },
];

export type Plan = {
  id: "br" | "mz";
  country: string;
  flag: string;
  currency: string;
  price: string;
  cadence: string;
  includes: string[];
};

export const PLANS: Plan[] = [
  {
    id: "br",
    country: "Brasil",
    flag: "🇧🇷",
    currency: "R$",
    price: "1.100",
    cadence: "mês",
    includes: [
      "Recepção virtual com IA no WhatsApp",
      "Agendamento, confirmação e lembretes",
      "Painel de gestão da agenda",
      "Suporte humano pelo WhatsApp",
    ],
  },
  {
    id: "mz",
    country: "Moçambique",
    flag: "🇲🇿",
    currency: "MT",
    price: "3.500",
    cadence: "mês",
    includes: [
      "Recepção virtual com IA no WhatsApp",
      "Agendamento, confirmação e lembretes",
      "Painel de gestão da agenda",
      "Suporte humano pelo WhatsApp",
    ],
  },
];

// Preços: Brasil R$ 1.100/mês · Moçambique 3.500 MT/mês

export type Addon = {
  name: string;
  status: string;
  description: string;
};

export const ADDONS: Addon[] = [
  {
    name: "Lembretes avançados",
    status: "Em breve",
    description: "Canais e personalização extra para lembretes de consulta.",
  },
  {
    name: "Remarcação e cancelamento automático",
    status: "Em breve",
    description: "Fluxo completo de alterações feito pelo próprio paciente.",
  },
  {
    name: "Multi-clínica / multi-unidade",
    status: "Sob consulta",
    description: "Gerencie várias unidades a partir de um único painel.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "O que é o SaúdeSync?",
    answer:
      "O SaúdeSync é um SaaS de agendamento com Inteligência Artificial que atende seus pacientes pelo WhatsApp 24 horas por dia. Ele entende o que o paciente sente, sugere a especialidade certa e marca a consulta sozinho.",
  },
  {
    question: "Como a IA entende os sintomas do paciente?",
    answer:
      "A IA compreende linguagem natural e o contexto da conversa — não apenas palavras-chave. Ela interpreta os sintomas descritos, tira dúvidas quando necessário e recomenda a especialidade mais adequada, de forma humanizada.",
  },
  {
    question: "O sistema funciona em Moçambique?",
    answer:
      "Sim. O SaúdeSync foi feito para o Brasil 🇧🇷 e Moçambique 🇲🇿. Em Moçambique os pagamentos podem ser feitos via M-pesa e E-mola (através da LOJOU) e os preços são exibidos em metical.",
  },
  {
    question: "Quais formas de pagamento vocês aceitam em cada país?",
    answer:
      "No Brasil 🇧🇷: Mercado Pago e cartão de crédito. Em Moçambique 🇲🇿: M-pesa e E-mola, processados através da LOJOU.",
  },
  {
    question: "Meus dados estão seguros e em conformidade com a LGPD?",
    answer:
      "Sim. Seus dados são protegidos com criptografia e o sistema está em conformidade com a LGPD no Brasil e com a legislação de proteção de dados de Moçambique.",
  },
  {
    question: "Preciso instalar algo?",
    answer:
      "Não. O SaúdeSync é um sistema na nuvem. Basta conectar seu número de WhatsApp e começar a agendar — sem instalação e sem hardware.",
  },
  {
    question: "Posso integrar com meu sistema de gestão atual?",
    answer:
      "Sim. O SaúdeSync é preparado para integração com Google Calendar, Outlook Calendar, KOMUNIKA e outros sistemas de gestão clínica.",
  },
  {
    question: "Tem teste grátis?",
    answer:
      "Sim. Você pode testar o SaúdeSync gratuitamente e ver a IA agendando consultas reais pelo WhatsApp antes de contratar.",
  },
];

export function ctaUrl(campaign: string, medium = "landing") {
  const params = new URLSearchParams({
    utm_source: "saudesync",
    utm_medium: medium,
    utm_campaign: campaign,
  });
  return `/teste-gratis?${params.toString()}`;
}

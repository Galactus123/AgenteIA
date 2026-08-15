# Prompt para Desenvolvedor — Landing Page SaúdeSync

Copie e envie o conteúdo abaixo para o desenvolvedor/agência responsável pela construção da landing page.

---

## PROMPT

Preciso que você desenvolva a landing page do **SaúdeSync**, um SaaS de agendamento com Inteligência Artificial via WhatsApp para clínicas privadas, com atuação no **Brasil 🇧🇷** e em **Moçambique 🇲🇿**.

A landing page deve ter uma estrutura de página única (one-page), com âncoras de navegação, seguindo a arquitetura de informação descrita abaixo. O objetivo é conversão para teste grátis, com dois públicos (BR e MZ) que precisam se sentir contemplados em moeda, forma de pagamento e linguagem.

### 1. Header / Navegação
- Logo (à esquerda)
- Menu: **Como funciona** (âncora) | **Especialidades** (dropdown) | **Preços** (âncora) | **Blog** | **Parceiros**
- Botão secundário: **Entrar**
- Botão primário (destaque): **Testar Grátis**
- Header fixo (sticky) ao rolar a página

### 2. Hero
- Headline: "Sua recepção nunca mais vai dormir. Agende consultas automaticamente pelo WhatsApp com IA."
- Subheadline: "O SaúdeSync entende o paciente, sugere a especialidade certa e marca a consulta sozinho — 24h por dia, sem perder mensagem."
- Selo/badge: "Feito para clínicas do Brasil 🇧🇷 e Moçambique 🇲🇿"
- CTA primário: "Testar Grátis" (botão)
- CTA secundário: "Ver como funciona" (abre vídeo ou faz scroll até a seção 3)
- Espaço para imagem/mockup do produto (print de conversa no WhatsApp + painel administrativo)

### 3. Como Funciona (4 cards em sequência/fluxo)
Cada card com ícone, título, texto curto e 3 bullets:
1. **Entendimento Inteligente** — A IA entende o que o paciente sente e sugere a especialidade certa
2. **Agendamento Automático** — Busca horários, o paciente escolhe, a consulta é marcada sozinha
3. **Confirmação e Lembretes** — Lembretes automáticos 24h e 2h antes reduzem faltas
4. **Remarcação e Cancelamento** — O paciente resolve tudo sozinho pelo WhatsApp

### 4. Especialidades Atendidas (grid de cards clicáveis, cada um leva a uma landing page própria)
Clínica Geral | Pediatria | Ginecologia | Dermatologia | Odontologia | Oftalmologia | Fisioterapia | Psicologia | Laboratórios | Centros Médicos

Cada card deve linkar para uma URL própria no padrão `/agendamento-[especialidade]`, pensada para SEO.

### 5. Diferencial / Filosofia
- Frase de destaque: "Você não precisa de mais um chatbot. Precisa de uma recepcionista que nunca dorme."
- 3 pilares em colunas: (1) Entende contexto, não só palavras-chave; (2) Agenda de ponta a ponta, sem intervenção humana; (3) Funciona nos dois mercados: WhatsApp + pagamentos locais

### 6. Métricas de Impacto (bloco de destaque com números grandes)
- Redução de faltas
- Aumento de conversão de conversas em consultas marcadas
- Disponibilidade 24h

(usar placeholders editáveis, pois os números reais virão de dados de clientes piloto)

### 7. Dashboard / Gestão
- Print/mockup do painel administrativo mostrando: consultas marcadas, canceladas, remarcadas, taxa de conversão da IA
- Texto reforçando que não é só um bot, é gestão completa da agenda

### 8. Integrações
- Logos: Google Calendar, Outlook Calendar, KOMUNIKA, WhatsApp
- Bloco separado de pagamentos, dividido por país:
  - 🇧🇷 Brasil: Mercado Pago, cartão de crédito
  - 🇲🇿 Moçambique: M-pesa, E-mola (via LOJOU)

### 9. Segurança e Conformidade
- Texto: "Seus dados protegidos com criptografia e conformidade com a LGPD (Brasil) e a legislação de proteção de dados de Moçambique."
- Ícones de cadeado/segurança

### 10. Planos e Preços
- **Toggle de país/moeda no topo do bloco**: alterna entre Real (🇧🇷) e Metical (🇲🇿)
- Estrutura modular, no estilo "base + módulos adicionais":

| Plano | Preço |
|---|---|
| SaúdeSync Base (Brasil) | **R$ 1.000/mês** |
| SaúdeSync Base (Moçambique) | **4.000 MT/mês** |

- Abaixo do preço base, listar módulos adicionais como itens que podem ser ativados (lembretes avançados, remarcação/cancelamento automático, multi-clínica/multi-unidade) — sem preço fixo definido ainda, apenas como "sob consulta" ou "em breve"
- CTA no bloco: "Testar Grátis"

### 11. Migração Fácil
- Bloco simples: "Já usa outro sistema de agenda? Migramos seus dados sem custo adicional."

### 12. Suporte
- "Suporte humano pelo WhatsApp — a IA cuida do paciente, um humano cuida de você."

### 13. FAQ (acordeão)
Incluir pelo menos estas perguntas:
- O que é o SaúdeSync?
- Como a IA entende os sintomas do paciente?
- O sistema funciona em Moçambique?
- Quais formas de pagamento vocês aceitam em cada país?
- Meus dados estão seguros e em conformidade com a LGPD?
- Preciso instalar algo?
- Posso integrar com meu sistema de gestão atual?
- Tem teste grátis?

### 14. CTA Final + Footer
- CTA final centralizado: "Crie sua conta agora"
- Footer com: Sobre nós, Funcionalidades, Preços, Blog, Contato, ícones de redes sociais, Política de Privacidade, Termos de Uso

---

### Requisitos técnicos
- Landing page 100% responsiva (mobile-first, já que grande parte do acesso via WhatsApp será mobile)
- Performance: otimizar imagens, lazy loading, Core Web Vitals
- SEO on-page: meta title, meta description, heading hierarchy (H1 único no hero), URLs amigáveis para as páginas de especialidade
- Estrutura preparada para internacionalização simples (troca de moeda/país no bloco de preços, sem necessidade de duas páginas separadas por enquanto)
- Botões de CTA com UTM tracking (parâmetros de origem/campanha) para todos os links de "Testar Grátis"
- Formulário de cadastro/teste grátis integrado à plataforma (informar endpoint/API quando disponível)

### Tom e estilo visual
- Visual limpo, profissional, cores associadas à área da saúde (tons de azul/verde, evitar excesso de vermelho)
- Tom de voz: direto, confiável, sem jargão técnico excessivo — falando com donos de clínica, não com desenvolvedores
- Ícones e ilustrações que remetam a WhatsApp, agenda e atendimento humanizado

---

Qualquer dúvida sobre o fluxo de funcionamento da IA (entendimento de sintomas, sugestão de especialidade, agendamento, lembretes, remarcação, cancelamento), posso detalhar o funcionamento completo do produto.
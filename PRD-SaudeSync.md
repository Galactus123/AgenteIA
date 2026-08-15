# PRD — SaúdeSync

## Sistema Inteligente de Agendamento com IA para Clínicas Privadas

**Versão:** 1.1

**Nome do Produto:** SaúdeSync

---

## Visão Geral

O SaúdeSync é um SaaS com Inteligência Artificial desenvolvido para automatizar o atendimento inicial de clínicas privadas através do WhatsApp.

O sistema atua como uma recepcionista virtual inteligente, capaz de conversar naturalmente com pacientes, entender suas necessidades, indicar a especialidade adequada, agendar consultas automaticamente e acompanhar toda a jornada até o atendimento.

O objetivo é reduzir o trabalho da recepção, diminuir perdas de pacientes por demora no atendimento e aumentar o número de consultas agendadas.

---

## Problema

Clínicas privadas recebem diariamente dezenas ou centenas de mensagens pelo WhatsApp.

Grande parte dessas mensagens contém perguntas repetitivas como:

- Quero marcar consulta.
- Qual médico atende este problema?
- Quanto custa?
- Tem horário hoje?
- Onde fica a clínica?
- Posso remarcar?

A recepção acaba sobrecarregada, gerando demora nas respostas e perda de pacientes.

---

## Objetivo do Produto

Criar um agente de IA capaz de substituir grande parte do atendimento inicial realizado pela recepção, funcionando 24 horas por dia.

---

## Público-alvo

Clínicas privadas de pequeno e médio porte.

Especialidades:

- Clínica Geral
- Pediatria
- Ginecologia
- Dermatologia
- Odontologia
- Oftalmologia
- Fisioterapia
- Psicologia
- Laboratórios
- Centros médicos

---

## Diferencial Competitivo

O SaúdeSync não funciona apenas como um chatbot.

Ele entende o contexto da conversa e conduz o paciente até o agendamento da consulta de forma totalmente automatizada.

---

## Escopo do MVP

O MVP deve entregar um ciclo funcional completo: conversa → identificação da especialidade → agendamento → confirmação → lembretes → remarcação/cancelamento.

**Dentro do escopo (MVP):**

- Agente de IA conversando pelo WhatsApp.
- Identificação do motivo e sugestão de especialidade.
- Agendamento, confirmação, remarcação e cancelamento automáticos.
- Lembretes automáticos (24h e 2h antes).
- Dashboard básico da clínica (consultas marcadas, canceladas e remarcadas).
- Cadastro de clínica, médicos e especialidades.
- Transferência para atendente humano quando a IA não conseguir resolver.

**Fora do escopo (pós-MVP):**

- Pagamentos online (M-pesa, E-mola, cartão) — no MVP o pagamento é feito presencialmente ou por link manual.
- Integrações com Google Calendar, Outlook e sistemas de gestão clínica.
- Integração com KOMUNIKA.
- Múltiplos canais (site, aplicativo) — o MVP é apenas WhatsApp.
- Painel avançado de KPIs e relatórios.
- Multi-idioma.

---

## Premissas do MVP

- Cada clínica usa um número de WhatsApp dedicado.
- O cadastro inicial da clínica, médicos e especialidades é feito por um administrador no painel web.
- A IA opera 24h; fora do horário de funcionamento, agendamentos são permitidos para o próximo dia útil.
- Pagamento não é exigido no momento do agendamento.
- O MVP suporta uma clínica por vez (arquitetura multi-tenant fica para depois).

---

## Funcionalidades Principais

### 1. Entendimento Inteligente do Motivo da Consulta

**Descrição**

A IA deve compreender, através da conversa, qual o problema informado pelo paciente.

**Exemplos**

> **Paciente:**
> "Estou com dor de cabeça há três dias."
>
> **IA:**
> "Entendi. Você pode precisar de avaliação em Clínica Geral ou Neurologia."

Outro exemplo:

> **Paciente:**
> "Meu filho está com febre."
>
> **IA:**
> "Vou procurar horários disponíveis com um Pediatra."

---

### 2. Sugestão Automática da Especialidade

Após identificar o problema do paciente, o sistema recomenda automaticamente a especialidade mais adequada.

Caso exista mais de uma possibilidade, apresenta opções.

> **Exemplo:**
> "Seu caso pode ser atendido por um Ortopedista ou Clínico Geral. Qual prefere?"

---

### 3. Agendamento Automático

Após definir a especialidade, a IA deve:

- consultar disponibilidade;
- apresentar horários livres;
- permitir que o paciente escolha;
- confirmar automaticamente a consulta.

---

### 4. Confirmação da Consulta

Após finalizar o agendamento, o sistema envia automaticamente:

- nome do médico;
- especialidade;
- data;
- horário;
- localização da clínica;
- orientações de preparo (quando aplicável).

---

### 5. Lembretes Automáticos

Enviar lembretes automáticos antes da consulta.

**Sugestão:**
- 24 horas antes;
- 2 horas antes.

**Objetivo:** Reduzir faltas.

---

### 6. Remarcação Automática

Caso o paciente deseje alterar o horário:

> **Exemplo:**
> "Quero remarcar minha consulta."

A IA:
- identifica a consulta existente;
- apresenta novos horários;
- altera automaticamente o agendamento.

Sem necessidade da recepção.

---

### 7. Cancelamento Automático

O paciente pode cancelar a consulta.

A IA:
- solicita confirmação;
- cancela;
- libera o horário automaticamente para outro paciente.

---

### 8. Transferência para Atendente Humano

Quando a IA não consegue resolver (pergunta complexa, paciente insiste, emergência ou 2 tentativas falhas), ela deve:

- avisar que vai transferir;
- notificar a recepção com o histórico da conversa;
- encerrar a participação da IA sem interromper o atendimento.

A transferência é acionada por gatilhos:

- paciente pede atendente humano;
- paciente relata emergência (o sistema prioriza o contato humano);
- a IA não conclui o objetivo após 3 interações sem progresso.

---

### 9. Tratamento de Erros e Concorrência

**Horário disputado:** quando dois pacientes escolhem o mesmo horário simultaneamente, o sistema reserva para quem confirmar primeiro e informa o segundo paciente, oferecendo o próximo horário livre.

**IA sem certeza:** quando a IA não identifica a especialidade com confiança, ela apresenta as opções disponíveis ou transfere para o humano em vez de adivinhar.

**Falha na API de WhatsApp:** as mensagens ficam em fila e são reenviadas automaticamente quando o canal volta.

---

## Fluxo Principal

1. Paciente envia mensagem.
2. IA responde imediatamente.
3. Entende o motivo da consulta.
4. Define a especialidade.
5. Busca horários.
6. Paciente escolhe.
7. Consulta é marcada.
8. Confirmação enviada.
9. Lembretes automáticos.
10. Possibilidade de remarcar ou cancelar.

---

## Dashboard da Clínica

O administrador deve visualizar:

- consultas marcadas;
- consultas canceladas;
- consultas remarcadas;
- agenda diária;
- médicos disponíveis;
- volume de atendimentos realizados pela IA;
- taxa de conversão de conversas em consultas.

---

## Cadastro de Médicos

Cada médico deverá possuir:

- nome;
- especialidade;
- horários de atendimento;
- dias disponíveis;
- duração da consulta;
- valor da consulta;
- status (ativo/inativo).

---

## Cadastro de Especialidades

A clínica poderá cadastrar:

- especialidade;
- descrição;
- médicos relacionados.

---

## Cadastro da Clínica

Informações:

- nome;
- endereço;
- telefone;
- WhatsApp;
- horário de funcionamento;
- localização;
- redes sociais.

---

## Inteligência Artificial

A IA deverá:

- compreender linguagem natural;
- interpretar sintomas descritos pelo paciente;
- manter contexto da conversa;
- responder de forma humanizada;
- fazer perguntas quando necessário;
- evitar respostas robóticas.

---

## Integrações

O sistema deverá ser preparado para integração com:

- KOMUNIKA (documentação da KOMUNIKA);
- Google Calendar;
- Outlook Calendar;
- sistemas de gestão clínica;
- LOJOU (M-pesa e E-mola) https://docs.lojou.app/]
- PayPal (Mercado pago, cartão de crédito).

---

## Regras de Negócio

- **Agendamento no mesmo dia:** permitido apenas dentro do horário de funcionamento da clínica e até 2 horas antes do horário desejado.
- **Cancelamento:** o paciente pode cancelar sem custo até 4 horas antes da consulta. A partir disso, somente o atendente humano pode cancelar.
- **Remarcação:** permitida sem custo até 4 horas antes. Cada consulta pode ser remarcada no máximo 1 vez no MVP.
- **No-show:** não há multa automática no MVP; o horário perdido é liberado para outro paciente.
- **Lembretes:** enviados 24h e 2h antes da consulta. Se o paciente responder ao lembrete, a IA retoma o atendimento.
- **Horários:** o sistema nunca oferece horários ocupados; a disponibilidade é verificada no momento da escolha.
- **Ordem de reserva:** o horário é confirmado apenas após o paciente confirmar a escolha na conversa.

---

## Segurança

- Login seguro.
- Criptografia dos dados.
- Controle de acesso por perfil.
- Registro de atividades.
- Backup automático.
- Conformidade com a LGPD (Brasil) e proteção de dados aplicável em Moçambique.

---

## Modelo de Negócio

SaaS por assinatura mensal.

**Plano MVP sugerido (definir depois com o cliente):**

- Assinatura mensal fixa por clínica (ex.: 1.500–3.000 MZN ou R$ 300–600/mês).
- Limite de pacientes atendidos por mês incluso; acima disso, plano superior.

**Monetização futura:**

- Cobrança por consulta agendada via IA.
- Consultoria de implantação e treinamento da equipe.
- Integrações avançadas como adicionais.

---

## Roadmap

**MVP (v1.0):**

- Agente de IA no WhatsApp (agendar, remarcar, cancelar, confirmar).
- Lembretes automáticos.
- Painel administrativo básico (clínica, médicos, especialidades, consultas).
- Transferência para atendente humano.

**v1.5:**

- Pagamentos online (M-pesa, E-mola, PayPal).
- Integração com Google Calendar e Outlook.
- Métricas e relatórios no painel.

**v2.0:**

- Integração com KOMUNIKA e sistemas de gestão clínica.
- Multi-tenant (várias clínicas com cadastro próprio).
- Canais adicionais (site, aplicativo).

---

## Indicadores (KPIs)

- Tempo médio de resposta da IA.
- Taxa de conversão de conversa em consulta marcada.
- Número de consultas agendadas.
- Número de remarcações.
- Número de cancelamentos.
- Redução do trabalho manual da recepção.
- Taxa de comparecimento após lembretes.

---

## Critérios de Sucesso

O SaúdeSync será considerado bem-sucedido quando:

- reduzir significativamente o tempo de resposta ao paciente;
- automatizar a maior parte dos agendamentos;
- diminuir faltas por meio de lembretes automáticos;
- permitir remarcações e cancelamentos sem intervenção humana;
- aumentar o número de consultas efetivamente marcadas;
- proporcionar uma experiência simples, rápida e humanizada tanto para pacientes quanto para a equipe da clínica.

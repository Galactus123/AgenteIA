import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso | SaúdeSync",
  description:
    "Termos e condições de uso do SaúdeSync. Isenção de responsabilidade médica, regras de planos, cancelamento e responsabilidade da clínica.",
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-sidebar sm:text-4xl">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Última atualização: {new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>

        <div className="mt-8 space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              1. Aceitação dos Termos
            </h2>
            <p className="mt-3">
              Ao acessar e utilizar o SaúdeSync, você concorda com estes
              Termos de Uso e com nossa Política de Privacidade. Se você
              não concordar com qualquer parte destes termos, não poderá
              utilizar o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              2. Descrição do Serviço
            </h2>
            <p className="mt-3">
              O SaúdeSync é um SaaS de recepção virtual com Inteligência
              Artificial que opera via WhatsApp para clínicas privadas. A
              IA atua como recepcionista automatizada, realizando o
              entendimento inicial do paciente, sugestão de especialidade,
              agendamento, confirmação, lembretes e remarcação/cancelamento
              de consultas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              3. Isenção de Responsabilidade Médica
            </h2>
            <p className="mt-3">
              O SaúdeSync <strong>não oferece serviços médicos, não realiza
              diagnósticos e não substitui a avaliação de um profissional
              de saúde</strong>. A inteligência artificial do SaúdeSync é
              uma ferramenta de recepção e agendamento — ela:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>
                <strong>Não faz diagnósticos</strong> sobre a condição de
                saúde do paciente.
              </li>
              <li>
                <strong>Não atende emergências médicas</strong>. Em caso de
                emergência, o paciente deve ser orientado a procurar
                atendimento de urgência imediatamente.
              </li>
              <li>
                <strong>Não prescreve tratamentos, medicamentos ou
                encaminhamentos clínicos</strong>.
              </li>
              <li>
                A decisão final sobre o atendimento, diagnóstico e tratamento
                é de exclusiva responsabilidade do profissional de saúde da
                clínica.
              </li>
            </ul>
            <p className="mt-3">
              A clínica é responsável por garantir que o paciente receba
              orientações médicas adequadas e por todas as decisões
              clínicas tomadas. O SaúdeSync é uma ferramenta de gestão de
              agenda e não assume qualquer responsabilidade por
              decisões, diagnósticos ou tratamentos médicos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              4. Responsabilidade da Clínica pelos Dados
            </h2>
            <p className="mt-3">
              A clínica é exclusivamente responsável por:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>
                Garantir que os dados cadastrais (nome da clínica, médicos,
                especialidades, horários, localização) sejam precisos e
                atualizados.
              </li>
              <li>
                Toda informação digitada no sistema pelo administrador da
                clínica, incluindo dados de médicos, pacientes e
                configurações de agenda.
              </li>
              <li>
                Assegurar que o uso da IA esteja em conformidade com a
                legislação vigente (LGPD no Brasil e legislação de
                proteção de dados de Moçambique).
              </li>
              <li>
                Monitorar as conversas da IA para garantir que não haja
                desvios de conduta ou situações que exijam intervenção
                humana imediata.
              </li>
            </ul>
            <p className="mt-3">
              O SaúdeSync não se responsabiliza por dados incorretos,
              desatualizados ou incompletos fornecidos pela clínica, nem
              por quaisquer consequências decorrentes de erros nesses dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              5. Planos e Pagamento
            </h2>
            <p className="mt-3">
              O SaúdeSync opera sob modelo de assinatura mensal. Os planos
              e preços estão disponíveis na página de{" "}
              <a href="/precos" className="text-primary-dark hover:underline">
                Preços
              </a>{" "}
              do site. Os valores são exibidos em Reais (R$) para o Brasil e
              em Meticais (MT) para Moçambique.
            </p>
            <p className="mt-3">
              O pagamento é processado de forma segura por meio dos gateways
              configurados para cada país (Mercado Pago e cartão de crédito
              no Brasil; M-pesa e E-mola via LOJOU em Moçambique).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              6. Cancelamento e Reembolso
            </h2>
            <p className="mt-3">
              O assinante pode cancelar sua assinatura a qualquer momento
              através do painel administrativo ou entrando em contato pelo
              WhatsApp de suporte.
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>
                O cancelamento entra em vigor no final do ciclo de faturamento
                vigente.
              </li>
              <li>
                Não são oferecidos reembolsos proporcionais por cancelamento
                no meio do ciclo de faturamento.
              </li>
              <li>
                Ao cancelar, os dados da clínica são mantidos por até 30 dias
                para possibilitar reativação. Após esse período, os dados são
                excluídos conforme nossa Política de Privacidade.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              7. Propriedade Intelectual
            </h2>
            <p className="mt-3">
              Todo o conteúdo, código, design, interfaces, logotipos e
              documentação do SaúdeSync são propriedade exclusiva do
              SaúdeSync. O cliente não pode copiar, modificar, distribuir ou
              utilizar qualquer parte do serviço para fins que não sejam a
              operação da sua clínica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              8. Modificações nos Termos
            </h2>
            <p className="mt-3">
              Reservamo-nos o direito de atualizar estes Termos de Uso a
              qualquer momento. Alterações serão comunicadas por e-mail ou
              por notificação no painel administrativo. A continuidade do
              uso do serviço após a publicação de alterações constitui
              aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              9. Contato
            </h2>
            <p className="mt-3">
              Para dúvidas sobre estes Termos de Uso, entre em contato
              através de{" "}
              <a
                href="mailto:saudesync1info@gmail.com"
                className="text-primary-dark hover:underline"
              >
                saudesync1info@gmail.com
              </a>
              ou pelo WhatsApp{" "}
              <a
                href="https://wa.me/258853287859"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-dark hover:underline"
              >
                +258 853 287 859
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
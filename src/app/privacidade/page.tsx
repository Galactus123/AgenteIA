import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | SaúdeSync",
  description:
    "Saiba como o SaúdeSync coleta, usa e protege seus dados. Conformidade com a LGPD e legislação de proteção de dados de Moçambique.",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-sidebar sm:text-4xl">
          Política de Privacidade
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
              1. Coleta de Dados
            </h2>
            <p className="mt-3">
              O SaúdeSync coleta os seguintes dados quando você utiliza nossos
              serviços ou preenche o formulário de teste grátis:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>Nome da clínica ou do responsável</li>
              <li>Nome completo do contato</li>
              <li>Número de WhatsApp</li>
              <li>E-mail (opcional)</li>
              <li>Especialidade principal da clínica</li>
              <li>País de atuação (Brasil ou Moçambique)</li>
            </ul>
            <p className="mt-3">
              Não coletamos dados sensíveis de saúde, prontuários médicos,
              histórico clínico ou qualquer informação médica do paciente. A
              IA opera exclusivamente sobre mensagens de texto trocadas pelo
              WhatsApp para identificar a especialidade adequada e agendar
              consultas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              2. Finalidade do Tratamento
            </h2>
            <p className="mt-3">
              Os dados coletados são utilizados exclusivamente para:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>
                Configurar e operar o atendimento automatizado via WhatsApp
                (recepção virtual, agendamento, confirmação e lembretes).
              </li>
              <li>
                Enviar notificações relacionadas ao agendamento e à gestão da
                agenda da clínica.
              </li>
              <li>
                Prestar suporte técnico e humano quando necessário.
              </li>
              <li>
                Cumprir obrigações legais e regulatórias aplicáveis.
              </li>
            </ul>
            <p className="mt-3">
              Não utilizamos seus dados para marketing, prospecção comercial
              de terceiros ou qualquer finalidade diversa da descrita acima.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              3. Base Legal e LGPD
            </h2>
            <p className="mt-3">
              O tratamento dos seus dados pessoais está baseado no consentimento
              livre, informado e inequívoco (art. 7º, inciso I, da Lei nº
              13.709/2018 — LGPD). Você pode revogar seu consentimento a
              qualquer momento, sem prejuízo, através do contato abaixo.
            </p>
            <p className="mt-3">
              No Brasil, o SaúdeSync está em conformidade com a LGPD e com as
              diretrizes da ANPD. Em Moçambique, operamos em conformidade com
              a legislação local de proteção de dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              4. Não Armazenamento de Prontuários Médicos
            </h2>
            <p className="mt-3">
              O SaúdeSync <strong>não armazena, processa nem retém prontuários
              médicos, laudos, resultados de exames ou qualquer dado clínico
              do paciente</strong>. A inteligência artificial atua apenas como
              recepcionista virtual: entende a mensagem do paciente, sugere a
              especialidade adequada, agenda a consulta e envia lembretes.
              Todo o conteúdo médico permanece sob responsabilidade exclusiva
              da clínica e do profissional de saúde.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              5. Compartilhamento e Armazenamento
            </h2>
            <p className="mt-3">
              Seus dados são armazenados de forma segura com criptografia em
              trânsito e em repouso. Não compartilhamos seus dados pessoais com
              terceiros, exceto quando estritamente necessário para a operação
              do serviço (por exemplo, integrações com WhatsApp Business API e
              processadores de pagamento, que estão sujeitos aos seus próprios
              termos de privacidade).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              6. Retenção e Exclusão
            </h2>
            <p className="mt-3">
              Os dados são mantidos pelo tempo necessário para a prestação do
              serviço. Ao cancelar sua assinatura, seus dados serão excluídos
              em até 30 dias, salvo obrigação legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              7. Seus Direitos
            </h2>
            <p className="mt-3">
              Como titular de dados pessoais, você tem o direito de:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>Confirmar a existência de tratamento de seus dados</li>
              <li>Acessar seus dados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Revogar o consentimento a qualquer momento</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato através de{" "}
              <a
                href="mailto:saudesync1info@gmail.com"
                className="text-primary-dark hover:underline"
              >
                saudesync1info@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-sidebar">
              8. Contato
            </h2>
            <p className="mt-3">
              Dúvidas ou solicitações relacionadas a esta Política de
              Privacidade podem ser direcionadas ao nosso Encarregado de
              Proteção de Dados (DPO) através de{" "}
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
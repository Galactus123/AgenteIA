export interface OverageReceiptData {
  clinicName: string;
  paymentMethod: string;
  transactionId: string;
  amount: number;
  currency: string;
  tokens: number;
  newTokenLimit: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMzn(amount: number, currency: string): string {
  return `${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatTokens(value: number): string {
  return value.toLocaleString("pt-BR");
}

// Template HTML do recibo por e-mail (Resend, Nodemailer ou similar).
const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>Recibo de Compra - SaúdeSync</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f6f8; color: #333333;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f4f6f8; padding: 40px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">SaúdeSync</h1>
                            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Recibo de Pagamento - Pacote Adicional</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="font-size: 16px; margin: 0 0 20px 0; color: #1e293b;">Olá, <strong>{{clinic_name}}</strong>,</p>
                            <p style="font-size: 14px; line-height: 1.6; margin: 0 0 25px 0; color: #475569;">
                                Confirmamos com sucesso a receção do seu pagamento. O seu pacote adicional de tokens já foi creditado e o atendimento automático por IA da sua clínica está totalmente ativo.
                            </p>

                            <!-- Tabela de Detalhes -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 25px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Descrição:</td>
                                                <td style="padding: 8px 0; font-size: 13px; color: #0f172a; font-weight: bold; text-align: right;">Pacote Adicional (+{{tokens}} Tokens IA)</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Valor Pago:</td>
                                                <td style="padding: 8px 0; font-size: 13px; color: #0f172a; font-weight: bold; text-align: right;">{{amount}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Método de Pagamento:</td>
                                                <td style="padding: 8px 0; font-size: 13px; color: #0f172a; font-weight: bold; text-align: right;">{{payment_method}} (M-Pesa / eMola)</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Referência:</td>
                                                <td style="padding: 8px 0; font-size: 13px; color: #0f172a; font-weight: bold; text-align: right;">{{transaction_id}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0 0 0; font-size: 14px; color: #0f172a; font-weight: bold;">Novo Limite Total:</td>
                                                <td style="padding: 12px 0 0 0; font-size: 14px; color: #16a34a; font-weight: bold; text-align: right;">{{new_token_limit}} Tokens</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

export function renderOverageReceiptHtml(data: OverageReceiptData): string {
  return TEMPLATE_HTML
    .replaceAll("{{clinic_name}}", escapeHtml(data.clinicName))
    .replaceAll("{{tokens}}", formatTokens(data.tokens))
    .replaceAll("{{amount}}", formatMzn(data.amount, data.currency))
    .replaceAll("{{payment_method}}", escapeHtml(data.paymentMethod))
    .replaceAll("{{transaction_id}}", escapeHtml(data.transactionId))
    .replaceAll("{{new_token_limit}}", formatTokens(data.newTokenLimit));
}

// Versão em texto simples do recibo, usada no WhatsApp (Komunika).
export function renderOverageReceiptText(data: OverageReceiptData): string {
  return [
    "SaúdeSync - Recibo de Pagamento",
    "",
    `Olá, ${data.clinicName},`,
    "",
    "Confirmamos com sucesso a receção do seu pagamento. O seu pacote adicional de tokens já foi creditado e o atendimento automático por IA da sua clínica está totalmente ativo.",
    "",
    `Descrição: Pacote Adicional (+${formatTokens(data.tokens)} Tokens IA)`,
    `Valor Pago: ${formatMzn(data.amount, data.currency)}`,
    `Método de Pagamento: ${data.paymentMethod} (M-Pesa / eMola)`,
    `Referência: ${data.transactionId}`,
    `Novo Limite Total: ${formatTokens(data.newTokenLimit)} tokens`,
    "",
    "Obrigado por escolher a SaúdeSync.",
  ].join("\n");
}
const mercadopago = require('mercadopago');
const axios = require('axios');
const env = require("./dev.env.js");

async function realizarTransacaoPIX(jobId, amount, freelancerEmail, freelancerCpfCnpj) {
    const mercadopago = require('mercadopago');

// Configurar Mercado Pago
mercadopago.configure({
  access_token: 'SEU_ACCESS_TOKEN'
});

// Endpoint para criar cobrança PIX
app.post('/api/create-pix-payment', async (req, res) => {
        try {
            // Calcular taxa da plataforma (ex.: 5%)
            const platformFee = amount * 0.05;
            const totalAmount = amount + platformFee;

            // Criar cobrança PIX
            const paymentData = {
            transaction_amount: totalAmount,
            description: `Pagamento pelo serviço ${jobId}`,
            payment_method_id: 'pix',
            payer: {
                email: 'email_do_contratante@example.com', // Substituir pelo email do contratante
                identification: { type: 'CPF', number: '12345678900' } // Substituir pelo CPF do contratante
            },
            notification_url: 'SUA_URL_DE_WEBHOOK'
            };

            const payment = await mercadopago.payment.create(paymentData);

            // Salvar detalhes no banco de dados
            // Exemplo: await db.savePayment({ jobId, paymentId: payment.body.id, status: 'pending', qrCode: payment.body.point_of_interaction.transaction_data.qr_code });

            res.json({
            qrCode: payment.body.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64: payment.body.point_of_interaction.transaction_data.qr_code_base64,
            paymentId: payment.body.id
            });
        } catch (error) {
            console.error('Erro ao criar cobrança PIX:', error);
            res.status(500).json({ error: 'Falha ao criar cobrança PIX' });
        }
    });
}

realizarTransacaoPIX();
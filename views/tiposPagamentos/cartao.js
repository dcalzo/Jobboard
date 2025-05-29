const stripe = require('stripe')('sua_chave_secreta_aqui');

// Função para criar uma cobrança
async function processarPagamento(cardDetails, amount) {
  try {
    // Criar um token de cartão de crédito
    const token = await stripe.tokens.create({
      card: {
        number: cardDetails.number,
        exp_month: cardDetails.exp_month,
        exp_year: cardDetails.exp_year,
        cvc: cardDetails.cvc
      }
    });

    // Usar o token para criar uma cobrança
    const charge = await stripe.charges.create({
      amount: amount * 100, // O Stripe espera o valor em centavos
      currency: 'usd',
      source: token.id,
      description: 'Descrição da transação'
    });

    console.log("Pagamento processado:", charge);
    return charge;
  } catch (err) {
    console.error("Erro ao processar pagamento:", err);
    throw err;
  }
}

// Exemplo de uso
const cardDetails = {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2025,
  cvc: '123'
};

const amount = 10; // $10.00

processarPagamento(cardDetails, amount)
  .then(result => console.log(result))
  .catch(error => console.error(error));
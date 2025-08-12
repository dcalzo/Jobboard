const axios = require('axios');
const env = require("./dev.env.js");

async function realizarTransacaoPIX(SELLER_KEY, DESTINY_PIX_KEY, AMOUNT, DESCRIPTION) {
    try {
        const response = await axios.post(
            'URL_DA_API', // Insira a URL correta da API aqui
            {
                "chave": DESTINY_PIX_KEY,
                "valor": AMOUNT,
                "descricao": DESCRIPTION
            },
            {
                headers: {
                    'Authorization': `Bearer ${SELLER_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Transação realizada com sucesso:', response.data);
        return response.data;
    } catch (error) {
        console.error('Erro ao realizar a transação:', error.response ? error.response.data : error.message);
    }
}

realizarTransacaoPIX();
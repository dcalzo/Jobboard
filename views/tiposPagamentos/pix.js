const axios = require('axios');

// Substitua pelos seus dados reais
const API_KEY = 'sua_chave_api';
const PIX_KEY = 'chave_pix_destinatario'; // Pode ser um telefone, email, cpf, etc.
const AMOUNT = 100.00; // Em reais
const DESCRIPTION = 'Transação de Teste';

async function realizarTransacaoPIX() {
    try {
        const response = await axios.post(
            'URL_DA_API', // Insira a URL correta da API aqui
            {
                "chave": PIX_KEY,
                "valor": AMOUNT,
                "descricao": DESCRIPTION
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Transação realizada com sucesso:', response.data);
    } catch (error) {
        console.error('Erro ao realizar a transação:', error.response ? error.response.data : error.message);
    }
}

realizarTransacaoPIX();
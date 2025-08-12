const axios = require('axios');
const env = require("./dev.env.js");

function gerarBoleto(dados) {
  return axios.post('https://sandbox.api.pagseguro.com/oauth2/'+env.TOKEN_PAGSEGURO, {
    client_id: 'SEU_CLIENT_ID',
    client_secret: 'SEU_CLIENT_SECRET',
    grant_type: 'client_credentials'
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    const token = env.TOKEN_PAGSEGURO;    
    // Agora use o token para criar o boleto
    axios.post('https://sandbox.api.pagseguro.com/orders', dados, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('AXIOS:', axios);    
    response = axios;
    console.log('RESPONSE:', response.data);
    return response.data; 
  })
  .then(response => {
    // Aqui você recebe os dados do boleto gerado
    return response.data;
  })
  .catch(error => {
    console.error(error.response ? error.response.data : error.message);
    throw error;
  });
}

module.exports = { gerarBoleto };
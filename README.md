Project JobBoard (Freelancer)

### Install Librarys

npm install
npm i nodemon

librarys used

express
mongoose
nodemon
path
ejs

### run localhost

nodemon

### database used

mongodb-compass (localhost)

mongodb atlas (serv)

### pagamento Bitcoin via Lightning

O pagamento Bitcoin usa uma invoice BitPay com a carteira Lightning selecionada.
Configure estas variáveis no ambiente do processo (ou adicione os valores no objeto de configuração usado por `dev.env.js`):

```text
BITPAY_PRIVATE_KEY=<chave privada da aplicação BitPay>
BITPAY_MERCHANT_TOKEN=<token merchant da BitPay>
BITPAY_ENVIRONMENT=Test
```

Use `BITPAY_ENVIRONMENT=Prod` somente com credenciais de produção. Sem as credenciais, o sistema não cria a invoice e exibe uma mensagem de configuração.

### Transferência bancária via PagBank

O pagamento selecionado como depósito bancário usa a API de transferências do PagBank para enviar o valor para os dados bancários cadastrados pelo profissional. Para habilitar o recurso, configure:

```text
PAGBANK_TRANSFER_ACCESS_TOKEN=<access_token com escopo transfer.create>
PAGBANK_NOTIFICATION_URL=https://seu-dominio/webhooks/pagbank/transferencias
PAGBANK_TRANSFER_API_URL=https://secure.api.pagseguro.com/transfers
```

O access token de transferência exige aplicação, certificado digital e liberação da API pelo PagBank. A API do PagBank identifica transferências externas por dados bancários como uma transferência PIX; ela não executa uma TED tradicional. O ambiente sandbox deve usar a URL de transferência correspondente ao ambiente disponibilizado para sua conta.
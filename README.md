Project JobBoard (Freelancer)

### Install Librarys

npm install

librarys used

express
mongoose
nodemon
livereload
connect-livereload
path
ejs

### run localhost

npm run dev

Abra http://localhost:8080/. O LiveReload atualiza o navegador ao salvar arquivos HTML, incluindo os templates em `views`. Para ativar a recarga automática, inicie a aplicação com `npm run dev`; o servidor de recarga é iniciado junto com a aplicação.

### Criptografia dos parâmetros da URL

Os parâmetros de navegação são enviados em um único parâmetro `q`, criptografado com AES-256-GCM. Os formulários são enviados por POST para que credenciais e outros campos não apareçam na URL.

Em desenvolvimento, se `URL_ENCRYPTION_KEY` não estiver definida, a aplicação cria e reutiliza automaticamente uma chave local aleatória em `.url-encryption-key`. Esse arquivo é ignorado pelo Git; mantenha-o para que links criptografados continuem funcionando após reiniciar.

Em produção, configure `URL_ENCRYPTION_KEY` no ambiente do processo Node com uma chave aleatória de pelo menos 32 bytes. Gere uma chave com:

```text
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

No PowerShell, defina-a antes de iniciar a aplicação em produção:

```powershell
$env:URL_ENCRYPTION_KEY = "<chave-gerada>"
npm run dev
```

Use a mesma chave após reinicializações e em todas as instâncias do servidor. Não a grave no repositório nem a compartilhe. URLs antigas com parâmetros em texto puro devem ser substituídas: abra a página inicial e navegue usando os links e formulários do sistema.

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

Em ambiente diferente de `production`, se a transferência falhar e o valor do serviço for válido, a tela exibe uma prévia dos dados e valores para desenvolvimento. Essa prévia é identificada como não enviada e não realiza pagamento algum.
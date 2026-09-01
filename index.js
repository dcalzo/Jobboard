const express = require("express");
const axios = require("axios");
const mercadopago = require("mercadopago");
const BitPay = require('bitpay-sdk');
const mongoose = require("mongoose");
const path = require("path");
const contratante = require("./contratante");
const task = require("./task.js");
const chatmensagem = require("./views/chat/mensagens.js");
const profissional = require("./views/professional/cadastro/profissional");
const contasPagamentos = require("./contasPagamento.js");
const env = require("./dev.env.js");
const app = express();
const porta = 8080;

mongoose.set('strictQuery', false);
                                                                            
mongoose.connect(env.LOCAL_HOST).then(function(){
    console.log("mongo conectado");
}).catch(function(err){
    console.log(err.message);
});

/*mongoose.connect(env.SERVIDOR,{useNewUrlParser: true, useUnifiedTopology:true}).then(function(){
    console.log("mongo conectado");
}).catch(function(err){
    console.log(err.message);
});*/

let msg = null;
let codigoBarrasPagBank = "";

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use("/public", express.static(path.join(__dirname,"public")));
app.set("views", path.join(__dirname,"/views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function formatDateBr(date) {
    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const ano = date.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function addBusinessDays(baseDate, daysToAdd) {
    const result = new Date(baseDate);
    let addedDays = 0;

    while (addedDays < daysToAdd) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        const isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;

        if (isBusinessDay) {
            addedDays += 1;
        }
    }

    return result;
}

function getThirdNextBusinessDay() {
    const thirdBusinessDay = addBusinessDays(new Date(), 3);
    return formatDateBr(thirdBusinessDay);
}

function normalizeTaxId(value) {
    if (!value) {
        return "";
    }

    return String(value).replace(/\D/g, "");
}

function calculatePaymentAmounts(amountValue) {
    const amount = Number.isFinite(Number(amountValue)) ? Number(amountValue) : 0;
    const professionalAmount = Number(amount.toFixed(2));
    const platformFee = Number((professionalAmount * 0.05).toFixed(2));

    return {
        professionalAmount: professionalAmount,
        platformFee: platformFee,
        totalAmount: Number((professionalAmount + platformFee).toFixed(2))
    };
}

function maskToken(token) {
    if (!token) {
        return "";
    }

    const tokenString = String(token);
    if (tokenString.length <= 10) {
        return "***";
    }

    return tokenString.slice(0, 6) + "..." + tokenString.slice(-4);
}

function shouldLogPagBankDebug() {
    return String(env.PAGBANK_DEBUG || "").toLowerCase() === "true";
}

function sanitizePagBankPayloadForLogs(payload) {
    if (!payload || typeof payload !== "object") {
        return payload;
    }

    const clonedPayload = JSON.parse(JSON.stringify(payload));
    if (clonedPayload.payment_method && clonedPayload.payment_method.holder && clonedPayload.payment_method.holder.email) {
        clonedPayload.payment_method.holder.email = "***";
    }

    return clonedPayload;
}

function brDateToIsoDate(brDate) {
    if (!brDate || typeof brDate !== "string") {
        return null;
    }

    const parts = brDate.split("/");
    if (parts.length !== 3) {
        return null;
    }

    return parts[2] + "-" + parts[1] + "-" + parts[0];
}

function stringifyPagBankValue(value) {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "object") {
        if (value.content) {
            return stringifyPagBankValue(value.content);
        }
        if (value.line_code) {
            return stringifyPagBankValue(value.line_code);
        }
        if (value.barcode) {
            return stringifyPagBankValue(value.barcode);
        }
        if (value.url) {
            return stringifyPagBankValue(value.url);
        }
        return JSON.stringify(value);
    }
    return String(value);
}

function getPagBankBarcode(responseData) {
    if (!responseData || typeof responseData !== "object") {
        return "";
    }

    if (responseData.payment_method && responseData.payment_method.barcode) {
        return stringifyPagBankValue(responseData.payment_method.barcode);
    }

    if (responseData.payment_method && responseData.payment_method.boleto && responseData.payment_method.boleto.barcode) {
        return stringifyPagBankValue(responseData.payment_method.boleto.barcode);
    }

    if (responseData.barcode) {
        return stringifyPagBankValue(responseData.barcode);
    }

    if (responseData.point_of_interaction && responseData.point_of_interaction.transaction_data) {
        const transactionData = responseData.point_of_interaction.transaction_data;
        if (transactionData.line_code) {
            return stringifyPagBankValue(transactionData.line_code);
        }
        if (transactionData.barcode) {
            return stringifyPagBankValue(transactionData.barcode);
        }
    }

    if (Array.isArray(responseData.charges) && responseData.charges.length > 0) {
        const firstCharge = responseData.charges[0];
        if (firstCharge && firstCharge.payment_method && firstCharge.payment_method.barcode) {
            return stringifyPagBankValue(firstCharge.payment_method.barcode);
        }
    }

    return "";
}

function getMercadoPagoBoletoLink(responseData) {
    if (!responseData || typeof responseData !== "object") {
        return "";
    }

    if (responseData.point_of_interaction && responseData.point_of_interaction.transaction_data) {
        const transactionData = responseData.point_of_interaction.transaction_data;
        if (transactionData.ticket_url) {
            return String(transactionData.ticket_url);
        }
        if (transactionData.transaction_url) {
            return String(transactionData.transaction_url);
        }
        if (transactionData.url) {
            return String(transactionData.url);
        }
    }

    if (responseData.transaction_details && responseData.transaction_details.external_resource_url) {
        return String(responseData.transaction_details.external_resource_url);
    }

    if (responseData.ticket_url) {
        return String(responseData.ticket_url);
    }

    return "";
}

function validatePagBankChargePayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== "object") {
        errors.push("payload ausente");
        return errors;
    }

    if (!payload.reference_id || String(payload.reference_id).trim() === "") {
        errors.push("reference_id obrigatorio");
    }

    if (!payload.description || String(payload.description).trim() === "") {
        errors.push("description obrigatoria");
    }

    const amountValue = payload.amount && payload.amount.value;
    if (!Number.isInteger(amountValue) || amountValue <= 0) {
        errors.push("amount.value deve ser inteiro positivo em centavos");
    }

    if (!payload.amount || payload.amount.currency !== "BRL") {
        errors.push("amount.currency deve ser BRL");
    }

    const dueDate = payload.payment_method && payload.payment_method.boleto && payload.payment_method.boleto.due_date;
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        errors.push("payment_method.boleto.due_date invalido (esperado YYYY-MM-DD)");
    }

    const holder = payload.payment_method && payload.payment_method.holder;
    if (!holder || !holder.name || String(holder.name).trim() === "") {
        errors.push("payment_method.holder.name obrigatorio");
    }

    if (!holder || !holder.tax_id || !/^\d{11}$|^\d{14}$/.test(String(holder.tax_id))) {
        errors.push("payment_method.holder.tax_id obrigatorio (11 ou 14 digitos)");
    }

    return errors;
}

async function buildBoletoWithPagBankBarcode(boletoData, profissionalDoc) {
    const token = env.TOKEN_MERCADO_PAGO;
    const apiUrl = String(env.MERCADO_PAGO_API_URL || "").replace(/\/+$/, "");

    if (!token || !apiUrl) {
        console.log("Mercado Pago: TOKEN_MERCADO_PAGO ou MERCADO_PAGO_API_URL nao configurado");
        return {
            ...boletoData,
            error: "TOKEN_MERCADO_PAGO ou MERCADO_PAGO_API_URL nao configurado"
        };
    }

    const client = new mercadopago.MercadoPagoConfig({ accessToken: token });
    const paymentClient = new mercadopago.Payment(client);

    const dueDate = brDateToIsoDate(boletoData.validity);
    const rawAmount = Number(
        boletoData.amount
        ?? boletoData.valor
        ?? boletoData.transaction_amount
        ?? boletoData.value
        ?? boletoData.total
        ?? boletoData.preco
        ?? 0
    );
    const amountFromPayload = Number(
        (boletoData && boletoData.payload && boletoData.payload.amount && boletoData.payload.amount.value) || 0
    );
    const fallbackAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : (Number.isFinite(amountFromPayload) && amountFromPayload > 0 ? amountFromPayload / 100 : 100);
    const amountInReais = Number.isFinite(fallbackAmount) && fallbackAmount > 0 ? fallbackAmount : 100;

    if (!dueDate || !Number.isFinite(amountInReais) || amountInReais <= 0) {
        return {
            ...boletoData,
            error: "Valor ou data de vencimento inválidos"
        };
    }

    const taxIdRaw = profissionalDoc && profissionalDoc.cpf_cnpj ? String(profissionalDoc.cpf_cnpj) : "";
    const taxId = normalizeTaxId(taxIdRaw);
    const fallbackEmail = env.EMAIL_PAGBANK || "";
    const payerEmail = (boletoData.payer && boletoData.payer.email) || fallbackEmail || "test@test.com";
    const payerNameRaw = String(boletoData.payer && boletoData.payer.name ? boletoData.payer.name : "Profissional").trim() || "Profissional";
    const payerNameParts = payerNameRaw.split(/\s+/).filter(Boolean);
    const payerFirstName = payerNameParts[0] || "Profissional";
    const payerLastName = payerNameParts.slice(1).join(" ") || "Cliente";

    const payload = {
        transaction_amount: Number(amountInReais.toFixed(2)),
        description: String(boletoData.description || "Pagamento de servico").slice(0, 140),
        payment_method_id: "bolbradesco",
        payer: {
            email: payerEmail,
            first_name: payerFirstName,
            last_name: payerLastName
        }
    };

    if (taxId) {
        payload.payer.identification = {
            type: taxId.length === 14 ? "CNPJ" : "CPF",
            number: taxId
        };
    } else {
        payload.payer.identification = {
            type: "CPF",
            number: "12345678909"
        };
    }

    payload.payer.address = {
        zip_code: "01310930",
        street_name: "Av. Paulista",
        street_number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        federal_unit: "SP"
    };

    console.log("Mercado Pago request url:", apiUrl);
    console.log("Mercado Pago request payload:", sanitizePagBankPayloadForLogs(payload));

    try {
        const response = await paymentClient.create({ body: payload });
        const responseData = response && response.body ? response.body : response;

        const codigoBarras = getPagBankBarcode(responseData);
        const linkBoleto = getMercadoPagoBoletoLink(responseData);
        codigoBarrasPagBank = codigoBarras;

        if (!codigoBarras && !linkBoleto) {
            if (shouldLogPagBankDebug()) {
                console.log("Mercado Pago DEBUG response body sem codigo de barras nem link:", responseData);
            }
            return {
                ...boletoData,
                error: "Não foi possível obter código de barras ou link do boleto"
            };
        }

        return Object.assign({}, boletoData, {
            codigo_barras: codigoBarras,
            link_boleto: linkBoleto
        });
    } catch (error) {
        let status = error && error.response ? error.response.status : null;
        let details = error && error.response && error.response.data ? error.response.data : error.message;

        if (shouldLogPagBankDebug()) {
            console.log("Mercado Pago DEBUG erro completo:", {
                url: apiUrl,
                status: status,
                details: details
            });
        }

        // Algumas vezes a SDK retorna erro genérico 'internal_error' com status nulo.
        // Tentamos uma chamada direta com axios uma vez para obter mais detalhes ou recuperar o boleto.
        const shouldRetryDirect = status === null || (Number.isInteger(status) && status >= 500) || (typeof details === "string" && details.toLowerCase().includes("internal_error"));

        if (shouldRetryDirect) {
            try {
                if (shouldLogPagBankDebug()) console.log("Mercado Pago: tentando retry direto via axios para obter mais detalhes...");
                const axiosResp = await axios.post(apiUrl, payload, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });

                const axiosData = axiosResp && axiosResp.data ? axiosResp.data : axiosResp;
                const codigoBarrasRetry = getPagBankBarcode(axiosData);
                const linkBoletoRetry = getMercadoPagoBoletoLink(axiosData);

                if (shouldLogPagBankDebug()) console.log("Mercado Pago retry response:", axiosData);

                if (codigoBarrasRetry || linkBoletoRetry) {
                    return Object.assign({}, boletoData, {
                        codigo_barras: codigoBarrasRetry,
                        link_boleto: linkBoletoRetry
                    });
                }

                // se não obteve, atualize detalhes para retornar
                status = axiosResp.status || status;
                details = axiosData;
            } catch (retryErr) {
                if (shouldLogPagBankDebug()) console.log("Mercado Pago retry erro:", retryErr && retryErr.response ? retryErr.response.data : retryErr.message || retryErr);
                // manter status/details originais ou usar o do retry
                const retryStatus = retryErr && retryErr.response ? retryErr.response.status : null;
                const retryDetails = retryErr && retryErr.response && retryErr.response.data ? retryErr.response.data : retryErr.message;
                status = status || retryStatus;
                details = details || retryDetails;
            }
        }

        console.log("Erro ao gerar boleto no Mercado Pago. Status:", status, "Detalhes:", details);
        return {
            ...boletoData,
            error: typeof details === "string" ? details : JSON.stringify(details)
        };
    }
}

function buildBoletoFromDb(taskDoc, profissionalDoc) {
    const fallbackDescription = "Servico de desenvolvimento de software";
    const descriptionParts = [];

    if (taskDoc && taskDoc.titleService) {
        descriptionParts.push(`Serviço: ${String(taskDoc.titleService)}`);
    }
    if (taskDoc && taskDoc.tipoPagamento) {
        descriptionParts.push(`Tipo de pagamento: ${String(taskDoc.tipoPagamento)}`);
    }
    if (taskDoc && taskDoc.developer) {
        descriptionParts.push(`Desenvolvedor: ${String(taskDoc.developer)}`);
    }
    if (taskDoc && taskDoc.description) {
        descriptionParts.push(String(taskDoc.description));
    }

    const amountValue = taskDoc && taskDoc.valor ? Number(String(taskDoc.valor).replace(/[^0-9,.-]/g, "").replace(",", ".")) : 100.50;
    const amount = Number.isFinite(amountValue) ? amountValue : 100.50;
    const paymentAmounts = calculatePaymentAmounts(amount);
    const profissionalNome = profissionalDoc && profissionalDoc.nome ? profissionalDoc.nome : "";
    const profissionalEmail = profissionalDoc && profissionalDoc.email ? profissionalDoc.email : "";
    const referenceId = taskDoc && taskDoc.idtask ? String(taskDoc.idtask) : "";

    return {
        reference_id: referenceId,
        description: descriptionParts.length ? descriptionParts.join(" | ") : fallbackDescription,
        amount: paymentAmounts.totalAmount,
        professionalAmount: paymentAmounts.professionalAmount,
        platformFee: paymentAmounts.platformFee,
        validity: getThirdNextBusinessDay(),
        payer: {
            name: profissionalNome,
            email: profissionalEmail
        },
        task: {
            idtask: referenceId,
            titleService: taskDoc && taskDoc.titleService ? String(taskDoc.titleService) : "",
            tipoPagamento: taskDoc && taskDoc.tipoPagamento ? String(taskDoc.tipoPagamento) : "",
            developer: taskDoc && taskDoc.developer ? String(taskDoc.developer) : "",
            valor: taskDoc && taskDoc.valor ? String(taskDoc.valor) : String(amount)
        },
        codigo_barras: codigoBarrasPagBank.length != 0 ? codigoBarrasPagBank : "Codigo de barras não disponivel"
    };
}

app.get("/", (req,res)=>{    
    let emailLog = "";
    let senhalog ="";
    contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, clienteContato){
        try{
            emailLog = clienteContato[0].email;
            senhalog = clienteContato[0].senha;
        }catch(e){}
    });
    profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, clienteProf){
         try{
            emailLog = clienteProf[0].email;
            senhalog = clienteProf[0].senha;
        }catch(e){}
    });
    if(((req.query.email == "teste" || req.query.email == "teste2@gmail.com") && req.query.senha == "123") &&
     (req.query.cadastroProf != "Salvar" || req.query.cadastroContractor !="Salvar")){
        if(req.query.typeuser == "contractor"){
            if(req.query.opcao == "Entrar" && task.idtask == undefined){
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
                res.render("board/index",{
                    typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    login: req.query.company,
                    senha:req.query.senha,
                    taskList: task,
                    column: "",
                    aviso: msg});
                });
            }  
            else if(req.query.opcao == "Entrar" && task.idtask != undefined){//----------------------------------------Inicio Board  
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){  
                res.render("board/index",{
                    typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    login: req.query.company,
                    senha:req.query.senha,
                    taskList: "task",
                    column: "",
                    aviso: msg});
                });
            }  
            else if(req.query.menu == "board"){                
                if(req.query.taskServ == "altera"){  
                    try{
                        task.collection.updateOne({
                            idtask: req.query.count
                        }, {
                            $set: {
                                column: req.query.column
                            }
                        });
                        console.log("task alterada");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){  
                    if(req.query.column == null){
                        res.render("board/index",{
                            typeuser: req.query.typeuser, 
                            email:req.query.email, 
                            senha:req.query.senha,
                            taskList: task,
                            column: req.query.column,
                            aviso: msg});
                    }else{
                        res.render("board/index",{
                            typeuser: req.query.typeuser, 
                            email:req.query.email, 
                            senha:req.query.senha,
                            taskList: task,
                            column: task[0].column,
                            aviso: msg});
                    }
                });                 
            }//-------------------------------------------------------------------------Fim BOARD
            else if(req.query.menu == "createTask"){  
                if( req.query.taskServ == "Salvar Serviço" ){
                    msg = "serviço salvo com sucesso";
                     try{
                        task.collection.insertMany([
                        { 
                            email: req.query.email, 
                            company: req.query.LoginContractor,
                            idtask: req.query.count,
                            developer: "",
                            titleService: req.query.titleService,
                            description: req.query.description,
                            valor: req.query.valor,
                            tipoPagamento: req.query.tipoPagamento,
                            gitLocal: req.query.gitLocal,
                            urlDoc: req.query.urlDoc,
                            column: req.query.column
                        }
                    ]).then(function(){
                        msg = "task salva"
                        console.log(msg) 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }                    
                }  
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
                contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
                    login =  req.query.email.split("@");
                    res.render("company/task/index",{ 
                        typeuser: req.query.typeuser, 
                        count: task,
                        Login: login[0],
                        email:req.query.email, 
                        senha:req.query.senha,
                        msg: msg});
                });
                });                
            }
            else if(req.query.menu == "fincadCont" || req.query.tipoPagamento != null){
                // -------------------------------------------------------------------------------------------------------------------- 
                if(req.query.tipoPagamento == "PIX"){
                    console.log("PIX");
                    /*const pix = require('faz-um-pix');
                    const code = pix({
                        chave: "sua_chave_pix@exemplo.com",
                        valor: 100.00,
                        nome: "Nome do beneficiado",
                        cidade: "SÃO PAULO",
                        descricao: "Pedido #123456",
                        codigo_transacao: "SUA_ID_TRANSACAO"
                    });
                    const payload = code;
                    console.log(payload);*/
                }else if(req.query.tipoPagamento == "Bitcoin"){ 
                        console.log("bitcoin");     
                        const BitPay = require('bitpay-sdk');
                        // Configurar cliente BitPay
                        const client = new BitPay.Client({
                        token: 'SEU_TOKEN_DA_BITPAY',
                        environment: 'test' // Use 'prod' em produção
                        });

                        // Endpoint para criar uma fatura
                        app.post('/api/create-invoice', async (req, res) => {
                        const { jobId, amount, freelancerWallet } = req.body;

                        try {
                            // Calcular taxa da plataforma (ex.: 5%)
                            const platformFee = amount * 0.05;
                            const totalAmount = amount + platformFee;

                            // Criar fatura na BitPay
                            const invoice = await client.createInvoice({
                            price: totalAmount,
                            currency: 'BTC',
                            buyer: { address1: freelancerWallet },
                            orderId: jobId,
                            notificationURL: 'SUA_URL_DE_WEBHOOK'
                            });

                            // Salvar detalhes no banco de dados
                            // Exemplo: await db.saveInvoice({ jobId, invoiceId: invoice.id, status: 'pending' });

                            res.json({ invoiceUrl: invoice.url, invoiceId: invoice.id });
                        } catch (error) {
                            console.error('Erro ao criar fatura:', error);
                            res.status(500).json({ error: 'Falha ao criar fatura' });
                        }
                    });             
                }else if(req.query.tipoPagamento == "bancodeposito"){
                    console.log("deposito");                        
                }  
                if(req.query.idtask == null){                                 
                    task.find({email:req.query.email}).sort({"_id":1}).exec(function(err, task){
                        contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){                    
                            profissional.find({}).sort({"_id":1}).exec(function(err, profissional){
                                var taskSelecionada = null;
                                var profissionalSelecionado = null;

                                if (task && task.length > 0) {
                                    taskSelecionada = task.find(function(item) {
                                        return item.titleService === req.query.taskservice;
                                    }) || task[0];
                                }

                                if (profissional && profissional.length > 0) {
                                    profissionalSelecionado = profissional.find(function(item) {
                                        return item.nome === req.query.profissionalSel;
                                    }) || profissional[0];
                                }

                                var boleto = buildBoletoFromDb(taskSelecionada, profissionalSelecionado);
                                var paymentValues = {
                                    professionalAmount: boleto.professionalAmount,
                                    platformFee: boleto.platformFee,
                                    totalAmount: boleto.amount
                                };
                                var shouldGeneratePagBankBoleto = req.query.tipoPagamento == "Boleto";

                                var boletoPromise = shouldGeneratePagBankBoleto
                                    ? buildBoletoWithPagBankBarcode(boleto, profissionalSelecionado)
                                    : Promise.resolve(boleto);

                                boletoPromise.then(function(boletoComCodigoPagBank) {
                                    if(req.query.tipoPagamento == ""){
                                        res.render("company/pagamento/index",{
                                            profissional: profissional,
                                            contratante: contratante,
                                            idtask:"",
                                            task: task,
                                            estadoPg: "",
                                            profissionalSel: req.query.profissionalSel,
                                            dadosPagamento: boletoComCodigoPagBank,
                                            paymentValues: paymentValues,
                                            taskservice: req.query.taskservice,
                                            typeuser: req.query.typeuser,
                                            nome: req.query.nome,
                                            email:req.query.email,
                                            senha:req.query.senha,
                                            tipoPagamento: ""});
                                    }
                                    else if(req.query.tipoPagamento != ""){
                                            res.render("company/pagamento/index",{
                                                profissional: profissional,
                                                contratante: contratante,
                                                idtask: "",
                                                task: task,
                                                estadoPg: "",
                                                profissionalSel: req.query.profissionalSel,
                                                dadosPagamento: boletoComCodigoPagBank,
                                                paymentValues: paymentValues,
                                                taskservice: req.query.taskservice,
                                                typeuser: req.query.typeuser,
                                                nome: req.query.nome,
                                                email:req.query.email,
                                                senha:req.query.senha,
                                                tipoPagamento: req.query.tipoPagamento});
                                    }
                                }).catch(function() {
                                    res.render("company/pagamento/index",{
                                        profissional: profissional,
                                        contratante: contratante,
                                        idtask: "",
                                        task: task,
                                        estadoPg: "",
                                        profissionalSel: req.query.profissionalSel,
                                        dadosPagamento: boleto,
                                        paymentValues: paymentValues,
                                        taskservice: req.query.taskservice,
                                        typeuser: req.query.typeuser,
                                        nome: req.query.nome,
                                        email:req.query.email,
                                        senha:req.query.senha,
                                        tipoPagamento: req.query.tipoPagamento || ""});
                                });
                            });
                        });
                    }); 
                }else{
                    task.find({developer:req.query.emailDev}).sort({"_id":1}).exec(function(err, task){
                        contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){                    
                            profissional.find({email:req.query.emailDev}).sort({"_id":1}).exec(function(err, profissional){
                                var taskSelecionada = task && task.length > 0 ? task[0] : null;
                                var profissionalSelecionado = profissional && profissional.length > 0 ? profissional[0] : null;
                                var boleto = buildBoletoFromDb(taskSelecionada, profissionalSelecionado);
                                var paymentValues = {
                                    professionalAmount: boleto.professionalAmount,
                                    platformFee: boleto.platformFee,
                                    totalAmount: boleto.amount
                                };
                                var shouldGeneratePagBankBoleto = req.query.tipoPagamento == "Boleto";
                                var boletoPromise = shouldGeneratePagBankBoleto
                                    ? buildBoletoWithPagBankBarcode(boleto, profissionalSelecionado)
                                    : Promise.resolve(boleto);

                                boletoPromise.then(function(boletoComCodigoPagBank) {
                                    res.render("company/pagamento/index",{
                                        profissional: profissional,
                                        contratante: contratante,
                                        idtask: req.query.idtask,
                                        dadosPagamento: boletoComCodigoPagBank,
                                        paymentValues: paymentValues,
                                        task: task,
                                        profissionalSel: req.query.profissionalSel,
                                        taskservice: req.query.taskservice,
                                        estadoPg: req.query.estadoPg,
                                        typeuser: req.query.typeuser,
                                        nome: req.query.nome,
                                        email:req.query.email,
                                        senha:req.query.senha,
                                        tipoPagamento: req.query.tipoPagamento});
                                }).catch(function() {
                                    res.render("company/pagamento/index",{
                                        profissional: profissional,
                                        contratante: contratante,
                                        idtask: req.query.idtask,
                                        dadosPagamento: boleto,
                                        paymentValues: paymentValues,
                                        task: task,
                                        profissionalSel: req.query.profissionalSel,
                                        taskservice: req.query.taskservice,
                                        estadoPg: req.query.estadoPg,
                                        typeuser: req.query.typeuser,
                                        nome: req.query.nome,
                                        email:req.query.email,
                                        senha:req.query.senha,
                                        tipoPagamento: req.query.tipoPagamento});
                                });
                            });
                        });
                    }); 
                }            
            } 
            else if(req.query.menu == "historico"){
                if(req.query.taskServ == "altera"){
                    try{
                        task.collection.updateOne({
                            idtask: req.query.count
                        }, {
                            $set: {
                                column: req.query.column
                            }
                        });
                        console.log("task finalizada");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
                    contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
                        res.render("company/historico/index",{
                            typeuser: req.query.typeuser, 
                            email:req.query.email, 
                            senha:req.query.senha,
                            contratante: contratante,
                            task: task
                        });
                        });
                    });   
            } 
            else if(req.query.menu == "fichaCont" || req.query.cadastroContractor == "Salvar"){                               
                res.render("company/cadastroCont/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    ficha: [req.query.nome,
                        req.query.endereco,
                        req.query.cidade,
                        req.query.estado,
                        req.query.cep,
                        req.query.pais,
                        req.query.cpf_cnpj,
                        req.query.email,
                        req.query.senha,
                        req.query.tipoPagamento
                        ],
                    senha:req.query.senha,
                    senha2: req.query.senha2, 
                    seletor: req.query.seletor});
            }
            else if(req.query.menu == "concluidos"){
                    contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){  
                            task.find({email:req.query.email}).sort({"_id":1}).exec(function(err, task){
                                res.render("company/concluidos/index",{
                                typeuser: req.query.typeuser,
                                task: task,
                                contratante: contratante,
                                profissional: profissional,
                                email:req.query.email,
                                senha:req.query.senha
                            });
                        });
                    });  
            } 
            else  if(req.query.menu == "chatC"){  
                if( req.query.conversa == "Enviar" && req.query.usuario != "" ){
                    try{
                        chatmensagem.collection.insertMany([
                        {           
                            remetente: req.query.email,
                            destinatario: req.query.usuario,
                            mensagem: req.query.mensagem                  
                        }
                    ]).then(function(){
                        msg = "mensagem salva"
                        console.log(msg) 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }              
                }           
            contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
                chatmensagem.find({}).sort({"_id":1}).exec(function(err, chatmensagem){
                    task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){
                        res.render("chat/index",{
                            task: task,
                            chatmensagem: chatmensagem,
                            mensagem: req.query.mensagem,
                            remetente: req.query.email,
                            usuario: req.query.usuario,
                            typeuser: req.query.typeuser,
                            email:req.query.email,
                            senha:req.query.senha
                        });
                    });
                });
            });  
            }
            else  if(req.query.menu == "ProdutosCaju"){     
                res.render("company/caju/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    senha:req.query.senha});       
            }else if(req.query.menu == "fichaCad"){
                if( req.query.alteraContractor == "Alterar" ){
                    try{
                        contratante.collection.updateOne({
                            email: req.query.email
                        }, {
                            $set: {
                                nome: req.query.nome,
                                endereco: req.query.endereco,
                                cidade: req.query.cidade,
                                estado: req.query.estado,
                                cep: req.query.cep,
                                pais: req.query.pais,
                                cpf_cnpj: req.query.cpf_cnpj,
                                email: req.query.email,
                                senha: req.query.senha,
                            }
                        });
                        console.log("contratante alterado");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }                                        
                }
                contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){ 
                    res.render("company/fichaCad/index",{                
                        typeuser: "", 
                        logado: "", 
                        email:contratante[0].email,
                        senha:contratante.senha,
                        contratante: contratante,
                        senha2: req.query.senha2,                
                        produto: contratante.produto,
                        mensagem: msg,
                        tipoPagamento: req.query.tipoPagamento});                   
                });
            }            
        }
        else  if(req.query.typeuser == "professional"){
            if(req.query.opcao == "Entrar"){//-------------------------------------Inicio Board  
                if(req.query.taskServ == "altera"){   
                    try{
                        task.collection.updateOne({
                            idtask: req.query.count
                        }, {
                            $set: {
                                developer: req.query.email,
                                column: req.query.column
                            }
                        });
                        console.log("task alterada");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                task.find({}).exec(function(err, task){     
                res.render("board/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    senha:req.query.senha, 
                    taskList: task,
                    column: "", 
                    aviso: null});
                });
            }else if(req.query.menu == "board"){
                let msg = null;         
                if(req.query.taskServ == "altera"){   
                    try{
                        task.collection.updateOne({
                            idtask: req.query.count
                        }, {
                            $set: {
                                developer: req.query.email,
                                column: req.query.column
                            }
                        });
                        console.log("task alterada");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }     
                task.find({}).exec(function(err, task){  
                if(req.query.column == null){
                    res.render("board/index",{typeuser: req.query.typeuser, 
                        email:req.query.email, 
                        taskList: task,
                        senha:req.query.senha, 
                        column: req.query.column, 
                        aviso: msg});
                }else{
                    res.render("board/index",{typeuser: req.query.typeuser, 
                        email:req.query.email, 
                        senha:req.query.senha, 
                        taskList: task,
                        column:task[0].column, 
                        aviso: msg});
                }               
            }); 
            }//-------------------------------------------------------------------------Fim Board
            else  if(req.query.menu == "ProdutosCaju"){     
                res.render("professional/caju/index",{
                    typeuser: req.query.typeuser,
                    email:req.query.email,
                    senha:req.query.senha,
                    tipoPagamento: req.query.hiddenCodigoBarras
                });       
            }else  if(req.query.menu == "ganho"){ ////////////////////////////////////////////////////////////////////////// 
                if(req.query.chavePix == "Enviar chave PIX"){
                    contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, dadosPag){
                        dadosPag.forEach(function(dado) { 
                            if (dado.tipo === "PIX"){                             
                                task.find({developer: req.query.email}).exec(function(err, task){   
                                    for(let i = 1; i < task.length; i++){                       
                                        //const idtask = Object.keys(req.query).find(id => id.startsWith(`idTask-${i}`) );
                                        //const barras = Object.keys(req.query).find(barra =>  barra.startsWith(`hiddenCodigoBarras-${i}`) );                            
                                        const parametros = Object.keys(req.query).find(barra => 
                                            barra.startsWith(`hiddenCodigoBarras-${i}`) != undefined ? console.log(req.query[`${barra}`]) : null);
                                        //console.log(req.query)
                                        //console.log(idtask)
                                        //console.log(req.query[`${barra}`])
                                        //console.log(req.query[`${idtask}`])
                                        //console.log(barras)
                                        /*console.log(req.query[`${barras}`]) */
                                    }
                                });        
                                try{
                                    task.collection.updateOne({
                                        idtask: "4",
                                        tipoPagamento: "PIX"
                                    }, {
                                    $set: {
                                        codigo: dado.chave
                                    }
                                });
                                 console.log("Chave PIX alterada");
                                }catch(e){
                                     console.log("Erro: "+e.message);
                                }
                            }
                        })
                    }); 
                }
                 if(req.query.carteiraBitcoin == "Enviar carteira Bitcoin"){
                    contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, dadosPag){
                        dadosPag.forEach(function(dado) { 
                            if (dado.tipo === "Bitcoin"){
                                try{
                                    task.collection.updateOne({
                                        idtask: "2",
                                        tipoPagamento: "Bitcoin"
                                    }, {
                                    $set: {
                                        codigo: dado.enderecoBTC
                                    }
                                });
                                 console.log("Carteira Bitcoin alterada");
                                }catch(e){
                                     console.log("Erro: "+e.message);
                                }
                            }
                        })
                    }); 
                }
                if(req.query.contaTED == "Enviar dados do TED"){
                    contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, dadosPag){
                        dadosPag.forEach(function(dado) { 
                            if (dado.tipo === "bancodeposito"){
                                try{
                                    task.collection.updateOne({
                                        idtask: "8",
                                        tipoPagamento: "bancodeposito"
                                    }, {
                                    $set: {
                                        codigo: "{Banco:'" + dado.banco + "',agencia:'" + dado.agencia + "',conta:'" + dado.numeroConta + "',tipo:'" + dado.tipoConta + "'}"
                                    }
                                });
                                 console.log("Carteira TED alterada");
                                }catch(e){
                                     console.log("Erro: "+e.message);
                                }
                            }
                        })
                    }); 
                }
                contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, dadosPag){
                    task.find({developer: req.query.email}).sort({"_id":1}).exec(function(err, task){
                    profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){
                       res.render("professional/ganho/index",{
                            typeuser: req.query.typeuser,
                            email: req.query.email,
                            senha: req.query.senha,
                            task: task,
                            codigoBarras: req.query.hiddenCodigoBarras,
                            tipoPagamento: req.query.tipoPagamento
                            });
                        });
                  });
              });                                     
            }else  if(req.query.menu == "fichaPro" || req.query.cadastroProf=="Salvar"){                   
                if(req.query.typeuser == null){
                     res.render("professional/cadastro/index",{
                        typeuser: null, 
                        email:req.query.email, 
                        senha:req.query.senha
                    }); 
                }else{
                    res.render("professional/cadastro/index",{
                        typeuser: req.query.typeuser, 
                        email:req.query.email, 
                        senha:req.query.senha
                    }); 
                }      
            
            }else if(req.query.menu == "fincadPro"){ ////////////////////////////////////////////////////////////////////////////////////////////////////////  
                if( req.query.cadastraPagamento == "Cadastrar Pagamento"){
                    try{
                        contasPagamentos.collection.insertMany([
                        {           
                            nome: req.query.nome,
                            email: req.query.email,
                            tipo: req.query.tipoPagamento,
                            documento: req.query.documento,
                            redeBTC: req.query.redeBTC,
                            enderecoBTC: req.query.enderecoBTC,
                            banco: req.query.banco,
                            agencia: req.query.agencia,
                            numeroConta: req.query.conta,
                            tipoConta: req.query.tipoConta,
                            tipochave: req.query.tipochave,
                            chave: req.query.chave,
                            senha: req.query.senha,
                            valor: req.query.valor,
                            observacao: req.query.observacao,
                            produto: "JobBaord"                
                        }
                    ]).then(function(){
                        msg = "pagamento salvo"
                        console.log(msg) 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }              
                } else if( req.query.cadastraPagamento == "Alterar Pagamento"){
                    try{
                        contasPagamentos.collection.updateOne({
                            email: req.query.email,
                            tipo: req.query.tipoPagamento
                        }, {
                            $set: {
                                nome: req.query.nome,
                                email: req.query.email,
                                tipo: req.query.tipoPagamento,
                                documento: req.query.documento,
                                redeBTC: req.query.redeBTC,
                                enderecoBTC: req.query.enderecoBTC,
                                banco: req.query.banco,
                                agencia: req.query.agencia,
                                numeroConta: req.query.conta,
                                tipoConta: req.query.tipoConta,
                                tipochave: req.query.tipochave,
                                chave: req.query.chave,
                                senha: req.query.senha,
                                valor: req.query.valor,
                                observacao: req.query.observacao,
                                produto: "JobBaord"            
                            }
                        }).then(function(){
                        msg = "pagamento alterado"
                        console.log(msg) 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }              
                }  
                contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contasSalvas){
                    res.render("professional/pagamento/index",{
                    typeuser: req.query.typeuser, 
                    codigoBarras: req.query.codigoBarras,
                    email:req.query.email, 
                    senha:req.query.senha, 
                    tipoPagamento: req.query.tipoPagamento,
                    contasSalvas: contasSalvas
                }); 
                 });                      
            }
            else if(req.query.menu == "chatP"){
                if( req.query.conversa == "Enviar" && req.query.usuario != "" ){           
                    try{
                        chatmensagem.collection.insertMany([
                        {     
                            tipoPagamento: req.query.tipoPagamento,      
                            remetente: req.query.email,
                            destinatario: req.query.usuario,
                            mensagem: req.query.mensagem                  
                        }
                    ]).then(function(){
                        msg = "mensagem salva"
                        console.log(msg) 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }              
                }     
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){  
                    chatmensagem.find({}).sort({"_id":1}).exec(function(err, chatmensagem){
                        task.find({developer: req.query.email}).exec(function(err, task){ 
                            res.render("chat/index",{
                                task: task,
                                chatmensagem: chatmensagem,
                                remetente: profissional[0].email,
                                tipoPagamento: req.query.tipoPagamento,
                                typeuser: req.query.typeuser,
                                mensagem: req.query.mensagem,
                                usuario: req.query.usuario,
                                email:req.query.email,
                                senha:req.query.senha
                            });
                        });
                    });
                }); 
            }
            else if(req.query.menu == "fichaCad"){ 
                if( req.query.alteraProf == "Alterar" ){
                    try{
                        profissional.collection.updateOne({
                            email: req.query.email
                        }, {
                            $set: {
                                nome: req.query.nome,
                                endereco: req.query.endereco,
                                 cidade: req.query.cidade,
                                 estado: req.query.estado,
                                 cep: req.query.cep,
                                 pais: req.query.pais,
                                 rg: req.query.rg,
                                 cpf_cnpj: req.query.cpf_cnpj,
                                 email: req.query.email,
                                 senha: req.query.senha,
                                 sexo: req.query.sexo,
                                 profissao: req.query.profissao,
                                 historico: req.query.historico,
                                 conhecimento: req.query.conhecimento,
                                 tipoPagamento: req.query.tipoPagamento,
                                 chavePixSel: req.query.chavePixSel,
                                 bancopix: req.query.txtBanco,
                                 chavepix: req.query.txtChavePix,
                                 carteiraBitcoin: req.query.carteiraBitcoin,
                                 conta: req.query.conta,
                                 agencia: req.query.agencia,
                                 banco: req.query.banco,
                                 tipoconta: req.query.tipoconta,
                            }
                        });
                        console.log("profissional alterado");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }                                        
                }
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){   
                    let tipoPag = profissional[0].tipoPagamento;  
                    if(req.query.tipoPagamento != profissional[0].tipoPagamento && req.query.tipoPagamento != undefined){
                        tipoPag = req.query.tipoPagamento;
                    }  
                    res.render("professional/fichaCad/index",{ 
                        typeuser: "", 
                        mensagem: msg,
                        profissional: profissional,
                        logado: "", 
                        sexo: profissional[0].sexo,
                        tipoPagamento: tipoPag,
                        email: profissional[0].email, 
                        senha: profissional[0].senha,
                        conta: profissional[0].conta,
                        agencia: profissional[0].agencia,
                        banco: profissional[0].banco,
                        tipoconta: profissional[0].tipoconta,
                        carteiraBitcoin: profissional[0].carteiraBitcoin,
                        chavePixSel: profissional[0].chavePixSel,
                        chavePix: profissional[0].chavepix,
                        txtBanco: profissional[0].bancopix,
                        txtChavePix: profissional[0].chavepix,
                        senha2:  req.query.senha2});                   
                });
            }
        }             
    }
    else{
        if(req.query.opcao == "login-pro" && req.query.opcaoPag != "cadastroPro"){   
            res.render("login/index",{logado: "", user:"professional"});
        }else if(req.query.opcao == "login-cont" && req.query.opcao != "cadastroCon"){   
            res.render("login/index",{logado: "", user:"contractor"});
        }else if(req.query.opcao == "About"){   
            res.render("about/index",{logado: ""});
        }else if(req.query.opcao == "cadastroPro" || req.query.opcaoPag == "cadastroPro"){ 
            if(req.query.cadastroPro == "Salvar" && req.query.senha != "" && req.query.senha == req.query.senha2){
                msg = "Profissional salvo com sucesso\npode procurar um serviço";
                     try{
                        profissional.insertMany([ 
                        { 
                            nome: req.query.nome, 
                            endereco: req.query.endereco,
                            cidade: req.query.cidade,
                            estado: req.query.estado,
                            cep: req.query.cep,
                            pais: req.query.pais,
                            rg: req.query.rg,
                            cpf_cnpj: req.query.cpf_cnpj,
                            email: req.query.email,
                            senha: req.query.senha,
                            sexo: req.query.sexo,
                            profissao: req.query.profissao,
                            historico: req.query.historico,
                            conhecimento: req.query.conhecimento,
                            tipoPagamento: req.query.tipoPagamento,
                            conta: req.query.conta,
                            agencia: req.query.agencia,
                            banco: req.query.banco,
                            tipoconta: req.query.tipoconta,
                            carteiraBitcoin: req.query.carteiraBitcoin,
                            chavePixSel: req.query.chavePixSel,
                            chavepix: req.query.txtChavePix,
                            bancopix: req.query.txtBanco
                        }
                    ]).then(function(){
                        console.log("Profissional salvo") 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }   
                    res.render("professional/cadastro/index",{
                        typeuser: "", 
                        mensagem: msg,
                        ficha: [req.query.nome, 
                            req.query.endereco,                             
                            req.query.cidade,
                            req.query.estado,
                            req.query.cep,
                            req.query.pais,
                            req.query.rg,
                            req.query.cpf_cnpj,
                            req.query.email, 
                            req.query.senha, 
                            req.query.sexo,
                            req.query.profissao,
                            req.query.historico,
                            req.query.conhecimento],
                        logado: "", 
                        sexo:req.query.sexo,
                        tipoPagamento: req.query.tipoPagamento,
                        conta: req.query.conta,
                        agencia: req.query.agencia,
                        banco: req.query.banco,
                        tipoconta: req.query.tipoconta,
                        carteiraBitcoin: req.query.carteiraBitcoin,
                        chavePixSel: req.query.chavePixSel,
                        chavePix: req.query.chavePix,
                        txtBanco: req.query.txtBanco,
                        txtChavePix: req.query.txtChavePix,
                        senha: req.query.senha,
                        senha2:  req.query.senha2
                    });                 
            }
            else{
                if(req.query.senha != req.query.senha2){
                    msg = "As senhas estão diferentes elas precisam ser iguais"
                }
                if(req.query.sexo != ""){
                    res.render("professional/cadastro/index",{
                        typeuser: "",
                        logado: "",
                        ficha: [req.query.nome, 
                            req.query.endereco,                             
                            req.query.cidade,
                            req.query.estado,
                            req.query.cep,
                            req.query.pais,
                            req.query.rg,
                            req.query.cpf_cnpj,
                            req.query.email, 
                            req.query.senha, 
                            req.query.sexo,
                            req.query.profissao,
                            req.query.historico,
                            req.query.conhecimento],
                        tipoPagamento: req.query.tipoPagamento,
                        sexo:req.query.sexo,
                        conta: req.query.conta,
                        agencia: req.query.agencia,
                        banco: req.query.banco,
                        tipoconta: req.query.tipoconta,
                        carteiraBitcoin: req.query.carteiraBitcoin,
                        chavePix: req.query.chavePix,
                        txtBanco: req.query.txtBanco,
                        chavePixSel: req.query.chavePixSel,
                        txtChavePix: req.query.txtChavePix,
                        mensagem: msg,
                        senha: req.query.senha,
                        senha2:  req.query.senha2
                    });
                }else{
                    res.render("professional/cadastro/index",{
                        typeuser: "",
                        logado: "",
                        ficha: [""],
                        sexo: "",
                        mensagem: msg,
                        tipoPagamento: req.query.tipoPagamento,
                        conta: null,
                        agencia: null,
                        banco: null,
                        tipoconta: "",
                        senha: "",
                        senha2:  ""
                    });
                } 
            }
        }
        else if(req.query.opcao == "cadastroCon" || req.query.cadastroContractor == "Salvar"){
            if(req.query.cadastroContractor=="Salvar" && req.query.senhaCad != "" && req.query.senhaCad2 != "" && 
                req.query.senhaCad == req.query.senhaCad2){
                msg = "Contratante salvo com sucesso\npode procurar um serviço";
                 try{  
                    contratante.insertMany([
                        { 
                            nome: req.query.nome, 
                            endereco: req.query.endereco,
                            cidade: req.query.cidade,
                            estado: req.query.estado,
                            cep: req.query.cep,
                            pais: req.query.pais,
                            cpf_cnpj: req.query.cpf_cnpj,
                            email: req.query.email,
                            senha: req.query.senha,
                            tipoPagamento: req.query.tipoPagamento,
                            produto: req.query.produto
                        }
                    ]).then(function(){
                        console.log("contratante salvo") 
                    }).catch(function(error){
                        console.log(error)    
                    });                     
                    }catch(e){
                        console.log(e.error);
                    } 
            }else{
                msg = "Contratante não foi salvo";                
            } 
            res.render("company/cadastroCont/index",{                
                typeuser: "", 
                logado: "", 
                ficha: [req.query.nome,
                req.query.endereco,
                req.query.cidade,
                req.query.estado,
                req.query.cep,
                req.query.pais,
                req.query.cpf_cnpj,
                req.query.email,
                req.query.senha,
                req.query.tipoPagamento
                ],
                senha2: req.query.senha2,                
                produto: req.query.produto,
                mensagem: msg,
                tipoPagamento: req.query.tipoPagamento}); 
        }
        else if(req.query.opcao == null || req.query.opcao == "home"){ 
            res.render("principal/index",{
                logado: "",
                demo: req.query.demo,
                demo2: req.query.demo2
            });
        }  
    }    
}); 

// API para gerar boleto via PagSeguro
app.post('/api/gerar-boleto', async (req, res) => {
    try {
        const payload = req.body && Object.keys(req.body).length > 0 ? req.body : (req.query || {});
        const { email, senha, taskTitleService } = payload;

        if (!email || !senha) {
            return res.status(400).json({ 
                success: false, 
                erro: 'Email e senha são obrigatórios' 
            });
        }

        // Buscar dados do profissional
        const profissionalDocs = await profissional.find({ email: email, senha: senha }).exec();
        
        if (!profissionalDocs || profissionalDocs.length === 0) {
            return res.status(401).json({ 
                success: false, 
                erro: 'Profissional não encontrado' 
            });
        }

        const profissionalSelecionado = profissionalDocs[0];

        const boletoData = {
            reference_id: profissionalSelecionado._id.toString(),
            description: `Pagamento de serviço: ${taskTitleService || 'Sem título'}`,
            amount: 100.00,
            validity: getThirdNextBusinessDay(),
            payer: {
                name: profissionalSelecionado.nome || 'Profissional',
                email: profissionalSelecionado.email
            }
        };

        // Gerar boleto com código de barras via PagBank
        const boletoComCodigo = await buildBoletoWithPagBankBarcode(boletoData, profissionalSelecionado);

        if (boletoComCodigo.codigo_barras || boletoComCodigo.link_boleto) {
            return res.json({
                success: true,
                codigoBarras: boletoComCodigo.codigo_barras || '',
                linkBoleto: boletoComCodigo.link_boleto || '',
                linkPagSeguro: boletoComCodigo.link_boleto || '',
                mensagem: 'Boleto gerado com sucesso',
                boleto: {
                    description: boletoData.description,
                    amount: boletoData.amount,
                    validity: boletoData.validity,
                    payer: boletoData.payer
                }
            });
        } else {
            return res.json({
                success: false,
                erro: boletoComCodigo.error || 'Não foi possível gerar o boleto. Verifique suas configurações.'
            });
        }

    } catch (error) {
        console.error('Erro ao gerar boleto:', error);
        res.status(500).json({
            success: false,
            erro: 'Erro ao gerar boleto: ' + error.message
        });
    }
});

app.post('/api/salvar-conta-bancaria', async (req, res) => {
    try {
        const { email, senha, banco, agencia, conta, tipoConta } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios.' });
        }
        if (!banco || !agencia || !conta || !tipoConta) {
            return res.status(400).json({ success: false, error: 'Todos os campos da conta bancária são obrigatórios.' });
        }

        const updateResult = await profissional.updateOne(
            { email: email, senha: senha },
            {
                $set: {
                    banco: banco,
                    agencia: agencia,
                    conta: conta,
                    tipoconta: tipoConta
                }
            }
        ).exec();

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Profissional não encontrado.' });
        }

        return res.json({ success: true, message: 'Dados bancários salvos com sucesso.' });
    } catch (error) {
        console.error('Erro ao salvar conta bancária:', error);
        return res.status(500).json({ success: false, error: 'Erro interno ao salvar conta bancária.' });
    }
});

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`funcionando\nhttp://localhost:${port}/`);
    });

    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.warn(`Porta ${port} ocupada. Tentando ${port + 1}...`);
            server.close(() => startServer(port + 1));
        } else {
            console.error("Erro ao iniciar servidor:", error);
            process.exit(1);
        }
    });
}

startServer(process.env.PORT || porta);




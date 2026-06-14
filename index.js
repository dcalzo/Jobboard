const express = require("express");
const axios = require("axios");
const BitPay = require('bitpay-sdk');
const mongoose = require("mongoose");
const path = require("path");
const contratante = require("./contratante");
const task = require("./task.js");
const chatmensagem = require("./views/chat/mensagens.js");
const profissional = require("./views/professional/cadastro/profissional");
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

function getPagBankBarcode(responseData) {
    if (!responseData || typeof responseData !== "object") {
        return "";
    }

    if (responseData.payment_method && responseData.payment_method.barcode) {
        return String(responseData.payment_method.barcode);
    }

    if (responseData.payment_method && responseData.payment_method.boleto && responseData.payment_method.boleto.barcode) {
        return String(responseData.payment_method.boleto.barcode);
    }

    if (responseData.barcode) {
        return String(responseData.barcode);
    }

    if (Array.isArray(responseData.charges) && responseData.charges.length > 0) {
        const firstCharge = responseData.charges[0];
        if (firstCharge && firstCharge.payment_method && firstCharge.payment_method.barcode) {
            return String(firstCharge.payment_method.barcode);
        }
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
    const token = env.TOKEN_PAGSEGURO;
    const pagBankBaseUrl = env.PAGBANK_API_URL || "https://sandbox.api.pagseguro.com";
    const chargeUrl = pagBankBaseUrl + "/charges";

    if (!token) {
        console.log("PagBank: TOKEN_PAGSEGURO nao configurado");
        return boletoData;
    }

    const dueDate = brDateToIsoDate(boletoData.validity);
    const amountInCents = Math.round(Number(boletoData.amount || 0) * 100);

    if (!dueDate || !Number.isFinite(amountInCents) || amountInCents <= 0) {
        return boletoData;
    }

    const taxIdRaw = profissionalDoc && profissionalDoc.cpf_cnpj ? String(profissionalDoc.cpf_cnpj) : "";
    const taxId = normalizeTaxId(taxIdRaw);
    const holder = {
        name: boletoData.payer && boletoData.payer.name ? boletoData.payer.name : "Profissional"
    };

    if (boletoData.payer && boletoData.payer.email) {
        holder.email = boletoData.payer.email;
    }

    if (taxId.length === 11 || taxId.length === 14) {
        holder.tax_id = taxId;
    }

    const payload = {
        reference_id: String(boletoData.reference_id || "123456"),
        description: String(boletoData.description || "Pagamento de servico").slice(0, 140),
        amount: {
            value: amountInCents,
            currency: "BRL"
        },
        payment_method: {
            type: "BOLETO",
            boleto: {
                due_date: dueDate,
                instruction_lines: {
                    line_1: "Pagamento referente ao servico contratado",
                    line_2: "Nao receber apos o vencimento"
                }
            },
            holder: holder
        }
    };

    const payloadErrors = validatePagBankChargePayload(payload);
    if (payloadErrors.length > 0) {
        console.log("PagBank: payload invalido para gerar boleto:", payloadErrors.join("; "));
        return boletoData;
    }

    if (shouldLogPagBankDebug()) {
        console.log("PagBank DEBUG request:", {
            url: chargeUrl,
            authorization: "Bearer " + maskToken(token),
            payload: sanitizePagBankPayloadForLogs(payload)
        });
    }

    try {
        const response = await axios.post(chargeUrl, payload, {
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
                Accept: "application/json"
            }
        });

        if (shouldLogPagBankDebug()) {
            console.log("PagBank DEBUG response status:", response.status);
        }

        codigoBarrasPagBank = getPagBankBarcode(response.data);
        if (!codigoBarrasPagBank) {
            if (shouldLogPagBankDebug()) {
                console.log("PagBank DEBUG response body sem codigo de barras:", response.data);
            }
            return boletoData;
        }

        return Object.assign({}, boletoData, {
            codigo_barras: codigoBarrasPagBank
        });
    } catch (error) {
        const status = error && error.response ? error.response.status : null;
        const details = error && error.response && error.response.data ? error.response.data : error.message;

        if (shouldLogPagBankDebug()) {
            console.log("PagBank DEBUG erro completo:", {
                url: chargeUrl,
                status: status,
                details: details
            });
        }

        console.log("Erro ao gerar boleto no PagBank. Status:", status, "Detalhes:", details);
        return boletoData;
    }
}

function buildBoletoFromDb(taskDoc, profissionalDoc) {
    const fallbackDescription = "Servico de desenvolvimento de software";
    const descriptionParts = [];

    if (taskDoc && taskDoc.titleService) {
        descriptionParts.push(String(taskDoc.titleService));
    }
    if (taskDoc && taskDoc.description) {
        descriptionParts.push(String(taskDoc.description));
    }

    const amountValue = taskDoc && taskDoc.valor ? Number(String(taskDoc.valor).replace(",", ".")) : 100.50;
    const amount = Number.isFinite(amountValue) ? amountValue : 100.50;
    const profissionalNome = profissionalDoc && profissionalDoc.nome ? profissionalDoc.nome : "";
    const profissionalEmail = profissionalDoc && profissionalDoc.email ? profissionalDoc.email : "";
    const referenceId = taskDoc && taskDoc.idtask ? String(taskDoc.idtask) : "";
    const barcodeSeed = referenceId.replace(/\D/g, "");

    return {
        reference_id: referenceId,
        description: descriptionParts.length ? descriptionParts.join("\n") : fallbackDescription,
        amount: amount,
        validity: getThirdNextBusinessDay(),
        payer: {
            name: profissionalNome,
            email: profissionalEmail
        },
        codigo_barras: codigoBarrasPagBank.length != 0 ? codigoBarrasPagBank : barcodeSeed + " 1111000 11111110 00000000000000"
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
    if(((req.query.email == "teste" || req.query.email == "teste2") && req.query.senha == "123") &&
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
                res.render("professional/caju/index",{typeuser: req.query.typeuser, email:req.query.email, senha:req.query.senha});       
            }else  if(req.query.menu == "ganho"){     
                res.render("professional/ganho/index",{typeuser: req.query.typeuser, email:req.query.email, senha:req.query.senha});       
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
            
            }else if(req.query.menu == "fincadPro"){     
                res.render("professional/pagamento/index",{
                    typeuser: req.query.typeuser, 
                    codigoBarras: req.query.codigoBarras,
                    email:req.query.email, 
                    senha:req.query.senha, 
                    tipoPagamento: req.query.tipoPagamento});       
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
            res.render("principal/index",{logado: ""});
        }  
    }    
}); 

app.listen(porta,()=>{
    console.log("funcionando\nhttp://localhost:8080/");    
});




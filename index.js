const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const path = require("path");
const contratante = require("./contratante");
const task = require("./task.js");
const contabilidade = require("./contabilidade.js");
const chatmensagem = require("./views/chat/mensagens.js");
const profissional = require("./views/professional/cadastro/profissional");
const contasPagamentos = require("./contasPagamento.js");
const { criarTransferenciaPagBank, criarPreviaTransferenciaPagBank, lerDadosBancarios } = require("./views/tiposPagamentos/ted.js");
const { criarPagamentoBitcoinLightning, criarPreviaPagamentoBitcoin } = require("./views/tiposPagamentos/bitCoin.js");
const { criarPagamentoPix, criarPreviaPagamentoPix } = require("./views/tiposPagamentos/pix.js");
const env = require("./dev.env.js");
const avaliar = require("./views/avaliar/avaliar.js");
const { createUrlEncryption, queryParameter, resolveEncryptionSecret } = require("./urlEncryption");
const app = express();
const porta = 8080;
const urlEncryption = createUrlEncryption(resolveEncryptionSecret(process.env.URL_ENCRYPTION_KEY, {
    isProduction: process.env.NODE_ENV === "production",
    keyFilePath: path.join(__dirname, ".url-encryption-key")
}));

if (process.env.NODE_ENV !== "production") {
    require("./live-reload")();
    app.use(require("connect-livereload")());
}

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

async function salvarLancamentoContabilidade({ contato, tipo, servico, ano, mes, dia, valor }) {
    const taskId = String(servico._id);
    const idtaskNumero = Number(servico.idtask);
    const idsTask = [...new Set([servico.idtask, idtaskNumero].filter((value) =>
        value !== undefined && value !== null && Number.isFinite(Number(value))
    ))];
    const lancamento = {
        idtask: idtaskNumero,
        taskId: taskId,
        contato: contato,
        tipo: tipo,
        ano: ano,
        mes: mes,
        dia: dia,
        valor: valor
    };
    const identidade = { contato: contato, tipo: tipo, taskId: taskId };
    const lancamentoAntigo = await contabilidade.findOne({
        contato: contato,
        taskId: { $exists: false },
        idtask: { $in: idsTask },
        $or: [
            { tipo: tipo },
            { tipo: { $exists: false } },
            { tipo: null }
        ]
    }).sort({ _id: 1 }).exec();

    if (lancamentoAntigo) {
        return contabilidade.updateOne({ _id: lancamentoAntigo._id }, { $set: lancamento }).exec();
    }

    try {
        return await contabilidade.updateOne(identidade, { $set: lancamento }, { upsert: true }).exec();
    } catch (error) {
        if (error.code !== 11000) throw error;
        return contabilidade.updateOne(identidade, { $set: lancamento }).exec();
    }
}

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use("/public", express.static(path.join(__dirname,"public")));
app.set("views", path.join(__dirname,"/views"));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const send = res.send;
    res.send = function(body) {
        if (typeof body === "string") {
            body = urlEncryption.encryptHtmlLinks(body);
        }
        return send.call(this, body);
    };

    if (req.path !== "/") return next();

    if (req.method === "POST") {
        if (Object.keys(req.query).length > 0) {
            return res.status(400).send("Não envie parâmetros pela URL; use os formulários do sistema.");
        }
        const body = req.body || {};
        if (Object.prototype.hasOwnProperty.call(body, queryParameter)) {
            try {
                const decryptedQuery = urlEncryption.decryptQuery(body[queryParameter]);
                delete body[queryParameter];
                req.query = { ...decryptedQuery, ...body };
            } catch (error) {
                console.error("Não foi possível descriptografar os parâmetros do formulário:", error.message);
                return res.status(400).send("Parâmetros do formulário inválidos ou não foi possível descriptografá-los.");
            }
        } else {
            req.query = body;
        }
        req.method = "GET";
        return next();
    }

    if ((req.method !== "GET" && req.method !== "HEAD") || Object.keys(req.query).length === 0) {
        return next();
    }

    if (Object.keys(req.query).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(req.query, queryParameter)) {
        return res.status(400).send("Parâmetros da URL não criptografados. Acesse a página inicial e use os links do sistema.");
    }

    try {
        req.query = urlEncryption.decryptQuery(req.query[queryParameter]);
        return next();
    } catch (error) {
        console.error("Não foi possível descriptografar os parâmetros da URL:", error.message);
        return res.status(400).send("Parâmetros da URL inválidos ou não foi possível descriptografá-los.");
    }
});

app.get("/", async (req,res)=>{    
    let usuarioAutenticado = null;
    if (typeof req.query.email === "string" &&
        typeof req.query.senha === "string" &&
        (req.query.typeuser === "contractor" || req.query.typeuser === "professional")) {
        try {
            const modeloUsuario = req.query.typeuser === "contractor" ? contratante : profissional;
            usuarioAutenticado = await modeloUsuario.findOne({
                email: req.query.email,
                senha: req.query.senha
            }).exec();
        } catch (error) {
            console.error("Erro ao consultar as credenciais no banco:", error.message);
            return res.status(500).send("Não foi possível verificar o login. Tente novamente.");
        }
    }

    if (usuarioAutenticado &&
     (req.query.cadastroProf != "Salvar" || req.query.cadastroContractor !="Salvar")){
        if(req.query.typeuser == "contractor"){
            //----------------------------------------Inicio Board--------------
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
            else if(req.query.opcao == "Entrar" && task.idtask != undefined){              
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
                        await task.updateOne({
                            _id: req.query.id
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
            }
            //-------------------------------------------------------Fim BOARD
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
                let comprovante = ""; 
                if(req.query.buttonPay == "Pagar"){                    
                    if(req.query.tipoPagamento == "PIX"){
                        let tarefaPagamento;
                        try {
                            tarefaPagamento = await task.findOne({
                                company: req.query.email,
                                titleService: req.query.taskservice,
                                developer: req.query.profissionalSel
                            }).exec();

                            if (!tarefaPagamento) {
                                throw new Error("Serviço não encontrado para pagamento.");
                            }

                            comprovante = JSON.stringify(await criarPagamentoPix(tarefaPagamento, req.query.email));
                        } catch (error) {
                            const detalhesErro = error && typeof error === "object" ? error : {};
                            // teste de pagamento inválido, exibir prévia do QR Code PIX sem criar o pagamento
                            if (process.env.NODE_ENV !== "production" && detalhesErro.code === "INVALID_PAYER_EMAIL" && tarefaPagamento) {
                                comprovante = JSON.stringify(criarPreviaPagamentoPix(tarefaPagamento));
                                console.info("Exibindo pré-visualização dos QR codes PIX; nenhum pagamento foi criado.");
                            // teste de pagamento inválido, exibir prévia do QR Code PIX sem criar o pagamento
                            } else {
                                comprovante = JSON.stringify({
                                    erro: detalhesErro.message || detalhesErro.error || String(error),
                                    codigo: detalhesErro.error,
                                    status: detalhesErro.status,
                                    detalhes: Array.isArray(detalhesErro.cause) ? detalhesErro.cause : []
                                });
                                console.error("Erro ao criar pagamento PIX:", comprovante);
                            }
                        }
                    }else if(req.query.tipoPagamento == "Bitcoin"){
                        let tarefaPagamento;
                        try {
                            tarefaPagamento = await task.findOne({
                                company: req.query.email,
                                titleService: req.query.taskservice,
                                developer: req.query.profissionalSel
                            }).exec();

                            if (!tarefaPagamento) {
                                throw new Error("Serviço não encontrado para pagamento.");
                            }

                            comprovante = JSON.stringify(await criarPagamentoBitcoinLightning(tarefaPagamento));
                        } catch (error) {
                            const detalhesErro = error && typeof error === "object" ? error : {};
                            const valorTexto = tarefaPagamento ? String(tarefaPagamento.valor).trim() : "";
                            const valor = Number(valorTexto.includes(",")
                                ? valorTexto.replace(/\./g, "").replace(",", ".")
                                : valorTexto);
                            // teste de pagamento inválido, exibir prévia do QR Code Bitcoin sem criar o pagamento
                            if (process.env.NODE_ENV !== "production" && tarefaPagamento && Number.isFinite(valor) && valor > 0 && Math.round(valor * 0.15 * 100) / 100 > 0) {
                                comprovante = JSON.stringify(criarPreviaPagamentoBitcoin(tarefaPagamento));
                                console.info("Exibindo pré-visualização da tela Bitcoin; nenhuma invoice foi criada.", detalhesErro.message);
                            // teste de pagamento inválido, exibir prévia do QR Code Bitcoin sem criar o pagamento
                            } else {
                                comprovante = JSON.stringify({ erro: detalhesErro.message || String(error) });
                                console.error("Erro ao criar pagamento Bitcoin Lightning:", detalhesErro.message || error);
                            }
                        }
                    }else if(req.query.tipoPagamento == "bancodeposito"){
                        let tarefaPagamento;
                        let contaProfissional;
                        try {
                            tarefaPagamento = await task.findOne({
                                company: req.query.email,
                                titleService: req.query.taskservice,
                                developer: req.query.profissionalSel
                            }).exec();
                            if (!tarefaPagamento) {
                                throw new Error("Serviço não encontrado para pagamento.");
                            }
                            const dadosBancarios = lerDadosBancarios(tarefaPagamento.codigo);
                            contaProfissional = await contasPagamentos.findOne({
                                email: tarefaPagamento.developer,
                                tipo: "bancodeposito"
                            }).exec();
                            if (!contaProfissional) {
                                throw new Error("Os dados do titular da conta bancária não foram cadastrados.");
                            }

                            comprovante = JSON.stringify(await criarTransferenciaPagBank(tarefaPagamento, {
                                nome: contaProfissional.nome,
                                documento: contaProfissional.documento,
                                banco: dadosBancarios.banco,
                                agencia: dadosBancarios.agencia,
                                numeroConta: dadosBancarios.numeroConta,
                                tipoConta: dadosBancarios.tipoConta,
                                ispb: contaProfissional.ispb
                            }));
                        } catch (error) {
                            const detalhesErro = error && typeof error === "object" ? error : {};
                            const valorTexto = tarefaPagamento ? String(tarefaPagamento.valor).trim() : "";
                            const valor = Number(valorTexto.includes(",")
                                ? valorTexto.replace(/\./g, "").replace(",", ".")
                                : valorTexto);
                            // teste de pagamento inválido, exibir prévia da transferência PagBank sem criar a transferência
                            if (process.env.NODE_ENV !== "production" && tarefaPagamento && Number.isFinite(valor) && valor > 0 && Math.round(valor * 0.15 * 100) / 100 > 0) {
                                comprovante = JSON.stringify(criarPreviaTransferenciaPagBank(
                                    tarefaPagamento,
                                    contaProfissional || {},
                                    detalhesErro.message || String(error)
                                ));
                                console.info("Exibindo prévia da transferência PagBank; nenhuma transferência foi enviada.", detalhesErro.message || error);
                            // teste de pagamento inválido, exibir prévia da transferência PagBank sem criar a transferência
                            } else {
                                comprovante = JSON.stringify({ erro: detalhesErro.message || String(error) });
                                console.error("Erro ao criar transferência PagBank:", detalhesErro.message || error);
                            }
                        }
                    }                     
                }
                task.find({company: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
                    profissional.find({email: task.map((t) => t.developer)}).sort({"_id":1}).exec(function(err, profissional){
                        contasPagamentos.find({email: req.query.profissionalSel}).sort({"_id":1}).exec(function(err, pagamento){
                            res.render("company/pagamento/index",{
                                profissional: profissional,
                                idtask: req.query.idtask,
                                dadosPagamento: pagamento,
                                task: task,
                                profissionalSel: req.query.profissionalSel,
                                taskservice: req.query.taskservice,
                                estadoPg: req.query.estadoPg,
                                typeuser: req.query.typeuser,
                                nome: req.query.nome,
                                email:req.query.email,
                                senha:req.query.senha,
                                tipoPagamento: req.query.tipoPagamento,
                                comprovante: comprovante
                            }); 
                        });                        
                    });                    
                });
            } 
            else if(req.query.menu == "historico"){
              if(req.query.enviaNota == "Enviar Avaliação"){
                console.log("salvar avaliação");
                    if(!req.query.profissionalSel || !["1", "2", "3", "4", "5"].includes(String(req.query.nota))){
                        return res.status(400).send("Selecione um profissional e uma nota para avaliar.");
                    }
                    try{
                        const servicoAvaliado = await task.findOne({
                            email: req.query.email,
                            developer: req.query.profissionalSel
                        });
                        if(!servicoAvaliado){
                            return res.status(400).send("O profissional selecionado não foi contratado por este contratante.");
                        }
                        await avaliar.collection.insertOne({
                            contato: req.query.profissionalSel,
                            comentario: req.query.comentarioProf,
                            nota: req.query.nota
                        });
                        msg = "Avaliação salva";
                        const historicoQuery = urlEncryption.encryptQuery({
                            typeuser: req.query.typeuser,
                            email: req.query.email,
                            senha: req.query.senha,
                            menu: "historico"
                        });
                        return res.redirect(`/?${queryParameter}=${historicoQuery}`);
                    }catch(error){
                        console.error("Erro ao salvar avaliação do profissional:", error.message);
                        return res.status(500).send("Não foi possível salvar a avaliação.");
                    }
                }
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, tasks){
                    if(err){
                        console.error("Erro ao buscar serviços do histórico:", err.message);
                        return res.status(500).send("Não foi possível carregar o histórico.");
                    }
                    const emailsProfissionais = [...new Set(
                        tasks.map((service) => service.developer).filter(Boolean)
                    )];
                    profissional.find({email: {$in: emailsProfissionais}}).sort({"_id":1}).exec(function(err, profissionais){
                        if(err){
                            console.error("Erro ao buscar profissionais do histórico:", err.message);
                            return res.status(500).send("Não foi possível carregar os profissionais do histórico.");
                        }
                        contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
                            contabilidade.find({contato:{$in: emailsProfissionais}}).sort({ano:-1, _id:-1}).exec(function(err, contabilidade){
                                avaliar.find({contato: req.query.email}).sort({"_id":-1}).exec(function(err, avaliacoesContratante){
                                    if(err){
                                        console.error("Erro ao buscar avaliações da empresa:", err.message);
                                        return res.status(500).send("Não foi possível carregar as avaliações da empresa.");
                                    }
                                    res.render("company/historico/index",{
                                        typeuser: req.query.typeuser,
                                        email:req.query.email,
                                        senha:req.query.senha,
                                        profissionais: profissionais,
                                        contratante: contratante,
                                        contabilidade: contabilidade,
                                        avaliacoesContratante: avaliacoesContratante,
                                        task: tasks
                                    });
                                });
                            });
                        });
                    });
                });
            } 
            else if(req.query.menu == "fichaCont" || req.query.cadastroContractor == "Salvar"){                               
                res.render("company/cadastroCont/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    ficha: {
                        nome: req.query.nome,
                        endereco: req.query.endereco,
                        cidade: req.query.cidade,
                        estado: req.query.estado,
                        cep: req.query.cep,
                        pais: req.query.pais,
                        cpf_cnpj: req.query.cpf_cnpj,
                        email: req.query.email,
                        senha: req.query.senha
                    },
                    senha:req.query.senha,
                    senha2: req.query.senha2, 
                    seletor: req.query.seletor});
            }
            else if(req.query.menu == "concluidos"){ 
                if(req.query.taskServ == "altera"){
                    try{
                        const idtaskTexto = String(req.query.count || "").trim();
                        const idtaskNumero = Number(idtaskTexto);
                        const idsTask = Number.isFinite(idtaskNumero)
                            ? [idtaskTexto, idtaskNumero]
                            : [idtaskTexto];
                        await task.collection.updateOne({
                            email: req.query.email,
                            idtask: { $in: idsTask }
                        }, {
                            $set: {
                                column: req.query.column,
                                comprovante: req.query.comprovante,
                                comprovantePlataforma: req.query.comprovantePlataforma
                            }
                        });
                        console.log("task atualizada");
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                if(req.query.contabilidade == "comprovante"){
                    try{
                        const idtaskTexto = String(req.query.count || "").trim();
                        const idtaskNumero = Number(idtaskTexto);
                        const idsTask = Number.isFinite(idtaskNumero)
                            ? [idtaskTexto, idtaskNumero]
                            : [idtaskTexto];
                        const servico = await task.collection.findOne({
                            email: req.query.email,
                            idtask: { $in: idsTask },
                            developer: req.query.developer
                        });
                        if(!idtaskTexto || !servico){
                            return res.status(404).send("Serviço não encontrado para contabilizar o pagamento.");
                        }
                        const dataAtual = new Date();
                        const dataLancamento = {
                            ano: String(dataAtual.getFullYear()),
                            mes: String(dataAtual.getMonth() + 1),
                            dia: String(dataAtual.getDate())
                        };
                        await salvarLancamentoContabilidade({
                            ...dataLancamento,
                            contato: req.query.developer,
                            tipo: "rendaProfissional",
                            servico: servico,
                            valor: servico.valor
                        });
                    }catch(error){
                        console.error("Erro ao contabilizar pagamento do profissional:", error.message);
                        return res.status(500).send("Não foi possível atualizar os gastos anuais.");
                    }
                }                
                if(req.query.contabilidade == "comprovantePlataforma"){
                    try{
                        const idtaskTexto = String(req.query.count || "").trim();
                        const idtaskNumero = Number(idtaskTexto);
                        const idsTask = Number.isFinite(idtaskNumero)
                            ? [idtaskTexto, idtaskNumero]
                            : [idtaskTexto];
                        const servico = await task.collection.findOne({
                            email: req.query.email,
                            idtask: { $in: idsTask }
                        });
                        if(!idtaskTexto || !servico){
                            return res.status(404).send("Serviço não encontrado para contabilizar a taxa da plataforma.");
                        }
                        const valorTexto = String(servico.valor || "").trim();
                        const valorServico = Number(valorTexto.includes(",")
                            ? valorTexto.replace(/\./g, "").replace(",", ".")
                            : valorTexto);
                        if(!Number.isFinite(valorServico)){
                            return res.status(400).send("O valor do serviço não é válido para contabilizar a taxa.");
                        }
                        const dataAtual = new Date();
                        await salvarLancamentoContabilidade({
                            contato: req.query.email,
                            tipo: "despesaPlataforma",
                            servico: servico,
                            ano: String(dataAtual.getFullYear()),
                            mes: String(dataAtual.getMonth() + 1),
                            dia: String(dataAtual.getDate()),
                            valor: (valorServico * 0.15).toFixed(2)
                        });
                    }catch(error){
                        console.error("Erro ao contabilizar taxa da plataforma:", error.message);
                        return res.status(500).send("Não foi possível atualizar os gastos anuais.");
                    }
                }                
                contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){
                    task.find({email:req.query.email}).sort({"_id":1}).exec(function(err, tasks){
                        if(err){
                            console.error("Erro ao buscar serviços concluídos:", err.message);
                            return res.status(500).send("Não foi possível carregar os serviços concluídos.");
                        }
                        const emailsProfissionais = [...new Set(
                            tasks.map((service) => service.developer).filter(Boolean)
                        )];
                        profissional.find({email: {$in: emailsProfissionais}}).sort({"_id":1}).exec(function(err, profissionais){
                            if(err){
                                console.error("Erro ao buscar profissionais contratados:", err.message);
                                return res.status(500).send("Não foi possível carregar os profissionais contratados.");
                            }
                            res.render("company/concluidos/index",{
                                typeuser: req.query.typeuser,
                                task: tasks,
                                contratante: contratante,
                                profissionais: profissionais,
                                email:req.query.email,
                                senha:req.query.senha
                            });
                        });
                    });
                });
            }
            else  if(req.query.menu == "chatC"){  
                if( req.query.conversa == "Send"){
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
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){                    
                    res.render("company/caju/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    senha:req.query.senha,
                    profissional: profissional
                }); 
            }); 
                      
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
            if(req.query.opcao == "Entrar"){
            //-------------------------------------Inicio Board  
                if(req.query.taskServ == "altera"){   
                    try{
                        const previousColumnByDestination = {
                            postDev: "post",
                            postRev: "postDev"
                        };
                        const previousColumn = previousColumnByDestination[req.query.column];
                        if (previousColumn && typeof req.query.id === "string") {
                            const result = await task.updateOne({
                                _id: req.query.id,
                                column: previousColumn
                            }, {
                                $set: {
                                    developer: req.query.email,
                                    column: req.query.column
                                }
                            });
                            if (result.matchedCount === 0) {
                                console.warn("Task não movida: ela já não está na coluna de origem.");
                            }
                        }
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
                        const previousColumnByDestination = {
                            postDev: "post",
                            postRev: "postDev"
                        };
                        const previousColumn = previousColumnByDestination[req.query.column];
                        if (previousColumn && typeof req.query.id === "string") {
                            const result = await task.updateOne({
                                _id: req.query.id,
                                column: previousColumn
                            }, {
                                $set: {
                                    developer: req.query.email,
                                    column: req.query.column
                                }
                            });
                            if (result.matchedCount === 0) {
                                console.warn("Task não movida: ela já não está na coluna de origem.");
                            }
                        }
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
            }
            //---------------------------------------------------Fim Board
            else  if(req.query.menu == "ProdutosCaju"){     
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){
                    res.render("professional/caju/index",{
                        typeuser: req.query.typeuser,
                        email:req.query.email,
                        senha:req.query.senha,
                        tipoPagamento: req.query.hiddenCodigoBarras,
                        profissional: profissional
                    });     
                });                 
            }else  if(req.query.menu == "ganho"){ 
                if(req.query.chavePix == "PIX"){
                    contasPagamentos.find({tipo: "PIX"}).sort({"_id":1}).exec(function(err, dadosPag){
                        try{
                            task.collection.updateOne({
                                idtask: req.query.idtask,
                            }, {
                                $set: {
                                    codigo: dadosPag[0].chave
                                }
                            });
                            console.log("Chave PIX alterada");
                        }catch(e){
                            console.log("Erro: "+e.message);
                        }
                    }); 
                }
                if(req.query.carteiraBitcoin == "bitcoin"){
                    contasPagamentos.find({tipo: "Bitcoin"}).sort({"_id":1}).exec(function(err, dadosPag){
                        try{
                            task.collection.updateOne({
                                idtask: req.query.idtask,
                            }, {
                                $set: {
                                    codigo: dadosPag[0].enderecoBTC
                                }
                            });
                            console.log("Carteira Bitcoin alterada");
                        }catch(e){
                            console.log("Erro: "+e.message);
                        }
                    }); 
                }
                if(req.query.contaTED == "TED"){
                    contasPagamentos.find({email: req.query.email, tipo: "bancodeposito"}).sort({"_id":1}).exec(function(err, dadosPag){
                        try{
                            task.collection.updateOne({
                                idtask: req.query.idtask,
                            }, {
                                $set: {
                                    codigo: JSON.stringify({
                                        Banco: dadosPag[0].banco,
                                        agencia: dadosPag[0].agencia,
                                        conta: dadosPag[0].numeroConta,
                                        tipo: dadosPag[0].tipoConta
                                    })
                                }
                            });
                            console.log("Carteira TED alterada");
                        }catch(e){
                            console.log("Erro: "+e.message);
                        }
                    }); 
                }
                if(req.query.enviaNota == "Enviar Avaliação" || req.query.enviaNota == "Submit Review"){
                    if(!req.query.contratanteSel || !["1", "2", "3", "4", "5"].includes(String(req.query.nota))){
                        return res.status(400).send("Selecione um contratante e uma nota para avaliar.");
                    }
                    try{
                        const contratanteAvaliado = await task.findOne({
                            developer: req.query.email,
                            email: req.query.contratanteSel
                        });
                        if(!contratanteAvaliado){
                            return res.status(400).send("O contratante selecionado não contratou este profissional.");
                        }
                        await avaliar.collection.insertOne({
                            contato: req.query.contratanteSel,
                            comentario: req.query.comentarioConta,
                            nota: req.query.nota
                        });
                        msg = "Avaliação salva";
                        console.log(msg);
                    }catch(error){
                        console.error("Erro ao salvar avaliação do contratante:", error.message);
                        return res.status(500).send("Não foi possível salvar a avaliação.");
                    }
                }
                contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec(function(err, dadosPag){
                    task.find({developer: req.query.email}).sort({"_id":1}).exec(function(err, task){
                        if(err){
                            console.error("Erro ao buscar serviços do profissional:", err.message);
                            return res.status(500).send("Não foi possível carregar os serviços do profissional.");
                        }
                        const emailsContratantes = [...new Set(
                            task.map((service) => service.email).filter(Boolean)
                        )];
                        contratante.find({email: {$in: emailsContratantes}}).sort({"_id":1}).exec(function(err, contratantes){
                            if(err){
                                console.error("Erro ao buscar contratantes dos serviços:", err.message);
                                return res.status(500).send("Não foi possível carregar os contratantes dos serviços.");
                            }
                            profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){
                                contabilidade.find({contato:req.query.email}).sort({"_id":1}).exec(function(err, contabilidade){
                                    avaliar.find({contato: req.query.email}).sort({"_id":-1}).exec(function(err, avaliacoesProfissional){
                                        if(err){
                                            console.error("Erro ao buscar avaliações do profissional:", err.message);
                                            return res.status(500).send("Não foi possível carregar as avaliações.");
                                        }
                                        res.render("professional/ganho/index",{
                                            typeuser: req.query.typeuser,
                                            email: req.query.email,
                                            senha: req.query.senha,
                                            task: task,
                                            contratante: contratantes,
                                            contabilidade: contabilidade,
                                            avaliacoesProfissional: avaliacoesProfissional,
                                            codigoBarras: req.query.hiddenCodigoBarras,
                                            tipoPagamento: req.query.tipoPagamento
                                        });
                                    });
                                });
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
            
            }
        else if(req.query.menu == "fincadPro"){ 
                let mensagemPagamento = null;
                if( req.query.cadastraPagamento == "Save Payment" || req.query.cadastraPagamento == "Cadastrar Pagamento"){
                    try{
                        await contasPagamentos.collection.insertMany([
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
                    ]);
                        mensagemPagamento = "Payment saved successfully.";
                    }catch(error){
                        console.error("Erro ao cadastrar dados de pagamento:", error);
                        return res.status(500).send("Não foi possível salvar os dados de pagamento.");
                    }              
                } else if( req.query.cadastraPagamento == "Update Payment" || req.query.cadastraPagamento == "Alterar Pagamento"){
                    try{
                        const resultado = await contasPagamentos.collection.updateOne({
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
                        });
                        if (resultado.matchedCount === 0) {
                            console.error("Nenhum dado de pagamento foi encontrado para alteração.");
                            return res.status(404).send("Não foi possível encontrar os dados de pagamento para alterar.");
                        }
                        mensagemPagamento = "Payment saved successfully.";
                    }catch(error){
                        console.error("Erro ao alterar dados de pagamento:", error);
                        return res.status(500).send("Não foi possível salvar os dados de pagamento.");
                    }              
                }
                try {
                    const contasSalvas = await contasPagamentos.find({email: req.query.email}).sort({"_id":1}).exec();
                    res.render("professional/pagamento/index",{
                    typeuser: req.query.typeuser, 
                    codigoBarras: req.query.codigoBarras,
                    email:req.query.email, 
                    senha:req.query.senha, 
                    tipoPagamento: req.query.tipoPagamento,
                    contasSalvas: contasSalvas,
                    mensagemPagamento: mensagemPagamento
                });
                } catch(error) {
                    console.error("Erro ao consultar dados de pagamento:", error);
                    return res.status(500).send("Não foi possível carregar os dados de pagamento.");
                }
        }
        else if(req.query.menu == "chatP"){
                if( req.query.conversa == "Send" && req.query.usuario != "" ){           
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
                let mensagemPagamento = null;
                if( req.query.alteraProf == "Alterar" || req.query.alteraProf == "Save changes" ){
                    try{
                        const atualizacaoPerfil = {
                            nome: req.query.nome,
                            endereco: req.query.endereco,
                            cidade: req.query.cidade,
                            estado: req.query.estado,
                            cep: req.query.cep,
                            pais: req.query.pais,
                            rg: req.query.rg,
                            cpf_cnpj: req.query.cpf_cnpj,
                            email: req.query.email,
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
                            tipoconta: req.query.tipoconta
                        };
                        if (typeof req.query.senha === "string" && req.query.senha.trim() !== "") {
                            atualizacaoPerfil.senha = req.query.senha;
                        }
                        const resultado = await profissional.collection.updateOne({
                            email: req.query.email
                        }, {
                            $set: atualizacaoPerfil
                        });
                        if (resultado.matchedCount === 0) {
                            console.error("Nenhum perfil profissional foi encontrado para atualização.");
                            return res.status(404).send("Não foi possível encontrar o perfil profissional para atualizar.");
                        }
                        mensagemPagamento = "Payment saved successfully.";
                        console.log("profissional alterado");
                    }catch(error){
                        console.error("Erro ao atualizar o perfil profissional:", error);
                        return res.status(500).send("Não foi possível salvar as alterações do perfil.");
                    }                                        
                }
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){   
                    let tipoPag = profissional[0].tipoPagamento;  
                    if(req.query.tipoPagamento != profissional[0].tipoPagamento && req.query.tipoPagamento != undefined){
                        tipoPag = req.query.tipoPagamento;
                    }  
                    res.render("professional/fichaCad/index",{ 
                        typeuser: "professional", 
                        mensagem: msg,
                        mensagemPagamento: mensagemPagamento,
                        profissional: profissional,
                        logado: "", 
                        sexo: profissional[0].sexo,
                        tipoPagamento: tipoPag,
                        email: profissional[0].email, 
                        senha: profissional[0].senha,
                        senha2:  req.query.senha2});                   
                });
            }
        }             
    }
    else{
        if (req.query.opcao === "Entrar" &&
            (req.query.typeuser === "contractor" || req.query.typeuser === "professional")) {
            res.status(401).render("login/index", {
                logado: "",
                user: req.query.typeuser,
                mensagem: "Invalid email or password."
            });
        }else if(req.query.opcao == "login-pro" && req.query.opcaoPag != "cadastroPro"){
            res.render("login/index",{logado: "", user:"professional"});
        }else if(req.query.opcao == "login-cont" && req.query.opcao != "cadastroCon"){   
            res.render("login/index",{logado: "", user:"contractor"});
        }else if(req.query.opcao == "About"){   
            res.render("about/index",{logado: ""});
        }else if(req.query.opcao == "cadastroPro" || req.query.opcaoPag == "cadastroPro"){ 
            const savePressed = req.query.cadastroPro === "Save";
            const requiredFields = [
                req.query.nome,
                req.query.endereco,
                req.query.cidade,
                req.query.estado,
                req.query.cep,
                req.query.pais,
                req.query.rg,
                req.query.cpf_cnpj,
                req.query.email,
                req.query.senha,
                req.query.senha2,
                req.query.sexo,
                req.query.profissao,
                req.query.historico,
                req.query.conhecimento
            ];
            const formIsComplete = requiredFields.every(value =>
                typeof value === "string" && value.trim() !== ""
            );
            const passwordsMatch = req.query.senha === req.query.senha2;
            let cadastroMensagem = null;

            if (savePressed && !formIsComplete) {
                cadastroMensagem = "Please complete all fields before saving.";
            } else if (savePressed && !passwordsMatch) {
                cadastroMensagem = "Passwords do not match.";
            } else if (savePressed && passwordsMatch) {
                cadastroMensagem = "Professional saved successfully\nyou can now look for a service.";
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
                            produto: "jobBoard",
                            conhecimento: req.query.conhecimento                           
                        }
                    ]).then(function(){
                        console.log("Profissional salvo") 
                    }).catch(function(error){
                        console.log(error)    
                    });
                    }catch(e){
                        console.log(e.error);
                    }   
            }
            res.render("professional/cadastro/index",{
                typeuser: "", 
                mensagem: cadastroMensagem,
                savePressed: savePressed,
                ficha: [
                    req.query.nome, 
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
                    produto: "jobBoard",
                    logado: "", 
                    sexo:req.query.sexo,
                    tipoPagamento: req.query.tipoPagamento,
                    senha: req.query.senha,
                    senha2:  req.query.senha2
                });           
        }
        else if(req.query.opcao == "cadastroCon" || req.query.cadastroContractor == "Save"){
            const savePressed = req.query.cadastroContractor === "Save";
            const requiredFields = [
                req.query.nome,
                req.query.endereco,
                req.query.cidade,
                req.query.estado,
                req.query.cep,
                req.query.pais,
                req.query.cpf_cnpj,
                req.query.email,
                req.query.senha,
                req.query.senha2
            ];
            const formIsComplete = requiredFields.every(value =>
                typeof value === "string" && value.trim() !== ""
            );
            const passwordsMatch = req.query.senha === req.query.senha2;
            let cadastroMensagem = null;

            if (savePressed && !formIsComplete) {
                cadastroMensagem = "Please complete all fields before saving.";
            } else if (savePressed && !passwordsMatch) {
                cadastroMensagem = "Passwords do not match.";
            } else if (savePressed && passwordsMatch) {
                try {
                    await contratante.insertMany([
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
                    ]);
                    cadastroMensagem = "Form saved successfully.";
                    console.log("Contratante salvo");
                } catch (error) {
                    console.error("Erro ao salvar contratante:", error);
                    cadastroMensagem = "Não foi possível salvar o formulário. Tente novamente.";
                }
            }
            res.render("company/cadastroCont/index",{                
                typeuser: "", 
                logado: "", 
                ficha: {
                    nome: req.query.nome,
                    endereco: req.query.endereco,
                    cidade: req.query.cidade,
                    estado: req.query.estado,
                    cep: req.query.cep,
                    pais: req.query.pais,
                    cpf_cnpj: req.query.cpf_cnpj,
                    email: req.query.email,
                    senha: req.query.senha
                },
                senha2: req.query.senha2,                
                produto: req.query.produto,
                mensagem: cadastroMensagem,
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

app.listen(porta,()=>{
   console.log(`funcionando\nhttp://localhost:${porta}/`);    
});

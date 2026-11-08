const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const path = require("path");
const contratante = require("./contratante");
const task = require("./task.js");
const contabilidade = require("./contabilidade.js");
const bug = require("./bug.js");
const chatmensagem = require("./views/chat/mensagens.js");
const profissional = require("./views/professional/cadastro/profissional");
const contasPagamentos = require("./contasPagamento.js");
const { criarTransferenciaPagBank, criarPreviaTransferenciaPagBank, lerDadosBancarios } = require("./views/tiposPagamentos/ted.js");
const { criarPagamentoBitcoinLightning, criarPreviaPagamentoBitcoin } = require("./views/tiposPagamentos/bitCoin.js");
const { criarPagamentoPix, criarPreviaPagamentoPix } = require("./views/tiposPagamentos/pix.js");
const env = require("./dev.env.js");
const avaliar = require("./views/avaliar/avaliar.js");
const companyController = require("./views/company/controller.js");
const professionalController = require("./views/professional/controller.js");
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
    let emailBloqueado = false;
    if (typeof req.query.email === "string" &&
        typeof req.query.senha === "string" &&
        (req.query.typeuser === "contractor" || req.query.typeuser === "professional")) {
        try {
            const modeloUsuario = req.query.typeuser === "contractor" ? contratante : profissional;
            usuarioAutenticado = await modeloUsuario.findOne({
                email: req.query.email,
                senha: req.query.senha
            }).exec();
            
            if (usuarioAutenticado && usuarioAutenticado.emailBloqueado === true) {
                emailBloqueado = true;
                usuarioAutenticado = null;
            }
        } catch (error) {
            console.error("Erro ao consultar as credenciais no banco:", error.message);
            return res.status(500).send("Não foi possível verificar o login. Tente novamente.");
        }
    }

    if (emailBloqueado) {
        return res.status(403).render("login/index", {
            logado: "",
            user: req.query.typeuser,
            mensagem: "This account has been blocked. Please contact the platform support for assistance."
        });
    }

    if (usuarioAutenticado &&
     (req.query.cadastroProf != "Salvar" || req.query.cadastroContractor !="Salvar")){
        if(req.query.typeuser == "contractor"){
            // Preparar modelos e dependências para o controller
            const models = {
                task, contratante, profissional, contasPagamentos,
                chatmensagem, avaliar, bug, contabilidade
            };
            const dependencies = {
                urlEncryption, criarPagamentoPix, criarPreviaPagamentoPix,
                criarPagamentoBitcoinLightning, criarPreviaPagamentoBitcoin,
                criarTransferenciaPagBank, criarPreviaTransferenciaPagBank,
                lerDadosBancarios, salvarLancamentoContabilidade
            };
            
            //----------------------------------------Inicio Board--------------
            if(req.query.opcao == "Entrar" && task.idtask == undefined){
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
                const encryptedParams = urlEncryption.encryptQuery({
                    typeuser: req.query.typeuser,
                    email: req.query.email,
                    senha: req.query.senha,
                    company: req.query.company || '',
                    menu: 'board'
                });
                res.render("board/index",{
                    typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    login: req.query.company,
                    senha:req.query.senha,
                    taskList: task,
                    column: "",
                    aviso: null,
                    encryptedParams: encryptedParams});
                });
            }  
            else if(req.query.opcao == "Entrar" && task.idtask != undefined){              
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){  
                const encryptedParams = urlEncryption.encryptQuery({
                    typeuser: req.query.typeuser,
                    email: req.query.email,
                    senha: req.query.senha,
                    company: req.query.company || '',
                    menu: 'board'
                });
                res.render("board/index",{
                    typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    login: req.query.company,
                    senha:req.query.senha,
                    taskList: "task",
                    column: "",
                    aviso: null,
                    encryptedParams: encryptedParams});
                });
            }
            else if(req.query.menu == "board"){                
                let avisoMover = null;
                if(req.query.taskServ == "altera"){  
                    try{
                        let podeMover = true;
                        if(req.query.column == "postEnd"){
                            const tarefaMovida = await task.findOne({ _id: req.query.id, email: req.query.email }).exec();
                            const preenchido = (valor) => typeof valor === "string" && valor.trim().length > 0;
                            if(!tarefaMovida || !preenchido(tarefaMovida.comprovante) || !preenchido(tarefaMovida.comprovantePlataforma)){
                                podeMover = false;
                                avisoMover = "A service can only be moved to Concluded after all payments have been made.";
                            }
                        }
                        if(podeMover){
                            await task.updateOne({
                                _id: req.query.id
                            }, {
                                $set: {
                                    column: req.query.column
                                }
                            });
                            console.log("task alterada");
                        }
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){  
                    const encryptedParams = urlEncryption.encryptQuery({
                        typeuser: req.query.typeuser,
                        email: req.query.email,
                        senha: req.query.senha,
                        menu: 'board'
                    });
                    if(req.query.column == null){
                        res.render("board/index",{
                            typeuser: req.query.typeuser, 
                            email:req.query.email, 
                            senha:req.query.senha,
                            taskList: task,
                            column: req.query.column,
                            aviso: avisoMover,
                            encryptedParams: encryptedParams});
                    }else{
                        res.render("board/index",{
                            typeuser: req.query.typeuser, 
                            email:req.query.email, 
                            senha:req.query.senha,
                            taskList: task,
                            column: task[0].column,
                            aviso: avisoMover,
                            encryptedParams: encryptedParams});
                    }
                });                 
            }
            //-------------------------------------------------------Fim BOARD
            else if(req.query.menu == "createTask"){  
                const result = await companyController.handleCreateTask(req, models);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "fincadCont" || req.query.tipoPagamento != null){
                const result = await companyController.handlePayments(req, models, dependencies);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "historico"){
                const result = await companyController.handleHistorico(req, models, dependencies);
                if (result && result.redirect) {
                    return res.redirect(result.redirect);
                } else if (result && result.error) {
                    return res.status(result.statusCode || 500).send(result.error);
                } else if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "fichaCont" || req.query.cadastroContractor == "Salvar"){                               
                const result = await companyController.handleFichaCont(req);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "concluidos"){ 
                const result = await companyController.handleConcluidos(req, models, dependencies);
                if (result && result.error) {
                    return res.status(result.statusCode || 500).send(result.error);
                } else if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else  if(req.query.menu == "chatC"){  
                const result = await companyController.handleChatC(req, models);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else  if(req.query.menu == "ProdutosCaju"){   
                const result = await companyController.handleProdutosCaju(req, models);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "fichaCad"){
                const result = await companyController.handleFichaCad(req, models);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
            else if(req.query.menu == "bug"){
                const result = await companyController.handleBug(req, models);
                if (result && result.template) {
                    return res.render(result.template, result.data);
                }
            }
        }
        else if (req.query.typeuser === "professional") {
            // Prepare models and dependencies for professional controller
            const professionalModels = {
                task: task,
                profissional: profissional,
                bug: bug,
                contasPagamentos: contasPagamentos,
                chatmensagem: chatmensagem,
                avaliar: avaliar,
                contratante: contratante,
                contabilidade: contabilidade
            };
            
            const professionalDependencies = {
                urlEncryption: urlEncryption
            };
            
            // Call professional controller dispatcher
            const result = await professionalController.handleProfessionalMenu(req, professionalModels, professionalDependencies);
            
            // Handle result from controller
            if (result.error) {
                return res.status(result.statusCode || 500).send(result.error);
            } else if (result.redirect) {
                return res.redirect(result.redirect);
            } else if (result.template && result.data) {
                return res.render(result.template, result.data);
            } else {
                return res.status(500).send("Erro ao processar requisição do profissional.");
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

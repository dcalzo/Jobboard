const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const contratante = require("./contratante");
const task = require("./task.js");
const chatmensagem = require("./views/chat/mensagens.js");
const profissional = require("./views/professional/cadastro/profissional");
const app = express();
const porta = 8080;

mongoose.set('strictQuery', false);
                                                                            
mongoose.connect('mongodb://0.0.0.0:27017/').then(function(){
    console.log("mongo conectado");
}).catch(function(err){
    console.log(err.message);
});

/*mongoose.connect("",{useNewUrlParser: true, useUnifiedTopology:true}).then(function(){
    console.log("mongo conectado");
}).catch(function(err){
    console.log(err.message);
});*/

let msg = null;

app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use("/public", express.static(path.join(__dirname,"public")));
app.set("views", path.join(__dirname,"/views"));

app.get("/", (req,res)=>{     
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
                var  boleto = {vazio: ""};               
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
                }else if(req.query.tipoPagamento == "Boleto"){      
                    console.log("boleto");                 
                }else if(req.query.tipoPagamento == "Bitcoin"){ 
                    console.log("bitcoin");     
                    /*const { Transaction } = require('bitcoinjs-lib');
                    const tx = new Transaction();
                    tx.addOutput(destinatarioAddress, valorEmSatoshis);*/             
                }else if(req.query.tipoPagamento == "bancodeposito"){
                    console.log("deposito");                        
                }                  
                if(req.query.idtask == null){                                 
                    task.find({email:req.query.email}).sort({"_id":1}).exec(function(err, task){
                        contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){                    
                            profissional.find({}).sort({"_id":1}).exec(function(err, profissional){
                                if(req.query.tipoPagamento == ""){
                                    res.render("company/pagamento/index",{
                                        profissional: profissional,
                                        contratante: contratante,
                                        idtask:"",
                                        task: task,
                                        estadoPg: "",
                                        profissionalSel: req.query.profissionalSel,
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
                                            taskservice: req.query.taskservice,
                                            typeuser: req.query.typeuser, 
                                            nome: req.query.nome,
                                            email:req.query.email,
                                            senha:req.query.senha,
                                            tipoPagamento: req.query.tipoPagamento});  
                                }
                            });
                        });
                    }); 
                }else{
                    task.find({developer:req.query.emailDev}).sort({"_id":1}).exec(function(err, task){
                        contratante.find({email:req.query.email}).sort({"_id":1}).exec(function(err, contratante){                    
                            profissional.find({email:req.query.emailDev}).sort({"_id":1}).exec(function(err, profissional){
                                res.render("company/pagamento/index",{
                                    profissional: profissional,
                                    contratante: contratante,
                                    idtask: req.query.idtask,
                                    boleto: boleto,
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
                     res.render("professional/cadastro/index",{typeuser: null, email:req.query.email, senha:req.query.senha}); 
                }else{
                    res.render("professional/cadastro/index",{typeuser: req.query.typeuser, email:req.query.email, senha:req.query.senha}); 
                }      
            
            }else if(req.query.menu == "fincadPro"){     
                res.render("professional/pagamento/index",{typeuser: req.query.typeuser, email:req.query.email, senha:req.query.senha});       
            }
            else if(req.query.menu == "chatP"){
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
                profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){  
                    chatmensagem.find({}).sort({"_id":1}).exec(function(err, chatmensagem){
                        task.find({developer: req.query.email}).exec(function(err, task){ 
                            res.render("chat/index",{
                                task: task,
                                chatmensagem: chatmensagem,
                                remetente: profissional[0].email,
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
        if(req.query.opcao == "login-pro"){   
            res.render("login/index",{logado: "", user:"professional"});
        }else if(req.query.opcao == "login-cont"){   
            res.render("login/index",{logado: "", user:"contractor"});
        }else if(req.query.opcao == "About"){   
            res.render("about/index",{logado: ""});
        }else if(req.query.opcao == "cadastroPro" || req.query.opcaoPag == "cadastroPro"){ 
            if(req.query.cadastroProf == "Salvar" && req.query.senha != "" && req.query.senha == req.query.senha2){
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




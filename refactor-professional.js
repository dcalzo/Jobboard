const fs = require('fs');
const path = require('path');

// Read the original file
const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Define the replacement block - from line ~351 to ~818
// This is all the professional typeuser logic

const oldProfessionalBlock = `        else  if(req.query.typeuser == "professional"){
            if(req.query.opcao == "Entrar"){
            //-------------------------------------Inicio Board  
                let avisoMover = null;
                if(req.query.taskServ == "altera"){   
                    try{
                        const previousColumnByDestination = {
                            postDev: "post",
                            postRev: "postDev"
                        };
                        const previousColumn = previousColumnByDestination[req.query.column];
                        if (previousColumn && typeof req.query.id === "string") {
                            const filtro = { _id: req.query.id, column: previousColumn };
                            if (previousColumn !== "post") {
                                filtro.developer = req.query.email;
                            }
                            const result = await task.updateOne(filtro, {
                                $set: {
                                    developer: req.query.email,
                                    column: req.query.column
                                }
                            });
                            if (result.matchedCount === 0) {
                                console.warn("Task não movida: ela já não está na coluna de origem ou pertence a outro profissional.");
                                if (previousColumn !== "post") {
                                    avisoMover = "You cannot move a task that belongs to another professional.";
                                }
                            }
                        }
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }
                task.find({}).exec(function(err, task){
                    const encryptedParams = urlEncryption.encryptQuery({
                        typeuser: req.query.typeuser,
                        email: req.query.email,
                        senha: req.query.senha,
                        menu: 'board'
                    });
                res.render("board/index",{typeuser: req.query.typeuser, 
                    email:req.query.email, 
                    senha:req.query.senha, 
                    taskList: task,
                    column: "", 
                    aviso: avisoMover,
                    encryptedParams: encryptedParams});
                });
            }else if(req.query.menu == "board"){
                let msg = null;         
                let avisoMover = null;
                if(req.query.taskServ == "altera"){   
                    try{
                        const previousColumnByDestination = {
                            postDev: "post",
                            postRev: "postDev"
                        };
                        const previousColumn = previousColumnByDestination[req.query.column];
                        if (previousColumn && typeof req.query.id === "string") {
                            const filtro = { _id: req.query.id, column: previousColumn };
                            if (previousColumn !== "post") {
                                filtro.developer = req.query.email;
                            }
                            const result = await task.updateOne(filtro, {
                                $set: {
                                    developer: req.query.email,
                                    column: req.query.column
                                }
                            });
                            if (result.matchedCount === 0) {
                                console.warn("Task não movida: ela já não está na coluna de origem ou pertence a outro profissional.");
                                if (previousColumn !== "post") {
                                    avisoMover = "You cannot move a task that belongs to another professional.";
                                }
                            }
                        }
                    }catch(e){
                        console.log("Erro: "+e.message);
                    }
                }     
                task.find({}).exec(function(err, task){
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
                        taskList: task,
                        senha:req.query.senha, 
                        column: req.query.column, 
                        aviso: avisoMover,
                        encryptedParams: encryptedParams});
                }else{
                    res.render("board/index",{
                        typeuser: req.query.typeuser, 
                        email:req.query.email, 
                        senha:req.query.senha, 
                        taskList: task,
                        column:task[0].column, 
                        aviso: avisoMover,
                        encryptedParams: encryptedParams});
                }               
            }); 
            }
            //---------------------------------------------------Fim Board
            else if(req.query.menu == "bug"){
                const mensagemBug = req.query.bugReport === "Submit Bug Report"
                    ? "Bug reported."
                    : null;
                if(mensagemBug){
                    try{
                            bug.collection.insertMany([
                        { 
                            email: req.query.email, 
                            titleService: req.query.bug,
                            description: req.query.bugDescription
                        }
                            ]).then(function(){
                                msg = "bug reportado"
                                console.log(msg)
                            }).catch(function(error){
                                console.log(error)
                            });
                        }catch(e){
                            console.log(e.error);
                        }
                }
                 profissional.find({email: req.query.email}).sort({"_id":1}).exec(function(err, profissional){                    
                    res.render("bug/index",{
                        typeuser: req.query.typeuser, 
                        email:req.query.email, 
                        senha:req.query.senha,
                        mensagemBug: mensagemBug,
                        profissional: profissional
                    }); 
                });
            } else  if(req.query.menu == "ProdutosCaju"){     
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
                            developer: req.query.email,
                            autor: "profissional",
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
                                    avaliar.find({$or: [{autor: "contratante", developer: req.query.email}, {autor: null, contato: req.query.email}]}).sort({"_id":-1}).exec(function(err, avaliacoesProfissional){
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
            }else  if(req.query.menu == "pagamento"){ 
                let mensagemPagamento = null;
                if( req.query.cadastraPagamento == "Save" || req.query.cadastraPagamento == "Salvar Conta"){
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
        }`;

const newProfessionalBlock = `        }
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
        else`;

// Perform the replacement
if (content.includes(oldProfessionalBlock)) {
    console.log('✓ Found professional block');
    content = content.replace(oldProfessionalBlock, newProfessionalBlock);
    
    // Write the updated content back
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✓ Refactoring complete!');
    console.log('✓ Professional logic extracted to controller');
    console.log('✓ index.js updated successfully');
} else {
    console.error('✗ Could not find professional block');
    console.log('Trying to find start of block...');
    const startStr = 'else  if(req.query.typeuser == "professional"){';
    if (content.includes(startStr)) {
        console.log('✓ Start found, but full block not matching');
        console.log('The block might have been already modified or has slight differences');
    }
    process.exit(1);
}

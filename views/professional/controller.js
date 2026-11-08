/**
 * Professional Menu Controller
 * 
 * Handles all menu logic for professional users including:
 * - Kanban board view and task movement
 * - Bug reporting
 * - Caju products page
 * - Earnings/payment management (ganho)
 * - Payment account configuration
 * - Chat functionality
 * - Professional profile editing (fichaCad)
 * 
 * Pattern: Each handler receives (req, models, dependencies) and returns:
 * - { template, data } for rendering
 * - { redirect } for redirects
 * - { error, statusCode } for errors
 */

/**
 * Main dispatcher for professional menu handlers
 * @param {Object} req - Express request object
 * @param {Object} models - MongoDB models { task, profissional, bug, contasPagamentos, chatmensagem, avaliar, contratante, contabilidade }
 * @param {Object} dependencies - Utility functions { urlEncryption, etc }
 * @returns {Promise<Object>} Result object with template/redirect/error
 */
async function handleProfessionalMenu(req, models, dependencies) {
    const { urlEncryption } = dependencies;
    
    try {
        // Handle initial board login (opcao == "Entrar")
        if (req.query.opcao === "Entrar") {
            return await handleBoardEntrada(req, models, dependencies);
        }
        
        // Handle menu-based routing
        if (req.query.menu === "board") {
            return await handleBoardBoard(req, models, dependencies);
        } else if (req.query.menu === "bug") {
            return await handleBugReport(req, models, dependencies);
        } else if (req.query.menu === "ProdutosCaju") {
            return await handleProdutosCaju(req, models, dependencies);
        } else if (req.query.menu === "ganho") {
            return await handleGanho(req, models, dependencies);
        } else if (req.query.menu === "pagamento") {
            return await handlePagamento(req, models, dependencies);
        } else if (req.query.menu === "chatP") {
            return await handleChatP(req, models, dependencies);
        } else if (req.query.menu === "fichaCad") {
            return await handleFichaCad(req, models, dependencies);
        } else {
            return { error: "Menu não encontrado", statusCode: 404 };
        }
    } catch (error) {
        console.error("Erro no dispatcher de menu profissional:", error.message);
        return { error: "Erro ao processar requisição", statusCode: 500 };
    }
}

/**
 * Handle board entrance (inicial login, opcao == "Entrar")
 */
async function handleBoardEntrada(req, models, dependencies) {
    const { task } = models;
    const { urlEncryption } = dependencies;
    
    let avisoMover = null;
    
    // Handle task movement if requested
    if (req.query.taskServ === "altera") {
        avisoMover = await movimentarTarefa(req, models);
    }
    
    // Get all tasks
    const taskList = await task.find({}).exec();
    
    const encryptedParams = urlEncryption.encryptQuery({
        typeuser: req.query.typeuser,
        email: req.query.email,
        senha: req.query.senha,
        menu: 'board'
    });
    
    return {
        template: "board/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            taskList: taskList,
            column: "",
            aviso: avisoMover,
            encryptedParams: encryptedParams
        }
    };
}

/**
 * Handle board view (menu == "board")
 */
async function handleBoardBoard(req, models, dependencies) {
    const { task } = models;
    const { urlEncryption } = dependencies;
    
    let avisoMover = null;
    
    // Handle task movement if requested
    if (req.query.taskServ === "altera") {
        avisoMover = await movimentarTarefa(req, models);
    }
    
    // Get all tasks
    const taskList = await task.find({}).exec();
    
    const encryptedParams = urlEncryption.encryptQuery({
        typeuser: req.query.typeuser,
        email: req.query.email,
        senha: req.query.senha,
        menu: 'board'
    });
    
    // Determine column to display
    const columnValue = req.query.column === null
        ? req.query.column
        : (taskList.length > 0 ? taskList[0].column : "");
    
    return {
        template: "board/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            taskList: taskList,
            column: columnValue,
            aviso: avisoMover,
            encryptedParams: encryptedParams
        }
    };
}

/**
 * Handle bug reporting
 */
async function handleBugReport(req, models, dependencies) {
    const { bug, profissional } = models;
    
    let mensagemBug = null;
    
    // Save bug if submitted
    if (req.query.bugReport === "Submit Bug Report") {
        mensagemBug = "Bug reported.";
        try {
            await bug.collection.insertMany([{
                email: req.query.email,
                titleService: req.query.bug,
                description: req.query.bugDescription
            }]);
            console.log("Bug reportado com sucesso");
        } catch (error) {
            console.error("Erro ao reportar bug:", error.message);
            return { error: "Não foi possível reportar o bug", statusCode: 500 };
        }
    }
    
    // Get professional info
    const profissionalData = await profissional.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    
    return {
        template: "bug/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            mensagemBug: mensagemBug,
            profissional: profissionalData
        }
    };
}

/**
 * Handle Caju products page
 */
async function handleProdutosCaju(req, models, dependencies) {
    const { profissional } = models;
    
    // Get professional info
    const profissionalData = await profissional.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    
    return {
        template: "professional/caju/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            tipoPagamento: req.query.hiddenCodigoBarras,
            profissional: profissionalData
        }
    };
}

/**
 * Handle earnings and ratings (ganho menu)
 */
async function handleGanho(req, models, dependencies) {
    const { task, contasPagamentos, contratante, profissional, contabilidade, avaliar } = models;
    
    // Handle payment method updates
    if (req.query.chavePix === "PIX") {
        await atualizarChavePagamento(req, models, "PIX", "chave");
    }
    if (req.query.carteiraBitcoin === "bitcoin") {
        await atualizarChavePagamento(req, models, "Bitcoin", "enderecoBTC");
    }
    if (req.query.contaTED === "TED") {
        await atualizarChavePagamento(req, models, "bancodeposito", null, req);
    }
    
    // Handle rating submission
    if (req.query.enviaNota === "Enviar Avaliação" || req.query.enviaNota === "Submit Review") {
        if (!req.query.contratanteSel || !["1", "2", "3", "4", "5"].includes(String(req.query.nota))) {
            return { error: "Selecione um contratante e uma nota para avaliar.", statusCode: 400 };
        }
        
        try {
            const contratanteAvaliado = await task.findOne({
                developer: req.query.email,
                email: req.query.contratanteSel
            });
            
            if (!contratanteAvaliado) {
                return { error: "O contratante selecionado não contratou este profissional.", statusCode: 400 };
            }
            
            await avaliar.collection.insertOne({
                contato: req.query.contratanteSel,
                developer: req.query.email,
                autor: "profissional",
                comentario: req.query.comentarioConta,
                nota: req.query.nota
            });
            
            console.log("Avaliação salva com sucesso");
        } catch (error) {
            console.error("Erro ao salvar avaliação do contratante:", error.message);
            return { error: "Não foi possível salvar a avaliação.", statusCode: 500 };
        }
    }
    
    // Get all data for the ganho page
    try {
        const dadosPag = await contasPagamentos.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
        const tarefas = await task.find({ developer: req.query.email }).sort({ "_id": 1 }).exec();
        
        const emailsContratantes = [...new Set(tarefas.map(service => service.email).filter(Boolean))];
        const contratantes = await contratante.find({ email: { $in: emailsContratantes } }).sort({ "_id": 1 }).exec();
        const profissionalData = await profissional.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
        const contabilidadeData = await contabilidade.find({ contato: req.query.email }).sort({ "_id": 1 }).exec();
        const avaliacoes = await avaliar.find({
            $or: [
                { autor: "contratante", developer: req.query.email },
                { autor: null, contato: req.query.email }
            ]
        }).sort({ "_id": -1 }).exec();
        
        return {
            template: "professional/ganho/index",
            data: {
                typeuser: req.query.typeuser,
                email: req.query.email,
                senha: req.query.senha,
                task: tarefas,
                contratante: contratantes,
                contabilidade: contabilidadeData,
                avaliacoesProfissional: avaliacoes,
                codigoBarras: req.query.hiddenCodigoBarras,
                tipoPagamento: req.query.tipoPagamento
            }
        };
    } catch (error) {
        console.error("Erro ao carregar dados do ganho:", error.message);
        return { error: "Não foi possível carregar os dados.", statusCode: 500 };
    }
}

/**
 * Handle payment account configuration (pagamento menu)
 */
async function handlePagamento(req, models, dependencies) {
    const { contasPagamentos } = models;
    let mensagemPagamento = null;
    
    try {
        // Handle new payment account registration
        if (req.query.cadastraPagamento === "Save" || req.query.cadastraPagamento === "Salvar Conta") {
            try {
                await contasPagamentos.collection.insertMany([{
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
                    produto: "JobBoard"
                }]);
                mensagemPagamento = "Payment saved successfully.";
            } catch (error) {
                console.error("Erro ao cadastrar dados de pagamento:", error);
                return { error: "Não foi possível salvar os dados de pagamento.", statusCode: 500 };
            }
        }
        
        // Handle payment account update
        if (req.query.cadastraPagamento === "Update Payment" || req.query.cadastraPagamento === "Alterar Pagamento") {
            try {
                const resultado = await contasPagamentos.collection.updateOne(
                    {
                        email: req.query.email,
                        tipo: req.query.tipoPagamento
                    },
                    {
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
                            produto: "JobBoard"
                        }
                    }
                );
                
                if (resultado.matchedCount === 0) {
                    console.error("Nenhum dado de pagamento foi encontrado para alteração.");
                    return { error: "Não foi possível encontrar os dados de pagamento para alterar.", statusCode: 404 };
                }
                
                mensagemPagamento = "Payment saved successfully.";
            } catch (error) {
                console.error("Erro ao alterar dados de pagamento:", error);
                return { error: "Não foi possível salvar os dados de pagamento.", statusCode: 500 };
            }
        }
        
        // Get all saved payment accounts
        const contasSalvas = await contasPagamentos.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
        
        return {
            template: "professional/pagamento/index",
            data: {
                typeuser: req.query.typeuser,
                codigoBarras: req.query.codigoBarras,
                email: req.query.email,
                senha: req.query.senha,
                tipoPagamento: req.query.tipoPagamento,
                contasSalvas: contasSalvas,
                mensagemPagamento: mensagemPagamento
            }
        };
    } catch (error) {
        console.error("Erro ao consultar dados de pagamento:", error);
        return { error: "Não foi possível carregar os dados de pagamento.", statusCode: 500 };
    }
}

/**
 * Handle professional chat (chatP menu)
 */
async function handleChatP(req, models, dependencies) {
    const { profissional, chatmensagem, task } = models;
    
    // Save message if sent
    if (req.query.conversa === "Send" && req.query.usuario !== "") {
        try {
            await chatmensagem.collection.insertMany([{
                tipoPagamento: req.query.tipoPagamento,
                remetente: req.query.email,
                destinatario: req.query.usuario,
                mensagem: req.query.mensagem
            }]);
            console.log("Mensagem salva com sucesso");
        } catch (error) {
            console.error("Erro ao salvar mensagem:", error);
            return { error: "Não foi possível salvar a mensagem.", statusCode: 500 };
        }
    }
    
    try {
        const profissionalData = await profissional.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
        const chat = await chatmensagem.find({}).sort({ "_id": 1 }).exec();
        const tarefas = await task.find({ developer: req.query.email }).exec();
        
        return {
            template: "chat/index",
            data: {
                task: tarefas,
                chatmensagem: chat,
                remetente: profissionalData[0]?.email,
                tipoPagamento: req.query.tipoPagamento,
                typeuser: req.query.typeuser,
                mensagem: req.query.mensagem,
                usuario: req.query.usuario,
                email: req.query.email,
                senha: req.query.senha
            }
        };
    } catch (error) {
        console.error("Erro ao carregar chat:", error);
        return { error: "Não foi possível carregar o chat.", statusCode: 500 };
    }
}

/**
 * Handle professional profile editing (fichaCad menu)
 */
async function handleFichaCad(req, models, dependencies) {
    const { profissional } = models;
    let mensagemPagamento = null;
    
    try {
        // Handle profile update
        if (req.query.alteraProf === "Alterar" || req.query.alteraProf === "Save changes") {
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
            
            // Only update password if provided
            if (typeof req.query.senha === "string" && req.query.senha.trim() !== "") {
                atualizacaoPerfil.senha = req.query.senha;
            }
            
            const resultado = await profissional.collection.updateOne(
                { email: req.query.email },
                { $set: atualizacaoPerfil }
            );
            
            if (resultado.matchedCount === 0) {
                console.error("Nenhum perfil profissional foi encontrado para atualização.");
                return { error: "Não foi possível encontrar o perfil profissional para atualizar.", statusCode: 404 };
            }
            
            mensagemPagamento = "Payment saved successfully.";
            console.log("Profissional alterado com sucesso");
        }
        
        // Get professional profile
        const profissionalData = await profissional.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
        
        if (!profissionalData || profissionalData.length === 0) {
            return { error: "Profissional não encontrado.", statusCode: 404 };
        }
        
        let tipoPag = profissionalData[0].tipoPagamento;
        if (req.query.tipoPagamento && req.query.tipoPagamento !== profissionalData[0].tipoPagamento) {
            tipoPag = req.query.tipoPagamento;
        }
        
        return {
            template: "professional/fichaCad/index",
            data: {
                typeuser: "professional",
                mensagem: null,
                mensagemPagamento: mensagemPagamento,
                profissional: profissionalData,
                logado: "",
                sexo: profissionalData[0].sexo,
                tipoPagamento: tipoPag,
                email: profissionalData[0].email,
                senha: profissionalData[0].senha,
                senha2: req.query.senha2
            }
        };
    } catch (error) {
        console.error("Erro ao atualizar o perfil profissional:", error);
        return { error: "Não foi possível salvar as alterações do perfil.", statusCode: 500 };
    }
}

/**
 * Helper: Move task between columns with validation
 * @private
 */
async function movimentarTarefa(req, models) {
    const { task } = models;
    
    try {
        const previousColumnByDestination = {
            postDev: "post",
            postRev: "postDev"
        };
        
        const previousColumn = previousColumnByDestination[req.query.column];
        
        if (previousColumn && typeof req.query.id === "string") {
            const filtro = {
                _id: req.query.id,
                column: previousColumn
            };
            
            // Only require developer match if not in "post" column
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
                    return "You cannot move a task that belongs to another professional.";
                }
            }
        }
    } catch (error) {
        console.error("Erro ao mover tarefa:", error.message);
    }
    
    return null;
}

/**
 * Helper: Update payment method on task
 * @private
 */
async function atualizarChavePagamento(req, models, tipo, campo, isContaBancaria = false) {
    const { task, contasPagamentos } = models;
    
    try {
        let query = { tipo: tipo };
        let novoCodigo = null;
        
        if (isContaBancaria) {
            // For bank account (TED)
            query.email = req.query.email;
            const conta = await contasPagamentos.find(query).sort({ "_id": 1 }).exec();
            
            if (conta && conta.length > 0) {
                novoCodigo = JSON.stringify({
                    Banco: conta[0].banco,
                    agencia: conta[0].agencia,
                    conta: conta[0].numeroConta,
                    tipo: conta[0].tipoConta
                });
            }
        } else {
            // For PIX or Bitcoin
            const conta = await contasPagamentos.find(query).sort({ "_id": 1 }).exec();
            if (conta && conta.length > 0) {
                novoCodigo = conta[0][campo];
            }
        }
        
        if (novoCodigo) {
            await task.collection.updateOne(
                { idtask: req.query.idtask },
                { $set: { codigo: novoCodigo } }
            );
            console.log(`Chave ${tipo} alterada com sucesso`);
        }
    } catch (error) {
        console.error(`Erro ao atualizar chave ${tipo}:`, error.message);
    }
}

// Export handlers
module.exports = {
    handleProfessionalMenu,
    handleBoardEntrada,
    handleBoardBoard,
    handleBugReport,
    handleProdutosCaju,
    handleGanho,
    handlePagamento,
    handleChatP,
    handleFichaCad
};

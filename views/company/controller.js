/**
 * Controlador de rotas da empresa (Contractor)
 * Extrai toda a lógica de menu do arquivo principal index.js
 * Trata: createTask, pagamentos, histórico, ficha cadastral, tarefas concluídas, chat, etc.
 */

const { queryParameter } = require("../../urlEncryption");

/**
 * Handler para menu "createTask"
 * Salva novo serviço/tarefa
 */
async function handleCreateTask(req, models) {
    const { task, contratante } = models;
    let msg = "";

    if (req.query.taskServ == "Save Service" || req.query.taskServ == "Salvar Serviço") {
        const requiredServiceFields = [
            req.query.titleService,
            req.query.description,
            req.query.valor,
            req.query.gitLocal,
            req.query.urlDoc
        ];
        const paymentMethods = ["PIX", "Bitcoin", "bancodeposito"];
        const formIsComplete = requiredServiceFields.every(value =>
            typeof value === "string" && value.trim().length > 0
        ) && paymentMethods.includes(req.query.tipoPagamento);

        if (!formIsComplete) {
            msg = "Please fill in all fields and select a payment method.";
        } else {
            msg = "service saved successfully";
            try {
                await task.collection.insertMany([
                    {
                        email: req.query.email,
                        company: req.query.LoginContractor,
                        idtask: req.query.count,
                        dataCriacao: new Date(),
                        developer: "",
                        titleService: req.query.titleService,
                        description: typeof req.query.description === "string" && req.query.description.trim()
                            ? req.query.description
                            : "",
                        valor: req.query.valor,
                        tipoPagamento: req.query.tipoPagamento,
                        gitLocal: req.query.gitLocal,
                        urlDoc: req.query.urlDoc,
                        column: req.query.column
                    }
                ]);
                msg = "task salva";
                console.log(msg);
            } catch (error) {
                console.log(error);
            }
        }
    }

    const tasks = await task.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    
    const login = req.query.email.split("@");
    
    return {
        template: "company/task/index",
        data: {
            typeuser: req.query.typeuser,
            count: tasks,
            Login: login[0],
            email: req.query.email,
            senha: req.query.senha,
            msg: msg
        }
    };
}

/**
 * Handler para menu "fincadCont" (Pagamentos)
 * Trata PIX, Bitcoin e TED (Transferência PagBank)
 */
async function handlePayments(req, models, { urlEncryption, criarPagamentoPix, criarPreviaPagamentoPix, 
    criarPagamentoBitcoinLightning, criarPreviaPagamentoBitcoin, criarTransferenciaPagBank, 
    criarPreviaTransferenciaPagBank, lerDadosBancarios }) {
    
    const { task, profissional, contasPagamentos } = models;
    let comprovante = "";

    if (req.query.buttonPay == "Pay" || req.query.buttonPay == "Pagar") {
        if (req.query.tipoPagamento == "PIX") {
            let tarefaPagamento;
            try {
                tarefaPagamento = await task.findOne({
                    email: req.query.email,
                    titleService: req.query.taskservice,
                    developer: req.query.profissionalSel
                }).exec();

                if (!tarefaPagamento) {
                    throw new Error("Serviço não encontrado para pagamento.");
                }

                comprovante = JSON.stringify(await criarPagamentoPix(tarefaPagamento, req.query.email));
            } catch (error) {
                const detalhesErro = error && typeof error === "object" ? error : {};
                if (process.env.NODE_ENV !== "production" && tarefaPagamento) {
                    comprovante = JSON.stringify(criarPreviaPagamentoPix(tarefaPagamento));
                    console.info("Exibindo pré-visualização dos QR codes PIX; nenhum pagamento foi criado.", detalhesErro.message || detalhesErro.error || error);
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
        } else if (req.query.tipoPagamento == "Bitcoin") {
            let tarefaPagamento;
            try {
                tarefaPagamento = await task.findOne({
                    email: req.query.email,
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
                
                if (process.env.NODE_ENV !== "production" && tarefaPagamento && Number.isFinite(valor) && valor > 0 && Math.round(valor * 0.15 * 100) / 100 > 0) {
                    comprovante = JSON.stringify(criarPreviaPagamentoBitcoin(tarefaPagamento));
                    console.info("Exibindo pré-visualização da tela Bitcoin; nenhuma invoice foi criada.", detalhesErro.message);
                } else {
                    comprovante = JSON.stringify({ erro: detalhesErro.message || String(error) });
                    console.error("Erro ao criar pagamento Bitcoin Lightning:", detalhesErro.message || error);
                }
            }
        } else if (req.query.tipoPagamento == "bancodeposito") {
            let tarefaPagamento;
            let contaProfissional;
            try {
                tarefaPagamento = await task.findOne({
                    email: req.query.email,
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
                
                if (process.env.NODE_ENV !== "production" && tarefaPagamento && Number.isFinite(valor) && valor > 0 && Math.round(valor * 0.15 * 100) / 100 > 0) {
                    comprovante = JSON.stringify(criarPreviaTransferenciaPagBank(
                        tarefaPagamento,
                        contaProfissional || {},
                        detalhesErro.message || String(error)
                    ));
                    console.info("Exibindo prévia da transferência PagBank; nenhuma transferência foi enviada.", detalhesErro.message || error);
                } else {
                    comprovante = JSON.stringify({ erro: detalhesErro.message || String(error) });
                    console.error("Erro ao criar transferência PagBank:", detalhesErro.message || error);
                }
            }
        }
    }

    const tasks = await task.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    const desenvolvedoresPagamento = tasks.filter((t) => t.developer && ["postRev", "postEnd"].includes(t.column)).map((t) => t.developer);
    const profissionais = await profissional.find({ email: { $in: desenvolvedoresPagamento } }).sort({ "_id": 1 }).exec();
    const pagamentos = await contasPagamentos.find({ email: req.query.profissionalSel }).sort({ "_id": 1 }).exec();

    return {
        template: "company/pagamento/index",
        data: {
            profissional: profissionais,
            idtask: req.query.idtask,
            dadosPagamento: pagamentos,
            task: tasks,
            profissionalSel: req.query.profissionalSel,
            taskservice: req.query.taskservice,
            estadoPg: req.query.estadoPg,
            typeuser: req.query.typeuser,
            nome: req.query.nome,
            email: req.query.email,
            senha: req.query.senha,
            tipoPagamento: req.query.tipoPagamento,
            comprovante: comprovante
        }
    };
}

/**
 * Handler para menu "historico"
 * Exibe histórico de serviços contratados
 */
async function handleHistorico(req, models, { urlEncryption, salvarLancamentoContabilidade }) {
    const { task, profissional, contratante, avaliar, contabilidade } = models;

    if (req.query.enviaNota == "Enviar Avaliação" || req.query.enviaNota == "Submit Review") {
        console.log("salvar avaliação");
        if (!req.query.profissionalSel || !["1", "2", "3", "4", "5"].includes(String(req.query.nota))) {
            return {
                error: "Selecione um profissional e uma nota para avaliar.",
                statusCode: 400
            };
        }

        try {
            const servicoAvaliado = await task.findOne({
                email: req.query.email,
                developer: req.query.profissionalSel
            });
            
            if (!servicoAvaliado) {
                return {
                    error: "O profissional selecionado não foi contratado por este contratante.",
                    statusCode: 400
                };
            }

            await avaliar.collection.insertOne({
                contato: req.query.email,
                developer: req.query.profissionalSel,
                autor: "contratante",
                comentario: req.query.comentarioProf,
                nota: req.query.nota
            });

            const historicoQuery = urlEncryption.encryptQuery({
                typeuser: req.query.typeuser,
                email: req.query.email,
                senha: req.query.senha,
                menu: "historico"
            });

            return {
                redirect: `/?${queryParameter}=${historicoQuery}`
            };
        } catch (error) {
            console.error("Erro ao salvar avaliação do profissional:", error.message);
            return {
                error: "Não foi possível salvar a avaliação.",
                statusCode: 500
            };
        }
    }

    const tasks = await task.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    
    if (!Array.isArray(tasks)) {
        return {
            error: "Erro ao buscar serviços do histórico",
            statusCode: 500
        };
    }

    const emailsProfissionais = [...new Set(
        tasks.map((service) => service.developer).filter(Boolean)
    )];

    const profissionais = await profissional.find({ email: { $in: emailsProfissionais } }).sort({ "_id": 1 }).exec();
    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    const contabilidades = await contabilidade.find({ contato: { $in: emailsProfissionais } }).sort({ ano: -1, _id: -1 }).exec();
    const avaliacoes = await avaliar.find({ contato: req.query.email, autor: { $ne: "contratante" } }).sort({ "_id": -1 }).exec();

    return {
        template: "company/historico/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            profissionais: profissionais,
            contratante: contractors,
            contabilidade: contabilidades,
            avaliacoesContratante: avaliacoes,
            task: tasks
        }
    };
}

/**
 * Handler para menu "fichaCont" e cadastro do contractor
 */
async function handleFichaCont(req) {
    return {
        template: "company/cadastroCont/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
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
            senha: req.query.senha,
            senha2: req.query.senha2,
            seletor: req.query.seletor
        }
    };
}

/**
 * Handler para menu "concluidos"
 * Tarefas concluídas com comprovantes
 */
async function handleConcluidos(req, models, { salvarLancamentoContabilidade }) {
    const { task, contratante, profissional } = models;

    if (req.query.taskServ == "altera") {
        try {
            const idtaskTexto = String(req.query.count || "").trim();
            const idtaskNumero = Number(idtaskTexto);
            const idsTask = Number.isFinite(idtaskNumero)
                ? [idtaskTexto, idtaskNumero]
                : [idtaskTexto];
            const comprovanteProfissional = typeof req.query.comprovante === "string" &&
                req.query.comprovante.trim().length > 0;
            const comprovantePlataforma = typeof req.query.comprovantePlataforma === "string" &&
                req.query.comprovantePlataforma.trim().length > 0;

            await task.collection.updateOne({
                email: req.query.email,
                idtask: { $in: idsTask }
            }, {
                $set: {
                    column: comprovanteProfissional && comprovantePlataforma ? "postEnd" : "postRev",
                    comprovante: req.query.comprovante,
                    comprovantePlataforma: req.query.comprovantePlataforma
                }
            });
            console.log("task atualizada");
        } catch (e) {
            console.log("Erro: " + e.message);
        }
    }

    if (req.query.contabilidade == "comprovante") {
        try {
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

            if (!idtaskTexto || !servico) {
                return {
                    error: "Serviço não encontrado para contabilizar o pagamento.",
                    statusCode: 404
                };
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
        } catch (error) {
            console.error("Erro ao contabilizar pagamento do profissional:", error.message);
            return {
                error: "Não foi possível atualizar os gastos anuais.",
                statusCode: 500
            };
        }
    }

    if (req.query.contabilidade == "comprovantePlataforma") {
        try {
            const idtaskTexto = String(req.query.count || "").trim();
            const idtaskNumero = Number(idtaskTexto);
            const idsTask = Number.isFinite(idtaskNumero)
                ? [idtaskTexto, idtaskNumero]
                : [idtaskTexto];
            const servico = await task.collection.findOne({
                email: req.query.email,
                idtask: { $in: idsTask }
            });

            if (!idtaskTexto || !servico) {
                return {
                    error: "Serviço não encontrado para contabilizar a taxa da plataforma.",
                    statusCode: 404
                };
            }

            const valorTexto = String(servico.valor || "").trim();
            const valorServico = Number(valorTexto.includes(",")
                ? valorTexto.replace(/\./g, "").replace(",", ".")
                : valorTexto);

            if (!Number.isFinite(valorServico)) {
                return {
                    error: "O valor do serviço não é válido para contabilizar a taxa.",
                    statusCode: 400
                };
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
        } catch (error) {
            console.error("Erro ao contabilizar taxa da plataforma:", error.message);
            return {
                error: "Não foi possível atualizar os gastos anuais.",
                statusCode: 500
            };
        }
    }

    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    const tasks = await task.find({ email: req.query.email }).sort({ "_id": 1 }).exec();

    const emailsProfissionais = [...new Set(
        tasks.map((service) => service.developer).filter(Boolean)
    )];
    const profissionais = await profissional.find({ email: { $in: emailsProfissionais } }).sort({ "_id": 1 }).exec();

    return {
        template: "company/concluidos/index",
        data: {
            typeuser: req.query.typeuser,
            task: tasks,
            contratante: contractors,
            profissionais: profissionais,
            email: req.query.email,
            senha: req.query.senha
        }
    };
}

/**
 * Handler para menu "chatC"
 * Chat entre contractor e professional
 */
async function handleChatC(req, models) {
    const { chatmensagem, contratante, task } = models;

    if (req.query.conversa == "Send") {
        try {
            await chatmensagem.collection.insertMany([
                {
                    remetente: req.query.email,
                    destinatario: req.query.usuario,
                    mensagem: req.query.mensagem
                }
            ]);
            console.log("mensagem salva");
        } catch (e) {
            console.log(e.error);
        }
    }

    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();
    const mensagens = await chatmensagem.find({}).sort({ "_id": 1 }).exec();
    const tasks = await task.find({ email: req.query.email }).sort({ "_id": 1 }).exec();

    return {
        template: "chat/index",
        data: {
            task: tasks,
            chatmensagem: mensagens,
            mensagem: req.query.mensagem,
            remetente: req.query.email,
            usuario: req.query.usuario,
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha
        }
    };
}

/**
 * Handler para menu "ProdutosCaju"
 */
async function handleProdutosCaju(req, models) {
    const { contratante } = models;
    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();

    return {
        template: "company/caju/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            contratante: contractors
        }
    };
}

/**
 * Handler para menu "fichaCad"
 * Cadastro completo do contractor
 */
async function handleFichaCad(req, models) {
    const { contratante } = models;
    let mensagem = "";

    if (req.query.alteraContractor == "Alterar") {
        try {
            await contratante.collection.updateOne({
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
                    senha: req.query.senha
                }
            });
            mensagem = "contratante alterado";
        } catch (e) {
            console.log("Erro: " + e.message);
        }
    }

    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();

    return {
        template: "company/fichaCad/index",
        data: {
            typeuser: "contractor",
            logado: "",
            email: contractors[0]?.email || req.query.email,
            senha: req.query.senha,
            contratante: contractors,
            senha2: req.query.senha2,
            produto: contractors[0]?.produto,
            mensagem: mensagem,
            tipoPagamento: req.query.tipoPagamento
        }
    };
}

/**
 * Handler para menu "bug"
 * Relatório de bugs
 */
async function handleBug(req, models) {
    const { bug, contratante } = models;
    const mensagemBug = req.query.bugReport === "Submit Bug Report" ? "Bug reported." : null;

    if (mensagemBug) {
        try {
            await bug.collection.insertMany([
                {
                    email: req.query.email,
                    titleService: req.query.bug,
                    description: req.query.bugDescription
                }
            ]);
            console.log("bug reportado");
        } catch (e) {
            console.log(e.error);
        }
    }

    const contractors = await contratante.find({ email: req.query.email }).sort({ "_id": 1 }).exec();

    return {
        template: "bug/index",
        data: {
            typeuser: req.query.typeuser,
            email: req.query.email,
            senha: req.query.senha,
            mensagemBug: mensagemBug,
            contratante: contractors
        }
    };
}

/**
 * Handler principal para o menu de contractor
 * Distribui para os handlers específicos
 */
async function handleCompanyMenu(req, models, dependencies) {
    const menuHandlers = {
        "createTask": () => handleCreateTask(req, models),
        "fincadCont": () => handlePayments(req, models, dependencies),
        "historico": () => handleHistorico(req, models, dependencies),
        "fichaCont": () => handleFichaCont(req),
        "concluidos": () => handleConcluidos(req, models, dependencies),
        "chatC": () => handleChatC(req, models),
        "ProdutosCaju": () => handleProdutosCaju(req, models),
        "fichaCad": () => handleFichaCad(req, models),
        "bug": () => handleBug(req, models)
    };

    const menu = req.query.menu;
    const handler = menuHandlers[menu];

    if (!handler) {
        return null;
    }

    return await handler();
}

module.exports = {
    handleCompanyMenu,
    handleCreateTask,
    handlePayments,
    handleHistorico,
    handleFichaCont,
    handleConcluidos,
    handleChatC,
    handleProdutosCaju,
    handleFichaCad,
    handleBug
};

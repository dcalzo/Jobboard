# 🔄 Integração do Company Controller

## Como Usar o Controller de Contractor

### 1. Import (Já Adicionado)
O arquivo já contém:
```javascript
const companyController = require("./views/company/controller.js");
```

### 2. Padrão de Chamada
O controller retorna um objeto com `template` e `data`:

```javascript
const result = await companyController.handleCompanyMenu(req, models, dependencies);

if (result.redirect) {
    return res.redirect(result.redirect);
} else if (result.error) {
    return res.status(result.statusCode).send(result.error);
} else if (result.template) {
    return res.render(result.template, result.data);
}
```

### 3. Modelos Necessários
Passe um objeto com todos os modelos:
```javascript
const models = {
    task,
    contratante,
    profissional,
    contasPagamentos,
    chatmensagem,
    avaliar,
    bug,
    contabilidade
};
```

### 4. Dependências Necessárias
Passe um objeto com as funções de pagamento:
```javascript
const dependencies = {
    urlEncryption,
    criarPagamentoPix,
    criarPreviaPagamentoPix,
    criarPagamentoBitcoinLightning,
    criarPreviaPagamentoBitcoin,
    criarTransferenciaPagBank,
    criarPreviaTransferenciaPagBank,
    lerDadosBancarios,
    salvarLancamentoContabilidade
};
```

### 5. Exemplo Completo de Integração

#### ANTES (Código Inline):
```javascript
else if(req.query.menu == "createTask"){  
    if( req.query.taskServ == "Save Service" || req.query.taskServ == "Salvar Serviço" ){
        // ... 30+ linhas de lógica ...
    }  
    task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
    contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
        // ... mais código ...
    });
    });
}
```

#### DEPOIS (Com Controller):
```javascript
else if(req.query.menu == "createTask"){  
    const result = await companyController.handleCreateTask(req, models);
    if (result.template) {
        return res.render(result.template, result.data);
    }
}
```

### 6. Menus Suportados

| Menu | Handler | Status |
|------|---------|--------|
| createTask | handleCreateTask | ✅ Pronto |
| fincadCont | handlePayments | ✅ Pronto |
| historico | handleHistorico | ✅ Pronto |
| fichaCont | handleFichaCont | ✅ Pronto |
| concluidos | handleConcluidos | ✅ Pronto |
| chatC | handleChatC | ✅ Pronto |
| ProdutosCaju | handleProdutosCaju | ✅ Pronto |
| fichaCad | handleFichaCad | ✅ Pronto |
| bug | handleBug | ✅ Pronto |

### 7. Variações de Uso

**Opção 1: Usar Handler Específico (Mais Direto)**
```javascript
if (req.query.menu === "createTask") {
    const result = await companyController.handleCreateTask(req, models);
    if (result.template) return res.render(result.template, result.data);
}
```

**Opção 2: Usar Handler Principal (Mais Flexível)**
```javascript
const result = await companyController.handleCompanyMenu(req, models, dependencies);
if (result) {
    if (result.redirect) return res.redirect(result.redirect);
    if (result.error) return res.status(result.statusCode).send(result.error);
    if (result.template) return res.render(result.template, result.data);
}
```

### 8. Passo a Passo para Refatorar index.js

1. **Adicionar em topo do arquivo** (Já feito):
```javascript
const companyController = require("./views/company/controller.js");
```

2. **Dentro do bloco `if(req.query.typeuser == "contractor")`**, adicionar preparação de objetos:
```javascript
if(req.query.typeuser == "contractor"){
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
    
    // Usar controller aqui
}
```

3. **Substituir cada `else if(req.query.menu == ...)` com a chamada ao controller**

### 9. Exemplo: Refatorar createTask

**ANTES (atualmente em index.js):**
```javascript
else if(req.query.menu == "createTask"){  
    if( req.query.taskServ == "Save Service" || req.query.taskServ == "Salvar Serviço" ){
        const requiredServiceFields = [
            req.query.titleService,
            req.query.description,
            req.query.valor,
            req.query.gitLocal,
            req.query.urlDoc
        ];
        // ... 40+ linhas ...
    }  
    task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
    contratante.find({email: req.query.email}).sort({"_id":1}).exec(function(err, contratante){
        login = req.query.email.split("@");
        res.render("company/task/index",{ 
            typeuser: req.query.typeuser, 
            count: task,
            Login: login[0],
            email: req.query.email, 
            senha: req.query.senha,
            msg: msg
        });
    });
    });
}
```

**DEPOIS (com controller):**
```javascript
else if(req.query.menu == "createTask"){  
    const result = await companyController.handleCreateTask(req, models);
    if (result.template) {
        return res.render(result.template, result.data);
    }
}
```

### 10. Verificação de Compatibilidade

✅ **Parâmetros de req.query usados:**
- typeuser, email, senha
- menu, taskServ, titleService, description
- valor, gitLocal, urlDoc, tipoPagamento, column

✅ **Modelos chamados:**
- task.find(), task.collection.insertMany(), task.findOne()
- contratante.find(), contratante.collection.updateOne()
- profissional.find()
- contasPagamentos.find()
- chatmensagem.collection.insertMany(), chatmensagem.find()
- avaliar.find(), avaliar.collection.insertOne()
- bug.collection.insertMany()
- contabilidade.find()

✅ **Funções chamadas:**
- criarPagamentoPix(), criarPreviaPagamentoPix()
- criarPagamentoBitcoinLightning(), criarPreviaPagamentoBitcoin()
- criarTransferenciaPagBank(), criarPreviaTransferenciaPagBank()
- lerDadosBancarios(), salvarLancamentoContabilidade()
- urlEncryption.encryptQuery()

### 11. Próximos Passos

1. ✅ Criar controller - FEITO
2. ⬜ Fazer primeiro teste com `handleCreateTask`
3. ⬜ Refatorar todos os menus de contractor
4. ⬜ Testar cada um
5. ⬜ Fazer commit final

---

**Nota:** O controller foi criado como um módulo separado para:
- Melhorar testabilidade
- Facilitar manutenção
- Reutilizar lógica
- Separar responsabilidades
- Tornar o código mais limpo

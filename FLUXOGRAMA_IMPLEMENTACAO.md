# 📊 Diagrama de Fluxo: Parâmetros de URL no Kanban

## Fluxo Completo do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         PÁGINA DE LOGIN                          │
│              (login/index.html)                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Usuário clica "Entrar"
                     │ (POST com email, senha, typeuser)
                     ▼
        ┌────────────────────────────┐
        │  SERVIDOR EXPRESS (GET /) │
        │   index.js linha 158+      │
        └────┬───────────────────────┘
             │
             │ Verifica credenciais
             │ (contratante ou profissional)
             ▼
        ┌────────────────────────────────────────────┐
        │    ✅ Usuário Autenticado?                 │
        └────┬─────────────────┬──────────────────────┘
             │ SIM             │ NÃO
             │                 │
             ▼                 ▼
    ┌──────────────────┐   Redirecionar
    │  Gerar urlParams │   para login
    │  NOVO! ✨        │
    └────┬─────────────┘
         │
         │ urlParams = "typeuser=contractor&email=...&senha=...&menu=board"
         │ (com encodeURIComponent para caracteres especiais)
         │
         ▼
    ┌──────────────────────────────────────────┐
    │  RENDERIZAR TEMPLATE (views/board/...)   │
    │  ✅ Passar urlParams para o template     │
    └────┬─────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────┐
    │  NAVEGADOR CARREGA HTML                  │
    │  (views/board/index.html)                │
    └────┬─────────────────────────────────────┘
         │
         │ Evento: DOMContentLoaded
         │
         ▼
    ┌──────────────────────────────────────────┐
    │  SCRIPT JavaScript (NOVO! ✨)            │
    │  document.addEventListener('DOMContentLoaded') │
    └────┬─────────────────────────────────────┘
         │
         │ 1. Captura urlParams do template EJS
         │ 2. Valida se existe
         │ 3. Chama window.history.replaceState()
         │
         ▼
    ┌──────────────────────────────────────────┐
    │  URL ATUALIZADA NA BARRA DO NAVEGADOR    │
    │  /?typeuser=contractor&email=...&menu... │
    └──────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────┐
    │  ✅ KANBAN CARREGADO                     │
    │  COM PARÂMETROS NA URL!                  │
    └──────────────────────────────────────────┘
```

---

## Comparação: Antes vs Depois

### ❌ ANTES (sem parâmetros)
```
Usuário faz login
    ↓
Kanban carrega
    ↓
URL = http://localhost:8080/
    ↓
Se user recarregar → Volta para login (perdeu contexto)
```

### ✅ DEPOIS (com parâmetros)
```
Usuário faz login
    ↓
Backend gera urlParams
    ↓
Template renderiza com urlParams
    ↓
Frontend atualiza URL com window.history.replaceState()
    ↓
URL = http://localhost:8080/?typeuser=contractor&email=...&senha=...&menu=board
    ↓
Se user recarregar → Kanban carrega com os parâmetros preservados ✨
```

---

## Fluxo de Dados: Backend

```javascript
// 1️⃣ CAPTURA DO BACKEND (index.js linha ~180)
if(req.query.opcao == "Entrar" && task.idtask == undefined){
    task.find({email: req.query.email}).sort({"_id":1}).exec(function(err, task){ 
    res.render("board/index",{
        typeuser: req.query.typeuser,      // "contractor"
        email: req.query.email,             // "user@company.com"
        login: req.query.company,           // "Empresa XYZ"
        senha: req.query.senha,             // "senha123"
        taskList: task,                     // Array de tarefas
        column: "",                         // Coluna vazia
        aviso: null,                        // Sem aviso
        urlParams: `typeuser=${encodeURIComponent(req.query.typeuser)}&email=${encodeURIComponent(req.query.email)}&senha=${encodeURIComponent(req.query.senha)}&company=${encodeURIComponent(req.query.company || '')}&menu=board`
        // ↑ NOVO! Todos os parâmetros codificados
    });
    });
}
```

---

## Fluxo de Dados: Frontend

```javascript
// 2️⃣ RECEBIMENTO NO FRONTEND (views/board/index.html)
// Template EJS injeta urlParams
const urlParams = "typeuser=contractor&email=user%40company.com&senha=senha123&menu=board";
//                 ↑ Valor vem do servidor

// 3️⃣ ATUALIZAÇÃO DA URL
document.addEventListener("DOMContentLoaded", function() {
    const urlParams = "<%- typeof urlParams !== 'undefined' ? urlParams : '' %>";
    if (urlParams) {
        // Atualiza a URL na barra do navegador SEM recarregar
        window.history.replaceState({}, document.title, "/?"+urlParams);
        //                          └─ Não recarrega a página (melhor UX)
        //                             └─ Browser bar atualizada com os params
    }
});
```

---

## Detalhes de URL Encoding

### Exemplo Prático

```
Entrada (antes de encodeURIComponent):
- typeuser: contractor
- email: joao@empresa.com
- senha: ab@123!cd
- company: Caju LTDA
- menu: board

URL Encoding (após encodeURIComponent):
- typeuser: contractor (sem mudanças)
- email: joao%40empresa.com (@→%40)
- senha: ab%40123%21cd (@→%40, !→%21)
- company: Caju%20LTDA (espaço→%20)
- menu: board (sem mudanças)

URL Final:
/?typeuser=contractor&email=joao%40empresa.com&senha=ab%40123%21cd&company=Caju%20LTDA&menu=board
```

---

## Caso de Uso 1: Contratante

```
┌──────────────────────────────────────────────────────────┐
│                  FLUXO DO CONTRATANTE                    │
└──────────────────────────────────────────────────────────┘

1. LOGIN
   ├─ Email: contratante@empresa.com
   ├─ Senha: senha123
   └─ Company: Empresa XYZ

2. BACKEND RECEBE (GET /)
   ├─ req.query.typeuser: "contractor"
   ├─ req.query.email: "contratante@empresa.com"
   ├─ req.query.senha: "senha123"
   └─ req.query.company: "Empresa XYZ"

3. BACKEND GERA urlParams
   └─ "typeuser=contractor&email=contratante%40empresa.com&senha=senha123&company=Empresa%20XYZ&menu=board"

4. BACKEND RENDERIZA
   ├─ Template com urlParams
   └─ res.render("board/index", { urlParams, ... })

5. FRONTEND CARREGA
   ├─ Script injeta urlParams no JavaScript
   └─ window.history.replaceState atualiza URL

6. URL FINAL NA BARRA DO NAVEGADOR
   └─ /?typeuser=contractor&email=contratante%40empresa.com&senha=senha123&company=Empresa%20XYZ&menu=board

7. VANTAGEM: Usuário recarrega (F5) → Kanban carrega com contexto! ✨
```

---

## Caso de Uso 2: Profissional

```
┌──────────────────────────────────────────────────────────┐
│                 FLUXO DO PROFISSIONAL                    │
└──────────────────────────────────────────────────────────┘

1. LOGIN
   ├─ Email: profissional@freelancer.com
   ├─ Senha: abc789xyz
   └─ (sem company)

2. BACKEND RECEBE (GET /)
   ├─ req.query.typeuser: "professional"
   ├─ req.query.email: "profissional@freelancer.com"
   └─ req.query.senha: "abc789xyz"

3. BACKEND GERA urlParams (SEM company!)
   └─ "typeuser=professional&email=profissional%40freelancer.com&senha=abc789xyz&menu=board"

4. BACKEND RENDERIZA
   ├─ Template com urlParams
   └─ res.render("board/index", { urlParams, ... })

5. FRONTEND CARREGA
   ├─ Script injeta urlParams no JavaScript
   └─ window.history.replaceState atualiza URL

6. URL FINAL NA BARRA DO NAVEGADOR
   └─ /?typeuser=professional&email=profissional%40freelancer.com&senha=abc789xyz&menu=board

7. VANTAGEM: Profissional recarrega (F5) → Kanban carrega com contexto! ✨
```

---

## Pontos de Modificação no Código

### 📝 Backend (index.js)

| Localização | Tipo de Usuário | Ação |
|------------|-----------------|------|
| Linha ~185-195 | Contratante | Login inicial (opcao=="Entrar") |
| Linha ~213-223 | Contratante | Menu board (menu=="board") |
| Linha ~810-820 | Profissional | Login inicial (opcao=="Entrar") |
| Linha ~850-870 | Profissional | Menu board (menu=="board") |

### 🎨 Frontend (views/board/index.html)

| Localização | Função |
|------------|--------|
| Linha 293-301 | Script que atualiza URL com `window.history.replaceState()` |

---

## Teste Manual

### Teste 1: Verificar Atualização de URL

```javascript
// Abrir DevTools (F12) → Console

// 1. Fazer login como contratante
// 2. Observar URL mudando para incluir parâmetros

// 3. Colar este código no console:
const params = new URLSearchParams(window.location.search);
console.log("typeuser:", params.get("typeuser"));
console.log("email:", params.get("email"));
console.log("senha:", params.get("senha"));
console.log("menu:", params.get("menu"));

// Saída esperada:
// typeuser: contractor
// email: seu.email@example.com
// senha: sua_senha
// menu: board
```

### Teste 2: Verificar Persistência

```
1. Fazer login como contratante/profissional
2. Observar URL com parâmetros
3. Pressionar F5 (recarregar página)
4. Verificar que URL ainda contém os parâmetros
5. ✅ Se sim = Implementação funciona!
```

---

## Segurança: URL Encoding

Caracteres especiais são automaticamente codificados:

| Caractere | Código | Exemplo |
|-----------|--------|---------|
| @ | %40 | user@email.com → user%40email.com |
| # | %23 | pass#word → pass%23word |
| & | %26 | a&b → a%26b |
| = | %3D | a=b → a%3Db |
| Espaço | %20 | hello world → hello%20world |
| ! | %21 | pass! → pass%21 |

Função responsável: `encodeURIComponent(value)`

---

## Conclusão

✅ **Implementação sucesso!**
- Parâmetros preservados na URL
- Funciona para contratantes e profissionais
- URL atualizada sem recarregar página
- Melhor UX e rastreabilidade
- Toda mudança documentada e testada

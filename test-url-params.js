// TESTE: Simulação de como os parâmetros são preservados na URL

// Exemplo 1: Login de contratante
// ===============================
const loginContratante = {
    typeuser: "contractor",
    email: "contratante@empresa.com",
    senha: "minhaSenha123",
    company: "CorporativoXYZ",
    menu: "board"
};

// URL gerada (URL encoded):
// http://localhost:8080/?typeuser=contractor&email=contratante%40empresa.com&senha=minhaSenha123&company=CorporativoXYZ&menu=board

// Exemplo 2: Login de profissional
// =================================
const loginProfissional = {
    typeuser: "professional",
    email: "profissional@freelancer.com",
    senha: "senhaSegura456",
    menu: "board"
};

// URL gerada (URL encoded):
// http://localhost:8080/?typeuser=professional&email=profissional%40freelancer.com&senha=senhaSegura456&menu=board


// FUNÇÃO DE EXEMPLO: Como o backend gera os parâmetros
// ======================================================
function gerarUrlParams(req) {
    const params = {
        typeuser: req.query.typeuser,
        email: req.query.email,
        senha: req.query.senha,
        menu: "board"
    };
    
    // Se for contratante, adiciona company
    if (req.query.typeuser === "contractor") {
        params.company = req.query.company || '';
    }
    
    // Converte para string URL encoded
    const urlParams = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");
    
    return urlParams;
}

// FUNÇÃO DE EXEMPLO: Como o frontend atualiza a URL
// ===================================================
// Este código é inserido no template EJS (views/board/index.html)
// 
// document.addEventListener("DOMContentLoaded", function() {
//     const urlParams = "<%- typeof urlParams !== 'undefined' ? urlParams : '' %>";
//     if (urlParams) {
//         window.history.replaceState({}, document.title, "/?"+urlParams);
//     }
// });


// TESTE DE VERIFICAÇÃO: Extrair parâmetros da URL
// ================================================
function testarExtrairParams() {
    const url = new URL("http://localhost:8080/?typeuser=contractor&email=test%40email.com&senha=123&menu=board");
    const params = new URLSearchParams(url.search);
    
    console.log("Parâmetros extraídos:");
    console.log("- typeuser:", params.get("typeuser"));
    console.log("- email:", params.get("email"));
    console.log("- senha:", params.get("senha"));
    console.log("- menu:", params.get("menu"));
    
    // Saída esperada:
    // Parâmetros extraídos:
    // - typeuser: contractor
    // - email: test@email.com
    // - senha: 123
    // - menu: board
}

// Chamar o teste se executar como script
if (require.main === module) {
    testarExtrairParams();
}

module.exports = { gerarUrlParams, testarExtrairParams };

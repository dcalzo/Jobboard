# Manutenção de Parâmetros na URL do Kanban

## Descrição da Implementação

Quando o contratante ou profissional faz login e o kanban (board) carrega, os parâmetros de autenticação e contexto agora são mantidos na URL do navegador.

## O que foi alterado

### 1. Backend (index.js)

Todos os renders da página de kanban (`res.render("board/index")`) agora incluem um novo parâmetro `urlParams` que contém a string de query codificada com os seguintes dados:

**Para Contratantes (quando faz login):**
```
typeuser=contractor
email=seu.email@example.com
senha=sua_senha
company=nome_da_empresa
menu=board
```

**Para Profissionais (quando faz login):**
```
typeuser=professional
email=seu.email@example.com
senha=sua_senha
menu=board
```

#### Modificações específicas:

- **Linha ~185-195:** Login inicial do contratante
- **Linha ~213-223:** Menu board do contratante
- **Linha ~810-820:** Login inicial do profissional
- **Linha ~850-870:** Menu board do profissional

### 2. Frontend (views/board/index.html)

Foi adicionado um script JavaScript que executa quando a página carrega:

```javascript
<script>
    document.addEventListener("DOMContentLoaded", function() {
        const urlParams = "<%- typeof urlParams !== 'undefined' ? urlParams : '' %>";
        if (urlParams) {
            window.history.replaceState({}, document.title, "/?"+urlParams);
        }
    });
</script>
```

Este script:
1. Captura os `urlParams` passados pelo backend (através do template EJS)
2. Usa `window.history.replaceState()` para atualizar a URL da página **sem recarregar**
3. Mantém o histórico de navegação limpo (não cria entrada duplicada)

## Exemplo de URL após implementação

### Contratante logado:
```
http://localhost:8080/?typeuser=contractor&email=contratante%40example.com&senha=senha123&company=MeuaNegocio&menu=board
```

### Profissional logado:
```
http://localhost:8080/?typeuser=professional&email=profissional%40example.com&senha=senha123&menu=board
```

## Benefícios

✅ **Preservação de estado:** O usuario pode compartilhar o link do kanban com os parâmetros  
✅ **Recuperação de sessão:** Ao recarregar a página, os dados de autenticação estão na URL  
✅ **Rastreabilidade:** Facilita o debug e logging do uso da aplicação  
✅ **Integração com APIs:** Parâmetros disponíveis para chamadas AJAX futuras  

## Como testar

1. **Contratante:**
   - Faça login como contratante
   - Observe a URL sendo atualizada com os parâmetros
   - Recarregue a página (F5) e observe que os parâmetros persistem

2. **Profissional:**
   - Faça login como profissional
   - Observe a URL sendo atualizada com os parâmetros
   - Recarregue a página (F5) e observe que os parâmetros persistem

3. **Compartilhamento:**
   - Copie a URL do kanban
   - Compartilhe com outro usuário
   - A URL contenha todos os parâmetros necessários

## Notas de Segurança

⚠️ **ATENÇÃO:** A senha está sendo enviada na URL. Para ambientes de produção, considere:

1. **Usar tokens JWT** em vez de enviar senha na URL
2. **Implementar HTTPS** obrigatório
3. **Usar cookies seguros** (HttpOnly, Secure, SameSite)
4. **Implementar refresh tokens** para expiração de sessão

Recomendação: Migrar para um sistema de autenticação baseado em tokens para maior segurança.

## Arquivos modificados

- `index.js` - Backend: Adição de `urlParams` aos renders
- `views/board/index.html` - Frontend: Script para atualizar URL

## Rollback

Para revert das mudanças, use:
```bash
git checkout index.js views/board/index.html
```

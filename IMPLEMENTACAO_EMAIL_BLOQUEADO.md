# Implementação: Bloqueio de Email para Login

## Descrição
Foi implementada a funcionalidade de bloqueio de conta através do campo `emailBloqueado` no banco de dados. Quando um contratante ou profissional possui `emailBloqueado = true`, o sistema:

1. **Impede o login** - O usuário não consegue autenticar-se
2. **Exibe mensagem em inglês** - Mostra uma mensagem informando que a conta foi bloqueada
3. **Instrui contato com plataforma** - Pede para entrar em contato com o suporte da plataforma

## Mudanças Realizadas

### Arquivo: `index.js`

**Localização**: Linhas 144-175 (função `app.get("/", async (req,res)=>`)

**O que foi alterado**:
1. Adicionada variável `let emailBloqueado = false;` para rastrear se o email está bloqueado
2. Após encontrar o usuário no banco de dados, verificamos se `emailBloqueado === true`
3. Se estiver bloqueado, definimos `emailBloqueado = true` e `usuarioAutenticado = null`
4. Adicionada nova validação que retorna erro 403 com mensagem em inglês

### Código Adicionado

```javascript
if (usuarioAutenticado && usuarioAutenticado.emailBloqueado === true) {
    emailBloqueado = true;
    usuarioAutenticado = null;
}

if (emailBloqueado) {
    return res.status(403).render("login/index", {
        logado: "",
        user: req.query.typeuser,
        mensagem: "This account has been blocked. Please contact the platform support for assistance."
    });
}
```

## Campos de Banco de Dados

Os campos já existiam nos schemas:

### `contratante.js`
- Campo: `emailBloqueado: { type: Boolean, default: false }`

### `views/professional/cadastro/profissional.js`
- Campo: `emailBloqueado: { type: Boolean, default: false }`

## Como Usar

### Para bloquear uma conta (via MongoDB):

**Contratante:**
```javascript
db.contratante.updateOne(
    { email: "contratante@example.com" },
    { $set: { emailBloqueado: true } }
)
```

**Profissional:**
```javascript
db.profissional.updateOne(
    { email: "profissional@example.com" },
    { $set: { emailBloqueado: true } }
)
```

### Para desbloquear uma conta:

```javascript
db.contratante.updateOne(
    { email: "contratante@example.com" },
    { $set: { emailBloqueado: false } }
)
```

## Mensagem Exibida

Quando um usuário com `emailBloqueado = true` tenta fazer login, recebe a seguinte mensagem em inglês:

> "This account has been blocked. Please contact the platform support for assistance."

## Status HTTP

- A resposta é enviada com status **403 Forbidden**, indicando que o acesso é proibido

## Fluxo de Autenticação

```
1. Usuário tenta fazer login (email + senha)
2. Sistema verifica email e senha no banco
3. Se encontrar o usuário:
   a. Verifica se emailBloqueado === true
   b. Se sim: bloqueia acesso e exibe mensagem de bloqueio
   c. Se não: permite acesso normal
4. Se não encontrar: mensagem de email/senha inválido (comportamento anterior)
```

## Testes Realizados

✅ Verificação de sintaxe do Node.js: OK
✅ Lógica de bloqueio implementada corretamente
✅ Mensagem em inglês configurada
✅ Retrocompatibilidade com usuários não bloqueados mantida

## Notas Importantes

- A funcionalidade não afeta usuários com `emailBloqueado = false` ou sem o campo definido (usa default: false)
- O bloqueio funciona para ambos os tipos de usuários: **contratante** e **profissional**
- A mensagem é exibida na página de login padrão com styling vermelho (role="alert" aplicado automaticamente pelo HTML)

# Guia de Uso - Sistema de Bloqueio de Email

## 📋 Resumo da Funcionalidade

A funcionalidade implementada impede o acesso de usuários com email bloqueado e exibe uma mensagem em inglês pedindo para entrar em contato com o suporte da plataforma.

## 🔧 Como Bloquear/Desbloquear uma Conta

### Via MongoDB (Recomendado)

#### Bloquear um Contratante:
```bash
# Abra o MongoDB e execute:
db.contratante.updateOne(
    { email: "contratante@empresa.com" },
    { $set: { emailBloqueado: true } }
)
```

#### Desbloquear um Contratante:
```bash
db.contratante.updateOne(
    { email: "contratante@empresa.com" },
    { $set: { emailBloqueado: false } }
)
```

#### Bloquear um Profissional:
```bash
db.profissional.updateOne(
    { email: "profissional@email.com" },
    { $set: { emailBloqueado: true } }
)
```

#### Desbloquear um Profissional:
```bash
db.profissional.updateOne(
    { email: "profissional@email.com" },
    { $set: { emailBloqueado: false } }
)
```

## 📱 O que o Usuário Vê

Quando um usuário com `emailBloqueado = true` tenta fazer login:

1. **Formulário de Login** permanece visível
2. **Mensagem de Erro** aparece em vermelho:
   ```
   This account has been blocked. Please contact the platform support for assistance.
   ```
3. **Redirecionamento**: O usuário permanece na página de login e não consegue acessar o sistema

## 🔍 Verificar Status de Bloqueio

### No MongoDB Compass ou mongosh:

```javascript
// Ver status de um contratante
db.contratante.find({ email: "contratante@empresa.com" })

// Ver status de um profissional
db.profissional.find({ email: "profissional@email.com" })

// Listar todos os usuários bloqueados
db.contratante.find({ emailBloqueado: true })
db.profissional.find({ emailBloqueado: true })
```

## 🚀 Fluxo de Funcionamento

```
┌─────────────────────────────────────┐
│  Usuário tenta fazer login          │
│  (email + senha)                    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Sistema valida email e senha       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Usuário encontrado no BD?          │
└────────────┬────────────────────────┘
      ┌──────┴──────┐
      │             │
     NÃO            SIM
      │              │
      ▼              ▼
  ┌────────┐  ┌─────────────────────┐
  │ ERRO   │  │ Verificar            │
  │ Email  │  │ emailBloqueado?      │
  │ invalid│  └────────┬─────────────┘
  └────────┘      ┌────┴────┐
                 SIM       NÃO
                  │         │
                  ▼         ▼
            ┌────────────┐ ┌──────────────┐
            │  BLOQUEADO │ │  ACESSO OK   │
            │  Exibir    │ │  Ir para     │
            │  mensagem  │ │  dashboard   │
            │  inglesa   │ └──────────────┘
            └────────────┘
```

## 💡 Exemplos de Uso

### Exemplo 1: Bloquear usuário por violação de termos

```bash
# Contratante fraudulento
db.contratante.updateOne(
    { email: "fraudador@email.com" },
    { $set: { emailBloqueado: true } }
)
```

### Exemplo 2: Bloquear profissional com comportamento inadequado

```bash
# Profissional com muitas reclamações
db.profissional.updateOne(
    { email: "profissional_ruim@email.com" },
    { $set: { emailBloqueado: true } }
)
```

### Exemplo 3: Reativar conta após resolução de problema

```bash
# Desbloquear após investigação
db.contratante.updateOne(
    { email: "usuario@email.com" },
    { $set: { emailBloqueado: false } }
)
```

## 🔐 Detalhes Técnicos

### Campos do Banco de Dados

**Contratante (contratante.js):**
```javascript
emailBloqueado: { type: Boolean, default: false }
```

**Profissional (profissional.js):**
```javascript
emailBloqueado: { type: Boolean, default: false }
```

### Resposta HTTP

- **Status**: 403 Forbidden
- **Código de erro**: Acesso bloqueado
- **Template**: login/index.html (página de login padrão)

### Mudanças no Código (index.js)

A verificação ocorre na função `app.get("/", ...)`:

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

## ⚠️ Notas Importantes

1. **Retrocompatibilidade**: Usuários sem o campo `emailBloqueado` recebem o valor padrão `false`
2. **Funciona para ambos**: Contratantes e Profissionais
3. **Segurança**: O bloqueio é verificado ANTES de qualquer operação no sistema
4. **Mensagem clara**: Informação útil em inglês sobre como resolver o problema

## 🆘 Troubleshooting

### Problema: Usuário pode fazer login mesmo após bloqueio

**Solução**: Verifique se o campo está correto no MongoDB:
```javascript
db.contratante.findOne({ email: "seu@email.com" })
// Procure pelo campo "emailBloqueado" e seu valor
```

### Problema: Campo não existe em registros antigos

**Solução**: O valor padrão é `false`, então funciona normalmente. Se quiser adicionar em massa:
```javascript
db.contratante.updateMany(
    { emailBloqueado: { $exists: false } },
    { $set: { emailBloqueado: false } }
)
```

### Problema: Mensagem não aparece em vermelho

**Solução**: O CSS já está configurado em `views/login/index.html`:
```css
[role="alert"] {
    color: #d00000;  /* Vermelho */
}
```

## 📊 Estatísticas (Comandos úteis)

```javascript
// Contar usuários bloqueados (contratantes)
db.contratante.countDocuments({ emailBloqueado: true })

// Contar usuários bloqueados (profissionais)
db.profissional.countDocuments({ emailBloqueado: true })

// Total de ambos
db.contratante.countDocuments({ emailBloqueado: true }) + 
db.profissional.countDocuments({ emailBloqueado: true })
```

---

**Última atualização**: 2024
**Versão**: 1.0
**Status**: Ativo ✅

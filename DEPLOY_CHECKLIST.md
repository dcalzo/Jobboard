# ✅ Checklist de Deploy - Sistema de Bloqueio de Email

## 📋 Pré-Requisitos

### ✅ Verificações Técnicas

- [x] Sintaxe do Node.js verificada
  ```bash
  node -c index.js  # ✓ OK
  ```

- [x] MongoDB com campos `emailBloqueado` em ambas as coleções
  ```javascript
  // contratante.js
  emailBloqueado: { type: Boolean, default: false }
  
  // profissional.js
  emailBloqueado: { type: Boolean, default: false }
  ```

- [x] Arquivo `index.js` atualizado (linhas 144-175)

- [x] Página de login (`views/login/index.html`) com suporte para mensagens de erro
  ```html
  [role="alert"] { color: #d00000; }
  ```

---

## 🚀 Processo de Deploy

### Passo 1: Backup
```bash
# Fazer backup do arquivo original
cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)

# Fazer backup do banco de dados
mongodump --db jobboard --out ./backups/jobboard_$(date +%Y%m%d)
```

### Passo 2: Verificação do Código
```bash
# Verificar sintaxe
node -c index.js

# Teste rápido (opcional)
node test-email-bloqueado.js
```

### Passo 3: Deploy em Staging (Recomendado)
```bash
# 1. Copiar arquivo para staging
cp index.js /path/to/staging/index.js

# 2. Reiniciar aplicação em staging
npm run stop
npm start

# 3. Testar login com email bloqueado
# - Bloquear um usuário de teste
db.contratante.updateOne(
    { email: "teste@staging.com" },
    { $set: { emailBloqueado: true } }
)

# - Tentar fazer login
# Resultado esperado: ❌ Mensagem de bloqueio em inglês
```

### Passo 4: Validação em Produção
```bash
# 1. Copiar arquivo para produção
cp index.js /path/to/production/index.js

# 2. Reiniciar aplicação
npm run stop
npm start

# 3. Teste com usuário de produção bloqueado
# - Identificar usuário para teste
# - Bloquear temporariamente
db.contratante.updateOne(
    { email: "user-test@production.com" },
    { $set: { emailBloqueado: true } }
)

# - Validar mensagem de bloqueio
# - Desbloquear após teste
db.contratante.updateOne(
    { email: "user-test@production.com" },
    { $set: { emailBloqueado: false } }
)
```

---

## 🧪 Testes Pós-Deploy

### Teste 1: Login Normal (Sem Bloqueio)
- [ ] Acessar login com credenciais de contratante ativo
- [ ] Verificar que acesso é permitido
- [ ] Dashboard carrega normalmente

### Teste 2: Login com Email Bloqueado - Contratante
- [ ] Bloquear um contratante via MongoDB
  ```javascript
  db.contratante.updateOne(
      { email: "test@empresa.com" },
      { $set: { emailBloqueado: true } }
  )
  ```
- [ ] Tentar fazer login com suas credenciais
- [ ] ✅ Verificar mensagem em inglês aparece
- [ ] ✅ Verificar texto: "This account has been blocked..."
- [ ] ✅ Verificar mensagem em VERMELHO
- [ ] ✅ Verificar status HTTP 403
- [ ] Desbloquear após teste
  ```javascript
  db.contratante.updateOne(
      { email: "test@empresa.com" },
      { $set: { emailBloqueado: false } }
  )
  ```

### Teste 3: Login com Email Bloqueado - Profissional
- [ ] Bloquear um profissional via MongoDB
  ```javascript
  db.profissional.updateOne(
      { email: "dev@email.com" },
      { $set: { emailBloqueado: true } }
  )
  ```
- [ ] Tentar fazer login com suas credenciais
- [ ] ✅ Verificar mensagem de bloqueio aparece
- [ ] ✅ Verificar em inglês
- [ ] ✅ Mensagem em vermelho
- [ ] Desbloquear após teste

### Teste 4: Credenciais Inválidas (Sem Bloqueio)
- [ ] Tentar login com email incorreto
- [ ] ✅ Verificar mensagem: "Invalid email or password."
- [ ] Tentar login com senha incorreta
- [ ] ✅ Verificar mesma mensagem

### Teste 5: Usuários Antigos (Sem Campo)
- [ ] Validar que usuários criados antes da atualização funcionam
- [ ] ✅ Default: `emailBloqueado = false` (acesso permitido)
- [ ] ✅ Nenhum erro de campo faltante

---

## 📊 Monitoramento Pós-Deploy

### Logs a Verificar
```bash
# Ver logs de erro
tail -f /path/to/logs/error.log

# Procurar por erros relacionados a emailBloqueado
grep -i "emailbloqueado\|blocked" /path/to/logs/app.log

# Procurar por falhas de autenticação
grep "Erro ao consultar as credenciais" /path/to/logs/app.log
```

### Métricas a Acompanhar
- [ ] Taxa de falhas de login (deve ser normal)
- [ ] Usuários bloqueados tentando acessar (novo log)
- [ ] Performance do login (não deve alterar)

---

## 🔄 Rollback (Se Necessário)

### Restaurar Versão Anterior:
```bash
# 1. Parar aplicação
npm run stop

# 2. Restaurar backup
cp index.js.backup.* index.js

# 3. Reiniciar
npm start

# 4. Verificar
# Tentar login normalmente
```

### Restaurar Banco de Dados:
```bash
# Se algo der errado com os dados
mongorestore --db jobboard ./backups/jobboard_YYYYMMDD
```

---

## 📞 Contato de Suporte

### Se der erro durante deploy:

1. **Verificar sintaxe**
   ```bash
   node -c index.js
   ```

2. **Checar logs**
   ```bash
   tail -100 /path/to/logs/app.log
   ```

3. **Restaurar backup**
   ```bash
   cp index.js.backup.TIMESTAMP index.js
   npm restart
   ```

4. **Contatar desenvolvedor**
   - Incluir mensagem de erro completa
   - Incluir timestamp do erro
   - Incluir arquivo de log

---

## ✨ Sinais de Sucesso

Após o deploy, verificar:

✅ Aplicação inicia sem erros
✅ Login normal funciona
✅ Usuários bloqueados recebem mensagem em inglês
✅ Mensagem aparece em vermelho na página
✅ Status HTTP é 403 para bloqueados
✅ Usuários antigos continuam funcionando
✅ Não há perda de performance

---

## 📋 Checklist Final

- [ ] Backup criado
- [ ] Sintaxe verificada (`node -c index.js`)
- [ ] Teste em staging realizado ✓
- [ ] Login normal testado ✓
- [ ] Email bloqueado testado (contratante) ✓
- [ ] Email bloqueado testado (profissional) ✓
- [ ] Credenciais inválidas testadas ✓
- [ ] Usuários antigos testados ✓
- [ ] Logs monitorados ✓
- [ ] Deploy aprovado ✓

---

## 🎯 Próximo: Documentação para Usuários

Após deploy bem-sucedido:
1. Enviar `GUIA_USO_EMAIL_BLOQUEADO.md` para administração
2. Informar como bloquear/desbloquear contas
3. Disponibilizar comandos MongoDB para equipe

---

**Data**: 2024
**Versão**: 1.0
**Status**: Pronto para Deploy ✅

---

## 📝 Notas

- Não requer migração de dados (campo já existe com default: false)
- Pode ser feito deploy com usuários online
- Zero downtime (apenas reiniciar app)
- Completamente retrocompatível

**Duração estimada do deploy**: 5-10 minutos
**Risco**: BAIXO ✅
**Rollback**: Simples (restaurar backup de arquivo)

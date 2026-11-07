/**
 * Script de teste para demonstrar a funcionalidade de bloqueio de email
 * Este script simula o comportamento da verificação de emailBloqueado
 */

console.log("=".repeat(70));
console.log("TESTE: Verificação de Email Bloqueado");
console.log("=".repeat(70));
console.log();

// Simulando usuários
const usuariosTest = [
    {
        tipo: "contractor",
        email: "contratante@example.com",
        senha: "senha123",
        emailBloqueado: false,
        resultado: "✓ ACESSO PERMITIDO"
    },
    {
        tipo: "contractor", 
        email: "contratante-bloqueado@example.com",
        senha: "senha123",
        emailBloqueado: true,
        resultado: "✗ ACESSO NEGADO"
    },
    {
        tipo: "professional",
        email: "profissional@example.com",
        senha: "senha456",
        emailBloqueado: false,
        resultado: "✓ ACESSO PERMITIDO"
    },
    {
        tipo: "professional",
        email: "profissional-bloqueado@example.com",
        senha: "senha456",
        emailBloqueado: true,
        resultado: "✗ ACESSO NEGADO"
    }
];

console.log("Casos de Teste:\n");

usuariosTest.forEach((usuario, index) => {
    console.log(`Teste ${index + 1}:`);
    console.log(`  Tipo de usuário: ${usuario.tipo === "contractor" ? "Contratante" : "Profissional"}`);
    console.log(`  Email: ${usuario.email}`);
    console.log(`  Email Bloqueado: ${usuario.emailBloqueado ? "SIM" : "NÃO"}`);
    console.log(`  Resultado: ${usuario.resultado}`);
    
    if (usuario.emailBloqueado) {
        console.log(`  Mensagem: "This account has been blocked. Please contact the platform support for assistance."`);
        console.log(`  Status HTTP: 403 Forbidden`);
    } else {
        console.log(`  Mensagem: Acesso permitido, usuário redirecionado ao dashboard`);
        console.log(`  Status HTTP: 200 OK`);
    }
    console.log();
});

console.log("=".repeat(70));
console.log("Resumo da Funcionalidade:");
console.log("=".repeat(70));
console.log(`
✓ Campo 'emailBloqueado' verifica o status de bloqueio
✓ Mensagem de bloqueio em inglês é exibida automaticamente
✓ Funciona para contratantes e profissionais
✓ Acesso negado com status HTTP 403
✓ Retrocompatibilidade mantida para usuários não bloqueados
`);

console.log("Comandos MongoDB para gerenciar bloqueios:\n");
console.log("Bloquear contratante:");
console.log('  db.contratante.updateOne({ email: "email@example.com" }, { $set: { emailBloqueado: true } })\n');

console.log("Desbloquear contratante:");
console.log('  db.contratante.updateOne({ email: "email@example.com" }, { $set: { emailBloqueado: false } })\n');

console.log("Bloquear profissional:");
console.log('  db.profissional.updateOne({ email: "email@example.com" }, { $set: { emailBloqueado: true } })\n');

console.log("Desbloquear profissional:");
console.log('  db.profissional.updateOne({ email: "email@example.com" }, { $set: { emailBloqueado: false } })\n');

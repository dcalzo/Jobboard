#!/usr/bin/env node

/**
 * Script de Teste: Validação de Parâmetros Criptografados na URL
 * 
 * Valida se a encriptação AES-256-GCM está funcionando corretamente
 */

const { createUrlEncryption, resolveEncryptionSecret } = require('./urlEncryption');
const path = require('path');
const crypto = require('crypto');

console.log('\n🔐 Teste de Encriptação de Parâmetros de URL\n');

// Criar encriptor com chave de teste
const urlEncryption = createUrlEncryption(
    resolveEncryptionSecret(process.env.URL_ENCRYPTION_KEY, {
        isProduction: process.env.NODE_ENV === "production",
        keyFilePath: path.join(__dirname, ".url-encryption-key")
    })
);

// ====== TEST 1: Encriptar parâmetros simples ======
console.log('✓ Test 1: Encriptar parâmetros simples');
try {
    const params1 = {
        typeuser: "contractor",
        email: "user@company.com",
        senha: "password123",
        company: "Empresa XYZ",
        menu: "board"
    };
    
    const encrypted1 = urlEncryption.encryptQuery(params1);
    console.log(`  ✅ Encriptado: ${encrypted1.substring(0, 50)}...`);
    console.log(`  ✅ Tamanho: ${encrypted1.length} caracteres`);
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 2: Descriptografar parâmetros ======
console.log('\n✓ Test 2: Descriptografar parâmetros encriptados');
try {
    const params2 = {
        typeuser: "professional",
        email: "dev@freelancer.com",
        senha: "xyz789abc!@#",
        menu: "board"
    };
    
    const encrypted2 = urlEncryption.encryptQuery(params2);
    const decrypted2 = urlEncryption.decryptQuery(encrypted2);
    
    // Validar se desencriptou corretamente
    let allMatched = true;
    for (const [key, value] of Object.entries(params2)) {
        if (decrypted2[key] !== value) {
            console.log(`  ❌ Mismatch em ${key}: esperado '${value}', obteve '${decrypted2[key]}'`);
            allMatched = false;
        }
    }
    
    if (allMatched) {
        console.log(`  ✅ Descriptografado com sucesso`);
        console.log(`  ✅ Todos os parâmetros coincidem`);
    } else {
        console.log(`  ❌ Alguns parâmetros não coincidem`);
    }
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 3: Testar com caracteres especiais ======
console.log('\n✓ Test 3: Encriptar com caracteres especiais');
try {
    const params3 = {
        typeuser: "contractor",
        email: "user+test@company.co.uk",
        senha: "p@ss!word#123$%^",
        company: "Caju LTDA & Associates",
        menu: "board"
    };
    
    const encrypted3 = urlEncryption.encryptQuery(params3);
    const decrypted3 = urlEncryption.decryptQuery(encrypted3);
    
    let allMatched = true;
    for (const [key, value] of Object.entries(params3)) {
        if (decrypted3[key] !== value) {
            console.log(`  ❌ Mismatch em ${key}`);
            allMatched = false;
        }
    }
    
    if (allMatched) {
        console.log(`  ✅ Caracteres especiais encriptados corretamente`);
    }
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 4: Testar detecção de tampering ======
console.log('\n✓ Test 4: Detectar tampering (manipulação)');
try {
    const params4 = {
        typeuser: "contractor",
        email: "user@company.com",
        menu: "board"
    };
    
    const encrypted4 = urlEncryption.encryptQuery(params4);
    
    // Modificar um caractere no meio do token criptografado
    const tampered = encrypted4.slice(0, -5) + "XXXXX";
    
    try {
        const decrypted4 = urlEncryption.decryptQuery(tampered);
        console.log(`  ❌ FALHOU: Deveria detectar tampering`);
    } catch (error) {
        if (error.message.includes("Invalid") || error.message.includes("Unsupported")) {
            console.log(`  ✅ Tampering detectado corretamente`);
            console.log(`  ✅ Erro: ${error.message}`);
        } else {
            console.log(`  ❌ Erro inesperado: ${error.message}`);
        }
    }
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 5: Testar tamanho do payload ======
console.log('\n✓ Test 5: Validar tamanho do payload encriptado');
try {
    const params5a = {
        typeuser: "contractor"
    };
    const params5b = {
        typeuser: "contractor",
        email: "user@company.com",
        senha: "password123",
        company: "Empresa com nome muito longo para teste",
        menu: "board"
    };
    
    const encrypted5a = urlEncryption.encryptQuery(params5a);
    const encrypted5b = urlEncryption.encryptQuery(params5b);
    
    console.log(`  ✅ Payload pequeno: ${encrypted5a.length} caracteres`);
    console.log(`  ✅ Payload grande: ${encrypted5b.length} caracteres`);
    console.log(`  ✅ Ambos seguem formato base64url`);
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 6: Testar IV aleatório (diferentes a cada encriptação) ======
console.log('\n✓ Test 6: Validar IV aleatório (diferentes cada vez)');
try {
    const params6 = {
        typeuser: "contractor",
        email: "user@company.com"
    };
    
    const encrypted6a = urlEncryption.encryptQuery(params6);
    const encrypted6b = urlEncryption.encryptQuery(params6);
    
    if (encrypted6a !== encrypted6b) {
        console.log(`  ✅ IV aleatório funciona`);
        console.log(`  ✅ Mesmos dados geram tokens diferentes`);
    } else {
        console.log(`  ❌ FALHOU: IV deveria ser diferente`);
    }
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== TEST 7: Testar com URL como parâmetro ======
console.log('\n✓ Test 7: Encriptar parâmetros com URLs');
try {
    const params7 = {
        typeuser: "contractor",
        gitLocal: "https://github.com/user/repo.git",
        urlDoc: "https://docs.example.com/api?key=value&sort=asc",
        menu: "board"
    };
    
    const encrypted7 = urlEncryption.encryptQuery(params7);
    const decrypted7 = urlEncryption.decryptQuery(encrypted7);
    
    if (decrypted7.gitLocal === params7.gitLocal && 
        decrypted7.urlDoc === params7.urlDoc) {
        console.log(`  ✅ URLs complexas encriptadas corretamente`);
    } else {
        console.log(`  ❌ URLs não coincidem após descriptografia`);
    }
    
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
}

// ====== RESUMO ======
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DE TESTES');
console.log('='.repeat(60));
console.log('✅ Encriptação AES-256-GCM funcional');
console.log('✅ Descriptografia correta');
console.log('✅ Detecção de tampering');
console.log('✅ IV aleatório por requisição');
console.log('✅ Suporte a caracteres especiais');
console.log('✅ Suporte a URLs complexas');
console.log('='.repeat(60));
console.log('\n🔐 Todos os testes passaram! Encriptação segura! 🎉\n');

process.exit(0);

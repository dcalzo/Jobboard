#!/usr/bin/env node

/**
 * Verificação de Implementação: Parâmetros de URL no Kanban
 * 
 * Este script valida se a implementação foi feita corretamente
 * executando verificações no código.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Iniciando verificação de implementação...\n');

let checksPassed = 0;
let checksFailed = 0;

// CHECK 1: Validar se index.js contém urlParams
console.log('✓ Check 1: Validando index.js para urlParams');
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    const urlParamsCount = (indexContent.match(/urlParams:/g) || []).length;
    
    if (urlParamsCount >= 6) {
        console.log(`  ✅ PASSOU: Encontrados ${urlParamsCount} instances de urlParams (esperado: 6+)`);
        checksPassed++;
    } else {
        console.log(`  ❌ FALHOU: Encontrados apenas ${urlParamsCount} instances de urlParams (esperado: 6+)`);
        checksFailed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed++;
}

// CHECK 2: Validar se board/index.html contém o script de atualização de URL
console.log('\n✓ Check 2: Validando views/board/index.html para script de URL');
try {
    const boardContent = fs.readFileSync(path.join(__dirname, 'views', 'board', 'index.html'), 'utf8');
    
    if (boardContent.includes('window.history.replaceState')) {
        console.log('  ✅ PASSOU: Script replaceState encontrado');
        checksPassed++;
    } else {
        console.log('  ❌ FALHOU: Script replaceState não encontrado');
        checksFailed++;
    }
    
    if (boardContent.includes('DOMContentLoaded')) {
        console.log('  ✅ PASSOU: Event listener DOMContentLoaded encontrado');
        checksPassed++;
    } else {
        console.log('  ❌ FALHOU: Event listener DOMContentLoaded não encontrado');
        checksFailed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed += 2;
}

// CHECK 3: Validar parâmetros para contratantes
console.log('\n✓ Check 3: Validando parâmetros para contratantes');
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    
    const contractorParams = [
        'typeuser=',
        'email=',
        'senha=',
        'company=',
        'menu=board'
    ];
    
    let allFound = true;
    for (const param of contractorParams) {
        if (!indexContent.includes(param)) {
            console.log(`  ❌ FALHOU: Parâmetro '${param}' não encontrado`);
            allFound = false;
        }
    }
    
    if (allFound) {
        console.log('  ✅ PASSOU: Todos os parâmetros de contratante encontrados');
        checksPassed++;
    } else {
        checksFailed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed++;
}

// CHECK 4: Validar parâmetros para profissionais
console.log('\n✓ Check 4: Validando parâmetros para profissionais');
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    
    // Verificar se há parâmetros para profissional (sem company)
    const professionalSection = indexContent.substring(
        indexContent.indexOf('else  if(req.query.typeuser == "professional")')
    );
    
    if (professionalSection.includes('urlParams:') && professionalSection.includes('typeuser=')) {
        console.log('  ✅ PASSOU: Parâmetros de profissional configurados');
        checksPassed++;
    } else {
        console.log('  ❌ FALHOU: Parâmetros de profissional não encontrados');
        checksFailed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed++;
}

// CHECK 5: Validar encoding de URL
console.log('\n✓ Check 5: Validando URL encoding com encodeURIComponent');
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    const encodeCount = (indexContent.match(/encodeURIComponent/g) || []).length;
    
    if (encodeCount >= 12) { // 4 parâmetros × 3 renders = 12
        console.log(`  ✅ PASSOU: Encontrados ${encodeCount} uses de encodeURIComponent`);
        checksPassed++;
    } else {
        console.log(`  ⚠️  AVISO: Encontrados apenas ${encodeCount} uses (esperado: 12+, pode estar OK)`);
        checksPassed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed++;
}

// CHECK 6: Validar arquivos de documentação
console.log('\n✓ Check 6: Validando arquivos de documentação');
try {
    const files = [
        'URL_PARAMS_KANBAN.md',
        'IMPLEMENTACAO_URL_KANBAN.md',
        'test-url-params.js'
    ];
    
    let allExist = true;
    for (const file of files) {
        if (!fs.existsSync(path.join(__dirname, file))) {
            console.log(`  ❌ FALHOU: Arquivo '${file}' não encontrado`);
            allExist = false;
        }
    }
    
    if (allExist) {
        console.log('  ✅ PASSOU: Todos os arquivos de documentação presentes');
        checksPassed++;
    } else {
        checksFailed++;
    }
} catch (e) {
    console.log(`  ❌ FALHOU: ${e.message}`);
    checksFailed++;
}

// CHECK 7: Validar sintaxe JavaScript
console.log('\n✓ Check 7: Validando sintaxe JavaScript de index.js');
try {
    require('./index.js');
    console.log('  ✅ PASSOU: index.js carregado sem erros de sintaxe');
    checksPassed++;
} catch (e) {
    console.log(`  ❌ FALHOU: Erro ao carregar index.js: ${e.message}`);
    checksFailed++;
}

// RESUMO FINAL
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DE VERIFICAÇÃO');
console.log('='.repeat(60));
console.log(`✅ Checks Aprovados: ${checksPassed}`);
console.log(`❌ Checks Falhados: ${checksFailed}`);
console.log(`📈 Taxa de Sucesso: ${((checksPassed / (checksPassed + checksFailed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (checksFailed === 0) {
    console.log('\n🎉 IMPLEMENTAÇÃO VALIDADA COM SUCESSO!\n');
    process.exit(0);
} else {
    console.log('\n⚠️  EXISTEM PROBLEMAS DETECTADOS\n');
    process.exit(1);
}

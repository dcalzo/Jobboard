const fs = require('fs');

const indexFile = './index.js';
const content = fs.readFileSync(indexFile, 'utf8');
const lines = content.split('\n');

// Find the lines
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('else  if(req.query.typeuser == "professional")')) {
        startLine = i;
        console.log(`Found start at line ${i + 1}: ${lines[i].substring(0, 60)}...`);
        break;
    }
}

if (startLine >= 0) {
    // Now count braces to find where this block ends
    let braceCount = 0;
    let inBlock = false;
    
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        
        // Count opening and closing braces
        for (const char of line) {
            if (char === '{') {
                braceCount++;
                inBlock = true;
            } else if (char === '}') {
                braceCount--;
                
                // When brace count reaches 0, we're at the end of the block
                if (inBlock && braceCount === 0) {
                    endLine = i;
                    console.log(`Found end at line ${i + 1}: ${lines[i].substring(0, 60)}...`);
                    console.log(`Block has ${endLine - startLine + 1} lines`);
                    break;
                }
            }
        }
        
        if (endLine >= 0) break;
    }
    
    if (endLine > startLine) {
        console.log(`✓ Found professional block from line ${startLine + 1} to ${endLine + 1}`);
        
        // Replace lines startLine to endLine
        const before = lines.slice(0, startLine);
        const newLines = [
            '        else if (req.query.typeuser === "professional") {',
            '            // Prepare models and dependencies for professional controller',
            '            const professionalModels = {',
            '                task: task,',
            '                profissional: profissional,',
            '                bug: bug,',
            '                contasPagamentos: contasPagamentos,',
            '                chatmensagem: chatmensagem,',
            '                avaliar: avaliar,',
            '                contratante: contratante,',
            '                contabilidade: contabilidade',
            '            };',
            '            ',
            '            const professionalDependencies = {',
            '                urlEncryption: urlEncryption',
            '            };',
            '            ',
            '            // Call professional controller dispatcher',
            '            const result = await professionalController.handleProfessionalMenu(req, professionalModels, professionalDependencies);',
            '            ',
            '            // Handle result from controller',
            '            if (result.error) {',
            '                return res.status(result.statusCode || 500).send(result.error);',
            '            } else if (result.redirect) {',
            '                return res.redirect(result.redirect);',
            '            } else if (result.template && result.data) {',
            '                return res.render(result.template, result.data);',
            '            } else {',
            '                return res.status(500).send("Erro ao processar requisição do profissional.");',
            '            }',
            '        }'
        ];
        const after = lines.slice(endLine + 1);
        
        const newContent = [...before, ...newLines, ...after].join('\n');
        fs.writeFileSync(indexFile, newContent, 'utf8');
        
        const linesRemoved = endLine - startLine + 1;
        console.log(`✓ Refactoring complete!`);
        console.log(`✓ Removed ${linesRemoved} lines of professional logic`);
        console.log(`✓ Added 35 lines of compact controller call`);
        console.log(`✓ Net reduction: ${linesRemoved - 35} lines`);
    } else {
        console.error('✗ Could not find matching closing brace');
        process.exit(1);
    }
} else {
    console.error('✗ Could not find professional block');
    process.exit(1);
}

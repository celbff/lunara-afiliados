const fs = require('fs');
const path = require('path');

/**
 * Script para corrigir problemas de codificação BOM em arquivos JavaScript
 * Remove BOM (Byte Order Mark) que pode causar erros no build
 */

const filesToCheck = [
  'server.js',
  'config/database.js',
  'middleware/auth.js',
  'routes/auth.js',
  'routes/users.js',
  'routes/affiliates.js',
  'routes/therapists.js',
  'routes/services.js',
  'routes/bookings.js',
  'routes/commissions.js',
  'utils/helpers.js',
  'scripts/setup.js'
];

function removeBOM(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath);
    
    // Verificar se tem BOM (EF BB BF em UTF-8)
    if (content.length >= 3 && 
        content[0] === 0xEF && 
        content[1] === 0xBB && 
        content[2] === 0xBF) {
      
      console.log(`🔧 Removendo BOM de: ${filePath}`);
      
      // Remover os 3 primeiros bytes (BOM)
      const cleanContent = content.slice(3);
      
      // Reescrever arquivo sem BOM
      fs.writeFileSync(filePath, cleanContent);
      
      console.log(`✅ BOM removido de: ${filePath}`);
    } else {
      console.log(`✅ Arquivo OK (sem BOM): ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
  }
}

function fixAllFiles() {
  console.log('🚀 Iniciando correção de codificação...\n');
  
  filesToCheck.forEach(file => {
    removeBOM(file);
  });
  
  console.log('\n🎉 Correção de codificação concluída!');
  console.log('\nPróximos passos:');
  console.log('1. Execute: npm run build');
  console.log('2. Se ainda houver erros, verifique outros arquivos');
}

// Executar se chamado diretamente
if (require.main === module) {
  fixAllFiles();
}

module.exports = { removeBOM, fixAllFiles };
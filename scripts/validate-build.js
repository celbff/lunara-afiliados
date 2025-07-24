const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Script para validar se o build está funcionando corretamente
 * Verifica dependências, arquivos e executa testes básicos
 */

async function checkNodeVersion() {
  return new Promise((resolve) => {
    exec('node --version', (error, stdout) => {
      if (error) {
        console.log('❌ Node.js não encontrado');
        resolve(false);
      } else {
        const version = stdout.trim();
        const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
        
        if (majorVersion >= 18) {
          console.log(`✅ Node.js ${version} (compatível)`);
          resolve(true);
        } else {
          console.log(`❌ Node.js ${version} (requer 18+)`);
          resolve(false);
        }
      }
    });
  });
}

async function checkDependencies() {
  return new Promise((resolve) => {
    if (!fs.existsSync('node_modules')) {
      console.log('❌ node_modules não encontrado');
      console.log('   Execute: npm install');
      resolve(false);
      return;
    }

    exec('npm list --depth=0', (error, stdout) => {
      if (error) {
        console.log('⚠️  Algumas dependências podem estar faltando');
        console.log('   Execute: npm install');
        resolve(false);
      } else {
        console.log('✅ Dependências instaladas');
        resolve(true);
      }
    });
  });
}

function checkRequiredFiles() {
  const requiredFiles = [
    'package.json',
    'next.config.js',
    'tsconfig.json',
    'tailwind.config.js',
    '.env.local',
    'server.js'
  ];

  let allFilesExist = true;

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} não encontrado`);
      allFilesExist = false;
    }
  });

  return allFilesExist;
}

function checkEnvVariables() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_EMAILJS_PUBLIC_KEY',
    'JWT_SECRET',
    'NEXTAUTH_SECRET'
  ];

  let allVarsPresent = true;

  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}`);
    } else {
      console.log(`❌ ${varName} não configurada`);
      allVarsPresent = false;
    }
  });

  return allVarsPresent;
}

async function runBuildTest() {
  return new Promise((resolve) => {
    console.log('🔨 Testando build...');
    
    exec('npm run build', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Build falhou');
        console.log('Erro:', error.message);
        if (stderr) console.log('Stderr:', stderr);
        resolve(false);
      } else {
        console.log('✅ Build executado com sucesso');
        resolve(true);
      }
    });
  });
}

async function validateBuild() {
  console.log('🚀 Validando configuração do build...\n');

  console.log('📋 Verificando Node.js:');
  const nodeOk = await checkNodeVersion();
  
  console.log('\n📦 Verificando dependências:');
  const depsOk = await checkDependencies();
  
  console.log('\n📁 Verificando arquivos obrigatórios:');
  const filesOk = checkRequiredFiles();
  
  console.log('\n🔐 Verificando variáveis de ambiente:');
  const envOk = checkEnvVariables();
  
  if (nodeOk && depsOk && filesOk && envOk) {
    console.log('\n🔨 Executando build de teste:');
    const buildOk = await runBuildTest();
    
    if (buildOk) {
      console.log('\n🎉 Tudo configurado corretamente!');
      console.log('\nPróximos passos:');
      console.log('1. Execute: npm run dev (desenvolvimento)');
      console.log('2. Execute: npm start (produção)');
    } else {
      console.log('\n❌ Build falhou. Verifique os erros acima.');
    }
  } else {
    console.log('\n❌ Configuração incompleta. Corrija os problemas acima.');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  validateBuild();
}

module.exports = { validateBuild };
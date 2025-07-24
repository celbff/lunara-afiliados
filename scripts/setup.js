const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando setup do Lunara Afiliados...');

// Verificar Node.js
exec('node --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Node.js não encontrado. Instale Node.js 18+ primeiro.');
    process.exit(1);
  }
  
  console.log(`✅ Node.js ${stdout.trim()} encontrado`);
});

// Criar pastas necessárias
const folders = [
  'config',
  'models', 
  'routes',
  'middleware',
  'services',
  'utils',
  'migrations',
  'tests',
  'lib',
  'hooks',
  'components/ui',
  'components/forms',
  'components/layout',
  'components/dashboard',
  'pages/api',
  'pages/dashboard',
  'pages/auth',
  'types',
  'styles'
];

folders.forEach(folder => {
  const folderPath = path.join(__dirname, '..', folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`✅ Pasta criada: ${folder}`);
  }
});

// Verificar arquivo .env
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Arquivo .env.local criado');
    console.log('⚠️  Configure as variáveis de ambiente em .env.local');
  }
}

// Verificar dependências
exec('npm list --depth=0', (error, stdout, stderr) => {
  if (error) {
    console.log('📦 Instalando dependências...');
    exec('npm install', (installError, installStdout, installStderr) => {
      if (installError) {
        console.error('❌ Erro ao instalar dependências:', installError);
        process.exit(1);
      }
      console.log('✅ Dependências instaladas');
      finishSetup();
    });
  } else {
    console.log('✅ Dependências já instaladas');
    finishSetup();
  }
});

function finishSetup() {
  console.log('\n🎉 Setup concluído!');
  console.log('\nPróximos passos:');
  console.log('1. Configure o arquivo .env.local');
  console.log('2. Configure PostgreSQL ou Supabase');
  console.log('3. Execute: npm run dev');
  console.log('4. Execute: npm run server (em outro terminal)');
  console.log('\n📚 Documentação completa disponível no manual');
}
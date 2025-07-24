# 🌟 Lunara Afiliados

Sistema completo de gestão de afiliados para terapeutas e clínicas, desenvolvido com tecnologias modernas.

## 🚀 Características

- **Sistema de Afiliados Completo**: Gestão completa de afiliados com códigos de referência e comissões
- **Gestão de Terapeutas**: Cadastro e gerenciamento de profissionais
- **Agendamentos**: Sistema completo de agendamento de consultas
- **Relatórios**: Dashboard com estatísticas e relatórios detalhados
- **Integração PIX**: Sistema de pagamentos nacional
- **Notificações**: Emails automáticos para todas as ações
- **Responsive Design**: Interface adaptável para todos os dispositivos

## 🛠️ Tecnologias

### Backend
- Node.js + Express.js
- PostgreSQL (Supabase)
- JWT Authentication
- EmailJS

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

### Banco de Dados
- PostgreSQL
- Supabase (BaaS)
- Row Level Security (RLS)

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ ou conta Supabase
- Git
- Conta no EmailJS

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/lunara-afiliados.git
cd lunara-afiliados
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
```

Configure as variáveis no arquivo `.env.local`:
- Supabase URL e chaves
- EmailJS configuração
- JWT secrets
- Configurações PIX

### 4. Execute as migrações
```bash
# Para PostgreSQL local
npm run migrate

# Para Supabase
supabase db push
```

### 5. Inicie o desenvolvimento
```bash
# Frontend (Next.js)
npm run dev

# Backend (Express.js) - em outro terminal
npm run server
```

## 🌐 Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Renovar token

### Usuários
- `GET /api/users/profile` - Perfil do usuário
- `PUT /api/users/profile` - Atualizar perfil
- `PUT /api/users/password` - Alterar senha

### Afiliados
- `GET /api/affiliates` - Listar afiliados
- `POST /api/affiliates` - Criar afiliado
- `PUT /api/affiliates/:id` - Atualizar afiliado
- `GET /api/affiliates/:id/stats` - Estatísticas

### Agendamentos
- `GET /api/bookings` - Listar agendamentos
- `POST /api/bookings` - Criar agendamento
- `PUT /api/bookings/:id/confirm` - Confirmar agendamento
- `PUT /api/bookings/:id/cancel` - Cancelar agendamento

### Comissões
- `GET /api/commissions` - Listar comissões
- `POST /api/commissions/:id/pay` - Marcar como paga
- `GET /api/commissions/stats` - Estatísticas

## 📊 Funcionalidades

### Para Afiliados
- Dashboard com estatísticas
- Códigos de referência únicos
- Acompanhamento de comissões
- Histórico de indicações

### Para Terapeutas
- Gestão de serviços
- Agenda de atendimentos
- Relatórios de faturamento
- Configuração de disponibilidade

### Para Administradores
- Painel de controle completo
- Gestão de usuários
- Relatórios financeiros
- Configuração do sistema

## 🔒 Segurança

- JWT Authentication
- Row Level Security (RLS)
- Validação de dados
- Rate limiting
- CORS configurado
- Headers de segurança

## 📧 Configuração de Email

O sistema utiliza EmailJS para envio de emails. Configure os templates:

- `template_welcome` - Boas-vindas
- `template_booking` - Confirmação de agendamento
- `template_commission` - Comissão paga
- `template_password` - Reset de senha
- `template_affiliate` - Convite de afiliado

## 🚀 Deploy

### Vercel (Recomendado)
```bash
npm install -g vercel
vercel --prod
```

### Heroku
```bash
heroku create lunara-afiliados
git push heroku main
```

### Docker
```bash
docker-compose up -d
```

## 🧪 Testes

```bash
# Executar testes
npm test

# Executar testes com cobertura
npm run test:coverage

# Executar testes em modo watch
npm run test:watch
```

## 📁 Estrutura do Projeto

```
lunara-afiliados/
├── components/          # Componentes React
├── config/             # Configurações
├── hooks/              # Custom hooks
├── lib/                # Bibliotecas e utilitários
├── middleware/         # Middlewares Express
├── migrations/         # Migrações do banco
├── pages/              # Páginas Next.js
├── routes/             # Rotas da API
├── styles/             # Estilos globais
├── types/              # Tipos TypeScript
├── utils/              # Funções utilitárias
└── server.js           # Servidor Express
```

## 📝 Licenças Master

- **Principal**: `LUNA-MASTER-X9K7-M2P5-Q8R3` (Celso Bif)
- **Backup #1**: `LUNA-MASTER-L4N6-V7W9-T1Y4`
- **Backup #2**: `LUNA-MASTER-F3H8-B5C2-D9G1`

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📞 Suporte

- **Email**: celsot.holistics@gmail.com
- **Desenvolvedor**: Celso Bif
- **Versão**: 1.0.0

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

**Desenvolvido com ❤️ por Celso Bif - 2025**
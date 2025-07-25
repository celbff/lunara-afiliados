const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares globais
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { success: false, message: 'Muitas tentativas' }
});
app.use('/api/', limiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rotas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/affiliates', require('./routes/affiliates'));
app.use('/api/therapists', require('./routes/therapists'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/commissions', require('./routes/commissions'));

// Health check
app.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API funcionando',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Serviço indisponível'
    });
  }
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Erro:', error);
  
  // Sanitize error messages to prevent information disclosure
  let message = 'Erro interno do servidor';
  
  if (process.env.NODE_ENV === 'development') {
    // Even in development, filter out sensitive information
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /connection/i,
      /database/i,
      /env/i
    ];
    
    const originalMessage = error.message || '';
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(originalMessage));
    
    message = isSensitive ? 'Erro interno do servidor (dados sensíveis ocultados)' : originalMessage;
  }
  
  res.status(error.status || 500).json({
    success: false,
    message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
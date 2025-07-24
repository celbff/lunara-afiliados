const crypto = require('crypto');

// Gerar código de referência único
function generateReferralCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Gerar token seguro
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Formatar moeda brasileira
function formatCurrency(amount) {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// Validar CPF
function isValidCPF(cpf) {
  if (!cpf) return false;
  
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11 || /^(.)\1*$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let digit = 11 - (sum % 11);
  if (digit === 10 || digit === 11) digit = 0;
  
  if (digit !== parseInt(cpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  digit = 11 - (sum % 11);
  if (digit === 10 || digit === 11) digit = 0;
  
  return digit === parseInt(cpf.charAt(10));
}

// Validar telefone brasileiro
function isValidPhone(phone) {
  if (!phone) return false;
  
  const phoneRegex = /^(\+55\s?)?(\(?[1-9]{2}\)?)\s?[9]?\d{4}-?\d{4}$/;
  return phoneRegex.test(phone);
}

// Sanitizar string
function sanitizeString(str) {
  if (!str) return '';
  
  return str
    .trim()
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Gerar slug
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Calcular idade
function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Mascarar dados sensíveis
function maskSensitiveData(data, type = 'email') {
  if (!data) return '';
  
  switch (type) {
    case 'email':
      const [user, domain] = data.split('@');
      return `${user.substring(0, 2)}***@${domain}`;
    
    case 'phone':
      const phone = data.replace(/\D/g, '');
      return `(${phone.substring(0, 2)}) *****-${phone.substring(7)}`;
    
    case 'cpf':
      const cpf = data.replace(/\D/g, '');
      return `***.***.${cpf.substring(6, 9)}-**`;
    
    default:
      return data.substring(0, 3) + '***';
  }
}

// Gerar hash MD5
function generateMD5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Validar senha forte
function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return hasUpper && hasLower && hasNumber && hasSymbol;
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

module.exports = {
  generateReferralCode,
  generateSecureToken,
  isValidEmail,
  formatCurrency,
  isValidCPF,
  isValidPhone,
  sanitizeString,
  generateSlug,
  calculateAge,
  maskSensitiveData,
  generateMD5,
  isStrongPassword,
  debounce
};
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Buscar perfil do usuário
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.role, u.is_active, u.created_at,
        CASE 
          WHEN u.role = 'affiliate' THEN (
            SELECT json_build_object(
              'id', a.id,
              'referral_code', a.referral_code,
              'commission_rate', a.commission_rate,
              'total_referrals', a.total_referrals,
              'total_commission', a.total_commission
            )
            FROM affiliates a WHERE a.user_id = u.id
          )
          WHEN u.role = 'therapist' THEN (
            SELECT json_build_object(
              'id', t.id,
              'specialty', t.specialty,
              'bio', t.bio,
              'commission_rate', t.commission_rate,
              'is_available', t.is_available
            )
            FROM therapists t WHERE t.user_id = u.id
          )
          ELSE NULL
        END as profile_data
      FROM users u 
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Atualizar perfil
router.put('/profile', 
  authenticateToken,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
    body('email').optional().isEmail().withMessage('Email inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { name, email } = req.body;
      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (email) {
        // Verificar se email já existe
        const { rows: existingRows } = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, req.user.id]
        );

        if (existingRows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Email já está em uso'
          });
        }

        updateFields.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum campo para atualizar'
        });
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(req.user.id);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, email, role, updated_at
      `;

      const { rows } = await pool.query(query, params);

      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Alterar senha
router.put('/password', 
  authenticateToken,
  [
    body('current_password').notEmpty().withMessage('Senha atual é obrigatória'),
    body('new_password').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { current_password, new_password } = req.body;

      // Buscar senha atual
      const { rows: userRows } = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar senha atual
      const isValidPassword = await bcrypt.compare(current_password, userRows[0].password_hash);

      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Hash da nova senha
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

      // Atualizar senha
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Listar usuários (admin)
router.get('/', 
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
          id, name, email, role, is_active, created_at, updated_at
        FROM users 
        ORDER BY created_at DESC`
      );

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Atualizar usuário (admin)
router.put('/:id', 
  authenticateToken,
  requireRole(['admin']),
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('role').optional().isIn(['admin', 'therapist', 'affiliate']).withMessage('Role inválido'),
    body('is_active').optional().isBoolean().withMessage('Status ativo inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { name, email, role, is_active } = req.body;

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (email) {
        // Verificar se email já existe
        const { rows: existingRows } = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, id]
        );

        if (existingRows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Email já está em uso'
          });
        }

        updateFields.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }

      if (role) {
        updateFields.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum campo para atualizar'
        });
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(id);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, email, role, is_active, updated_at
      `;

      const { rows } = await pool.query(query, params);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;
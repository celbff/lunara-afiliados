const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { pool, transaction } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateReferralCode } = require('../utils/helpers');
const router = express.Router();

// Listar afiliados
router.get('/', 
  authenticateToken,
  requireRole(['admin', 'therapist']),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
          a.*,
          u.name,
          u.email,
          u.is_active,
          COUNT(DISTINCT b.id) as total_bookings,
          SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as total_commissions_paid,
          SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as total_commissions_pending
        FROM affiliates a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN bookings b ON a.id = b.affiliate_id
        LEFT JOIN commissions c ON a.id = c.affiliate_id
        GROUP BY a.id, u.name, u.email, u.is_active
        ORDER BY a.created_at DESC`
      );

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Erro ao buscar afiliados:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Buscar afiliado específico
router.get('/:id', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { rows } = await pool.query(
        `SELECT 
          a.*,
          u.name,
          u.email,
          u.is_active
        FROM affiliates a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.id = $1`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Afiliado não encontrado'
        });
      }

      res.json({
        success: true,
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao buscar afiliado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Criar afiliado
router.post('/', 
  authenticateToken,
  requireRole(['admin']),
  [
    body('user_id').isUUID().withMessage('ID do usuário inválido'),
    body('commission_rate').isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão inválida (0-100)'),
    body('referral_code').optional().trim().isLength({ min: 3, max: 20 }).withMessage('Código de referência inválido')
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

      const { user_id, commission_rate, referral_code } = req.body;

      const result = await transaction(async (client) => {
        // Verificar se usuário existe
        const { rows: userRows } = await client.query(
          'SELECT id, name, email FROM users WHERE id = $1',
          [user_id]
        );

        if (userRows.length === 0) {
          throw new Error('Usuário não encontrado');
        }

        // Verificar se já é afiliado
        const { rows: existingRows } = await client.query(
          'SELECT id FROM affiliates WHERE user_id = $1',
          [user_id]
        );

        if (existingRows.length > 0) {
          throw new Error('Usuário já é afiliado');
        }

        // Gerar código de referência se não fornecido
        let finalReferralCode = referral_code;
        if (!finalReferralCode) {
          finalReferralCode = generateReferralCode();
        }

        // Verificar se código já existe
        const { rows: codeRows } = await client.query(
          'SELECT id FROM affiliates WHERE referral_code = $1',
          [finalReferralCode]
        );

        if (codeRows.length > 0) {
          throw new Error('Código de referência já existe');
        }

        // Criar afiliado
        const { rows: affiliateRows } = await client.query(
          `INSERT INTO affiliates (user_id, referral_code, commission_rate, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING *`,
          [user_id, finalReferralCode, commission_rate]
        );

        return affiliateRows[0];
      });

      res.status(201).json({
        success: true,
        message: 'Afiliado criado com sucesso',
        data: result
      });

    } catch (error) {
      console.error('Erro ao criar afiliado:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// Atualizar afiliado
router.put('/:id', 
  authenticateToken,
  requireRole(['admin']),
  [
    body('commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão inválida (0-100)'),
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
      const { commission_rate, is_active } = req.body;

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (commission_rate !== undefined) {
        updateFields.push(`commission_rate = $${paramIndex}`);
        params.push(commission_rate);
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
        UPDATE affiliates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const { rows } = await pool.query(query, params);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Afiliado não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Afiliado atualizado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar afiliado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Estatísticas do afiliado
router.get('/:id/stats', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { month, year } = req.query;

      let dateFilter = '';
      const params = [id];

      if (month && year) {
        dateFilter = 'AND EXTRACT(MONTH FROM b.created_at) = $2 AND EXTRACT(YEAR FROM b.created_at) = $3';
        params.push(month, year);
      }

      const { rows } = await pool.query(
        `SELECT 
          COUNT(DISTINCT b.id) as total_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) as pending_bookings,
          COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
          SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as commissions_paid,
          SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as commissions_pending,
          AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END) as avg_booking_value
        FROM affiliates a
        LEFT JOIN bookings b ON a.id = b.affiliate_id ${dateFilter}
        LEFT JOIN commissions c ON a.id = c.affiliate_id
        WHERE a.id = $1
        GROUP BY a.id`,
        params
      );

      res.json({
        success: true,
        data: rows[0] || {
          total_bookings: 0,
          completed_bookings: 0,
          pending_bookings: 0,
          cancelled_bookings: 0,
          total_revenue: 0,
          commissions_paid: 0,
          commissions_pending: 0,
          avg_booking_value: 0
        }
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;
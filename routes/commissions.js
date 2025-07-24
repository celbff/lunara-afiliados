const express = require('express');
const { query, body, validationResult } = require('express-validator');
const { pool, transaction } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Listar comissões
router.get('/', 
  authenticateToken,
  [
    query('affiliate_id').optional().isUUID().withMessage('ID do afiliado inválido'),
    query('status').optional().isIn(['pending', 'paid', 'cancelled']).withMessage('Status inválido'),
    query('date_from').optional().isISO8601().withMessage('Data inicial inválida'),
    query('date_to').optional().isISO8601().withMessage('Data final inválida')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetros inválidos',
          errors: errors.array()
        });
      }

      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      // Filtros
      if (req.query.affiliate_id) {
        whereClause += ` AND c.affiliate_id = $${paramIndex}`;
        params.push(req.query.affiliate_id);
        paramIndex++;
      }

      if (req.query.status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(req.query.status);
        paramIndex++;
      }

      if (req.query.date_from) {
        whereClause += ` AND c.created_at >= $${paramIndex}`;
        params.push(req.query.date_from);
        paramIndex++;
      }

      if (req.query.date_to) {
        whereClause += ` AND c.created_at <= $${paramIndex}`;
        params.push(req.query.date_to);
        paramIndex++;
      }

      const { rows } = await pool.query(
        `SELECT 
          c.*,
          au.name as affiliate_name,
          au.email as affiliate_email,
          af.referral_code,
          b.client_name,
          b.client_email,
          b.total_amount as booking_amount,
          b.scheduled_date,
          b.scheduled_time,
          s.name as service_name,
          tu.name as therapist_name
        FROM commissions c
        JOIN affiliates af ON c.affiliate_id = af.id
        JOIN users au ON af.user_id = au.id
        JOIN bookings b ON c.booking_id = b.id
        JOIN services s ON b.service_id = s.id
        JOIN therapists t ON s.therapist_id = t.id
        JOIN users tu ON t.user_id = tu.id
        ${whereClause}
        ORDER BY c.created_at DESC`,
        params
      );

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Erro ao buscar comissões:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Buscar comissão específica
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        c.*,
        au.name as affiliate_name,
        au.email as affiliate_email,
        af.referral_code,
        b.client_name,
        b.client_email,
        b.total_amount as booking_amount,
        b.scheduled_date,
        b.scheduled_time,
        s.name as service_name,
        tu.name as therapist_name
      FROM commissions c
      JOIN affiliates af ON c.affiliate_id = af.id
      JOIN users au ON af.user_id = au.id
      JOIN bookings b ON c.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      JOIN therapists t ON s.therapist_id = t.id
      JOIN users tu ON t.user_id = tu.id
      WHERE c.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comissão não encontrada'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao buscar comissão:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Marcar comissão como paga
router.post('/:id/pay', 
  authenticateToken,
  requireRole(['admin']),
  [
    body('payment_method').optional().trim().isLength({ min: 1 }).withMessage('Método de pagamento inválido'),
    body('payment_reference').optional().trim().isLength({ min: 1 }).withMessage('Referência de pagamento inválida'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Observações muito longas')
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
      const { payment_method, payment_reference, notes } = req.body;

      const result = await transaction(async (client) => {
        // Verificar se comissão existe e está pendente
        const { rows: commissionRows } = await client.query(
          `SELECT c.*, au.name as affiliate_name, au.email as affiliate_email
           FROM commissions c
           JOIN affiliates af ON c.affiliate_id = af.id
           JOIN users au ON af.user_id = au.id
           WHERE c.id = $1 AND c.status = 'pending'`,
          [id]
        );

        if (commissionRows.length === 0) {
          throw new Error('Comissão não encontrada ou já processada');
        }

        const commission = commissionRows[0];

        // Marcar como paga
        const { rows: updatedRows } = await client.query(
          `UPDATE commissions 
           SET status = 'paid', 
               payment_date = NOW(),
               payment_method = $2,
               payment_reference = $3,
               notes = $4,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id, payment_method, payment_reference, notes]
        );

        // Atualizar total de comissões do afiliado
        await client.query(
          `UPDATE affiliates 
           SET total_commission = total_commission + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [commission.amount, commission.affiliate_id]
        );

        return {
          ...updatedRows[0],
          affiliate_name: commission.affiliate_name,
          affiliate_email: commission.affiliate_email
        };
      });

      res.json({
        success: true,
        message: 'Comissão marcada como paga com sucesso',
        data: result
      });

    } catch (error) {
      console.error('Erro ao marcar comissão como paga:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// Estatísticas de comissões
router.get('/stats/summary', 
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { month, year } = req.query;

      let dateFilter = '';
      const params = [];

      if (month && year) {
        dateFilter = 'WHERE EXTRACT(MONTH FROM c.created_at) = $1 AND EXTRACT(YEAR FROM c.created_at) = $2';
        params.push(month, year);
      }

      const { rows } = await pool.query(
        `SELECT 
          COUNT(*) as total_commissions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_commissions,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_commissions,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_commissions,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
          AVG(amount) as avg_commission_amount
        FROM commissions c
        ${dateFilter}`,
        params
      );

      res.json({
        success: true,
        data: rows[0]
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

// Estatísticas por afiliado
router.get('/stats/by-affiliate', 
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
          af.id,
          af.referral_code,
          au.name as affiliate_name,
          au.email as affiliate_email,
          COUNT(c.id) as total_commissions,
          SUM(c.amount) as total_amount,
          SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN c.status = 'pending' THEN c.amount ELSE 0 END) as pending_amount,
          AVG(c.amount) as avg_commission_amount
        FROM affiliates af
        JOIN users au ON af.user_id = au.id
        LEFT JOIN commissions c ON af.id = c.affiliate_id
        GROUP BY af.id, af.referral_code, au.name, au.email
        ORDER BY total_amount DESC NULLS LAST`
      );

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas por afiliado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;
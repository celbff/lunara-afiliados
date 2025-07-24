const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { pool, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Listar agendamentos
router.get('/', 
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite inválido'),
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Status inválido'),
    query('therapist_id').optional().isUUID().withMessage('ID do terapeuta inválido'),
    query('affiliate_id').optional().isUUID().withMessage('ID do afiliado inválido'),
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      // Filtros
      if (req.query.status) {
        whereClause += ` AND b.status = $${paramIndex}`;
        params.push(req.query.status);
        paramIndex++;
      }

      if (req.query.therapist_id) {
        whereClause += ` AND b.therapist_id = $${paramIndex}`;
        params.push(req.query.therapist_id);
        paramIndex++;
      }

      if (req.query.affiliate_id) {
        whereClause += ` AND b.affiliate_id = $${paramIndex}`;
        params.push(req.query.affiliate_id);
        paramIndex++;
      }

      if (req.query.date_from) {
        whereClause += ` AND b.scheduled_date >= $${paramIndex}`;
        params.push(req.query.date_from);
        paramIndex++;
      }

      if (req.query.date_to) {
        whereClause += ` AND b.scheduled_date <= $${paramIndex}`;
        params.push(req.query.date_to);
        paramIndex++;
      }

      // Query principal
      const query = `
        SELECT 
          b.*,
          s.name as service_name,
          s.price as service_price,
          s.duration_minutes,
          tu.name as therapist_name,
          tu.email as therapist_email,
          au.name as affiliate_name,
          au.email as affiliate_email,
          af.referral_code
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN therapists t ON b.therapist_id = t.id
        LEFT JOIN users tu ON t.user_id = tu.id
        LEFT JOIN affiliates af ON b.affiliate_id = af.id
        LEFT JOIN users au ON af.user_id = au.id
        ${whereClause}
        ORDER BY b.scheduled_date DESC, b.scheduled_time DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const { rows } = await pool.query(query, params);

      // Contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM bookings b
        ${whereClause}
      `;

      const { rows: countRows } = await pool.query(countQuery, params.slice(0, -2));
      const total = parseInt(countRows[0].total);

      res.json({
        success: true,
        data: {
          bookings: rows,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Criar agendamento
router.post('/', 
  authenticateToken,
  [
    body('therapist_id').isUUID().withMessage('ID do terapeuta inválido'),
    body('service_id').isUUID().withMessage('ID do serviço inválido'),
    body('client_name').trim().isLength({ min: 2 }).withMessage('Nome do cliente obrigatório'),
    body('client_email').isEmail().withMessage('Email inválido'),
    body('client_phone').optional().trim().isLength({ min: 10 }).withMessage('Telefone inválido'),
    body('scheduled_date').isISO8601().withMessage('Data inválida'),
    body('scheduled_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora inválida'),
    body('affiliate_code').optional().trim().isLength({ min: 1 }).withMessage('Código de afiliado inválido'),
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

      const {
        therapist_id,
        service_id,
        client_name,
        client_email,
        client_phone,
        scheduled_date,
        scheduled_time,
        notes,
        affiliate_code
      } = req.body;

      const result = await transaction(async (client) => {
        // Buscar serviço e preço
        const { rows: serviceRows } = await client.query(
          'SELECT * FROM services WHERE id = $1 AND therapist_id = $2 AND is_active = true',
          [service_id, therapist_id]
        );

        if (serviceRows.length === 0) {
          throw new Error('Serviço não encontrado ou inativo');
        }

        const service = serviceRows[0];

        // Verificar disponibilidade
        const { rows: conflictRows } = await client.query(
          `SELECT id FROM bookings 
           WHERE therapist_id = $1 
           AND scheduled_date = $2 
           AND scheduled_time = $3 
           AND status NOT IN ('cancelled', 'completed')`,
          [therapist_id, scheduled_date, scheduled_time]
        );

        if (conflictRows.length > 0) {
          throw new Error('Horário não disponível');
        }

        // Buscar afiliado se código fornecido
        let affiliate_id = null;
        if (affiliate_code) {
          const { rows: affiliateRows } = await client.query(
            'SELECT id FROM affiliates WHERE referral_code = $1',
            [affiliate_code]
          );

          if (affiliateRows.length > 0) {
            affiliate_id = affiliateRows[0].id;
          }
        }

        // Criar agendamento
        const { rows: bookingRows } = await client.query(
          `INSERT INTO bookings (
             service_id, therapist_id, affiliate_id,
             client_name, client_email, client_phone,
             scheduled_date, scheduled_time, notes,
             total_amount, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW())
           RETURNING *`,
          [
            service_id, therapist_id, affiliate_id,
            client_name, client_email, client_phone,
            scheduled_date, scheduled_time, notes,
            service.price
          ]
        );

        const booking = bookingRows[0];

        // Criar comissão se houver afiliado
        if (affiliate_id) {
          const { rows: affiliateRows } = await client.query(
            'SELECT commission_rate FROM affiliates WHERE id = $1',
            [affiliate_id]
          );

          if (affiliateRows.length > 0) {
            const commissionRate = affiliateRows[0].commission_rate;
            const commissionAmount = (service.price * commissionRate) / 100;

            await client.query(
              `INSERT INTO commissions (affiliate_id, booking_id, amount, percentage, status, created_at)
               VALUES ($1, $2, $3, $4, 'pending', NOW())`,
              [affiliate_id, booking.id, commissionAmount, commissionRate]
            );
          }
        }

        return booking;
      });

      res.status(201).json({
        success: true,
        message: 'Agendamento criado com sucesso',
        data: result
      });

    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// Confirmar agendamento
router.put('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE bookings 
       SET status = 'confirmed', updated_at = NOW() 
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado ou já processado'
      });
    }

    res.json({
      success: true,
      message: 'Agendamento confirmado com sucesso',
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Cancelar agendamento
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { rows } = await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', cancellation_reason = $2, updated_at = NOW() 
       WHERE id = $1 AND status IN ('pending', 'confirmed')
       RETURNING *`,
      [id, reason]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado ou não pode ser cancelado'
      });
    }

    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso',
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
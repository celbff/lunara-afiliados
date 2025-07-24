const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool, transaction } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Listar terapeutas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        t.*,
        u.name,
        u.email,
        u.is_active,
        COUNT(DISTINCT s.id) as total_services,
        COUNT(DISTINCT b.id) as total_bookings,
        AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END) as avg_booking_value
      FROM therapists t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN services s ON t.id = s.therapist_id AND s.is_active = true
      LEFT JOIN bookings b ON t.id = b.therapist_id
      GROUP BY t.id, u.name, u.email, u.is_active
      ORDER BY t.created_at DESC`
    );

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao buscar terapeutas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Buscar terapeuta específico
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        t.*,
        u.name,
        u.email,
        u.is_active
      FROM therapists t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Terapeuta não encontrado'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao buscar terapeuta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Criar terapeuta
router.post('/', 
  authenticateToken,
  requireRole(['admin']),
  [
    body('user_id').isUUID().withMessage('ID do usuário inválido'),
    body('specialty').trim().isLength({ min: 2 }).withMessage('Especialidade obrigatória'),
    body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Biografia muito longa'),
    body('commission_rate').isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão inválida (0-100)')
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

      const { user_id, specialty, bio, commission_rate } = req.body;

      const result = await transaction(async (client) => {
        // Verificar se usuário existe
        const { rows: userRows } = await client.query(
          'SELECT id, name, email FROM users WHERE id = $1',
          [user_id]
        );

        if (userRows.length === 0) {
          throw new Error('Usuário não encontrado');
        }

        // Verificar se já é terapeuta
        const { rows: existingRows } = await client.query(
          'SELECT id FROM therapists WHERE user_id = $1',
          [user_id]
        );

        if (existingRows.length > 0) {
          throw new Error('Usuário já é terapeuta');
        }

        // Criar terapeuta
        const { rows: therapistRows } = await client.query(
          `INSERT INTO therapists (user_id, specialty, bio, commission_rate, is_available, created_at)
           VALUES ($1, $2, $3, $4, true, NOW())
           RETURNING *`,
          [user_id, specialty, bio, commission_rate]
        );

        return therapistRows[0];
      });

      res.status(201).json({
        success: true,
        message: 'Terapeuta criado com sucesso',
        data: result
      });

    } catch (error) {
      console.error('Erro ao criar terapeuta:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

// Atualizar terapeuta
router.put('/:id', 
  authenticateToken,
  requireRole(['admin', 'therapist']),
  [
    body('specialty').optional().trim().isLength({ min: 2 }).withMessage('Especialidade obrigatória'),
    body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Biografia muito longa'),
    body('commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taxa de comissão inválida (0-100)'),
    body('is_available').optional().isBoolean().withMessage('Disponibilidade inválida')
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
      const { specialty, bio, commission_rate, is_available } = req.body;

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (specialty) {
        updateFields.push(`specialty = $${paramIndex}`);
        params.push(specialty);
        paramIndex++;
      }

      if (bio !== undefined) {
        updateFields.push(`bio = $${paramIndex}`);
        params.push(bio);
        paramIndex++;
      }

      if (commission_rate !== undefined) {
        updateFields.push(`commission_rate = $${paramIndex}`);
        params.push(commission_rate);
        paramIndex++;
      }

      if (is_available !== undefined) {
        updateFields.push(`is_available = $${paramIndex}`);
        params.push(is_available);
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
        UPDATE therapists 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const { rows } = await pool.query(query, params);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Terapeuta não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Terapeuta atualizado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar terapeuta:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Buscar disponibilidade do terapeuta
router.get('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Data é obrigatória'
      });
    }

    // Buscar horários ocupados
    const { rows: busySlots } = await pool.query(
      `SELECT scheduled_time, s.duration_minutes
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.therapist_id = $1 
       AND b.scheduled_date = $2 
       AND b.status NOT IN ('cancelled', 'completed')`,
      [id, date]
    );

    // Horários padrão (8h às 18h)
    const defaultSlots = [];
    for (let hour = 8; hour < 18; hour++) {
      defaultSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      defaultSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    // Filtrar horários disponíveis
    const availableSlots = defaultSlots.filter(slot => {
      return !busySlots.some(busy => {
        const busyStart = busy.scheduled_time;
        const busyEnd = new Date(`2000-01-01T${busyStart}`);
        busyEnd.setMinutes(busyEnd.getMinutes() + busy.duration_minutes);
        
        const slotTime = new Date(`2000-01-01T${slot}`);
        const slotEnd = new Date(slotTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + 60); // Assumindo 60 min por slot
        
        return slotTime < busyEnd && slotEnd > new Date(`2000-01-01T${busyStart}`);
      });
    });

    res.json({
      success: true,
      data: {
        date,
        available_slots: availableSlots,
        busy_slots: busySlots.map(slot => slot.scheduled_time)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar disponibilidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
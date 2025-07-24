const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Listar serviços
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { therapist_id } = req.query;

    let query = `
      SELECT 
        s.*,
        t.specialty,
        u.name as therapist_name,
        u.email as therapist_email
      FROM services s
      JOIN therapists t ON s.therapist_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE s.is_active = true
    `;

    const params = [];
    if (therapist_id) {
      query += ' AND s.therapist_id = $1';
      params.push(therapist_id);
    }

    query += ' ORDER BY s.created_at DESC';

    const { rows } = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Buscar serviço específico
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        s.*,
        t.specialty,
        u.name as therapist_name,
        u.email as therapist_email
      FROM services s
      JOIN therapists t ON s.therapist_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE s.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Serviço não encontrado'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao buscar serviço:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Criar serviço
router.post('/', 
  authenticateToken,
  requireRole(['admin', 'therapist']),
  [
    body('therapist_id').isUUID().withMessage('ID do terapeuta inválido'),
    body('name').trim().isLength({ min: 2 }).withMessage('Nome do serviço obrigatório'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Descrição muito longa'),
    body('price').isFloat({ min: 0.01 }).withMessage('Preço inválido'),
    body('duration_minutes').isInt({ min: 15, max: 480 }).withMessage('Duração inválida (15-480 minutos)')
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

      const { therapist_id, name, description, price, duration_minutes } = req.body;

      // Verificar se terapeuta existe
      const { rows: therapistRows } = await pool.query(
        'SELECT id FROM therapists WHERE id = $1',
        [therapist_id]
      );

      if (therapistRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Terapeuta não encontrado'
        });
      }

      // Criar serviço
      const { rows } = await pool.query(
        `INSERT INTO services (therapist_id, name, description, price, duration_minutes, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         RETURNING *`,
        [therapist_id, name, description, price, duration_minutes]
      );

      res.status(201).json({
        success: true,
        message: 'Serviço criado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao criar serviço:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Atualizar serviço
router.put('/:id', 
  authenticateToken,
  requireRole(['admin', 'therapist']),
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Nome do serviço obrigatório'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Descrição muito longa'),
    body('price').optional().isFloat({ min: 0.01 }).withMessage('Preço inválido'),
    body('duration_minutes').optional().isInt({ min: 15, max: 480 }).withMessage('Duração inválida (15-480 minutos)'),
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
      const { name, description, price, duration_minutes, is_active } = req.body;

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        params.push(description);
        paramIndex++;
      }

      if (price !== undefined) {
        updateFields.push(`price = $${paramIndex}`);
        params.push(price);
        paramIndex++;
      }

      if (duration_minutes !== undefined) {
        updateFields.push(`duration_minutes = $${paramIndex}`);
        params.push(duration_minutes);
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
        UPDATE services 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const { rows } = await pool.query(query, params);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Serviço não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Serviço atualizado com sucesso',
        data: rows[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// Excluir serviço
router.delete('/:id', 
  authenticateToken,
  requireRole(['admin', 'therapist']),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar se existem agendamentos ativos
      const { rows: bookingRows } = await pool.query(
        `SELECT COUNT(*) as count 
         FROM bookings 
         WHERE service_id = $1 AND status NOT IN ('cancelled', 'completed')`,
        [id]
      );

      if (parseInt(bookingRows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível excluir serviço com agendamentos ativos'
        });
      }

      // Desativar serviço
      const { rows } = await pool.query(
        `UPDATE services 
         SET is_active = false, updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Serviço não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Serviço desativado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;
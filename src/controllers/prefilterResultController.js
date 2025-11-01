import { PrefilterResult } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateMessageId } from '../utils/validators.js';
import createCsvWriter from 'csv-writer';

export const prefilterResultController = {
  // Get all prefilter results with filtering and pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, maybe_lfg, min_confidence, max_confidence } = req.query;
    const query = {};
    
    if (maybe_lfg !== undefined) query.maybe_lfg = maybe_lfg === 'true';
    if (min_confidence !== undefined) query.confidence = { ...query.confidence, $gte: parseFloat(min_confidence) };
    if (max_confidence !== undefined) query.confidence = { ...query.confidence, $lte: parseFloat(max_confidence) };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [results, total] = await Promise.all([
      PrefilterResult.find(query)
        .sort({ message_date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PrefilterResult.countDocuments(query)
    ]);

    res.json({
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get prefilter result by message_id
  getByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const result = await PrefilterResult.findOne({ message_id: parseInt(message_id, 10) });

    if (!result) {
      return res.status(404).json({ error: 'Prefilter result not found' });
    }

    res.json(result);
  }),

  // Create new prefilter result
  create: handleAsyncError(async (req, res) => {
    const result = new PrefilterResult(req.body);
    await result.save();
    res.status(201).json(result);
  }),

  // Update prefilter result by message_id
  updateByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const result = await PrefilterResult.findOneAndUpdate(
      { message_id: parseInt(message_id, 10) },
      req.body,
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Prefilter result not found' });
    }

    res.json(result);
  }),

  // Delete prefilter result by message_id
  deleteByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const result = await PrefilterResult.findOneAndDelete({ message_id: parseInt(message_id, 10) });

    if (!result) {
      return res.status(404).json({ error: 'Prefilter result not found' });
    }

    res.json({ message: 'Prefilter result deleted successfully' });
  })
};
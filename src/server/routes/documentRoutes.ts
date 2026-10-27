/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireCustomerAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import { supabaseStatementRepo, supabaseAccountRepo, supabaseTransactionRepo, supabaseRAGRepo } from '../db/supabaseRepository.ts';
import { parseCsvStatement, parseExcelStatement, parsePdfStatement, ExtractedTransactionRow } from '../documents/parser.ts';
import { chunkFinancialStatement, globalVectorStore } from '../../lib/rag/index.ts';

export const documentRouter = Router();

// Protect all document routes with authentication
documentRouter.use(requireCustomerAuth);

// Multer memory storage supporting statements up to 50MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
    if (!allowedExtensions.includes(ext)) {
      const err: any = new Error('Unsupported media type. Allowed formats: CSV, XLS, XLSX, PDF.');
      err.statusCode = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * POST /api/documents/upload
 * Accept supported bank statement files and upload to Supabase Storage
 */
documentRouter.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.customer || !req.customer.id) {
      return res.status(401).json({ error: 'Unauthorized: Authenticated customer session is required.' });
    }

    const file = req.file;
    const { accountId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No statement file uploaded.' });
    }

    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      return res.status(400).json({ error: 'Account ID is required to associate this statement.' });
    }

    const account = await supabaseAccountRepo.findById(accountId.trim(), req.customer.id);
    if (!account || !account.id) {
      return res.status(404).json({ error: 'Account not found or access denied.' });
    }

    // Verify file magic bytes / signature for security
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      const header = file.buffer.slice(0, 5).toString('ascii');
      if (!header.startsWith('%PDF')) {
        return res.status(422).json({ error: 'Invalid PDF file. Header signature does not match PDF specification.' });
      }
    } else if (ext === '.xlsx') {
      const header = file.buffer.slice(0, 2).toString('ascii');
      if (header !== 'PK') {
        return res.status(422).json({ error: 'Invalid XLSX file. Header signature does not match OpenXML zip archive.' });
      }
    }

    // Compute SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Upload to Supabase Storage private bucket
    const safeBaseName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_\.\-]/g, '_');
    const storagePath = await supabaseStatementRepo.uploadFileToStorage(
      req.customer.id,
      safeBaseName,
      file.buffer,
      file.mimetype || 'application/octet-stream'
    );

    // Extract raw preview immediately in memory
    let parseResult;
    if (ext === '.csv') {
      parseResult = await parseCsvStatement(file.buffer.toString('utf-8'), req.customer.id);
    } else if (ext === '.xlsx' || ext === '.xls') {
      parseResult = await parseExcelStatement(file.buffer, req.customer.id);
    } else if (ext === '.pdf') {
      parseResult = await parsePdfStatement(file.buffer, req.customer.id);
    }

    const hasRows = Boolean(parseResult?.rows && parseResult.rows.length > 0);
    const previewJson = hasRows ? JSON.stringify(parseResult!.rows) : undefined;
    const initialStatus = parseResult?.isScannedPdf
      ? 'failed'
      : hasRows
      ? (parseResult!.ambiguousRowsCount > 0 ? 'partially_completed' : 'completed')
      : 'uploaded';

    const errorMessage = parseResult?.isScannedPdf
      ? parseResult.errors[0]
      : (!hasRows && parseResult?.errors && parseResult.errors.length > 0 ? parseResult.errors[0] : undefined);

    // Create statement document record in Supabase
    const statement = await supabaseStatementRepo.create(req.customer.id, {
      accountId: account.id,
      fileName: safeBaseName,
      originalName: file.originalname,
      storagePath,
      fileSizeBytes: file.size,
      mimeType: file.mimetype || 'application/octet-stream',
      checksum,
      processingStatus: initialStatus,
      extractedCount: parseResult?.validRowsCount || 0,
      errorMessage,
      rawTextPreview: previewJson,
    });

    if (!statement || !statement.id) {
      return res.status(500).json({ error: 'Failed to record statement document in repository.' });
    }

    return res.status(201).json({
      message: parseResult?.isScannedPdf
        ? 'Statement uploaded. OCR required: Scanned or image-only PDF detected.'
        : 'Statement uploaded successfully to Supabase Storage and registered.',
      document: statement,
      id: statement.id,
      extractedCount: parseResult?.validRowsCount || 0,
      ambiguousCount: parseResult?.ambiguousRowsCount || 0,
      selectedSheet: parseResult?.selectedSheet,
      sheetSelectionReason: parseResult?.sheetSelectionReason,
      isScannedPdf: parseResult?.isScannedPdf || false,
      error: errorMessage,
      detectedProvider: parseResult?.detectedProvider,
      detectedCurrency: parseResult?.detectedCurrency,
    });
  } catch (error: any) {
    console.error('Statement upload error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Failed to upload statement file.' });
  }
});

/**
 * GET /api/documents
 * List all statement documents from Supabase
 */
documentRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documents = await supabaseStatementRepo.listByCustomer(req.customer!.id);
    return res.json({
      documents,
      count: documents.length,
    });
  } catch (error: any) {
    console.error('Error fetching documents from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
});

/**
 * GET /api/documents/:documentId
 * Retrieve specific document metadata and staged preview from Supabase
 */
documentRouter.get('/:documentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = await supabaseStatementRepo.findById(documentId, req.customer!.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    const preview = await supabaseStatementRepo.getExtractedPreview(documentId, req.customer!.id);

    return res.json({
      document,
      preview,
    });
  } catch (error: any) {
    console.error('Error retrieving document from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve document.' });
  }
});

/**
 * POST /api/documents/:documentId/process
 * Stage and validate extracted transaction rows from Supabase (reparsing from storage if preview is missing)
 */
documentRouter.post('/:documentId/process', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.customer || !req.customer.id) {
      return res.status(401).json({ error: 'Unauthorized: Authenticated customer session is required.' });
    }

    const { documentId } = req.params;
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      return res.status(400).json({ error: 'Valid document ID parameter is required.' });
    }

    const document = await supabaseStatementRepo.findById(documentId.trim(), req.customer.id);
    if (!document || !document.id) {
      return res.status(404).json({ error: 'Statement document not found or access denied.' });
    }

    let rows: ExtractedTransactionRow[] | null = await supabaseStatementRepo.getExtractedPreview(documentId.trim(), req.customer.id);

    // If no preview rows staged yet or force reparsing requested, attempt to reparse from storage
    const storagePath = document.storagePath || (document as any).storage_path;
    if ((!rows || rows.length === 0) && storagePath) {
      const fileBuffer = await supabaseStatementRepo.downloadFileFromStorage(storagePath);
      if (fileBuffer) {
        const ext = path.extname(document.fileName || document.originalName).toLowerCase();
        let parseResult;
        if (ext === '.csv') {
          parseResult = await parseCsvStatement(fileBuffer.toString('utf-8'), req.customer.id);
        } else if (ext === '.xlsx' || ext === '.xls') {
          parseResult = await parseExcelStatement(fileBuffer, req.customer.id);
        } else if (ext === '.pdf') {
          parseResult = await parsePdfStatement(fileBuffer, req.customer.id);
        }

        if (parseResult?.isScannedPdf) {
          await supabaseStatementRepo.updateStatus(documentId.trim(), req.customer.id, 'failed', undefined, parseResult.errors[0]);
          const failedDoc = (await supabaseStatementRepo.findById(documentId.trim(), req.customer.id)) || document;
          return res.status(422).json({
            error: parseResult.errors[0],
            isScannedPdf: true,
            document: failedDoc,
            id: failedDoc.id,
          });
        }

        if (parseResult?.rows && parseResult.rows.length > 0) {
          rows = parseResult.rows;
          await supabaseStatementRepo.saveExtractedPreview(documentId.trim(), req.customer.id, rows);
        }
      }
    }

    const effectiveRows = rows || [];
    const validRowsCount = effectiveRows.filter((r: any) => !r.isAmbiguous).length;
    const ambiguousRowsCount = effectiveRows.filter((r: any) => r.isAmbiguous).length;

    const finalStatus = validRowsCount === 0 && document.errorMessage
      ? 'failed'
      : ambiguousRowsCount > 0
      ? 'partially_completed'
      : 'completed';

    await supabaseStatementRepo.updateStatus(documentId.trim(), req.customer.id, finalStatus, { extracted: validRowsCount });
    const updatedDoc = (await supabaseStatementRepo.findById(documentId.trim(), req.customer.id)) || document;

    return res.json({
      message: 'Statement parsed successfully. Review extracted transactions before importing.',
      document: updatedDoc,
      id: updatedDoc.id,
      extractedCount: validRowsCount,
      ambiguousCount: ambiguousRowsCount,
      rows: effectiveRows,
    });
  } catch (error: any) {
    console.error('Statement processing error:', error);
    if (req.customer?.id && req.params.documentId) {
      await supabaseStatementRepo.updateStatus(req.params.documentId, req.customer.id, 'failed', undefined, error.message);
    }
    return res.status(500).json({ error: error.message || 'Failed to process statement.' });
  }
});

/**
 * POST /api/documents/:documentId/import
 * Confirm and import validated extracted transactions with deduplication into Supabase
 */
documentRouter.post('/:documentId/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.customer || !req.customer.id) {
      return res.status(401).json({ error: 'Unauthorized: Authenticated customer session is required.' });
    }

    const { documentId } = req.params;
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      return res.status(400).json({ error: 'Valid document ID parameter is required.' });
    }

    const document = await supabaseStatementRepo.findById(documentId.trim(), req.customer.id);
    if (!document || !document.id) {
      return res.status(404).json({ error: 'Statement document not found or access denied.' });
    }

    // Check duplicate import attempt
    if (document.importedCount > 0 && document.processingStatus === 'completed') {
      return res.status(409).json({
        error: `This statement document ("${document.originalName}") has already been imported (${document.importedCount} transactions recorded).`,
        document,
        id: document.id,
        importedCount: document.importedCount,
        duplicateCount: document.duplicateCount,
      });
    }

    // Target account: allow override from req.body.accountId or fallback to document.accountId
    const rawAccountId = req.body?.accountId || document.accountId;
    if (!rawAccountId || typeof rawAccountId !== 'string' || rawAccountId.trim() === '') {
      return res.status(400).json({ error: 'Account ID is required to import statement transactions.' });
    }

    const targetAccountId = rawAccountId.trim();
    const account = await supabaseAccountRepo.findById(targetAccountId, req.customer.id);
    if (!account || !account.id) {
      return res.status(404).json({ error: 'Target financial account not found or access denied.' });
    }

    let stagedRows: ExtractedTransactionRow[] | null = await supabaseStatementRepo.getExtractedPreview(documentId.trim(), req.customer.id);

    // If client supplied validated rows from preview, use them and persist to staged preview
    if (Array.isArray(req.body?.transactions) && req.body.transactions.length > 0) {
      stagedRows = req.body.transactions.map((r: any) => ({
        date: r.date,
        description: r.description,
        rawDescription: r.rawDescription || r.originalDescription || r.description,
        amount: Number(r.amount),
        type: r.type || (r.direction === 'credit' ? 'credit' : 'debit'),
        categoryId: r.categoryId || '478dea5c-1271-42ae-8183-a968dda771ad',
        categoryName: r.categoryName || r.category || 'General / Other',
        balanceAfter: r.balanceAfter ?? r.balance ?? null,
        isRecurring: Boolean(r.isRecurring),
        isAmbiguous: false,
      }));
      await supabaseStatementRepo.saveExtractedPreview(documentId.trim(), req.customer.id, stagedRows);
    }

    if (!stagedRows || stagedRows.length === 0) {
      return res.status(400).json({
        error: 'No staged transactions found for this document. Please process the document first.',
      });
    }

    const rowsToImport = stagedRows.filter((r) => !r.isAmbiguous && r.amount > 0);

    if (rowsToImport.length === 0) {
      return res.status(400).json({ error: 'No valid non-ambiguous transactions available to import.' });
    }

    const importResult = await supabaseTransactionRepo.createManyWithDeduplication(
      req.customer.id,
      account.id,
      document.id,
      rowsToImport.map((r) => ({
        date: r.date,
        description: r.description,
        rawDescription: r.rawDescription,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        balanceAfter: r.balanceAfter,
        isRecurring: r.isRecurring,
      }))
    );

    await supabaseStatementRepo.updateStatus(
      documentId.trim(),
      req.customer.id,
      'completed',
      {
        imported: importResult.imported,
        duplicate: importResult.duplicates,
      }
    );

    // Ingest chunks into customer-isolated vector store for RAG (non-blocking)
    try {
      const docChunks = chunkFinancialStatement({
        documentId: document.id,
        customerId: req.customer.id,
        documentTitle: document.originalName || document.fileName,
        transactions: rowsToImport.map((r, idx) => ({
          id: `tx-${idx}-${Date.now()}`,
          date: r.date,
          description: r.description,
          originalDescription: r.rawDescription || r.description,
          amount: r.amount,
          debit: r.type === 'debit' ? r.amount : 0,
          credit: r.type === 'credit' ? r.amount : 0,
          direction: r.type,
          category: (r.categoryName || 'General / Other') as any,
          balance: r.balanceAfter ?? null,
          reference: null,
          merchant: null,
          upiHandle: null,
          paymentMethod: 'netbanking',
          confidence: 1.0,
          reviewRequired: false,
          sourceFile: document.originalName,
          sourceSheet: null,
          sourceRow: idx + 1,
        })),
      });
      globalVectorStore.addChunks(req.customer.id, docChunks);
      await supabaseRAGRepo.addChunks(req.customer.id, docChunks);
    } catch (ragErr: any) {
      console.warn('Supabase RAG vector ingestion note:', ragErr.message);
    }

    const updatedDoc = (await supabaseStatementRepo.findById(documentId.trim(), req.customer.id)) || document;

    return res.json({
      message: `Import complete: ${importResult.imported} imported, ${importResult.duplicates} duplicates skipped.`,
      document: updatedDoc,
      id: updatedDoc.id,
      importedCount: importResult.imported,
      duplicateCount: importResult.duplicates,
      transactions: importResult.transactions,
    });
  } catch (error: any) {
    console.error('Statement import error in Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to import statement transactions.' });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Safely delete an owned document and its associated file from Supabase
 */
documentRouter.delete('/:documentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = await supabaseStatementRepo.findById(documentId, req.customer!.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    // Remove from vector stores
    globalVectorStore.removeDocument(req.customer!.id, documentId);
    try {
      await supabaseRAGRepo.removeDocument(req.customer!.id, documentId);
    } catch (ragErr: any) {
      console.warn('Supabase RAG vector removal note:', ragErr.message);
    }

    await supabaseStatementRepo.delete(documentId, req.customer!.id);

    return res.json({
      success: true,
      message: `Document "${document.originalName}" removed from Supabase.`,
    });
  } catch (error: any) {
    console.error('Error deleting document from Supabase:', error);
    return res.status(500).json({ error: 'Failed to delete document.' });
  }
});

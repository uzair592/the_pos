import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import {
  generateTenantBackup,
  generateTenantZipBackup,
  generateTenantExcelBackup,
  generateSampleZipBackup,
  generateTemplateFile,
  restoreTenantBackupFromBuffer,
  getBackupHistory,
} from '../services/backupService.js';
import {
  inspectUploadedFile,
  validateImportRows,
  executeDataImport,
  getImportHistory,
  parseRawFileBuffer,
} from '../services/dataImportService.js';

async function getDefaultBranchId(tenantId: string): Promise<string> {
  try {
    const { rows } = await query('SELECT id FROM branches WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1', [tenantId], { tenantId });
    return rows[0]?.id || '';
  } catch (_) {
    return '';
  }
}

export async function backupRoutes(fastify: FastifyInstance) {
  // Apply authentication to all backup & import endpoints
  fastify.addHook('preHandler', authenticate);

  // ==========================================
  // 1. BACKUP EXPORT & DOWNLOAD ENDPOINTS
  // ==========================================

  /**
   * Download Standard Native ZIP Backup
   */
  fastify.get('/api/restaurant/backups/export/zip', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const { buffer, fileName } = await generateTenantZipBackup(
        tenantId,
        req.user!.id,
        req.user!.fullName || 'Staff'
      );
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to generate ZIP backup' });
    }
  });

  /**
   * Download JSON Backup
   */
  fastify.get('/api/restaurant/backups/export/json', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const { package: backupPkg, fileName } = await generateTenantBackup(
        tenantId,
        req.user!.id,
        req.user!.fullName || 'Staff'
      );
      const jsonBuf = Buffer.from(JSON.stringify(backupPkg, null, 2), 'utf-8');
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', jsonBuf.length);
      return reply.send(jsonBuf);
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to generate JSON backup' });
    }
  });

  /**
   * Download Multi-Sheet Excel Backup (.xlsx)
   */
  fastify.get('/api/restaurant/backups/export/excel', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const { buffer, fileName } = await generateTenantExcelBackup(
        tenantId,
        req.user!.id,
        req.user!.fullName || 'Staff'
      );
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to generate Excel backup' });
    }
  });

  /**
   * Trigger backup creation and get summary
   */
  fastify.post('/api/restaurant/backups/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    const { format = 'zip' } = (req.body as any) || {};

    try {
      if (format === 'zip') {
        const result = await generateTenantZipBackup(tenantId, req.user!.id, req.user!.fullName || 'Staff');
        return reply.send({
          success: true,
          fileName: result.fileName,
          fileSize: result.buffer.length,
          checksum: result.checksum,
          recordCounts: result.recordCounts,
          downloadUrl: '/api/restaurant/backups/export/zip',
        });
      } else {
        const result = await generateTenantBackup(tenantId, req.user!.id, req.user!.fullName || 'Staff');
        return reply.send({
          success: true,
          fileName: result.fileName,
          checksum: result.package.metadata.checksum,
          recordCounts: result.package.metadata.recordCounts,
          downloadUrl: '/api/restaurant/backups/export/json',
        });
      }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate backup' });
    }
  });

  // ==========================================
  // 2. SAMPLE FORMAT & TEMPLATES ENDPOINTS
  // ==========================================

  /**
   * Download Full Sample Backup (.zip)
   */
  fastify.get('/api/restaurant/backups/samples/full-zip', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { buffer, fileName } = generateSampleZipBackup();
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate sample zip' });
    }
  });

  /**
   * Download Clean Template Files (.xlsx or .csv)
   */
  fastify.get('/api/restaurant/backups/templates/:entity', async (req: FastifyRequest, reply: FastifyReply) => {
    const { entity } = req.params as { entity: string };
    const { format = 'xlsx' } = req.query as { format?: 'xlsx' | 'csv' };

    const validEntities: Record<string, 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'PURCHASES' | 'CUSTOMERS'> = {
      inventory: 'INVENTORY',
      menu: 'MENU',
      suppliers: 'SUPPLIERS',
      purchases: 'PURCHASES',
      customers: 'CUSTOMERS',
    };

    const entityType = validEntities[entity.toLowerCase()];
    if (!entityType) {
      return reply.status(400).send({ error: `Invalid entity type: ${entity}. Valid types: inventory, menu, suppliers, purchases, customers` });
    }

    try {
      const { buffer, fileName, mimeType } = generateTemplateFile(entityType, format === 'csv' ? 'csv' : 'xlsx');
      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate template' });
    }
  });

  // ==========================================
  // 3. RESTORE BACKUP ENDPOINTS
  // ==========================================

  /**
   * Restore Native Backup from Multipart File Upload or Base64 / JSON Body
   */
  fastify.post('/api/restaurant/backups/restore', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    let fileBuffer: Buffer | null = null;

    if (req.isMultipart()) {
      const data = await (req as any).file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }
      fileBuffer = await data.toBuffer();
    } else {
      const body = req.body as any;
      if (body?.fileBase64) {
        fileBuffer = Buffer.from(body.fileBase64, 'base64');
      } else if (body?.metadata && body?.data) {
        // Direct BackupPackage JSON
        fileBuffer = Buffer.from(JSON.stringify(body), 'utf-8');
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return reply.status(400).send({ error: 'Invalid or missing backup file payload' });
    }

    try {
      const result = await restoreTenantBackupFromBuffer(
        tenantId,
        fileBuffer,
        req.user!.id,
        req.user!.fullName || 'Restaurant Staff',
        { mode: 'FULL' }
      );
      return reply.send(result);
    } catch (err: any) {
      req.log.error(err);
      return reply.status(400).send({ error: err.message || 'Failed to restore backup' });
    }
  });

  /**
   * Get Backup History List
   */
  fastify.get('/api/restaurant/backups/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const backups = await getBackupHistory(tenantId);
      return reply.send({ backups });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch backup history' });
    }
  });

  // ==========================================
  // 4. PREVIOUS POS SOFTWARE IMPORT ENDPOINTS
  // ==========================================

  /**
   * Step 1 & 2: Inspect uploaded file, detect sheets, entity type & suggest column mappings
   */
  fastify.post('/api/restaurant/imports/inspect', async (req: FastifyRequest, reply: FastifyReply) => {
    let fileBuffer: Buffer | null = null;
    let fileName = 'uploaded_file';

    if (req.isMultipart()) {
      const data = await (req as any).file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }
      fileName = data.filename;
      fileBuffer = await data.toBuffer();
    } else {
      const body = req.body as any;
      if (body?.fileBase64) {
        fileBuffer = Buffer.from(body.fileBase64, 'base64');
        fileName = body.fileName || 'uploaded_file';
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return reply.status(400).send({ error: 'Invalid or empty file payload' });
    }

    try {
      const inspection = await inspectUploadedFile(fileBuffer, fileName);
      return reply.send({
        success: true,
        fileSize: fileBuffer.length,
        ...inspection,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to parse and inspect file' });
    }
  });

  /**
   * Step 4: Validate mapped rows, detect missing fields, and flag potential duplicates
   */
  fastify.post('/api/restaurant/imports/validate', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    const body = req.body as {
      fileBase64?: string;
      fileName?: string;
      sheetName?: string;
      rawRows?: Record<string, any>[];
      entityType: 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'CUSTOMERS';
      columnMapping: Record<string, string>;
    };

    if (!body.entityType || !body.columnMapping) {
      return reply.status(400).send({ error: 'entityType and columnMapping are required' });
    }

    let rows = body.rawRows;
    if (!rows && body.fileBase64) {
      const buf = Buffer.from(body.fileBase64, 'base64');
      const parsed = parseRawFileBuffer(buf, body.fileName || 'file.xlsx');
      const sheet = parsed.sheets.find((s) => s.name === body.sheetName) || parsed.sheets[0];
      rows = sheet?.rows || [];
    }

    if (!rows || rows.length === 0) {
      return reply.status(400).send({ error: 'No data rows found for validation' });
    }

    try {
      const validation = await validateImportRows(tenantId, body.entityType, rows, body.columnMapping);
      return reply.send({
        success: true,
        entityType: body.entityType,
        ...validation,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to validate import data' });
    }
  });

  /**
   * Step 5 & 6: Execute transactional import with chosen strategy
   */
  fastify.post('/api/restaurant/imports/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    const body = req.body as {
      fileBase64?: string;
      fileName?: string;
      fileFormat?: string;
      sheetName?: string;
      rawRows?: Record<string, any>[];
      entityType: 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'CUSTOMERS';
      columnMapping: Record<string, string>;
      strategy: 'CREATE_NEW' | 'UPDATE_MATCHING' | 'SKIP_DUPLICATES';
    };

    if (!body.entityType || !body.columnMapping || !body.strategy) {
      return reply.status(400).send({ error: 'entityType, columnMapping, and strategy are required' });
    }

    let rows = body.rawRows;
    if (!rows && body.fileBase64) {
      const buf = Buffer.from(body.fileBase64, 'base64');
      const parsed = parseRawFileBuffer(buf, body.fileName || 'file.xlsx');
      const sheet = parsed.sheets.find((s) => s.name === body.sheetName) || parsed.sheets[0];
      rows = sheet?.rows || [];
    }

    if (!rows || rows.length === 0) {
      return reply.status(400).send({ error: 'No data rows provided to import' });
    }

    try {
      const branchId = req.user?.branchId || (await getDefaultBranchId(tenantId));
      const result = await executeDataImport(
        tenantId,
        branchId,
        req.user!.id,
        {
          entityType: body.entityType,
          rawRows: rows,
          columnMapping: body.columnMapping,
          strategy: body.strategy,
          fileName: body.fileName || 'migration_file',
          fileFormat: body.fileFormat || 'XLSX',
        }
      );
      return reply.send(result);
    } catch (err: any) {
      req.log.error(err);
      return reply.status(400).send({ error: err.message || 'Import execution failed' });
    }
  });

  /**
   * View Previous POS Import History & Errors
   */
  fastify.get('/api/restaurant/imports/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const history = await getImportHistory(tenantId);
      return reply.send({ imports: history });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch import history' });
    }
  });
}

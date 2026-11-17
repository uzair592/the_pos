import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../common/Modal.js';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FolderArchive,
  ShieldCheck,
  Layers,
  Sparkles,
  FileCheck,
  Info,
} from 'lucide-react';

interface BackupRestoreHubProps {
  tenant: any;
  onRefresh?: () => void;
}

export const BackupRestoreHub: React.FC<BackupRestoreHubProps> = ({ tenant, onRefresh }) => {
  const { success, error, info } = useToast();

  // Active view / subtab
  const [activeSubTab, setActiveSubTab] = useState<'NATIVE' | 'IMPORT_WIZARD' | 'TEMPLATES' | 'HISTORY'>('NATIVE');

  // Loading states
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // History states
  const [backupsHistory, setBackupsHistory] = useState<any[]>([]);
  const [importsHistory, setImportsHistory] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'BACKUPS' | 'IMPORTS'>('BACKUPS');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Native Restore modal states
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFileSummary, setRestoreFileSummary] = useState<any | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Import Wizard states (6 Steps)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'CUSTOMERS'>('INVENTORY');
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [importStrategy, setImportStrategy] = useState<'CREATE_NEW' | 'UPDATE_MATCHING' | 'SKIP_DUPLICATES'>('UPDATE_MATCHING');
  const [executingImport, setExecutingImport] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [selectedErrorLog, setSelectedErrorLog] = useState<any | null>(null);

  // Fetch histories on mount
  const fetchHistories = async () => {
    setLoadingHistory(true);
    try {
      const [bRes, iRes] = await Promise.all([
        api.get('/restaurant/backups/history').catch(() => ({ backups: [] })),
        api.get('/restaurant/imports/history').catch(() => ({ imports: [] })),
      ]);
      setBackupsHistory(bRes.backups || []);
      setImportsHistory(iRes.imports || []);
    } catch (err: any) {
      console.warn('Failed to load histories:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistories();
  }, []);

  // Utility to download files with authentication header
  const triggerAuthDownload = async (url: string, defaultName: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errJson.error || 'Failed to download file');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = defaultName;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      success(`Downloaded ${filename} successfully!`);
    } catch (err: any) {
      error(err.message || 'Download failed');
    }
  };

  // 1. Export Handlers
  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      await triggerAuthDownload(
        '/api/restaurant/backups/export/zip',
        `restaurant_backup_${tenant?.name?.replace(/\s+/g, '_') || 'backup'}.zip`
      );
      fetchHistories();
    } finally {
      setExportingZip(false);
    }
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      await triggerAuthDownload(
        '/api/restaurant/backups/export/json',
        `restaurant_backup_${tenant?.name?.replace(/\s+/g, '_') || 'backup'}.json`
      );
      fetchHistories();
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await triggerAuthDownload(
        '/api/restaurant/backups/export/excel',
        `restaurant_export_${tenant?.name?.replace(/\s+/g, '_') || 'backup'}.xlsx`
      );
    } finally {
      setExportingExcel(false);
    }
  };

  // 2. Native Restore Handlers
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip') && !file.name.endsWith('.json')) {
      error('Please select a valid native backup archive (.zip or .json)');
      return;
    }

    setRestoreFile(file);
    setRestoreFileSummary({
      fileName: file.name,
      fileSize: file.size,
      isZip: file.name.endsWith('.zip'),
    });
    setRestoreConfirmText('');
    setIsRestoreModalOpen(true);
    e.target.value = '';
  };

  const handleExecuteRestore = async () => {
    if (restoreConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      error('Please type CONFIRM to authorize restoring this backup');
      return;
    }
    if (!restoreFile) return;

    setRestoring(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuf = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const res = await api.post('/restaurant/backups/restore', {
            fileBase64: base64,
            fileName: restoreFile.name,
          });

          success(res.message || 'Restaurant backup restored successfully!');
          setIsRestoreModalOpen(false);
          fetchHistories();
          if (onRefresh) onRefresh();
        } catch (postErr: any) {
          error(postErr.message || 'Restoration failed');
        } finally {
          setRestoring(false);
        }
      };
      reader.onerror = () => {
        error('Failed to read file from disk');
        setRestoring(false);
      };
      reader.readAsArrayBuffer(restoreFile);
    } catch (err: any) {
      error(err.message || 'Restore failed');
      setRestoring(false);
    }
  };

  // 3. Import Wizard Handlers
  const handleWizardFileSelected = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.json', '.zip'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      error('Unsupported format. Please upload an Excel (.xlsx), CSV (.csv), or JSON file.');
      return;
    }

    setImportFile(file);
    setUploadingFile(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuf = reader.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          setFileBase64(base64);

          // Call inspect API
          const inspectRes = await api.post('/restaurant/imports/inspect', {
            fileBase64: base64,
            fileName: file.name,
          });

          setInspectionResult(inspectRes);
          const firstSheet = inspectRes.sheetNames?.[0] || 'Sheet1';
          setSelectedSheet(firstSheet);

          // Detect entity type
          const detected = (inspectRes.detectedEntity || 'INVENTORY') as any;
          setSelectedEntity(['INVENTORY', 'MENU', 'SUPPLIERS', 'CUSTOMERS'].includes(detected) ? detected : 'INVENTORY');

          // Initialize column mappings from suggested
          setColumnMappings(inspectRes.suggestedMappings || {});
          setWizardStep(2);
          success('File inspected successfully!');
        } catch (apiErr: any) {
          error(apiErr.message || 'Inspection failed');
        } finally {
          setUploadingFile(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      error(err.message || 'Failed to read file');
      setUploadingFile(false);
    }
  };

  const handleRunValidation = async () => {
    setValidating(true);
    try {
      const res = await api.post('/restaurant/imports/validate', {
        fileBase64,
        fileName: importFile?.name,
        sheetName: selectedSheet,
        entityType: selectedEntity,
        columnMapping: columnMappings,
      });

      setValidationResult(res);
      setWizardStep(4);
      success(`Validation completed: ${res.validRecords} of ${res.totalRecords} records are valid.`);
    } catch (err: any) {
      error(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    setExecutingImport(true);
    try {
      const res = await api.post('/restaurant/imports/execute', {
        fileBase64,
        fileName: importFile?.name,
        fileFormat: inspectionResult?.format || 'XLSX',
        sheetName: selectedSheet,
        entityType: selectedEntity,
        columnMapping: columnMappings,
        strategy: importStrategy,
      });

      setExecutionResult(res);
      setWizardStep(6);
      success(`Import finished: ${res.successCount} created, ${res.updatedCount} updated.`);
      fetchHistories();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      error(err.message || 'Import execution failed');
    } finally {
      setExecutingImport(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setImportFile(null);
    setFileBase64('');
    setInspectionResult(null);
    setValidationResult(null);
    setExecutionResult(null);
    setColumnMappings({});
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-3 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 rounded-xl text-brand-600 dark:text-brand-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Backup, Restore & Migration Hub</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full">
                  Format v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Safeguard your restaurant database with complete cryptographic snapshot backups or migrate existing data (Inventory, Menu, Suppliers, Customers) from previous POS systems.
              </p>
            </div>
          </div>

          {/* Quick Sub-navigation */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('NATIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'NATIVE'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Native Backup & Restore
            </button>
            <button
              onClick={() => setActiveSubTab('IMPORT_WIZARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'IMPORT_WIZARD'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Previous POS Migration Wizard
            </button>
            <button
              onClick={() => setActiveSubTab('TEMPLATES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'TEMPLATES'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Sample & Templates
            </button>
            <button
              onClick={() => setActiveSubTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'HISTORY'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Audit History ({backupsHistory.length + importsHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: NATIVE BACKUP & RESTORE */}
      {/* ========================================================= */}
      {activeSubTab === 'NATIVE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: Create & Download Native Backup */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                <FolderArchive className="w-4 h-4 text-brand-600" />
                <span>1. Create Full Restaurant Backup</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Generate a full cryptographic snapshot of your restaurant. All categories, menu items, ingredients, UOMs, FIFO batches, supplier ledgers, orders, payments, expenses, and settings are preserved in verified JSON or ZIP archives.
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Multi-File Package (v1.0 Standard)</span>
                </div>
                <p>
                  Includes <code className="text-brand-600 font-mono">manifest.json</code>, SHA-256 checksum, and individual table datasets.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2.5">
              <button
                onClick={handleExportZip}
                disabled={exportingZip}
                className="flex items-center space-x-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{exportingZip ? 'Creating ZIP...' : 'Download Full Backup (.zip)'}</span>
              </button>

              <button
                onClick={handleExportJson}
                disabled={exportingJson}
                className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>{exportingJson ? 'Exporting...' : 'JSON Backup'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{exportingExcel ? 'Exporting...' : 'Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* Card B: Restore Native Backup */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>2. Restore Native Backup</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Restore a previously created backup file for this restaurant. The system performs pre-restore verification, verifies the checksum, and generates an automatic pre-restore safety snapshot before committing any changes.
              </p>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Safety Pre-Restore Snapshot</span>
                </div>
                <p>
                  Your existing database will be snapshotted automatically before restoration begins. If any error occurs, the transaction rolls back cleanly.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all w-full">
                <Upload className="w-4 h-4" />
                <span>Select Native Backup File (.zip or .json)</span>
                <input
                  type="file"
                  accept=".zip,.json"
                  className="hidden"
                  onChange={handleRestoreFileSelected}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: PREVIOUS POS SOFTWARE MIGRATION WIZARD */}
      {/* ========================================================= */}
      {activeSubTab === 'IMPORT_WIZARD' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          {/* Wizard Step Indicator */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span>Previous POS Software Data Migration Wizard</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Migrate your menu, inventory, suppliers, or customer records from Excel or CSV files exported by other restaurant software.
                </p>
              </div>

              {wizardStep > 1 && (
                <button
                  onClick={resetWizard}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-semibold"
                >
                  Start Over
                </button>
              )}
            </div>

            {/* Stepper bar */}
            <div className="flex items-center space-x-2 mt-4 text-xs font-semibold">
              {[
                { num: 1, label: 'Upload' },
                { num: 2, label: 'Entity & Sheet' },
                { num: 3, label: 'Map Columns' },
                { num: 4, label: 'Validate' },
                { num: 5, label: 'Strategy' },
                { num: 6, label: 'Import' },
              ].map((step, idx) => (
                <React.Fragment key={step.num}>
                  <div
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all ${
                      wizardStep === step.num
                        ? 'bg-brand-600 text-white font-bold shadow-sm'
                        : wizardStep > step.num
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/10">
                      {wizardStep > step.num ? '✓' : step.num}
                    </span>
                    <span>{step.label}</span>
                  </div>
                  {idx < 5 && <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-800" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* STEP 1: Upload File */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 rounded-2xl p-10 text-center flex flex-col items-center justify-center transition-all bg-slate-50/50 dark:bg-slate-800/30">
                <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950/50 rounded-full flex items-center justify-center text-brand-600 mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Upload Previous Software File
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-4">
                  Drag and drop your spreadsheet or backup file here. We support <strong>.xlsx</strong>, <strong>.csv</strong>, and <strong>.json</strong> files exported from any restaurant management system.
                </p>

                <label className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all">
                  <span>{uploadingFile ? 'Analyzing File...' : 'Browse Computer'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.json,.zip"
                    className="hidden"
                    disabled={uploadingFile}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleWizardFileSelected(f);
                    }}
                  />
                </label>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start space-x-2.5 text-[11px] text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-bold">Need a template to format your data?</p>
                  <p className="mt-0.5">
                    Click the <strong>Sample & Templates</strong> tab above to download pre-formatted Excel or CSV templates for Inventory, Menu, Suppliers, and Customers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Entity & Sheet Selection */}
          {wizardStep === 2 && inspectionResult && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Uploaded File: {inspectionResult.fileName}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Format: {inspectionResult.format} • Size: {Math.round(inspectionResult.fileSize / 1024)} KB • Sheets Detected: {inspectionResult.sheetNames?.length || 1}
                  </p>
                </div>
                <div className="px-3 py-1 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold border border-brand-200 dark:border-brand-900">
                  Auto-Detected: {inspectionResult.detectedEntity}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Entity Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    What data are you migrating?
                  </label>
                  <select
                    value={selectedEntity}
                    onChange={(e) => setSelectedEntity(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="INVENTORY">📦 Inventory Items (Raw materials, UOMs, Opening Stock)</option>
                    <option value="MENU">🍽️ Menu Products (Pizzas, burgers, sides, prices, categories)</option>
                    <option value="SUPPLIERS">🏢 Suppliers & Vendors (Names, phones, addresses)</option>
                    <option value="CUSTOMERS">👥 Customer Directory (Names, phones, addresses, loyalty)</option>
                  </select>
                </div>

                {/* Sheet Selector (for Excel) */}
                {inspectionResult.sheetNames && inspectionResult.sheetNames.length > 1 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      Select Worksheet / Tab:
                    </label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      {inspectionResult.sheetNames.map((s: string) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Sample preview of detected rows */}
              <div>
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">
                  Sample Data Rows from File:
                </h5>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto max-h-48">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
                      <tr>
                        {inspectionResult.availableColumns?.map((col: string) => (
                          <th key={col} className="px-3 py-2 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[10px]">
                      {inspectionResult.previewRows?.slice(0, 3).map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {inspectionResult.availableColumns?.map((col: string) => (
                            <td key={col} className="px-3 py-1.5 whitespace-nowrap truncate max-w-[160px]">
                              {String(r[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  <span>Proceed to Column Mapping</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Column Mapping */}
          {wizardStep === 3 && inspectionResult && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Map Your File Columns to Restaurant POS Fields
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verify that each column in your previous software file correctly connects to the corresponding POS field.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-brand-600">
                  Target Entity: {selectedEntity}
                </div>
              </div>

              {/* Column Mapping Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Previous Software Column</th>
                      <th className="px-4 py-2.5">Mapped Restaurant POS Field</th>
                      <th className="px-4 py-2.5">Sample Value Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inspectionResult.availableColumns?.map((col: string) => {
                      const sampleVal = inspectionResult.previewRows?.[0]?.[col] ?? '—';
                      const currentTarget = columnMappings[col] || '';

                      return (
                        <tr key={col} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                            {col}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={currentTarget}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnMappings((prev) => {
                                  const updated = { ...prev };
                                  if (val) updated[col] = val;
                                  else delete updated[col];
                                  return updated;
                                });
                              }}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                            >
                              <option value="">— Do Not Import (Ignore) —</option>
                              {selectedEntity === 'INVENTORY' && (
                                <>
                                  <option value="name">Item Name * (Required)</option>
                                  <option value="category">Category</option>
                                  <option value="sku">SKU / Barcode</option>
                                  <option value="unit">Unit of Measure (kg, pcs, litres, etc.) *</option>
                                  <option value="purchasePrice">Purchase Price (Cost) *</option>
                                  <option value="openingStock">Opening Stock Level</option>
                                  <option value="minStockAlert">Min Stock Alert Threshold</option>
                                  <option value="notes">Notes / Storage Info</option>
                                </>
                              )}
                              {selectedEntity === 'MENU' && (
                                <>
                                  <option value="name">Menu Item Name * (Required)</option>
                                  <option value="category">Menu Category * (Required)</option>
                                  <option value="basePrice">Selling Price (Base Price) *</option>
                                  <option value="description">Description</option>
                                  <option value="taxRate">Tax Rate (%)</option>
                                  <option value="sku">SKU / Code</option>
                                </>
                              )}
                              {selectedEntity === 'SUPPLIERS' && (
                                <>
                                  <option value="name">Supplier / Vendor Name * (Required)</option>
                                  <option value="contactPerson">Contact Person</option>
                                  <option value="phone">Phone Number</option>
                                  <option value="email">Email Address</option>
                                  <option value="address">Physical Address</option>
                                  <option value="taxNumber">Tax / NTN Number</option>
                                  <option value="paymentTerms">Payment Terms</option>
                                </>
                              )}
                              {selectedEntity === 'CUSTOMERS' && (
                                <>
                                  <option value="name">Customer Full Name * (Required)</option>
                                  <option value="phone">Phone Number</option>
                                  <option value="email">Email Address</option>
                                  <option value="address">Delivery / Billing Address</option>
                                  <option value="loyaltyPoints">Opening Loyalty Points</option>
                                </>
                              )}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 truncate max-w-[200px]">
                            {String(sampleVal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={handleRunValidation}
                  disabled={validating}
                  className="flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <span>{validating ? 'Validating Records...' : 'Validate Data'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Validation Summary */}
          {wizardStep === 4 && validationResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total Rows</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{validationResult.totalRecords}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">Valid Records</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{validationResult.validRecords}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 text-center">
                  <p className="text-[10px] text-rose-700 dark:text-rose-400 font-bold uppercase">Errors Found</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{validationResult.errorRecords}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900 text-center">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">Potential Duplicates</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{validationResult.duplicateRecords}</p>
                </div>
              </div>

              {/* Validation Issues List if any */}
              {validationResult.issues && validationResult.issues.length > 0 ? (
                <div>
                  <h5 className="font-bold text-xs text-rose-700 dark:text-rose-400 mb-2 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Row Validation Issues Detected ({validationResult.issues.length})</span>
                  </h5>
                  <div className="border border-rose-200 dark:border-rose-900/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-semibold sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5">Row</th>
                          <th className="px-3 py-1.5">Field</th>
                          <th className="px-3 py-1.5">Issue Reason</th>
                          <th className="px-3 py-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-950 font-mono text-[10px]">
                        {validationResult.issues.slice(0, 50).map((iss: any, idx: number) => (
                          <tr key={idx} className="hover:bg-rose-50/50">
                            <td className="px-3 py-1.5 font-bold">#{iss.row}</td>
                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{iss.field}</td>
                            <td className="px-3 py-1.5 text-rose-600 dark:text-rose-400">{iss.message}</td>
                            <td className="px-3 py-1.5 text-slate-400 truncate max-w-[120px]">{String(iss.value ?? '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All rows passed verification! Data is clean and ready to import.</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Back to Mapping
                </button>
                <button
                  onClick={() => setWizardStep(5)}
                  className="flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  <span>Select Import Strategy</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Strategy Selection */}
          {wizardStep === 5 && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Choose Migration Handling Strategy
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select how this POS software handles items that match records already in your restaurant database:
                </p>
              </div>

              <div className="space-y-3">
                <label
                  className={`flex items-start space-x-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    importStrategy === 'UPDATE_MATCHING'
                      ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value="UPDATE_MATCHING"
                    checked={importStrategy === 'UPDATE_MATCHING'}
                    onChange={() => setImportStrategy('UPDATE_MATCHING')}
                    className="mt-0.5 text-brand-600"
                  />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                      Update Matching Records (Recommended)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      If an item with matching name or SKU already exists in this restaurant, update its price, category, and unit. All new items will be inserted cleanly.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    importStrategy === 'SKIP_DUPLICATES'
                      ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value="SKIP_DUPLICATES"
                    checked={importStrategy === 'SKIP_DUPLICATES'}
                    onChange={() => setImportStrategy('SKIP_DUPLICATES')}
                    className="mt-0.5 text-brand-600"
                  />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                      Skip Existing Records (Safe Mode)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Only insert records that do not exist yet. Existing items and their stock balances will remain completely untouched.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    importStrategy === 'CREATE_NEW'
                      ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value="CREATE_NEW"
                    checked={importStrategy === 'CREATE_NEW'}
                    onChange={() => setImportStrategy('CREATE_NEW')}
                    className="mt-0.5 text-brand-600"
                  />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                      Create As New Always
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Inserts every row as a new record, generating new unique internal identifiers and barcode SKUs if necessary.
                    </p>
                  </div>
                </label>
              </div>

              {selectedEntity === 'INVENTORY' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inventory Opening Stock Rule</span>
                  </div>
                  <p>
                    Opening stock will be recorded cleanly as <strong className="font-mono text-brand-600">OPENING_STOCK</strong> in branch stock levels and active FIFO batch lots. No synthetic or fake purchase orders will be fabricated.
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={executingImport}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  <span>{executingImport ? 'Executing Migration...' : 'Execute Import Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Completion Report */}
          {wizardStep === 6 && executionResult && (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Migration Completed Successfully!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your previous POS software data has been processed and committed to the database.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-center text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Processed</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{executionResult.totalProcessed}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Created</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{executionResult.successCount}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900">
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold">Updated</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{executionResult.updatedCount || 0}</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Skipped</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-0.5">{executionResult.skippedCount || 0}</p>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={resetWizard}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                >
                  Import Another File
                </button>
                <a
                  href={selectedEntity === 'INVENTORY' ? '/app/inventory' : '/app/menu'}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
                >
                  <span>View in {selectedEntity === 'INVENTORY' ? 'Inventory Overview' : 'Menu Management'}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: DOWNLOAD SAMPLE & ENTITY TEMPLATES */}
      {/* ========================================================= */}
      {activeSubTab === 'TEMPLATES' && (
        <div className="space-y-6">
          {/* Sample Full Backup Box */}
          <div className="bg-gradient-to-r from-brand-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FolderArchive className="w-5 h-5 text-brand-400" />
                <h4 className="font-bold text-sm">Download Official Sample Backup Archive (.zip)</h4>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                Inspect a real, pre-filled sample ZIP backup featuring Delight Pizza & Bistro demo data, manifest.json, categories, menu items, raw ingredients, suppliers, recipes, and sample orders.
              </p>
            </div>

            <button
              onClick={() => triggerAuthDownload('/api/restaurant/backups/samples/full-zip', 'sample_restaurant_backup.zip')}
              className="bg-brand-500 hover:bg-brand-400 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download sample_restaurant_backup.zip</span>
            </button>
          </div>

          {/* Migration Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                entity: 'inventory',
                title: 'Inventory Items Template',
                description: 'Raw materials, ingredients, current opening stock, standard UOMs, and reorder alerts.',
                columns: 'Item Name, Category, SKU, Unit, Purchase Price, Opening Stock, Min Stock Alert',
              },
              {
                entity: 'menu',
                title: 'Menu Products Template',
                description: 'Customer menu catalog, public names, selling prices, food categories, and tax rates.',
                columns: 'Item Name, Category, Base Price, Description, Tax Rate, SKU',
              },
              {
                entity: 'suppliers',
                title: 'Suppliers & Vendors Template',
                description: 'Approved vendor directory, phone numbers, contact representatives, and terms.',
                columns: 'Supplier Name, Contact Person, Phone, Email, Address, Tax Number, Payment Terms',
              },
              {
                entity: 'purchases',
                title: 'Historical Purchases Template',
                description: 'Vendor invoices, purchased items, received quantities, and unit purchase rates.',
                columns: 'Supplier Name, Item Name, Quantity, Unit, Unit Price, Invoice Number, Purchase Date',
              },
              {
                entity: 'customers',
                title: 'Customers Directory Template',
                description: 'Customer database, mobile numbers, delivery addresses, and loyalty rewards points.',
                columns: 'Customer Name, Phone, Email, Address, Loyalty Points',
              },
            ].map((tpl) => (
              <div
                key={tpl.entity}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{tpl.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {tpl.description}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg truncate">
                    Columns: {tpl.columns}
                  </p>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() =>
                      triggerAuthDownload(
                        `/api/restaurant/backups/templates/${tpl.entity}?format=xlsx`,
                        `template_${tpl.entity}.xlsx`
                      )
                    }
                    className="flex-1 flex items-center justify-center space-x-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 py-1.5 rounded-lg text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerAuthDownload(
                        `/api/restaurant/backups/templates/${tpl.entity}?format=csv`,
                        `template_${tpl.entity}.csv`
                      )
                    }
                    className="flex-1 flex items-center justify-center space-x-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 py-1.5 rounded-lg text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Standard Units Reference Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
              <Info className="w-4 h-4 text-brand-600" />
              <span>Standard Accepted Units of Measure (UOM)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              When migrating inventory items, use these recognized units to ensure seamless recipe costing and stock deduction:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {['kg (kilograms)', 'grams (g)', 'litres (L)', 'ml (millilitres)', 'pieces (pcs)', 'portions', 'cans', 'bottles', 'boxes'].map(
                (u) => (
                  <span
                    key={u}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    {u}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: AUDIT HISTORY LEDGER */}
      {/* ========================================================= */}
      {activeSubTab === 'HISTORY' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setHistoryTab('BACKUPS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  historyTab === 'BACKUPS'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Native Backups ({backupsHistory.length})
              </button>
              <button
                onClick={() => setHistoryTab('IMPORTS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  historyTab === 'IMPORTS'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Previous Software Imports ({importsHistory.length})
              </button>
            </div>

            <button
              onClick={fetchHistories}
              disabled={loadingHistory}
              className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          {/* BACKUPS HISTORY TABLE */}
          {historyTab === 'BACKUPS' && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Backup Name / File</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Size</th>
                    <th className="px-4 py-2.5">Triggered By</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {backupsHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                        No native backups recorded yet. Click "Create Full Backup" to generate one.
                      </td>
                    </tr>
                  ) : (
                    backupsHistory.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {b.file_name || b.filename || b.backup_name}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-500 text-[11px]">
                          {b.backup_type || 'FULL'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-600">
                          {Math.round((b.file_size || b.size_bytes || 0) / 1024)} KB
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {b.triggered_by_name || 'Staff'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {b.status || 'COMPLETED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* IMPORTS HISTORY TABLE */}
          {historyTab === 'IMPORTS' && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Source File</th>
                    <th className="px-4 py-2.5">Entity</th>
                    <th className="px-4 py-2.5">Strategy</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5 text-right">Created</th>
                    <th className="px-4 py-2.5 text-right">Updated</th>
                    <th className="px-4 py-2.5 text-right">Failed</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importsHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                        No previous software migrations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    importsHistory.map((imp) => (
                      <tr key={imp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium">
                          {new Date(imp.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {imp.file_name}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                          {imp.entity_type}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                          {imp.strategy}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{imp.total_records}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-bold">{imp.success_count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-600">{imp.updated_count || 0}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-600">
                          {imp.failed_count > 0 ? (
                            <button
                              onClick={() => setSelectedErrorLog(imp.errors_log)}
                              className="underline hover:text-rose-800 font-bold"
                            >
                              {imp.failed_count}
                            </button>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              imp.status === 'SUCCESS'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 border border-emerald-200'
                                : imp.status === 'PARTIAL'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {imp.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* RESTORE CONFIRMATION SAFETY MODAL */}
      {/* ========================================================= */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        title="Confirm Native Database Restore"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-3 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">CRITICAL WARNING: Restore Action</p>
              <p className="text-[11px] mt-1 text-rose-700 dark:text-rose-300">
                Restoring this backup will replace current menu items, inventory ingredients, FIFO batches, and orders with the records from the backup archive.
              </p>
            </div>
          </div>

          {restoreFileSummary && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
              <p><span className="text-slate-500">File Name:</span> {restoreFileSummary.fileName}</p>
              <p><span className="text-slate-500">Archive Type:</span> {restoreFileSummary.isZip ? 'Standard ZIP Package (v1.0)' : 'JSON Snapshot'}</p>
              <p><span className="text-slate-500">File Size:</span> {Math.round(restoreFileSummary.fileSize / 1024)} KB</p>
              <p className="text-emerald-600 font-sans font-semibold pt-1">
                ✓ An automatic safety pre-restore backup will be generated first.
              </p>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              To proceed, please type <span className="font-mono text-rose-600">CONFIRM</span> below:
            </label>
            <input
              type="text"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              placeholder="CONFIRM"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRestoreModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={restoreConfirmText.trim().toUpperCase() !== 'CONFIRM' || restoring}
              onClick={handleExecuteRestore}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-md transition-all disabled:opacity-50"
            >
              {restoring ? 'Restoring Database...' : 'Restore Database Now'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ERROR LOG VIEWER MODAL */}
      <Modal
        isOpen={Boolean(selectedErrorLog)}
        onClose={() => setSelectedErrorLog(null)}
        title="Migration Error Log"
        maxWidth="md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500 text-[11px]">
            The following row-level issues occurred during the data migration:
          </p>
          <div className="max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[11px] space-y-1">
            {Array.isArray(selectedErrorLog) && selectedErrorLog.length > 0 ? (
              selectedErrorLog.map((errItem: any, idx: number) => (
                <div key={idx} className="text-rose-600 border-b border-slate-200/50 pb-1">
                  Row #{errItem.row || '?'}: {errItem.error || errItem.message || JSON.stringify(errItem)}
                </div>
              ))
            ) : (
              <p className="text-slate-400">No specific error details recorded.</p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setSelectedErrorLog(null)}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


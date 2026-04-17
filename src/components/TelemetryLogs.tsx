import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format, isSameDay, parseISO, isValid } from 'date-fns';
import { Search, Filter, Calendar, Cpu, Download, Trash2, CheckSquare, Square, AlertCircle, X } from 'lucide-react';

interface TelemetryLogsProps {
  locationId: string;
  sensors: any[];
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export default function TelemetryLogs({ locationId, sensors }: TelemetryLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterSensor, setFilterSensor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, type: 'selected' | 'all'} | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setNotification({ message: `Erro: ${errMessage}`, type: 'error' });
    throw new Error(JSON.stringify(errInfo));
  };

  const safeParseISO = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return isValid(date) ? date : null;
    } catch (e) {
      return null;
    }
  };

  const safeFormat = (dateStr: string, formatStr: string) => {
    const date = safeParseISO(dateStr);
    if (!date) return '-';
    return format(date, formatStr);
  };

  useEffect(() => {
    const q = query(
      collection(db, 'telemetry'),
      where('locationId', '==', locationId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'telemetry');
    });

    return () => unsubscribe();
  }, [locationId]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'telemetry', id));
      setDeletingId(null);
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
      setNotification({ message: "Registro excluído com sucesso!", type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `telemetry/${id}`);
      setDeletingId(null);
    }
  };

  const handleDeleteSelectedAction = async () => {
    if (selectedIds.size === 0) return;
    setConfirmModal(null);
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'telemetry', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
      setNotification({ message: "Registros excluídos com sucesso!", type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'telemetry/batch');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteAllAction = async () => {
    setConfirmModal(null);
    setIsBulkDeleting(true);
    try {
      const q = query(collection(db, 'telemetry'), where('locationId', '==', locationId));
      const snap = await getDocs(q);
      
      const batchSize = 400; // Safer batch size
      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += batchSize) {
        chunks.push(snap.docs.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      
      setSelectedIds(new Set());
      setNotification({ message: "Todo o histórico foi removido!", type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'telemetry/all');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredLogs = logs.filter(log => {
    const matchSensor = filterSensor ? log.sensorId === filterSensor : true;
    
    let matchDate = true;
    if (filterDate) {
      const logDate = safeParseISO(log.timestamp);
      const targetDate = safeParseISO(filterDate);
      matchDate = logDate && targetDate ? isSameDay(logDate, targetDate) : false;
    }
    
    return matchSensor && matchDate;
  });

  const exportToCSV = () => {
    const headers = ['Data', 'Hora', 'Sensor', 'Nível (%)'];
    const rows = filteredLogs.map(log => [
      safeFormat(log.timestamp, 'dd/MM/yyyy'),
      safeFormat(log.timestamp, 'HH:mm:ss'),
      sensors.find(s => s.sensorId === log.sensorId)?.name || log.sensorId,
      log.value.toFixed(1)
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `logs_${locationId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-24 right-10 z-[120] px-6 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          notification.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-red-50 rounded-2xl text-red-600">
                <AlertCircle className="w-8 h-8" />
              </div>
              <button 
                onClick={() => setConfirmModal(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Confirmar Exclusão</h3>
            <p className="text-text-muted text-sm leading-relaxed mb-8 font-medium">
              {confirmModal.type === 'selected' 
                ? `Você tem certeza que deseja excluir os ${selectedIds.size} registros selecionados?` 
                : "Você tem certeza que deseja excluir TODO o histórico deste local? Esta ação é irreversível."
              }
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-6 py-3 rounded-2xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.type === 'selected' ? handleDeleteSelectedAction : handleDeleteAllAction}
                className="flex-1 px-6 py-3 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkDeleting && (
        <div className="fixed top-24 right-10 z-[110] bg-white px-6 py-3 rounded-2xl shadow-xl border border-blue-100 flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-primary-blue uppercase tracking-widest">Processando Exclusão...</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-end bg-white p-6 rounded-3xl border border-border-gray shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Filtrar por Sensor</label>
          <div className="relative">
            <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <select 
              value={filterSensor}
              onChange={(e) => setFilterSensor(e.target.value)}
              className="w-full bg-gray-50 border border-border-gray rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none appearance-none"
            >
              <option value="">Todos os Sensores</option>
              {sensors.filter(s => s.locationId === locationId).map(s => (
                <option key={s.id} value={s.sensorId}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Filtrar por Data</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-gray-50 border border-border-gray rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          
          {selectedIds.size > 0 && (
            <button 
              onClick={() => setConfirmModal({show: true, type: 'selected'})}
              disabled={isBulkDeleting}
              className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Excluir ({selectedIds.size})
            </button>
          )}

          <button 
            onClick={() => setConfirmModal({show: true, type: 'all'})}
            disabled={isBulkDeleting}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shadow-md shadow-red-100 disabled:opacity-50"
          >
            <AlertCircle className="w-4 h-4" /> Excluir Tudo
          </button>
        </div>
      </div>

      <div className="card-minimal overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 w-10">
                  <button onClick={toggleSelectAll} className="p-1 hover:bg-gray-200 rounded transition-colors">
                    {selectedIds.size === filteredLogs.length && filteredLogs.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary-blue" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Sensor</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Leitura</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className={`hover:bg-blue-50/30 transition-colors ${selectedIds.has(log.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleSelect(log.id)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                      {selectedIds.has(log.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary-blue" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">
                      {safeFormat(log.timestamp, 'HH:mm:ss')}
                    </p>
                    <p className="text-[10px] text-text-muted font-medium">
                      {safeFormat(log.timestamp, 'dd MMM, yyyy')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary-blue rounded-full" />
                      <span className="text-sm font-semibold text-gray-700">
                        {sensors.find(s => s.sensorId === log.sensorId)?.name || log.sensorId}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-primary-blue">
                      {log.value.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      log.value < 20 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {log.value < 20 ? 'Nível Baixo' : 'Normal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {deletingId === log.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleDelete(log.id)}
                          className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                        >
                          Confirmar
                        </button>
                        <button 
                          onClick={() => setDeletingId(null)}
                          className="text-[10px] font-bold text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeletingId(log.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir entrada"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted italic text-sm">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

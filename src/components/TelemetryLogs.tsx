import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { format, isSameDay, parseISO, isValid } from 'date-fns';
import { Search, Filter, Calendar, Cpu, Download, Trash2 } from 'lucide-react';

interface TelemetryLogsProps {
  locationId: string;
  sensors: any[];
}

export default function TelemetryLogs({ locationId, sensors }: TelemetryLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterSensor, setFilterSensor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    });

    return () => unsubscribe();
  }, [locationId]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'telemetry', id));
      setDeletingId(null);
    } catch (err) {
      console.error("Error deleting telemetry:", err);
      setDeletingId(null);
    }
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

        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-black transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="card-minimal overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Sensor</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Leitura</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
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
                  <td colSpan={4} className="px-6 py-12 text-center text-text-muted italic text-sm">
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

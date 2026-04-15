import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, where, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Plus, Users, MapPin, Activity, LogOut, ArrowLeft, ExternalLink, Droplets, Trash2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { format } from 'date-fns';
import WaterLevel from './WaterLevel';
import HistoryChart from './HistoryChart';
import TelemetryLogs from './TelemetryLogs';

const safeFormat = (dateStr: string, formatStr: string) => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data Inválida';
    return format(date, formatStr);
  } catch (e) {
    return 'Data Inválida';
  }
};

export default function AdminDashboard() {
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');
  const [locationTelemetry, setLocationTelemetry] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorHardwareId, setNewSensorHardwareId] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingSensorId, setDeletingSensorId] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const ensureAdminDoc = async () => {
      if (auth.currentUser && auth.currentUser.email === "victorjacques2207@gmail.com") {
        try {
          const adminDocRef = doc(db, 'users', auth.currentUser.uid);
          const adminDoc = await getDoc(adminDocRef);
          if (!adminDoc.exists()) {
            await setDoc(adminDocRef, {
              email: auth.currentUser.email,
              role: 'admin',
              createdAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Error ensuring admin doc:", err);
        }
      }
    };
    ensureAdminDoc();
  }, []);

  useEffect(() => {
    // Fetch Locations
    const unsubLoc = onSnapshot(collection(db, 'locations'), (snap) => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch All Sensors
    const unsubSensors = onSnapshot(collection(db, 'sensors'), (snap) => {
      setSensors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Recent Telemetry (Global)
    const q = query(collection(db, 'telemetry'), orderBy('timestamp', 'desc'), limit(10));
    const unsubTel = onSnapshot(q, (snap) => {
      setTelemetry(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubLoc();
      unsubUsers();
      unsubSensors();
      unsubTel();
    };
  }, []);

  // Fetch Telemetry for Selected Location
  useEffect(() => {
    if (!selectedLocation) {
      setLocationTelemetry([]);
      return;
    }

    const q = query(
      collection(db, 'telemetry'),
      where('locationId', '==', selectedLocation.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLocationTelemetry(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Firestore error for location:", err);
    });

    return () => unsubscribe();
  }, [selectedLocation]);

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      setNotification({ message: "Cliente removido com sucesso!", type: 'success' });
      setDeletingUserId(null);
    } catch (err) {
      console.error("Error deleting user:", err);
      setNotification({ message: "Erro ao remover cliente.", type: 'error' });
      setDeletingUserId(null);
    }
  };

  const handleDeleteSensor = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sensors', id));
      setNotification({ message: "Sensor removido com sucesso!", type: 'success' });
      setDeletingSensorId(null);
    } catch (err) {
      console.error("Error deleting sensor:", err);
      setNotification({ message: "Erro ao remover sensor.", type: 'error' });
      setDeletingSensorId(null);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'locations', id));
      setNotification({ message: "Local removido com sucesso!", type: 'success' });
      setDeletingLocationId(null);
    } catch (err) {
      console.error("Error deleting location:", err);
      setNotification({ message: "Erro ao remover local.", type: 'error' });
      setDeletingLocationId(null);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName) return;
    try {
      await addDoc(collection(db, 'locations'), {
        name: newLocationName,
        createdAt: new Date().toISOString()
      });
      setNewLocationName('');
    } catch (err) {
      console.error("Error creating location:", err);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const locationId = selectedLocation?.id;
    if (!newClientEmail || !locationId) return;
    
    try {
      setNotification({ message: "Vinculando email no banco...", type: 'info' });
      await setDoc(doc(db, 'users', newClientEmail), {
        email: newClientEmail,
        role: 'client',
        locationId: locationId
      });
      setNewClientEmail('');
      setNotification({ message: "Email vinculado com sucesso!", type: 'success' });
    } catch (err) {
      console.error("Error creating client record:", err);
    }
  };

  const handleCreateSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    const locationId = selectedLocation?.id;
    
    // Check if name is provided. Hardware ID will be generated if empty.
    if (!newSensorName || !locationId) {
      setNotification({ message: "Por favor, insira um nome para o sensor.", type: 'error' });
      return;
    }

    // Generate hardware ID from name if not provided (slugify + random)
    const generatedId = newSensorHardwareId.trim() || 
      (newSensorName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, '_') // replace non-alphanumeric with _
        + '_' + Math.random().toString(36).substring(2, 6));

    try {
      await addDoc(collection(db, 'sensors'), {
        name: newSensorName,
        sensorId: generatedId,
        locationId: locationId,
        createdAt: new Date().toISOString()
      });
      setNewSensorName('');
      setNewSensorHardwareId('');
      setNotification({ message: `Sensor criado com sucesso! ID: ${generatedId}`, type: 'success' });
    } catch (err) {
      console.error("Error creating sensor:", err);
      setNotification({ message: "Erro ao criar sensor. Verifique suas permissões.", type: 'error' });
    }
  };

  const latestLocationReading = locationTelemetry[0];
  const latestSensor = sensors.find(s => s.sensorId === latestLocationReading?.sensorId);
  const sensorDisplayName = latestSensor ? latestSensor.name : (latestLocationReading?.sensorId || 'Aguardando...');

  if (selectedLocation) {
    return (
      <div className="min-h-screen bg-bg flex flex-col font-sans">
        <header className="px-10 py-6 flex justify-between items-center bg-card border-b border-border-gray">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setSelectedLocation(null);
                setActiveTab('dashboard');
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-text-muted" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">{selectedLocation.name}</h1>
              <div className="flex gap-4 mt-1">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`text-[10px] font-black tracking-widest uppercase pb-1 border-b-2 transition-all ${
                    activeTab === 'dashboard' ? 'border-primary-blue text-primary-blue' : 'border-transparent text-text-muted hover:text-gray-900'
                  }`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setActiveTab('logs')}
                  className={`text-[10px] font-black tracking-widest uppercase pb-1 border-b-2 transition-all ${
                    activeTab === 'logs' ? 'border-primary-blue text-primary-blue' : 'border-transparent text-text-muted hover:text-gray-900'
                  }`}
                >
                  Histórico de Dados
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ECFDF5] text-success-green rounded-full text-[12px] font-semibold">
            <div className="w-2 h-2 bg-success-green rounded-full" />
            LOCAL ATIVO
          </div>
        </header>

        {notification && (
          <div className={`fixed top-24 right-10 z-50 px-6 py-3 rounded-2xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
            notification.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
            'bg-blue-50 border-blue-100 text-blue-700'
          }`}>
            <p className="text-sm font-bold">{notification.message}</p>
          </div>
        )}

        <main className="p-10 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Real-time Visual */}
              <div className="lg:col-span-5 card-minimal flex flex-col items-center justify-center">
                <span className="label-minimal mb-8">Nível em Tempo Real</span>
                <WaterLevel percentage={latestLocationReading?.value || 0} />
                <div className="mt-8 text-center">
                  <div className="text-4xl font-black text-primary-blue mb-1">
                    {latestLocationReading ? latestLocationReading.value.toFixed(1) : '0.0'}%
                  </div>
                  <p className="text-xs text-text-muted uppercase font-bold tracking-wider">
                    {sensorDisplayName}
                  </p>
                </div>
              </div>

              {/* History & Clients */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="card-minimal">
                  <span className="label-minimal">Histórico do Local</span>
                  <HistoryChart data={locationTelemetry} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sensor Management */}
                  <div className="card-minimal">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary-blue" /> Sensores do Local
                    </h3>
                    <div className="space-y-2 mb-6 max-h-40 overflow-y-auto pr-2">
                        {sensors.filter(s => s.locationId === selectedLocation.id).map(s => (
                          <div key={s.id} className="p-3 bg-gray-50 rounded-xl text-sm border border-gray-100 flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-semibold text-text-main">{s.name}</p>
                              <p className="text-[10px] text-text-muted font-bold">ID: {s.sensorId}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-[10px] font-bold text-primary-blue bg-blue-50 px-2 py-1 rounded-md">
                                {locationTelemetry.find(t => t.sensorId === s.sensorId)?.value.toFixed(1) || '0.0'}%
                              </div>
                              {deletingSensorId === s.id ? (
                                <div className="flex gap-2">
                                  <button onClick={() => handleDeleteSensor(s.id)} className="text-[10px] font-bold text-red-600">Sim</button>
                                  <button onClick={() => setDeletingSensorId(null)} className="text-[10px] font-bold text-gray-500">Não</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletingSensorId(s.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      {sensors.filter(s => s.locationId === selectedLocation.id).length === 0 && (
                        <p className="text-sm text-text-muted italic">Nenhum sensor cadastrado.</p>
                      )}
                    </div>
                    
                    <form onSubmit={handleCreateSensor} className="space-y-3 pt-4 border-t border-gray-100">
                      <input 
                        type="text" 
                        value={newSensorName}
                        onChange={(e) => setNewSensorName(e.target.value)}
                        placeholder="Nome (ex: Cisterna 1)"
                        className="w-full bg-gray-50 border border-border-gray rounded-xl px-4 py-2 text-sm focus:outline-none"
                      />
                      <input 
                        type="text" 
                        value={newSensorHardwareId}
                        onChange={(e) => setNewSensorHardwareId(e.target.value)}
                        placeholder="ID Hardware (Opcional)"
                        className="w-full bg-gray-50 border border-border-gray rounded-xl px-4 py-2 text-sm focus:outline-none"
                      />
                      <button type="submit" className="w-full bg-primary-blue text-white font-bold py-2 rounded-xl text-sm shadow-md shadow-blue-100">
                        Criar Sensor
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="card-minimal">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary-blue" /> Clientes do Local
                      </h3>
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {users.filter(u => u.locationId === selectedLocation.id).map(u => (
                          <div key={u.id} className="p-3 bg-gray-50 rounded-xl text-sm border border-gray-100 flex justify-between items-center">
                            <p className="font-semibold text-text-main truncate mr-2">{u.email}</p>
                            {deletingUserId === u.id ? (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-[10px] font-bold text-red-600 hover:underline"
                                >
                                  Sim
                                </button>
                                <button 
                                  onClick={() => setDeletingUserId(null)}
                                  className="text-[10px] font-bold text-gray-500 hover:underline"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setDeletingUserId(u.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {users.filter(u => u.locationId === selectedLocation.id).length === 0 && (
                          <p className="text-sm text-text-muted italic">Nenhum cliente vinculado.</p>
                        )}
                      </div>
                    </div>

                    <div className="card-minimal">
                      <h3 className="text-lg font-bold mb-4">Adicionar Cliente</h3>
                      <form onSubmit={handleCreateClient} className="space-y-3">
                        <input 
                          type="email" 
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          placeholder="Email do novo cliente"
                          className="w-full bg-gray-50 border border-border-gray rounded-xl px-4 py-2 text-sm focus:outline-none"
                        />
                        <button type="submit" className="w-full bg-primary-blue text-white font-bold py-2 rounded-xl text-sm shadow-md shadow-blue-100">
                          Vincular Email
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TelemetryLogs locationId={selectedLocation.id} sensors={sensors} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      <header className="px-10 py-6 flex justify-between items-center bg-card border-b border-border-gray">
        <div className="text-primary-blue font-extrabold text-2xl tracking-tighter">SIGMA ADMIN</div>
        <button onClick={() => signOut(auth)} className="text-red-500 font-semibold flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      {notification && (
        <div className={`fixed top-24 right-10 z-50 px-6 py-3 rounded-2xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
          notification.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
          notification.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
          'bg-blue-50 border-blue-100 text-blue-700'
        }`}>
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <main className="p-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Locations List */}
        <section className="lg:col-span-7 space-y-6">
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MapPin className="text-primary-blue" /> Gerenciar Locais
            </h2>
            
            <form onSubmit={handleCreateLocation} className="flex gap-2 mb-8">
              <input 
                type="text" 
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="Nome do Local (ex: med401)"
                className="flex-1 bg-gray-50 border border-border-gray rounded-xl px-4 py-3 focus:outline-none"
              />
              <button type="submit" className="bg-primary-blue text-white px-6 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100">
                <Plus className="w-5 h-5" /> Criar
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map(loc => (
                <div 
                  key={loc.id} 
                  onClick={() => setSelectedLocation(loc)}
                  className="group cursor-pointer p-6 bg-gray-50 rounded-3xl border border-border-gray hover:border-primary-blue hover:bg-white transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:bg-blue-50 transition-colors">
                      <MapPin className="w-6 h-6 text-primary-blue" />
                    </div>
                    {deletingLocationId === loc.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteLocation(loc.id); }}
                          className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                        >
                          Confirmar
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingLocationId(null); }}
                          className="text-[10px] font-bold text-gray-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingLocationId(loc.id); }}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary-blue mt-2" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{loc.name}</h3>
                  <p className="text-xs text-text-muted font-bold mt-1">ID: {loc.id}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Global Activity */}
        <section className="lg:col-span-5 space-y-6">
          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Activity className="text-primary-blue" /> Atividade Global
            </h2>
            <div className="space-y-4">
              {telemetry.map(t => (
                <div key={t.id} className="text-sm border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-primary-blue font-bold">
                      {t.value.toFixed(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Local: {locations.find(l => l.id === t.locationId)?.name || 'Desconhecido'}</p>
                      <p className="text-xs text-text-muted">Sensor: {t.sensorId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {safeFormat(t.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
              ))}
              {telemetry.length === 0 && (
                <p className="text-center text-text-muted py-8 italic">Nenhuma atividade registrada.</p>
              )}
            </div>
          </div>

          <div className="card-minimal">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="text-primary-blue" /> Usuários do Sistema
            </h2>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{u.email}</p>
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">
                      {u.role} • {locations.find(l => l.id === u.locationId)?.name || 'Sem Local'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

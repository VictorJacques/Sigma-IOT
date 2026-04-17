import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WaterLevel from './WaterLevel';
import HistoryChart from './HistoryChart';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { format } from 'date-fns';

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'12h' | '1d' | '3d' | '7d'>('12h');

  useEffect(() => {
    // Fetch User Profile to get locationId using email as ID
    const fetchUser = async () => {
      if (!auth.currentUser || !auth.currentUser.email) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // If user doc doesn't exist, they might be the default admin
          if (auth.currentUser.email === "victorjacques2207@gmail.com") {
            setUserData({ role: 'admin' });
          } else {
            setError("Perfil de usuário não encontrado.");
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Erro ao carregar perfil.");
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userData) return;

    const locationId = userData.locationId;
    if (!locationId && userData.role !== 'admin') {
      setError("Nenhum local vinculado a este usuário.");
      setLoading(false);
      return;
    }

    // Fetch Sensors for this location
    const sensorsQuery = locationId 
      ? query(collection(db, 'sensors'), where('locationId', '==', locationId))
      : collection(db, 'sensors');

    const unsubscribeSensors = onSnapshot(sensorsQuery, (snapshot) => {
      const sensorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSensors(sensorsData);
    });

    const now = new Date();
    const startTime = new Date();
    if (timeRange === '12h') startTime.setHours(now.getHours() - 12);
    else if (timeRange === '1d') startTime.setHours(now.getHours() - 24);
    else if (timeRange === '3d') startTime.setDate(now.getDate() - 3);
    else if (timeRange === '7d') startTime.setDate(now.getDate() - 7);

    const q = locationId 
      ? query(
          collection(db, 'telemetry'), 
          where('locationId', '==', locationId), 
          where('timestamp', '>=', startTime.toISOString()),
          orderBy('timestamp', 'desc'), 
          limit(500)
        )
      : query(
          collection(db, 'telemetry'), 
          where('timestamp', '>=', startTime.toISOString()),
          orderBy('timestamp', 'desc'), 
          limit(500)
        );

    const unsubscribeTelemetry = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTelemetry(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Erro ao carregar dados.");
      setLoading(false);
    });

    return () => {
      unsubscribeSensors();
      unsubscribeTelemetry();
    };
  }, [userData, timeRange]);

  const handleLogout = () => signOut(auth);

  const latestReading = telemetry[0];
  const lastUpdate = latestReading ? new Date(latestReading.timestamp) : null;
  
  // Dynamic Sensor Discovery: Combi registered sensors with active telemetry sensor IDs
  const activeSensorIds = Array.from(new Set(telemetry.map(t => t.sensorId))).filter(Boolean);
  
  // Track IDs we've already included to avoid duplicates
  const includedIds = new Set();
  const sensorsWithData: any[] = [];

  // 1. Add registered sensors (and find their latest data)
  sensors.forEach(sensor => {
    const latestForSensor = telemetry.find(t => t.sensorId === sensor.sensorId);
    sensorsWithData.push({
      ...sensor,
      latestValue: latestForSensor?.value || 0,
      lastUpdate: latestForSensor?.timestamp || null
    });
    includedIds.add(sensor.sensorId);
  });

  // 2. Discover sensors that are sending data but aren't registered yet
  activeSensorIds.forEach(sid => {
    if (!includedIds.has(sid)) {
      const latestForSensor = telemetry.find(t => t.sensorId === sid);
      sensorsWithData.push({
        id: `unregistered-${sid}`,
        sensorId: sid,
        name: `Sensor Novo (${sid})`,
        latestValue: latestForSensor?.value || 0,
        lastUpdate: latestForSensor?.timestamp || null,
        isUnregistered: true
      });
      includedIds.add(sid);
    }
  });

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      {/* Header */}
      <header className="px-10 py-6 flex justify-between items-center bg-card border-b border-border-gray">
        <div className="text-primary-blue font-extrabold text-2xl tracking-tighter">SIGMA IOT</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ECFDF5] text-success-green rounded-full text-[12px] font-semibold">
          <div className="w-2 h-2 bg-success-green rounded-full" />
          SISTEMA ONLINE
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-10">
        <div className="flex flex-col gap-6">
          {/* Sensors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sensorsWithData.map((sensor) => (
              <div key={sensor.id} className="card-minimal flex items-center justify-between p-8 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex-1">
                  <div className="flex flex-col">
                    <span className="label-minimal !mb-1">Nível {sensor.name}</span>
                    <span className="text-[10px] font-bold text-text-muted mb-4">ID: {sensor.sensorId}</span>
                  </div>
                  
                  <div className="big-number-minimal flex items-baseline gap-1">
                    {sensor.latestValue.toFixed(1)}
                    <span className="text-[32px] text-text-muted font-normal">%</span>
                  </div>
                  
                  <div className="mt-6 flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-[#ECFDF5] text-success-green text-[9px] font-black rounded uppercase tracking-wider">
                      Online
                    </div>
                    {sensor.isUnregistered && (
                      <div className="px-2 py-0.5 bg-orange-50 text-orange-500 text-[9px] font-black rounded uppercase tracking-wider">
                        Não Registrado
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="ml-6">
                  <WaterLevel percentage={sensor.latestValue} />
                </div>
              </div>
            ))}
            {sensorsWithData.length === 0 && (
              <div className="col-span-full card-minimal text-center py-12">
                <p className="text-text-muted italic">Nenhum sensor encontrado para este local.</p>
              </div>
            )}
          </div>

          {/* History Chart Card */}
          <div className="card-minimal">
            <div className="flex justify-between items-center mb-6">
              <span className="label-minimal !mb-0">Histórico Combinado</span>
              <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                {(['12h', '1d', '3d', '7d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      timeRange === range 
                        ? 'bg-white text-primary-blue shadow-sm' 
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <HistoryChart data={telemetry} sensors={sensors} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Technical Details Card */}
          <div className="card-minimal !p-8">
            <span className="label-minimal">Sensores Configurados</span>
            <div className="space-y-3 mt-4">
              {sensors.map(s => (
                <div key={s.id} className="flex flex-col py-3 border-b border-[#F3F4F6] last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] font-semibold text-text-main">{s.name}</span>
                    <span className="text-[10px] font-black text-primary-blue bg-blue-50 px-2 py-0.5 rounded uppercase">Ativo</span>
                  </div>
                  <span className="text-[11px] text-text-muted mt-1">ID: {s.sensorId}</span>
                </div>
              ))}
              {sensors.length === 0 && (
                <p className="text-[12px] text-text-muted italic">Nenhum sensor cadastrado.</p>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-[#F3F4F6]">
              <span className="label-minimal">Rede e Conectividade</span>
              <div className="flex justify-between py-2">
                <span className="text-[12px] text-text-muted">Protocolo</span>
                <span className="text-[12px] font-bold text-text-main">HTTPS/Firestore</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[12px] text-text-muted">Atualização</span>
                <span className="text-[12px] font-bold text-text-main">Tempo Real</span>
              </div>
            </div>
          </div>

          {/* Last Update Card */}
          <div className="card-minimal !p-8">
            <span className="label-minimal">Última Atualização</span>
            <div className="text-[24px] font-medium mb-1">
              {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : '--:--:--'}
            </div>
            <div className="text-[14px] text-text-muted">
              {lastUpdate ? format(lastUpdate, "d 'de' MMMM, yyyy") : 'Aguardando dados...'}
            </div>
          </div>

          {/* User & Logout */}
          <div className="mt-auto flex justify-between items-center text-[12px] text-text-muted">
            <div className="flex flex-col">
              <span>{auth.currentUser?.email}</span>
              <button onClick={handleLogout} className="text-red-500 hover:underline text-left font-semibold mt-1 flex items-center gap-1">
                <LogOut className="w-3 h-3" /> Sair
              </button>
            </div>
            <div className="text-right">
              <span>v2.0.4-stable</span>
              <br />
              <span>Sigma IoT &copy; 2024</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

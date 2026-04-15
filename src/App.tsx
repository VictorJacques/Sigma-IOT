import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch role using email as ID
        try {
          const userDoc = await getDoc(doc(db, 'users', user.email || ''));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            // Default admin check
            if (user.email === "victorjacques2207@gmail.com") {
              setRole('admin');
            } else {
              setRole('client');
            }
          }
        } catch (err) {
          console.error("Error fetching role:", err);
          setRole('client');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <Droplets className="w-12 h-12 text-primary-blue" />
          <p className="text-text-muted font-medium animate-pulse">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <Login key="login" />
      ) : role === 'admin' ? (
        <AdminDashboard key="admin" />
      ) : (
        <Dashboard key="dashboard" />
      )}
    </AnimatePresence>
  );
}

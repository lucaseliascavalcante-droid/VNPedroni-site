import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc,
  getDoc, serverTimestamp, getDocs
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion, useInView } from 'framer-motion';
import {
  X, Loader, Folder, ArrowLeft, Image as ImageIcon, LogOut,
  Calendar, Users, Trash2, ChevronDown, ChevronUp, Plus, Search,
  Edit2, Save, Link as LinkIcon, CheckCircle, Unlink, ExternalLink,
  Eye, EyeOff, Clock, Package, Upload
} from 'lucide-react';

const manualConfig = {
  apiKey: "AIzaSyAfSW_AdPUx3akxBAh4lZKOSmiIq-86lE8",
  authDomain: "vn-pedroni-fotografia-fd52f.firebaseapp.com",
  projectId: "vn-pedroni-fotografia-fd52f",
  storageBucket: "vn-pedroni-fotografia-fd52f.firebasestorage.app",
  messagingSenderId: "673075986211",
  appId: "1:673075986211:web:b04ab0c9bf3aa3a5709696"
};

// =============================================
// ADMIN: CRIAR ACESSO DE CLIENTE
// =============================================
export function AdminClientManager({ onClose, db, isDemoMode, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [links, setLinks] = useState([{ title: '', url: '' }]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isDemoMode) return alert("Modo demo não permite criar clientes reais.");
    if (!db) return alert("Firestore não disponível.");
    setLoading(true);
    setMessage('Criando conta...');
    let secondaryApp = null;
    try {
      const appName = "ClientApp_" + Date.now();
      secondaryApp = initializeApp(manualConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use')
          throw new Error("Este e-mail já está cadastrado.");
        if (authErr.code === 'auth/operation-not-allowed')
          throw new Error("Auth por e-mail/senha não habilitado no Firebase Console.");
        if (authErr.code === 'auth/weak-password')
          throw new Error("Senha muito fraca (mínimo 6 caracteres).");
        throw new Error("Auth: " + authErr.message);
      }

      const clientUid = userCredential.user.uid;
      setMessage('Salvando no banco de dados...');

      const validLinks = links.filter(l => l.title.trim() && l.url.trim());

      await setDoc(doc(db, 'clients', clientUid), {
        name: name || '',
        email: email,
        role: 'client',
        createdAt: serverTimestamp(),
        deliveryDate: deliveryDate || null,
        previewPhotos: [],
        links: validLinks,
        linkedArtifacts: [],
        status: 'pendente'
      });

      try { await deleteApp(secondaryApp); secondaryApp = null; } catch (e) { }

      setMessage('✅ Cliente criado com sucesso!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      console.error("Erro ao criar cliente:", err);
      if (secondaryApp) { try { await deleteApp(secondaryApp); } catch (e) { } }
      setMessage('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="bg-[#FAF9F6] p-8 md:p-10 max-w-lg w-full rounded shadow-2xl relative text-[#593428] max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition"><X size={24} /></button>
        <h3 className="text-3xl font-serif mb-8 text-center">Novo Cliente</h3>

        {message && (
          <div className={`p-4 rounded mb-6 text-sm ${message.includes('✅') ? 'bg-green-100 text-green-800' : message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Nome do Cliente</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria e João" className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Senha Provisória</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">
              <Calendar size={12} className="inline mr-1 -mt-0.5" /> Data Prevista de Entrega
            </label>
            <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans text-sm" />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-3">
              <LinkIcon size={12} className="inline mr-1 -mt-0.5" /> Links de Entrega
            </label>
            {links.map((l, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input type="text" placeholder="Texto do Botão" value={l.title} onChange={e => { const n = [...links]; n[i].title = e.target.value; setLinks(n); }} className="w-1/3 border-b border-[#593428]/20 bg-transparent p-2 outline-none text-sm" />
                <input type="url" placeholder="URL do Link" value={l.url} onChange={e => { const n = [...links]; n[i].url = e.target.value; setLinks(n); }} className="w-2/3 border-b border-[#593428]/20 bg-transparent p-2 outline-none text-sm" />
              </div>
            ))}
            <button type="button" onClick={() => setLinks([...links, { title: '', url: '' }])} className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1 hover:opacity-100">+ Adicionar Link</button>
          </div>

          <button disabled={loading} className="w-full bg-[#593428] text-white py-4 font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 mt-4 flex justify-center items-center gap-2">
            {loading ? <Loader className="animate-spin" size={16} /> : 'Criar Cliente'}
          </button>
        </form>
      </div>
    </div>
  );
}


// =============================================
// DASHBOARD DO CLIENTE
// =============================================

// Componente de foto com tilt 3D interativo
function TiltPhoto({ src, index, total }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const isFirst = index === 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.9,
        delay: index * 0.12,
        ease: [0.2, 0, 0.2, 1]
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        transition: 'transform 0.15s ease-out'
      }}
      className={`relative overflow-hidden cursor-crosshair group ${
        isFirst ? 'md:col-span-2 md:row-span-2 aspect-[4/3] lg:aspect-auto' : ''
      } bg-[#e5e5e5] rounded-sm`}
    >
      <motion.img
        src={src}
        alt={`Preview ${index}`}
        loading="lazy"
        className="w-full h-full object-cover"
        whileHover={{ scale: 1.06 }}
        transition={{ duration: 1.8, ease: [0.2, 0, 0.2, 1] }}
      />
      <motion.div
        className="absolute inset-0 bg-[#593428]/5 pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ background: 'transparent' }}
        whileHover={{
          background: 'linear-gradient(180deg, transparent 50%, rgba(89,52,40,0.15) 100%)'
        }}
        transition={{ duration: 0.6 }}
      />
    </motion.div>
  );
}

// Componente de link com animação
function LinkButton({ lk, index }) {
  return (
    <motion.a
      href={lk.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.2, 0, 0.2, 1] }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-4 border border-[#593428]/15 text-[#593428] px-12 py-6 hover:bg-[#593428] hover:text-[#EADDCE] transition-all rounded-sm shadow-lg group"
    >
      <motion.div whileHover={{ rotate: 8 }}>
        <Folder size={20} />
      </motion.div>
      <span className="font-bold text-[11px] tracking-[0.2em] uppercase">{lk.title}</span>
    </motion.a>
  );
}

// Componente de artifact com tilt
function ArtifactCard({ art }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x, y });
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: [0.2, 0, 0.2, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transform: `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        transition: 'transform 0.12s ease-out'
      }}
      className="bg-white rounded-sm shadow-sm hover:shadow-2xl transition-shadow duration-700 p-10 text-left border border-[#593428]/5"
    >
      <div className="flex items-center gap-4 mb-4">
        <Folder size={22} className="text-[#593428]/40" />
        <h4 className="font-serif text-2xl">{art.title || art.id}</h4>
      </div>
      {art.description && <p className="text-sm text-gray-400 font-light leading-relaxed mb-6">{art.description}</p>}
      {art.url && (
        <a href={art.url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 bg-[#593428] text-[#EADDCE] px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 rounded-sm transition-opacity">
          <ExternalLink size={12} /> Acessar Material
        </a>
      )}
    </motion.div>
  );
}

export function ClientDashboard({ db, user, onLogOut, onBackContent }) {
  const [clientData, setClientData] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    const clientRef = doc(db, 'clients', user.uid);
    const unsub = onSnapshot(clientRef, async (snap) => {
      if (!snap.exists()) {
        setClientData('NOT_FOUND');
        setLoading(false);
        return;
      }
      const data = snap.data();
      setClientData(data);

      const linkedIds = data.linkedArtifacts || [];
      if (linkedIds.length > 0) {
        try {
          const artSnap = await getDocs(collection(db, 'artifacts'));
          const allArtifacts = artSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setArtifacts(allArtifacts.filter(a => linkedIds.includes(a.id)));
        } catch (e) {
          console.error("Erro ao buscar artifacts:", e);
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Erro snapshot:", err);
      setClientData('NOT_FOUND');
      setLoading(false);
    });
    return () => unsub();
  }, [user, db]);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return dateStr; }
  };

  if (loading) {
    return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center text-[#593428]"><Loader className="animate-spin" /></div>;
  }

  if (clientData === 'NOT_FOUND' || !clientData) {
    return (
      <div className="h-screen bg-[#FAF9F6] flex flex-col items-center justify-center text-[#593428] fixed inset-0 z-50">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <h2 className="text-2xl font-serif mb-4">Nenhuma entrega encontrada.</h2>
          <p className="opacity-50 mb-8">Essa conta não possui materiais vinculados.</p>
          <div className="flex gap-4 justify-center">
            <button onClick={onBackContent} className="border border-[#593428] px-6 py-3 uppercase text-[10px] tracking-widest font-bold flex items-center gap-2"><ArrowLeft size={14} /> Site Oficial</button>
            <button onClick={onLogOut} className="bg-[#593428] text-[#EADDCE] px-6 py-3 uppercase text-[10px] tracking-widest font-bold">Sair</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen bg-[#FAF9F6] overflow-y-auto text-[#593428] z-[100] pb-24">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0, 0.2, 1] }}
        className="absolute top-0 left-0 w-full py-6 px-8 flex justify-between items-center z-50"
      >
        <button onClick={onBackContent} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest hover:text-[#593428]/70 transition text-[#593428] border border-[#593428]/20 px-4 py-2 rounded-full hover:bg-[#593428]/5">
          <ArrowLeft size={16} /> PÁGINA INICIAL
        </button>
        <div className="flex items-center gap-4 text-[#593428]">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50 hidden md:block">ENTREGA EXCLUSIVA</span>
          <button onClick={onLogOut} className="p-2 border border-[#593428]/20 hover:bg-[#593428]/5 rounded-full transition-colors flex items-center gap-2 text-[10px] font-bold tracking-widest">
            <LogOut size={14} /> <span className="hidden md:inline">SAIR</span>
          </button>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto text-center mt-32 px-6">

        {/* Título */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50 block mb-6"
        >
          Entrega Exclusiva
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.2, 0, 0.2, 1] }}
          className="text-5xl md:text-8xl font-serif mb-8 px-4 leading-none"
        >
          {clientData.name || clientData.email}
        </motion.h1>

        {/* Data prevista */}
        {clientData.deliveryDate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="inline-flex items-center gap-3 bg-[#593428]/5 border border-[#593428]/10 px-8 py-3 rounded-full mb-20"
          >
            <Calendar size={16} className="opacity-60" />
            <span className="text-[11px] uppercase font-bold tracking-[0.15em] opacity-70">
              Previsão de entrega: {formatDate(clientData.deliveryDate)}
            </span>
          </motion.div>
        )}

        {/* Links de entrega */}
        {clientData.links?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-6 mb-24 px-4">
            {clientData.links.map((lk, i) => (
              <LinkButton key={i} lk={lk} index={i} />
            ))}
          </div>
        )}

        {/* Fotos de prévia — Galeria Imersiva */}
        {clientData.previewPhotos?.length > 0 && (
          <div className="mb-32">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.2, 0, 0.2, 1] }}
              className="text-4xl md:text-5xl font-serif italic mb-16 text-[#593428]/70"
            >
              Suas Prévias
            </motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 auto-rows-[400px] px-2">
              {clientData.previewPhotos.map((p, i) => (
                <TiltPhoto key={i} src={p} index={i} total={clientData.previewPhotos.length} />
              ))}
            </div>
          </div>
        )}

        {/* Artifacts vinculados */}
        {artifacts.length > 0 && (
          <div className="mb-32">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="text-4xl md:text-5xl font-serif italic mb-16 text-[#593428]/70"
            >
              Seus Materiais
            </motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {artifacts.map((art) => (
                <ArtifactCard key={art.id} art={art} />
              ))}
            </div>
          </div>
        )}

        {/* Vazio */}
        {!clientData.links?.length && !clientData.previewPhotos?.length && !artifacts.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-16"
          >
            <Package size={48} className="mx-auto mb-4" />
            <p className="text-sm">Seus materiais ainda estão sendo preparados.</p>
            <p className="text-[10px] uppercase tracking-widest mt-2">Você será notificado quando estiver pronto.</p>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-[10px] uppercase font-bold tracking-[0.5em] opacity-30 mt-40 mb-10"
        >
          VN PEDRONI FOTOGRAFIA
        </motion.p>
      </div>
    </div>
  );
}


// =============================================
// CRM DE CLIENTES (TEMPO REAL)
// =============================================
export function AdminClientCRM({ onClose, db, storage, isDemoMode, onCreateNew }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Edit states
  const [editData, setEditData] = useState(null);
  const [linkArtifactTarget, setLinkArtifactTarget] = useState(null);
  const [artifactIdInput, setArtifactIdInput] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Upload de fotos de prévia para o Storage
  const handlePhotoUpload = async (files, clientId) => {
    if (!files.length || !storage) return;
    setUploadingPhotos(true);
    try {
      const urls = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const storageRef = ref(storage, `clients/${clientId}/previews/${Date.now()}_${safeName}`);
        await uploadBytes(storageRef, file);
        const dl = await getDownloadURL(storageRef);
        urls.push(dl);
      }
      // Adicionar URLs ao editData se estiver editando
      if (editData) {
        setEditData(prev => ({
          ...prev,
          previewPhotos: [...(prev.previewPhotos || []), ...urls]
        }));
      } else {
        // Salvar direto no Firestore
        const snap = await getDoc(doc(db, 'clients', clientId));
        if (snap.exists()) {
          const current = snap.data().previewPhotos || [];
          await updateDoc(doc(db, 'clients', clientId), { previewPhotos: [...current, ...urls] });
        }
      }
    } catch (err) {
      alert("Erro no upload: " + err.message);
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Ouvir clients em tempo real
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Erro ao ouvir clients:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Salvar dados do cliente
  const saveClient = async (clientId, data) => {
    setSaving(true);
    setSaveMsg('Salvando...');
    try {
      await updateDoc(doc(db, 'clients', clientId), data);
      setSaveMsg('✅ Salvo!');
      setTimeout(() => setSaveMsg(''), 1500);
    } catch (err) {
      setSaveMsg('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Vincular artifact
  const linkArtifact = async (clientId) => {
    if (!artifactIdInput.trim()) return;
    try {
      const snap = await getDoc(doc(db, 'clients', clientId));
      if (!snap.exists()) throw new Error("Cliente não encontrado");
      const current = snap.data().linkedArtifacts || [];
      const id = artifactIdInput.trim();
      if (!current.includes(id)) {
        await updateDoc(doc(db, 'clients', clientId), { linkedArtifacts: [...current, id] });
      }
      setArtifactIdInput('');
      setLinkArtifactTarget(null);
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const unlinkArtifact = async (clientId, artifactId) => {
    const snap = await getDoc(doc(db, 'clients', clientId));
    if (!snap.exists()) return;
    const current = snap.data().linkedArtifacts || [];
    await updateDoc(doc(db, 'clients', clientId), { linkedArtifacts: current.filter(id => id !== artifactId) });
  };

  // Deletar
  const handleDelete = async (client) => {
    if (isDemoMode) return alert("Modo demo não permite deletar.");
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'clients', client.id));
      setDeleteConfirm(null);
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return '—'; }
  };

  const filteredClients = clients.filter(c =>
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-start p-4 overflow-y-auto">
      <div className="bg-[#FAF9F6] p-8 md:p-12 max-w-5xl w-full rounded shadow-2xl relative text-[#593428] my-8">
        <button onClick={onClose} className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition"><X size={24} /></button>

        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Users size={24} className="opacity-60" />
            <h3 className="text-3xl font-serif">CRM de Clientes</h3>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* ACTIONS BAR */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-[#593428]/15 bg-white pl-10 pr-4 py-3 outline-none text-sm rounded-lg focus:border-[#593428]/40 transition-colors" />
          </div>
          <button onClick={onCreateNew}
            className="bg-[#593428] text-[#EADDCE] px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2 justify-center rounded-lg shadow-lg">
            <Plus size={14} /> Novo Cliente
          </button>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="text-center py-20">
            <Loader className="animate-spin mx-auto mb-4" size={28} />
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Carregando clientes...</span>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Users size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-serif text-xl">{searchTerm ? 'Nenhum resultado' : 'Nenhum cliente cadastrado'}</p>
            <p className="text-[10px] uppercase tracking-widest mt-2">
              {searchTerm ? 'Tente outro termo' : 'Clique em "Novo Cliente" para começar'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClients.map((client) => (
              <div key={client.id} className="border border-[#593428]/10 rounded-xl bg-white overflow-hidden hover:shadow-lg transition-shadow">

                {/* CLIENT ROW */}
                <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#593428]/[0.02] transition-colors"
                  onClick={() => {
                    setExpandedClient(expandedClient === client.id ? null : client.id);
                    setEditData(null);
                    setSaveMsg('');
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-[#593428]/10 rounded-full flex items-center justify-center text-[#593428] font-serif text-lg">
                      {(client.name || client.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{client.name || 'Sem nome'}</p>
                      <p className="text-[11px] opacity-50">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Status badge */}
                    <span className={`text-[9px] uppercase tracking-widest font-bold px-3 py-1 rounded-full ${
                      client.status === 'entregue'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {client.status || 'pendente'}
                    </span>
                    {expandedClient === client.id ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                  </div>
                </div>

                {/* EXPANDED CARD */}
                {expandedClient === client.id && (
                  <div className="border-t border-[#593428]/10 p-6 bg-[#593428]/[0.01] animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                      {/* ===== COLUNA 1: STATUS ===== */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40 border-b border-[#593428]/10 pb-2">Status</h4>

                        {/* Nome editável */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Nome</label>
                          {editData ? (
                            <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })}
                              className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm" />
                          ) : (
                            <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">{client.name || '—'}</p>
                          )}
                        </div>

                        {/* E-mail */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">E-mail</label>
                          <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-[#593428]/10 select-all text-xs">{client.email}</p>
                        </div>

                        {/* Data criação */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">
                            <Clock size={10} className="inline mr-1" /> Criado em
                          </label>
                          <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">{formatDate(client.createdAt)}</p>
                        </div>

                        {/* Data prevista */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">
                            <Calendar size={10} className="inline mr-1" /> Data Prevista
                          </label>
                          {editData ? (
                            <input type="date" value={editData.deliveryDate || ''} onChange={e => setEditData({ ...editData, deliveryDate: e.target.value })}
                              className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm" />
                          ) : (
                            <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">
                              {client.deliveryDate ? formatDate(client.deliveryDate) : 'Não definida'}
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Status da Entrega</label>
                          {editData ? (
                            <select value={editData.status || 'pendente'} onChange={e => setEditData({ ...editData, status: e.target.value })}
                              className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm">
                              <option value="pendente">Pendente</option>
                              <option value="entregue">Entregue</option>
                            </select>
                          ) : (
                            <span className={`inline-block text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full ${
                              client.status === 'entregue' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {client.status || 'pendente'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ===== COLUNA 2: ARQUIVOS E PRÉVIAS ===== */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40 border-b border-[#593428]/10 pb-2">Arquivos e Prévias</h4>

                        {/* Fotos Prévias */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-2">
                            <ImageIcon size={10} className="inline mr-1" /> Fotos Prévias
                          </label>
                          {/* Thumbnails existentes */}
                          {(editData ? editData.previewPhotos : client.previewPhotos)?.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {(editData ? editData.previewPhotos : client.previewPhotos).map((url, pi) => (
                                <div key={pi} className="relative aspect-square rounded-lg overflow-hidden bg-[#e5e5e5] group">
                                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  {editData && (
                                    <button onClick={() => {
                                      const photos = editData.previewPhotos.filter((_, i) => i !== pi);
                                      setEditData({ ...editData, previewPhotos: photos });
                                    }} className="absolute inset-0 bg-red-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={14} className="text-white" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Adicionar foto por upload */}
                          {editData ? (
                            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#593428]/20 px-3 py-2 rounded-lg hover:bg-[#593428]/5 transition-colors">
                              {uploadingPhotos ? (
                                <Loader className="animate-spin" size={14} />
                              ) : (
                                <Upload size={14} className="opacity-50" />
                              )}
                              <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
                                {uploadingPhotos ? 'Enviando...' : 'Enviar Fotos'}
                              </span>
                              <input type="file" multiple accept="image/*" className="hidden"
                                onChange={e => handlePhotoUpload(Array.from(e.target.files), client.id)}
                                disabled={uploadingPhotos} />
                            </label>
                          ) : (
                            !(client.previewPhotos?.length > 0) && (
                              <p className="text-xs opacity-40 italic">Nenhuma foto de prévia.</p>
                            )
                          )}
                          {!(editData ? editData.previewPhotos : client.previewPhotos)?.length && !editData && (
                            <p className="text-xs opacity-40 italic">Nenhuma foto de prévia.</p>
                          )}
                        </div>

                        {/* Linked Artifacts */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-2">
                            <Folder size={10} className="inline mr-1" /> Artifacts Vinculados
                          </label>
                          {(client.linkedArtifacts || []).length === 0 ? (
                            <p className="text-xs opacity-40 italic">Nenhum artifact.</p>
                          ) : (
                            <div className="space-y-1.5 mb-3">
                              {client.linkedArtifacts.map((artId) => (
                                <div key={artId} className="flex items-center justify-between bg-white border border-[#593428]/10 px-3 py-1.5 rounded-lg">
                                  <span className="text-xs font-mono select-all truncate">{artId}</span>
                                  <button onClick={() => unlinkArtifact(client.id, artId)} className="text-red-400 hover:text-red-600 transition p-1 ml-2 flex-shrink-0">
                                    <Unlink size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {linkArtifactTarget === client.id ? (
                            <div className="flex items-center gap-2 mt-2">
                              <input type="text" value={artifactIdInput} onChange={e => setArtifactIdInput(e.target.value)} placeholder="ID do artifact"
                                className="flex-1 border border-[#593428]/20 bg-white px-3 py-1.5 rounded-lg outline-none text-xs" />
                              <button onClick={() => linkArtifact(client.id)} className="bg-[#593428] text-[#EADDCE] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg">Vincular</button>
                              <button onClick={() => { setLinkArtifactTarget(null); setArtifactIdInput(''); }} className="text-[9px] uppercase tracking-widest font-bold opacity-50 hover:opacity-100">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setLinkArtifactTarget(client.id)} className="text-[9px] uppercase tracking-widest font-bold text-[#593428]/50 hover:text-[#593428] flex items-center gap-1">
                              <Plus size={10} /> Vincular Artifact
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ===== COLUNA 3: LINKS EXTERNOS ===== */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40 border-b border-[#593428]/10 pb-2">
                          <LinkIcon size={10} className="inline mr-1" /> Links Externos
                        </h4>

                        {/* Links existentes */}
                        {(editData ? editData.links : client.links)?.length > 0 ? (
                          <div className="space-y-2">
                            {(editData ? editData.links : client.links).map((lk, li) => (
                              <div key={li} className="bg-white border border-[#593428]/10 p-3 rounded-lg">
                                {editData ? (
                                  <div className="space-y-2">
                                    <input type="text" value={lk.title || ''} placeholder="Texto do Botão"
                                      onChange={e => {
                                        const links = [...editData.links];
                                        links[li] = { ...links[li], title: e.target.value };
                                        setEditData({ ...editData, links });
                                      }}
                                      className="w-full border border-[#593428]/20 px-2 py-1.5 rounded outline-none text-xs" />
                                    <input type="url" value={lk.url || ''} placeholder="URL"
                                      onChange={e => {
                                        const links = [...editData.links];
                                        links[li] = { ...links[li], url: e.target.value };
                                        setEditData({ ...editData, links });
                                      }}
                                      className="w-full border border-[#593428]/20 px-2 py-1.5 rounded outline-none text-xs" />
                                    <button onClick={() => {
                                      const links = editData.links.filter((_, i) => i !== li);
                                      setEditData({ ...editData, links });
                                    }} className="text-[9px] uppercase tracking-widest text-red-400 hover:text-red-600 font-bold">Remover</button>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-xs font-bold">{lk.title}</p>
                                    <p className="text-[10px] opacity-40 truncate">{lk.url}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs opacity-40 italic">Nenhum link cadastrado.</p>
                        )}

                        {/* Adicionar link no modo edição */}
                        {editData && (
                          <button onClick={() => setEditData({ ...editData, links: [...(editData.links || []), { title: '', url: '' }] })}
                            className="text-[9px] uppercase tracking-widest font-bold text-[#593428]/50 hover:text-[#593428] flex items-center gap-1">
                            <Plus size={10} /> Adicionar Link
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ===== AÇÕES ===== */}
                    <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#593428]/10 flex-wrap">
                      {editData ? (
                        <>
                          <button onClick={() => {
                            saveClient(client.id, {
                              name: editData.name || '',
                              deliveryDate: editData.deliveryDate || null,
                              status: editData.status || 'pendente',
                              previewPhotos: editData.previewPhotos || [],
                              links: (editData.links || []).filter(l => l.title && l.url)
                            });
                            setEditData(null);
                          }} disabled={saving}
                            className="bg-[#593428] text-[#EADDCE] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                            {saving ? <Loader className="animate-spin" size={12} /> : <Save size={12} />}
                            {saveMsg || 'Salvar Alterações'}
                          </button>
                          <button onClick={() => { setEditData(null); setSaveMsg(''); }}
                            className="border border-[#593428]/20 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#593428]/5">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditData({
                            name: client.name || '',
                            deliveryDate: client.deliveryDate || '',
                            status: client.status || 'pendente',
                            previewPhotos: [...(client.previewPhotos || [])],
                            links: [...(client.links || []).map(l => ({ ...l }))]
                          })}
                            className="text-[10px] uppercase tracking-widest font-bold text-[#593428]/60 hover:text-[#593428] transition flex items-center gap-1 border border-[#593428]/20 px-4 py-2 rounded-lg hover:bg-[#593428]/5">
                            <Edit2 size={12} /> Editar
                          </button>

                          {/* Toggle status rápido */}
                          <button onClick={() => saveClient(client.id, { status: client.status === 'entregue' ? 'pendente' : 'entregue' })}
                            className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 px-4 py-2 rounded-lg border transition ${
                              client.status === 'entregue'
                                ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                                : 'border-green-300 text-green-600 hover:bg-green-50'
                            }`}>
                            <CheckCircle size={12} />
                            {client.status === 'entregue' ? 'Marcar Pendente' : 'Marcar Entregue'}
                          </button>

                          {/* Delete */}
                          {deleteConfirm === client.id ? (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs text-red-600">Confirmar exclusão?</span>
                              <button onClick={() => handleDelete(client)} disabled={deleting}
                                className="bg-red-600 text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                                {deleting ? <Loader className="animate-spin" size={10} /> : <Trash2 size={10} />} Sim
                              </button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="border border-red-300 text-red-600 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-50">Não</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(client.id)} className="text-[10px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600 transition flex items-center gap-1 ml-auto">
                              <Trash2 size={12} /> Excluir
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc,
  getDoc, serverTimestamp, getDocs, query, where
} from "firebase/firestore";
import {
  X, Upload, Loader, Folder, ArrowLeft, Image as ImageIcon, Lock, LogOut,
  Calendar, Users, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Plus, Search,
  Edit2, Save, Link as LinkIcon, CheckCircle, Unlink
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
// ADMIN: CRIAR ACESSO DE CLIENTE (FIRESTORE)
// =============================================
export function AdminClientManager({ onClose, db, isDemoMode, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // PASSO 1: Firebase Auth via app secundário
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
      console.log("✅ Conta criada UID:", clientUid);

      // PASSO 2: Criar documento no Firestore /clients/{UID}
      setMessage('Salvando no banco de dados...');
      await setDoc(doc(db, 'clients', clientUid), {
        name: name || '',
        email: email,
        role: 'client',
        createdAt: serverTimestamp(),
        linkedArtifacts: []
      });
      console.log("✅ Documento Firestore criado: /clients/" + clientUid);

      // Cleanup
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
      <div className="bg-[#FAF9F6] p-8 md:p-12 max-w-lg w-full rounded shadow-2xl relative text-[#593428]">
        <button onClick={onClose} className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition"><X size={24} /></button>
        <h3 className="text-3xl font-serif mb-8 text-center">Novo Cliente</h3>

        {message && (
          <div className={`p-4 rounded mb-6 text-sm ${message.includes('✅') ? 'bg-green-100 text-green-800' : message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Nome do Cliente</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria e João" className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Senha Provisória</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
          </div>

          <button disabled={loading} className="w-full bg-[#593428] text-white py-4 font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 mt-8 flex justify-center items-center gap-2">
            {loading ? <Loader className="animate-spin" size={16} /> : 'Criar Cliente'}
          </button>
        </form>
      </div>
    </div>
  );
}


// =============================================
// DASHBOARD DO CLIENTE (FIRESTORE)
// =============================================
export function ClientDashboard({ db, user, onLogOut, onBackContent }) {
  const [clientData, setClientData] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;

    // Ouvir documento do cliente em tempo real
    const clientRef = doc(db, 'clients', user.uid);
    const unsubClient = onSnapshot(clientRef, async (snap) => {
      if (!snap.exists()) {
        setClientData('NOT_FOUND');
        setLoading(false);
        return;
      }
      const data = snap.data();
      setClientData(data);

      // Buscar artifacts vinculados
      const linkedIds = data.linkedArtifacts || [];
      if (linkedIds.length > 0) {
        try {
          const artSnap = await getDocs(collection(db, 'artifacts'));
          const allArtifacts = artSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const linked = allArtifacts.filter(a => linkedIds.includes(a.id));
          setArtifacts(linked);
        } catch (e) {
          console.error("Erro ao buscar artifacts:", e);
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Erro snapshot cliente:", err);
      setClientData('NOT_FOUND');
      setLoading(false);
    });

    return () => unsubClient();
  }, [user, db]);

  if (loading) {
    return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center text-[#593428]"><Loader className="animate-spin" /></div>;
  }

  if (clientData === 'NOT_FOUND' || !clientData) {
    return (
      <div className="h-screen bg-[#FAF9F6] flex flex-col items-center justify-center text-[#593428] fixed inset-0 z-50">
        <h2 className="text-2xl font-serif">Nenhuma entrega encontrada.</h2>
        <p className="opacity-50 mt-4 mb-8">Essa conta não possui materiais vinculados.</p>
        <div className="flex gap-4">
          <button onClick={onBackContent} className="border border-[#593428] px-6 py-3 uppercase text-[10px] tracking-widest font-bold flex items-center gap-2"><ArrowLeft size={14} /> Site Oficial</button>
          <button onClick={onLogOut} className="bg-[#593428] text-[#EADDCE] px-6 py-3 uppercase text-[10px] tracking-widest font-bold">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen bg-[#FAF9F6] overflow-y-auto text-[#593428] z-[100] pb-24">
      <style>{`
        @keyframes clientFadeSlideUp { from { opacity: 0; transform: translateY(40px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes clientFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes clientSlideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .client-animate-header { animation: clientSlideDown 0.8s cubic-bezier(0.2, 0, 0.2, 1) forwards; }
        .client-animate-title { animation: clientFadeSlideUp 1s cubic-bezier(0.2, 0, 0.2, 1) 0.2s forwards; opacity: 0; }
        .client-animate-links { animation: clientFadeSlideUp 0.8s cubic-bezier(0.2, 0, 0.2, 1) 0.5s forwards; opacity: 0; }
      `}</style>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full py-6 px-8 flex justify-between items-center z-50 client-animate-header">
        <button onClick={onBackContent} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest hover:text-[#593428]/70 transition text-[#593428] border border-[#593428]/20 px-4 py-2 rounded-full hover:bg-[#593428]/5">
          <ArrowLeft size={16} /> PÁGINA INICIAL
        </button>
        <div className="flex items-center gap-4 text-[#593428]">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50 hidden md:block">ENTREGA EXCLUSIVA</span>
          <button onClick={onLogOut} className="p-2 border border-[#593428]/20 hover:bg-[#593428]/5 rounded-full transition-colors flex items-center gap-2 text-[10px] font-bold tracking-widest">
            <LogOut size={14} /> <span className="hidden md:inline">SAIR</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto text-center mt-32 px-6">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50 block mb-6 client-animate-header">Entrega Exclusiva</span>
        <h1 className="text-5xl md:text-7xl font-serif mb-8 px-4 leading-none client-animate-title">
          {clientData.name || clientData.email}
        </h1>

        {/* Artifacts Vinculados */}
        {artifacts.length > 0 && (
          <div className="mt-16 client-animate-links">
            <h3 className="text-2xl font-serif italic mb-8 text-[#593428]/80">Seus Materiais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artifacts.map((art) => (
                <div key={art.id} className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-500 p-6 text-left border border-[#593428]/5">
                  <div className="flex items-center gap-3 mb-3">
                    <Folder size={20} className="text-[#593428]/50" />
                    <h4 className="font-serif text-lg">{art.title || art.id}</h4>
                  </div>
                  {art.description && <p className="text-sm text-gray-500 mb-4">{art.description}</p>}
                  {art.url && (
                    <a href={art.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#593428] text-[#EADDCE] px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 rounded">
                      <Folder size={12} /> Acessar Material
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {artifacts.length === 0 && (
          <div className="mt-16 opacity-40">
            <Folder size={48} className="mx-auto mb-4" />
            <p className="text-sm">Nenhum material vinculado ainda.</p>
            <p className="text-[10px] uppercase tracking-widest mt-2">O administrador irá vincular seus arquivos em breve.</p>
          </div>
        )}

        <p className="text-[10px] uppercase font-bold tracking-[0.5em] opacity-30 mt-32 mb-10">VN PEDRONI FOTOGRAFIA</p>
      </div>
    </div>
  );
}


// =============================================
// CRM DE CLIENTES (FIRESTORE - TEMPO REAL)
// =============================================
export function AdminClientCRM({ onClose, db, isDemoMode, onCreateNew }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Link artifact
  const [linkTarget, setLinkTarget] = useState(null);
  const [artifactIdInput, setArtifactIdInput] = useState('');
  const [linking, setLinking] = useState(false);

  // Listener em tempo real na coleção clients
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(list);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao ouvir clients:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Editar nome
  const startEditing = (client) => {
    setEditingClient(client.id);
    setEditName(client.name || '');
    setSaveMsg('');
  };

  const saveName = async () => {
    if (!editingClient) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clients', editingClient), { name: editName });
      setSaveMsg('✅ Salvo!');
      setTimeout(() => { setSaveMsg(''); setEditingClient(null); }, 1000);
    } catch (err) {
      setSaveMsg('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Vincular artifact
  const linkArtifact = async (clientId) => {
    if (!artifactIdInput.trim()) return;
    setLinking(true);
    try {
      const clientRef = doc(db, 'clients', clientId);
      const snap = await getDoc(clientRef);
      if (!snap.exists()) throw new Error("Cliente não encontrado");
      const current = snap.data().linkedArtifacts || [];
      const id = artifactIdInput.trim();
      if (!current.includes(id)) {
        await updateDoc(clientRef, { linkedArtifacts: [...current, id] });
      }
      setArtifactIdInput('');
      setLinkTarget(null);
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      setLinking(false);
    }
  };

  // Desvincular artifact
  const unlinkArtifact = async (clientId, artifactId) => {
    try {
      const clientRef = doc(db, 'clients', clientId);
      const snap = await getDoc(clientRef);
      if (!snap.exists()) return;
      const current = snap.data().linkedArtifacts || [];
      await updateDoc(clientRef, { linkedArtifacts: current.filter(id => id !== artifactId) });
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  // Deletar cliente
  const handleDelete = async (client) => {
    if (isDemoMode) return alert("Modo demo não permite deletar.");
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'clients', client.id));
      setDeleteConfirm(null);
    } catch (err) {
      alert("Erro ao deletar: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return '—';
    }
  };

  const filteredClients = clients.filter(c =>
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-start p-4 overflow-y-auto">
      <div className="bg-[#FAF9F6] p-8 md:p-12 max-w-4xl w-full rounded shadow-2xl relative text-[#593428] my-8">
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
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-[#593428]/15 bg-white pl-10 pr-4 py-3 outline-none text-sm rounded-lg focus:border-[#593428]/40 transition-colors"
            />
          </div>
          <button
            onClick={onCreateNew}
            className="bg-[#593428] text-[#EADDCE] px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 flex items-center gap-2 justify-center rounded-lg shadow-lg"
          >
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
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <div key={client.id} className="border border-[#593428]/10 rounded-lg bg-white overflow-hidden hover:shadow-md transition-shadow">
                {/* Client Row */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#593428]/[0.02] transition-colors"
                  onClick={() => {
                    setExpandedClient(expandedClient === client.id ? null : client.id);
                    if (editingClient === client.id) { setEditingClient(null); }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#593428]/10 rounded-full flex items-center justify-center text-[#593428] font-serif text-lg">
                      {(client.name || client.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{client.name || 'Sem nome'}</p>
                      <p className="text-[11px] opacity-50">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase tracking-widest opacity-40 hidden sm:block">
                      {formatDate(client.createdAt)}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest opacity-30 bg-[#593428]/5 px-2 py-1 rounded-full">
                      {(client.linkedArtifacts || []).length} artifact{(client.linkedArtifacts || []).length !== 1 ? 's' : ''}
                    </span>
                    {expandedClient === client.id ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedClient === client.id && (
                  <div className="border-t border-[#593428]/10 p-5 bg-[#593428]/[0.015] animate-fade-in space-y-5">

                    {/* INFO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">UID</label>
                        <p className="text-xs font-mono bg-white px-3 py-2 rounded border border-[#593428]/10 select-all break-all">{client.id}</p>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">E-mail</label>
                        <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-[#593428]/10 select-all">{client.email}</p>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Role</label>
                        <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">{client.role || 'client'}</p>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Criado em</label>
                        <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">{formatDate(client.createdAt)}</p>
                      </div>
                    </div>

                    {/* EDIT NAME */}
                    {editingClient === client.id ? (
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Nome</label>
                          <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm" />
                        </div>
                        <button onClick={saveName} disabled={saving} className="bg-[#593428] text-[#EADDCE] px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                          {saving ? <Loader className="animate-spin" size={12} /> : <Save size={12} />}
                          {saveMsg || 'Salvar'}
                        </button>
                        <button onClick={() => setEditingClient(null)} className="border border-[#593428]/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#593428]/5">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(client)} className="text-[10px] uppercase tracking-widest font-bold text-[#593428]/60 hover:text-[#593428] transition flex items-center gap-1">
                        <Edit2 size={12} /> Editar Nome
                      </button>
                    )}

                    {/* LINKED ARTIFACTS */}
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-2">
                        <LinkIcon size={10} className="inline mr-1" /> Artifacts Vinculados
                      </label>
                      {(client.linkedArtifacts || []).length === 0 ? (
                        <p className="text-xs opacity-40 italic">Nenhum artifact vinculado.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {client.linkedArtifacts.map((artId) => (
                            <div key={artId} className="flex items-center justify-between bg-white border border-[#593428]/10 px-3 py-2 rounded-lg">
                              <span className="text-xs font-mono select-all">{artId}</span>
                              <button
                                onClick={() => unlinkArtifact(client.id, artId)}
                                className="text-red-400 hover:text-red-600 transition p-1"
                                title="Desvincular"
                              >
                                <Unlink size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add artifact link */}
                      {linkTarget === client.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={artifactIdInput}
                            onChange={e => setArtifactIdInput(e.target.value)}
                            placeholder="Cole o ID do artifact"
                            className="flex-1 border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm"
                          />
                          <button
                            onClick={() => linkArtifact(client.id)}
                            disabled={linking || !artifactIdInput.trim()}
                            className="bg-[#593428] text-[#EADDCE] px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                          >
                            {linking ? <Loader className="animate-spin" size={12} /> : <Plus size={12} />}
                            Vincular
                          </button>
                          <button onClick={() => { setLinkTarget(null); setArtifactIdInput(''); }} className="border border-[#593428]/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#593428]/5">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setLinkTarget(client.id)}
                          className="text-[10px] uppercase tracking-widest font-bold text-[#593428]/60 hover:text-[#593428] transition flex items-center gap-1 mt-1"
                        >
                          <Plus size={12} /> Vincular Artifact
                        </button>
                      )}
                    </div>

                    {/* DELETE */}
                    <div className="pt-3 border-t border-[#593428]/10">
                      {deleteConfirm === client.id ? (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-lg">
                          <span className="text-sm text-red-700 flex-1">Excluir permanentemente este cliente?</span>
                          <button onClick={() => handleDelete(client)} disabled={deleting} className="bg-red-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                            {deleting ? <Loader className="animate-spin" size={12} /> : <Trash2 size={12} />}
                            Confirmar
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="border border-red-300 text-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-red-100">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(client.id)} className="text-[10px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600 transition flex items-center gap-1">
                          <Trash2 size={12} /> Excluir Cliente
                        </button>
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

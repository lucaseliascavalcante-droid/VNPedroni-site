import React, { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import { 
  X, Upload, Loader, Folder, ArrowLeft, Image as ImageIcon, Lock, LogOut, 
  Calendar, Users, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Plus, Search,
  Edit2, Save, Link as LinkIcon, CheckCircle
} from 'lucide-react';

// Reusing same config for secondary app
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
export function AdminClientManager({ onClose, db, storage, isDemoMode, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [links, setLinks] = useState([{ title: 'Baixar em Alta (Drive)', url: '' }]);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if(isDemoMode) return alert("Modo demo não permite criar clientes reais.");
    setLoading(true);
    setMessage('Criando conta do cliente...');
    let secondaryApp = null;
    try {
      // 1. Create Secondary App for auth
      const appName = "SecondaryClientApp_" + Date.now();
      secondaryApp = initializeApp(manualConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      setMessage('Criando credenciais de acesso...');
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      } catch(authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          throw new Error("Este e-mail já está cadastrado. Use outro e-mail ou delete o cliente existente no CRM.");
        }
        if (authErr.code === 'auth/operation-not-allowed') {
          throw new Error("Login por e-mail/senha não está habilitado no Firebase Console. Ative em Authentication > Sign-in method.");
        }
        if (authErr.code === 'auth/weak-password') {
          throw new Error("Senha muito fraca. Use pelo menos 6 caracteres.");
        }
        throw new Error("Auth: " + authErr.message);
      }
      const clientUid = userCredential.user.uid;
      console.log("Conta criada com UID:", clientUid);
      
      // 2. Upload Previews
      setMessage('Enviando prévias...');
      const uploadedUrls = [];
      for (const file of previewFiles) {
        if(file instanceof File) {
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
          const storageRef = ref(storage, `uploads/${manualConfig.projectId}/${Date.now()}_client_${safeName}`);
          await uploadBytes(storageRef, file);
          const dl = await getDownloadURL(storageRef);
          uploadedUrls.push(dl);
        } else {
          uploadedUrls.push(file); 
        }
      }
      console.log("Upload de prévias concluído:", uploadedUrls.length);

      // 3. Save client data.json to Storage
      setMessage('Salvando dados do cliente...');
      const clientData = {
        email: email,
        password: password,
        title: title || "Sua Entrega",
        deliveryDate: deliveryDate || null,
        links: links.filter(l => l.url.trim() !== ''),
        previewPhotos: uploadedUrls,
        createdAt: new Date().toISOString()
      };
      const dataRef = ref(storage, `uploads/${manualConfig.projectId}/clients/${clientUid}/data.json`);
      await uploadString(dataRef, JSON.stringify(clientData), 'raw', { contentType: 'application/json' });
      console.log("data.json salvo no Storage");

      // 4. Update registry.json for CRM
      setMessage('Atualizando registro de clientes...');
      let registry = [];
      try {
        const regRef = ref(storage, `uploads/${manualConfig.projectId}/clients/registry.json`);
        const regUrl = await getDownloadURL(regRef);
        const regResp = await fetch(regUrl);
        registry = await regResp.json();
        if (!Array.isArray(registry)) registry = [];
      } catch(e) {
        console.log("registry.json não existe ainda, criando novo");
      }
      registry = registry.filter(c => c.email !== email);
      registry.push({
        uid: clientUid,
        email: email,
        password: password,
        role: 'client',
        title: title || "Sua Entrega",
        deliveryDate: deliveryDate || null,
        createdAt: new Date().toISOString()
      });
      const regRef = ref(storage, `uploads/${manualConfig.projectId}/clients/registry.json`);
      await uploadString(regRef, JSON.stringify(registry), 'raw', { contentType: 'application/json' });
      console.log("registry.json atualizado com", registry.length, "clientes");

      // Cleanup secondary app
      try { await deleteApp(secondaryApp); secondaryApp = null; } catch(e) { console.log("Cleanup:", e); }
      
      setMessage('✅ Cliente criado com sucesso!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch(err) {
      console.error("Erro ao criar cliente:", err);
      if (secondaryApp) { try { await deleteApp(secondaryApp); } catch(e) {} }
      setMessage('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    setPreviewFiles(prev => [...prev, ...files]);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="bg-[#FAF9F6] p-8 md:p-12 max-w-2xl w-full rounded shadow-2xl relative text-[#593428] max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition"><X size={24} /></button>
        <h3 className="text-3xl font-serif mb-8 text-center">Criar Acesso de Cliente</h3>
        
        {message && <div className={`p-4 rounded mb-6 text-sm ${message.includes('✅') ? 'bg-green-100 text-green-800' : message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{message}</div>}

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">E-mail do Cliente</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Senha</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">Título da Entrega</label>
            <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex: Casamento Casal Lindo" className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans text-xl" />
          </div>

          {/* DATA PREVISTA DE ENTREGA */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-1">
              <Calendar size={12} className="inline mr-1 -mt-0.5" />
              Data Prevista de Entrega
            </label>
            <input 
              type="date" 
              value={deliveryDate} 
              onChange={e=>setDeliveryDate(e.target.value)} 
              className="w-full border-b border-[#593428]/20 bg-transparent p-2 outline-none font-sans text-sm"
            />
          </div>
          
          <div className="pt-4">
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-3">Links de Entrega (Google Drive, etc)</label>
            {links.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input type="text" placeholder="Nome do Botão" value={v.title} onChange={e=>{let l=[...links]; l[i].title=e.target.value; setLinks(l);}} className="w-1/3 border-b border-[#593428]/20 bg-transparent p-2 outline-none text-sm" />
                <input type="url" placeholder="URL do Drive" value={v.url} onChange={e=>{let l=[...links]; l[i].url=e.target.value; setLinks(l);}} className="w-2/3 border-b border-[#593428]/20 bg-transparent p-2 outline-none text-sm" />
              </div>
            ))}
            <button type="button" onClick={()=>setLinks([...links, {title:'', url:''}])} className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-2 hover:opacity-100">+ Adicionar Link</button>
          </div>

          <div className="pt-4">
            <label className="text-[10px] uppercase font-bold tracking-widest opacity-50 block mb-3">Fotos de Prévia</label>
            <div className="border border-dashed border-[#593428]/20 p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5" onClick={() => document.getElementById('previewFolderInput').click()}>
              <ImageIcon className="opacity-50 mb-2"/>
              <span className="text-[10px] uppercase tracking-widest font-bold">Selecionar Fotos</span>
              <input type="file" id="previewFolderInput" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
            {previewFiles.length > 0 && <div className="mt-2 text-xs opacity-70">{previewFiles.length} arquivos selecionados.</div>}
          </div>

          <button disabled={loading} className="w-full bg-[#593428] text-white py-4 font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 mt-8 flex justify-center items-center gap-2">
            {loading ? <Loader className="animate-spin" size={16} /> : 'Criar Conta & Enviar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// =============================================
// DASHBOARD DO CLIENTE (COM ANIMAÇÕES)
// =============================================
export function ClientDashboard({ storage, user, onLogOut, onBackContent }) {
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(!user || !storage) return;

    const fetchClientData = async () => {
      try {
        const dataRef = ref(storage, `uploads/${manualConfig.projectId}/clients/${user.uid}/data.json`);
        const url = await getDownloadURL(dataRef);
        const response = await fetch(url);
        const data = await response.json();
        setClientData(data);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setClientData('NOT_FOUND');
        setLoading(false);
      }
    };

    fetchClientData();
  }, [user, storage]);

  // Format delivery date
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch(e) {
      return dateStr;
    }
  };

  if (loading) {
    return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center text-[#593428]"><Loader className="animate-spin" /></div>
  }

  if (clientData === 'NOT_FOUND' || clientData === 'ERROR' || !clientData) {
    return (
      <div className="h-screen bg-[#FAF9F6] flex flex-col items-center justify-center text-[#593428] fixed inset-0 z-50">
        <h2 className="text-2xl font-serif">Nenhuma entrega encontrada.</h2>
        <p className="opacity-50 mt-4 mb-8">Essa conta não possui materiais vinculados ou não foi encontrada.</p>
        <div className="flex gap-4">
          <button onClick={onBackContent} className="border border-[#593428] px-6 py-3 uppercase text-[10px] tracking-widest font-bold flex items-center gap-2"><ArrowLeft size={14}/> Site Oficial</button>
          <button onClick={onLogOut} className="bg-[#593428] text-[#EADDCE] px-6 py-3 uppercase text-[10px] tracking-widest font-bold">Sair</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 min-h-screen bg-[#FAF9F6] overflow-y-auto text-[#593428] z-[100] pb-24">
      {/* Animations CSS */}
      <style>{`
        @keyframes clientFadeSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes clientFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes clientSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .client-animate-header {
          animation: clientSlideDown 0.8s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        .client-animate-title {
          animation: clientFadeSlideUp 1s cubic-bezier(0.2, 0, 0.2, 1) 0.2s forwards;
          opacity: 0;
        }
        .client-animate-links {
          animation: clientFadeSlideUp 0.8s cubic-bezier(0.2, 0, 0.2, 1) 0.5s forwards;
          opacity: 0;
        }
        .client-animate-delivery {
          animation: clientFadeIn 0.8s cubic-bezier(0.2, 0, 0.2, 1) 0.4s forwards;
          opacity: 0;
        }
        .client-photo-stagger {
          animation: clientFadeSlideUp 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* Top Header Logged */}
      <div className="absolute top-0 left-0 w-full py-6 px-8 flex justify-between items-center z-50 client-animate-header">
        <button onClick={onBackContent} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest hover:text-[#593428]/70 transition text-[#593428] border border-[#593428]/20 px-4 py-2 rounded-full hover:bg-[#593428]/5"><ArrowLeft size={16}/> PÁGINA INICIAL</button>
        <div className="flex items-center gap-4 text-[#593428]">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50 hidden md:block">ENTREGA EXCLUSIVA</span>
          <button onClick={onLogOut} className="p-2 border border-[#593428]/20 hover:bg-[#593428]/5 rounded-full transition-colors flex items-center gap-2 text-[10px] font-bold tracking-widest" title="Sair"><LogOut size={14}/> <span className="hidden md:inline">SAIR</span></button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto text-center mt-32 px-6">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50 block mb-6 client-animate-header">Entrega Exclusiva</span>
        <h1 className="text-5xl md:text-8xl font-serif mb-8 px-4 leading-none client-animate-title">{clientData.title}</h1>

        {/* DELIVERY DATE BADGE */}
        {clientData.deliveryDate && (
          <div className="client-animate-delivery inline-flex items-center gap-3 bg-[#593428]/5 border border-[#593428]/10 px-8 py-3 rounded-full mb-16 cursor-default select-none">
            <Calendar size={16} className="opacity-60" />
            <span className="text-[11px] uppercase font-bold tracking-[0.15em] opacity-70">
              Previsão de entrega: {formatDate(clientData.deliveryDate)}
            </span>
          </div>
        )}

        {/* Action Folders */}
        <div className="flex flex-wrap justify-center gap-6 mb-32 px-4 client-animate-links">
          {clientData.links?.map((lk, i) => (
            <a key={i} href={lk.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 border border-[#593428]/20 text-[#593428] px-10 py-5 hover:bg-[#593428] hover:text-[#EADDCE] transition-all rounded-sm shadow-xl group">
              <Folder size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-[11px] tracking-widest uppercase">{lk.title}</span>
            </a>
          ))}
        </div>

        {/* Previews with stagger animation */}
        {clientData.previewPhotos?.length > 0 && (
          <div className="mb-24">
            <h3 className="text-3xl font-serif italic mb-12 text-[#593428]/80 client-animate-title" style={{animationDelay: '0.6s'}}>Suas Prévias</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 auto-rows-[400px]">
              {clientData.previewPhotos.map((p, i) => (
                <div 
                  key={i} 
                  className={`relative overflow-hidden group ${i === 0 ? 'md:col-span-2 md:row-span-2 aspect-[4/3] lg:aspect-auto' : ''} bg-[#e5e5e5] client-photo-stagger`}
                  style={{ animationDelay: `${0.7 + (i * 0.12)}s` }}
                >
                  <img src={p} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105" alt={`Preview ${i}`} loading="lazy" />
                  <div className="absolute inset-0 bg-[#593428]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-[10px] uppercase font-bold tracking-[0.5em] opacity-30 mt-32 mb-10">VN PEDRONI FOTOGRAFIA</p>
      </div>
    </div>
  )
}


// =============================================
// CRM DE CLIENTES (ADMIN)
// =============================================
export function AdminClientCRM({ onClose, storage, isDemoMode, onCreateNew }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingClient, setEditingClient] = useState(null); // uid of client being edited
  const [editData, setEditData] = useState(null); // full editable data
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const regRef = ref(storage, `uploads/${manualConfig.projectId}/clients/registry.json`);
      const regUrl = await getDownloadURL(regRef);
      const response = await fetch(regUrl);
      const data = await response.json();
      setClients(data);
    } catch (e) {
      console.log("Nenhum registro de clientes encontrado");
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Load full client data.json for editing
  const startEditing = async (client) => {
    try {
      const dataRef = ref(storage, `uploads/${manualConfig.projectId}/clients/${client.uid}/data.json`);
      const url = await getDownloadURL(dataRef);
      const resp = await fetch(url);
      const fullData = await resp.json();
      setEditData({ ...fullData, uid: client.uid });
      setEditingClient(client.uid);
    } catch(e) {
      // Fallback: use registry data
      setEditData({
        uid: client.uid,
        email: client.email,
        password: client.password,
        title: client.title || '',
        deliveryDate: client.deliveryDate || '',
        links: [],
        previewPhotos: [],
        createdAt: client.createdAt
      });
      setEditingClient(client.uid);
    }
  };

  const cancelEditing = () => {
    setEditingClient(null);
    setEditData(null);
    setSaveMsg('');
  };

  // Save edited client data
  const saveClientData = async () => {
    if (!editData) return;
    setSaving(true);
    setSaveMsg('Salvando...');
    try {
      const { uid, ...dataToSave } = editData;

      // Save data.json
      const dataRef = ref(storage, `uploads/${manualConfig.projectId}/clients/${uid}/data.json`);
      await uploadString(dataRef, JSON.stringify(dataToSave), 'raw', { contentType: 'application/json' });

      // Update registry
      const updatedClients = clients.map(c => {
        if (c.uid === uid) {
          return {
            ...c,
            title: dataToSave.title,
            deliveryDate: dataToSave.deliveryDate,
            email: dataToSave.email,
            password: dataToSave.password
          };
        }
        return c;
      });
      const regRef = ref(storage, `uploads/${manualConfig.projectId}/clients/registry.json`);
      await uploadString(regRef, JSON.stringify(updatedClients), 'raw', { contentType: 'application/json' });
      setClients(updatedClients);

      setSaveMsg('✅ Salvo!');
      setTimeout(() => { setSaveMsg(''); setEditingClient(null); setEditData(null); }, 1500);
    } catch(err) {
      setSaveMsg('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Upload photos for editing client
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !editData) return;
    setUploadingPhotos(true);
    try {
      const newUrls = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const storageRef = ref(storage, `uploads/${manualConfig.projectId}/${Date.now()}_edit_${safeName}`);
        await uploadBytes(storageRef, file);
        const dl = await getDownloadURL(storageRef);
        newUrls.push(dl);
      }
      setEditData(prev => ({
        ...prev,
        previewPhotos: [...(prev.previewPhotos || []), ...newUrls]
      }));
    } catch(err) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleDelete = async (client) => {
    if (isDemoMode) return alert("Modo demo não permite deletar.");
    setDeleting(true);
    try {
      try {
        const dataRef = ref(storage, `uploads/${manualConfig.projectId}/clients/${client.uid}/data.json`);
        await deleteObject(dataRef);
      } catch(e) { console.log("data.json não encontrado, continuando..."); }

      const updatedClients = clients.filter(c => c.uid !== client.uid);
      const regRef = ref(storage, `uploads/${manualConfig.projectId}/clients/registry.json`);
      await uploadString(regRef, JSON.stringify(updatedClients), 'raw', { contentType: 'application/json' });
      
      setClients(updatedClients);
      setDeleteConfirm(null);
    } catch (err) {
      alert("Erro ao deletar: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const togglePassword = (uid) => {
    setShowPasswords(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(e) {
      return dateStr;
    }
  };

  const filteredClients = clients.filter(c => 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.title?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">{clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}</p>
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
            <p className="font-serif text-xl">{searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum cliente cadastrado'}</p>
            <p className="text-[10px] uppercase tracking-widest mt-2">
              {searchTerm ? 'Tente outro termo de busca' : 'Crie o primeiro acesso de cliente'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client, idx) => (
              <div key={client.uid || idx} className="border border-[#593428]/10 rounded-lg bg-white overflow-hidden hover:shadow-md transition-shadow">
                {/* Client Row */}
                <div 
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#593428]/[0.02] transition-colors"
                  onClick={() => { setExpandedClient(expandedClient === client.uid ? null : client.uid); if (editingClient === client.uid) cancelEditing(); }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#593428]/10 rounded-full flex items-center justify-center text-[#593428] font-serif text-lg">
                      {client.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{client.title || 'Sem título'}</p>
                      <p className="text-[11px] opacity-50">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {client.deliveryDate && (
                      <span className="hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-widest opacity-50 bg-[#593428]/5 px-3 py-1 rounded-full">
                        <Calendar size={10} /> {formatDate(client.deliveryDate)}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-widest opacity-40 hidden sm:block">
                      {formatDate(client.createdAt)}
                    </span>
                    {expandedClient === client.uid ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedClient === client.uid && (
                  <div className="border-t border-[#593428]/10 p-5 bg-[#593428]/[0.015] animate-fade-in">
                    
                    {/* INFO SECTION */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">E-mail</label>
                        <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-[#593428]/10 select-all">{client.email}</p>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Senha</label>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-[#593428]/10 flex-1 select-all">
                            {showPasswords[client.uid] ? client.password : '••••••••'}
                          </p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); togglePassword(client.uid); }} 
                            className="p-2 hover:bg-[#593428]/10 rounded transition-colors"
                            title={showPasswords[client.uid] ? 'Esconder' : 'Mostrar'}
                          >
                            {showPasswords[client.uid] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Criado em</label>
                        <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">{formatDate(client.createdAt)}</p>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Entrega Prevista</label>
                        <p className="text-sm bg-white px-3 py-2 rounded border border-[#593428]/10">
                          {client.deliveryDate ? formatDate(client.deliveryDate) : 'Não definida'}
                        </p>
                      </div>
                    </div>

                    {/* EDIT / DELETE ACTIONS */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {editingClient !== client.uid && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); startEditing(client); }}
                          className="text-[10px] uppercase tracking-widest font-bold text-[#593428] hover:text-[#593428]/70 transition-colors flex items-center gap-1 border border-[#593428]/20 px-4 py-2 rounded-lg hover:bg-[#593428]/5"
                        >
                          <Edit2 size={12} /> Editar Cliente
                        </button>
                      )}

                      {deleteConfirm === client.uid ? (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-lg flex-1">
                          <span className="text-sm text-red-700 flex-1">Excluir este cliente?</span>
                          <button 
                            onClick={() => handleDelete(client)} 
                            disabled={deleting}
                            className="bg-red-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {deleting ? <Loader className="animate-spin" size={12} /> : <Trash2 size={12} />}
                            {deleting ? 'Excluindo...' : 'Confirmar'}
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(null)} 
                            className="border border-red-300 text-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-red-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(client.uid); }} 
                          className="text-[10px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Excluir
                        </button>
                      )}
                    </div>

                    {/* ======================== */}
                    {/* EDIT MODE */}
                    {/* ======================== */}
                    {editingClient === client.uid && editData && (
                      <div className="mt-6 border-t border-[#593428]/10 pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-serif flex items-center gap-2">
                            <Edit2 size={16} className="opacity-50" /> Editando Cliente
                          </h4>
                          {saveMsg && (
                            <span className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 ${saveMsg.includes('✅') ? 'text-green-600' : saveMsg.includes('Erro') ? 'text-red-500' : 'text-[#593428]/50'}`}>
                              {saveMsg.includes('✅') && <CheckCircle size={12} />}
                              {saveMsg}
                            </span>
                          )}
                        </div>

                        {/* Title & Delivery Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">Título da Entrega</label>
                            <input 
                              type="text" 
                              value={editData.title || ''}
                              onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm focus:border-[#593428]/40 transition-colors"
                              placeholder="Título da entrega"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-1">
                              <Calendar size={10} className="inline mr-1" />Data Prevista de Entrega
                            </label>
                            <input 
                              type="date" 
                              value={editData.deliveryDate || ''}
                              onChange={e => setEditData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                              className="w-full border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm focus:border-[#593428]/40 transition-colors"
                            />
                          </div>
                        </div>

                        {/* LINKS / BUTTONS */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-3">
                            <LinkIcon size={10} className="inline mr-1" />Links / Botões de Entrega
                          </label>
                          {(editData.links || []).map((link, li) => (
                            <div key={li} className="flex gap-2 mb-2 items-center">
                              <input 
                                type="text" 
                                placeholder="Nome do Botão" 
                                value={link.title || ''}
                                onChange={e => {
                                  const links = [...(editData.links || [])];
                                  links[li] = { ...links[li], title: e.target.value };
                                  setEditData(prev => ({ ...prev, links }));
                                }}
                                className="w-1/3 border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm focus:border-[#593428]/40"
                              />
                              <input 
                                type="url" 
                                placeholder="URL (Google Drive, etc)" 
                                value={link.url || ''}
                                onChange={e => {
                                  const links = [...(editData.links || [])];
                                  links[li] = { ...links[li], url: e.target.value };
                                  setEditData(prev => ({ ...prev, links }));
                                }}
                                className="flex-1 border border-[#593428]/20 bg-white px-3 py-2 rounded-lg outline-none text-sm focus:border-[#593428]/40"
                              />
                              <button 
                                onClick={() => {
                                  const links = (editData.links || []).filter((_, i) => i !== li);
                                  setEditData(prev => ({ ...prev, links }));
                                }}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => setEditData(prev => ({ ...prev, links: [...(prev.links || []), { title: '', url: '' }] }))}
                            className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1 mt-2"
                          >
                            <Plus size={12} /> Adicionar Link
                          </button>
                        </div>

                        {/* PREVIEW PHOTOS */}
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold opacity-40 block mb-3">
                            <ImageIcon size={10} className="inline mr-1" />Fotos de Prévia
                          </label>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                            {(editData.previewPhotos || []).map((photo, pi) => (
                              <div key={pi} className="relative group aspect-square rounded-lg overflow-hidden bg-[#e5e5e5]">
                                <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <button 
                                  onClick={() => {
                                    const photos = (editData.previewPhotos || []).filter((_, i) => i !== pi);
                                    setEditData(prev => ({ ...prev, previewPhotos: photos }));
                                  }}
                                  className="absolute inset-0 bg-red-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={16} className="text-white" />
                                </button>
                              </div>
                            ))}
                            {/* Upload Button */}
                            <label className="aspect-square border-2 border-dashed border-[#593428]/15 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[#593428]/5 hover:border-[#593428]/30 transition-all">
                              {uploadingPhotos ? (
                                <Loader className="animate-spin opacity-50" size={20} />
                              ) : (
                                <>
                                  <Plus size={20} className="opacity-40 mb-1" />
                                  <span className="text-[8px] uppercase tracking-widest font-bold opacity-40">Fotos</span>
                                </>
                              )}
                              <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                onChange={handlePhotoUpload}
                                className="hidden" 
                                disabled={uploadingPhotos}
                              />
                            </label>
                          </div>
                          <p className="text-[10px] opacity-40">{(editData.previewPhotos || []).length} foto{(editData.previewPhotos || []).length !== 1 ? 's' : ''}</p>
                        </div>

                        {/* SAVE / CANCEL */}
                        <div className="flex gap-3 pt-4 border-t border-[#593428]/10">
                          <button 
                            onClick={saveClientData}
                            disabled={saving}
                            className="bg-[#593428] text-[#EADDCE] px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2 rounded-lg shadow-lg"
                          >
                            {saving ? <Loader className="animate-spin" size={12} /> : <Save size={12} />}
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="border border-[#593428]/20 px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#593428]/5 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
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

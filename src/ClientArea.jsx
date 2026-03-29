import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { X, Upload, Loader, Folder, ArrowLeft, Image as ImageIcon, Lock, LogOut } from 'lucide-react';

// Reusing same config for secondary app
const manualConfig = {
  apiKey: "AIzaSyAfSW_AdPUx3akxBAh4lZKOSmiIq-86lE8",
  authDomain: "vn-pedroni-fotografia-fd52f.firebaseapp.com",
  projectId: "vn-pedroni-fotografia-fd52f",
  storageBucket: "vn-pedroni-fotografia-fd52f.firebasestorage.app",
  messagingSenderId: "673075986211",
  appId: "1:673075986211:web:b04ab0c9bf3aa3a5709696"
};

export function AdminClientManager({ onClose, db, storage, isDemoMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [links, setLinks] = useState([{ title: 'Baixar em Alta (Drive)', url: '' }]);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if(isDemoMode) return alert("Modo demo não permite criar clientes reais.");
    setLoading(true);
    setMessage('Criando conta do cliente...');
    try {
      // 1. Create Secondary App
      const secondaryApp = initializeApp(manualConfig, "SecondaryApp" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const clientUid = userCredential.user.uid;
      
      // 2. Upload Previews
      setMessage('Lendo arquivos e fazendo upload das prévias...');
      const uploadedUrls = [];
      try {
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
      } catch (storageErr) {
        throw new Error("Storage: " + storageErr.message);
      }

      // 3. Save to Firestore
      setMessage('Salvando dados do cliente...');
      try {
        await setDoc(doc(db, 'artifacts', manualConfig.projectId, 'public', 'data', 'clients', clientUid), {
          email: email,
          title: title || "Sua Entrega",
          links: links.filter(l => l.url.trim() !== ''),
          previewPhotos: uploadedUrls,
          createdAt: new Date().toISOString()
        });
      } catch (dbErr) {
        throw new Error("Firestore: " + dbErr.message);
      }

      // Cleanup
      if (secondaryApp.delete) await secondaryApp.delete();
      
      setMessage('Cliente criado com sucesso!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch(err) {
      console.error(err);
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
        
        {message && <div className="bg-yellow-100 text-yellow-800 p-4 rounded mb-6 text-sm">{message}</div>}

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

export function ClientDashboard({ db, user, onLogOut, onBackContent }) {
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(!user || !db) return;
    getDoc(doc(db, 'artifacts', manualConfig.projectId, 'public', 'data', 'clients', user.uid)).then(d => {
      if(d.exists()) {
        setClientData(d.data());
      } else {
        setClientData('NOT_FOUND');
      }
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setClientData('ERROR');
      setLoading(false);
    });
  }, [user, db]);

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
    <div className="fixed inset-0 min-h-screen bg-[#FAF9F6] overflow-y-auto text-[#593428] animate-fade-in z-[100] pb-24">
      {/* Top Header Logged */}
      <div className="absolute top-0 left-0 w-full py-6 px-8 flex justify-between items-center z-50">
        <button onClick={onBackContent} className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest hover:text-[#593428]/70 transition text-[#593428]"><ArrowLeft size={16}/> SITE OFICIAL</button>
        <div className="flex items-center gap-4 text-[#593428]">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50 hidden md:block">ENTREGA EXCLUSIVA</span>
          <button onClick={onLogOut} className="p-2 border border-[#593428]/20 hover:bg-[#593428]/5 rounded-full transition-colors" title="Sair"><LogOut size={14}/></button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto text-center mt-32 px-6">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-50 block mb-6">Entrega Exclusiva</span>
        <h1 className="text-5xl md:text-8xl font-serif mb-20 px-4 leading-none">{clientData.title}</h1>

        {/* Action Folders */}
        <div className="flex flex-wrap justify-center gap-6 mb-32 px-4">
          {clientData.links?.map((lk, i) => (
            <a key={i} href={lk.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 border border-[#593428]/20 text-[#593428] px-10 py-5 hover:bg-[#593428] hover:text-[#EADDCE] transition-all rounded-sm shadow-xl group">
              <Folder size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-[11px] tracking-widest uppercase">{lk.title}</span>
            </a>
          ))}
        </div>

        {/* Previews */}
        {clientData.previewPhotos?.length > 0 && (
          <div className="mb-24 scale-up-center">
            <h3 className="text-3xl font-serif italic mb-12 text-[#593428]/80">Suas Prévias</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 auto-rows-[400px]">
              {clientData.previewPhotos.map((p, i) => (
                <div key={i} className={`relative overflow-hidden group ${i === 0 ? 'md:col-span-2 md:row-span-2 aspect-[4/3] lg:aspect-auto' : ''} bg-[#e5e5e5]`}>
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

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Video, Heart, Mail, Instagram, Play, ArrowRight, Menu, X, Lock, LogOut, Plus, Trash2, Save, Edit2, Image as ImageIcon, Upload, Loader, Facebook, Twitter, Linkedin, ChevronDown, Link as LinkIcon, User, ChevronLeft, ChevronRight, LayoutGrid, Settings, Film, CheckCircle, AlertCircle, Cloud, WifiOff, Database, RefreshCw, AlertTriangle, HardDrive, Link, ImageOff, Maximize2, XCircle, GripVertical } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// --- FIREBASE CONFIGURATION ---
const manualConfig = {
  apiKey: "AIzaSyAfSW_AdPUx3akxBAh4lZKOSmiIq-86lE8",
  authDomain: "vn-pedroni-fotografia-fd52f.firebaseapp.com",
  projectId: "vn-pedroni-fotografia-fd52f",
  storageBucket: "vn-pedroni-fotografia-fd52f.firebasestorage.app",
  messagingSenderId: "673075986211",
  appId: "1:673075986211:web:b04ab0c9bf3aa3a5709696"
};

// --- INICIALIZAÇÃO SEGURA ---
let app, auth, db, storage;
const appId = manualConfig.projectId; 
let firebaseInitialized = false;

try {
  if (getApps().length === 0) {
    app = initializeApp(manualConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  firebaseInitialized = true;
  console.log("🔥 Firebase Inicializado");
} catch (e) {
  console.error("Erro Firebase:", e);
}

// --- INDEXED DB HELPER (V14 - OTIMIZADO) ---
const DB_NAME = 'vn_pedroni_v14_fixed'; 
const STORE_CONTENT = 'site_content';
const STORE_ITEMS = 'site_items';

const idb = {
  _dbPromise: null, // Cache de conexão
  open: () => {
    if (idb._dbPromise) return idb._dbPromise;
    
    idb._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => {
          idb._dbPromise = null; // Reset em caso de erro
          reject(request.error);
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_CONTENT)) db.createObjectStore(STORE_CONTENT);
        if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS);
      };
    });
    return idb._dbPromise;
  },
  put: async (storeName, key, value) => {
    try {
      const db = await idb.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        // Otimização: structuredClone é mais rápido que JSON parse/stringify
        const cleanValue = typeof structuredClone === 'function' 
            ? structuredClone(value) 
            : JSON.parse(JSON.stringify(value));
            
        const req = store.put(cleanValue, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("IDB Put Error:", e); }
  },
  get: async (storeName, key) => {
    try {
      const db = await idb.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  },
  clear: async () => {
     try {
       const req = indexedDB.deleteDatabase(DB_NAME);
       localStorage.clear();
       req.onsuccess = () => {
           console.log("DB Limpo");
           window.location.reload();
       };
     } catch(e) {}
  }
};

// --- HELPERS ---
const isVideo = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:video')) return true; 
  if (url.startsWith('data:image')) return false;

  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('.avi') || lower.includes('.mkv');
};

const normalizeGallery = (gallery) => {
  if (!gallery || !Array.isArray(gallery)) return [];
  return gallery.map(item => {
    if (typeof item === 'string') return { url: item, size: 'landscape', type: isVideo(item) ? 'video' : 'image' };
    return { ...item, size: item.size || 'landscape', type: isVideo(item.url) ? 'video' : 'image' }; 
  });
};

const EditableText = ({ id, tag: Tag, className, value, isEditing, onChange }) => {
  const safeValue = (value !== undefined && value !== null && typeof value !== 'object') ? String(value) : '';
  if (isEditing) {
    return (
      <textarea 
        value={safeValue} 
        onChange={e => onChange(id, e.target.value)} 
        className={`w-full bg-yellow-100/10 border border-yellow-500/20 p-1 focus:outline-none rounded resize-none ${className}`} 
      />
    );
  }
  return <Tag className={className}>{safeValue}</Tag>;
};

const PinterestIcon = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 20l4-9" />
    <path d="M10.7 13c.437 1.263 1.43 2 2.55 2 2.071 0 3.75-1.554 3.75-4.5 0-3.32-2.65-6-6-6S5 7.18 5 10.5c0 1.6.86 3.03 2.15 3.9" />
    <path d="M16 10.5c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5S13.672 9 14.5 9s1.5.672 1.5 1.5z" />
  </svg>
);

const SmartSocialButton = ({ icon: Icon, link, isEditing, onUpdate, label }) => {
    const handleClick = () => {
        if (isEditing) {
            const newLink = prompt(`Editar Link do ${label}:`, link);
            if (newLink !== null) onUpdate(newLink);
        } else {
            if (link) window.open(link, '_blank');
        }
    };
    return (
        <button 
            onClick={handleClick} 
            className={`p-3 transition-colors border rounded-full relative group ${isEditing ? 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10' : 'border-white/10 hover:text-white'}`}
            title={isEditing ? `Editar ${label}` : label}
        >
            <Icon size={20} />
            {isEditing && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black rounded-full p-0.5">
                    <Edit2 size={8} />
                </span>
            )}
        </button>
    );
};

const ImageWithLoader = ({ src, alt, className, style, onClick }) => {
    const [progress, setProgress] = useState(0);
    const [imgLoading, setImgLoading] = useState(true);
    const [currentSrc, setCurrentSrc] = useState(null);
    const [error, setError] = useState(false);
    const lastUpdate = useRef(0);

    useEffect(() => {
        if (!src) { setError(true); setImgLoading(false); return; }
        
        setError(false);
        setImgLoading(true);
        setProgress(0);

        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setCurrentSrc(src);
            setImgLoading(false);
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.responseType = "blob";

        // Otimização: Throttle na atualização de progresso para evitar re-renders excessivos
        xhr.onprogress = (event) => {
            const now = Date.now();
            if (event.lengthComputable && (now - lastUpdate.current > 150)) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setProgress(percent);
                lastUpdate.current = now;
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const blobUrl = URL.createObjectURL(xhr.response);
                setCurrentSrc(blobUrl);
                setImgLoading(false);
            } else {
                setCurrentSrc(src);
                setImgLoading(false); 
            }
        };

        xhr.onerror = () => {
            console.warn("XHR falhou, usando tag img padrão");
            setCurrentSrc(src);
            setImgLoading(false);
        };

        xhr.send();

        return () => {
            xhr.abort();
            if (currentSrc && currentSrc.startsWith('blob:') && !src.startsWith('blob:')) {
                URL.revokeObjectURL(currentSrc);
            }
        };
    }, [src]);

    return (
        <div className={`relative overflow-hidden bg-[#e5e5e5] flex items-center justify-center ${className}`} style={style} onClick={onClick}>
            {imgLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f0f0f0] z-10 text-[#593428]">
                    <Loader className="animate-spin mb-2" size={24}/>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{progress}%</span>
                </div>
            )}
            
            {error ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center w-full">
                    <ImageOff size={24} className="mb-2 opacity-50"/>
                    <span className="text-[9px] uppercase tracking-widest opacity-50">Indisponível</span>
                </div>
            ) : (
                <img 
                    src={currentSrc || src} 
                    alt={alt} 
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover transition-all duration-700 ${imgLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                    onError={() => setError(true)}
                />
            )}
        </div>
    );
};

export default function App() {
  // 1. ESTADOS
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Carregando...');
  const [appState, setAppState] = useState('loading'); 
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const [statusMsg, setStatusMsg] = useState('Iniciando...');
  
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  
  // Drag and Drop
  const [draggedItemIndex, setDraggedIndex] = useState(null);
  
  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(null);
  
  // Admin & Modals
  const [isEditing, setIsEditing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showHeroManager, setShowHeroManager] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [newItem, setNewItem] = useState({ title: '', location: '', image: '', category: '', gallery: [] });

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const ignoreRemote = useRef(false);
  const modalScrollRef = useRef(null); 

  // --- DEFAULT CONTENT ---
  const defaultContent = {
    heroTagline: "Natural Beauty & Soul",
    heroTitle: "Eternizando Momentos",
    heroSubtitle: "Filmes e fotografias que contam a sua verdadeira história.",
    heroButton: "Ver Portfólio",
    heroBackgroundType: 'image',
    heroBackgrounds: ["https://images.unsplash.com/photo-1519225421980-715cb0202128?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80"],
    introTitle: "Não criamos apenas imagens,",
    introSubtitle: "criamos herança visual.",
    introText: "Acreditamos que o casamento não é um evento sobre protocolos, mas sobre conexão. É sobre o toque das mãos trêmulas, o olhar cúmplice e a lágrima discreta.",
    marqueeTitle: "Veja nossas Últimas Fotos",
    marqueeImages: ["https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=600&q=80"],
    videoTagline: "Cinematografia",
    videoTitle: "Cinema Documental",
    videoDescription: "Capturamos o movimento e a emoção. Nossos filmes são documentários da sua herança familiar.",
    videoSectionUrl: "", 
    portfolioSubtitle: "Histórias de Amor",
    portfolioTitle: "Portfólio Selecionado",
    teamTitle: "Quem Somos",
    teamMembers: [
      { name: "Lucas Cavalcante", role: "Filmmaker", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80" },
      { name: "Vivyan Pedroni", role: "Fotógrafa", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80" }
    ],
    contactTitle: "Vamos criar algo juntos?",
    contactButton: "Fale Conosco",
    contactLink: "https://wa.me/5511999999999", 
    footerCopyright: "© 2024 VN Pedroni Fotografia.",
    socialInstagram: "https://instagram.com",
    socialPinterest: "https://pinterest.com" 
  };

  const [content, setContent] = useState(defaultContent);
  const [items, setItems] = useState([]);

  // --- 1. BOOTSTRAP: CARREGAR LOCAL ---
  useEffect(() => {
    const boot = async () => {
      try {
        const localContent = await idb.get(STORE_CONTENT, 'main');
        if (localContent && typeof localContent === 'object' && Object.keys(localContent).length > 0) {
          setContent(prev => ({ ...prev, ...localContent }));
          ignoreRemote.current = true;
        }
        
        const localItems = await idb.get(STORE_ITEMS, 'list');
        if (localItems && Array.isArray(localItems) && localItems.length > 0) {
          setItems(localItems);
          ignoreRemote.current = true;
        }
        setAppState('ready');
      } catch(e) { 
        console.error("Erro boot local:", e); 
        setAppState('ready'); 
      } finally { 
        setDataLoaded(true);
        setLoading(false); 
      }
    };
    setTimeout(boot, 500);
  }, []);

  // --- 2. AUTHENTICATION (PÚBLICO) ---
  useEffect(() => {
    if (!firebaseInitialized) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setStatusMsg(u.isAnonymous ? "Visitante" : "Admin Online");
      } else {
        signInAnonymously(auth).catch(() => setStatusMsg("Modo Leitura"));
      }
    });
    return () => unsub();
  }, []);

  // --- 3. SYNC COM NUVEM ---
  useEffect(() => {
    if (isEditing || !firebaseInitialized) return;
    if (ignoreRemote.current) return;

    try {
        const unsubContent = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'site_content', 'main_doc'), (snap) => {
          if (snap.exists()) setContent(prev => ({ ...prev, ...snap.data() }));
        }, err => console.log("Sync content error (ok se offline)"));

        const unsubItems = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'site_portfolio', 'items_doc'), (snap) => {
          if (snap.exists()) setItems(snap.data().items || []);
        }, err => console.log("Sync items error (ok se offline)"));

        return () => { unsubContent(); unsubItems(); };
    } catch(e) {}
  }, [user, isEditing]);

  // --- 4. PERSISTÊNCIA UNIFICADA (OTIMIZADA COM requestIdleCallback) ---
  const saveAll = async () => {
    setSaveStatus('saving');
    setStatusMsg("Salvando...");
    
    try {
      await idb.put(STORE_CONTENT, 'main', content);
      await idb.put(STORE_ITEMS, 'list', items);
      
      if (user && user.email && firebaseInitialized && !isDemoMode) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'site_content', 'main_doc'), content);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'site_portfolio', 'items_doc'), { items });
        setSaveStatus('saved');
        setStatusMsg("Salvo na Nuvem");
      } else {
        setSaveStatus('saved-local');
        setStatusMsg("Salvo Localmente");
      }
    } catch (err) {
      setSaveStatus('saved-local'); 
      setStatusMsg("Salvo Local (Erro Rede)");
    }
    
    setTimeout(() => { if(saveStatus !== 'error') setSaveStatus('idle'); }, 3000);
  };

  useEffect(() => {
    if (!isEditing || !dataLoaded) return;
    
    // Otimização: Salvar apenas quando o browser estiver ocioso
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    const cancelIdleCallback = window.cancelIdleCallback || clearTimeout;
    
    const taskId = idleCallback(() => saveAll(), { timeout: 4000 });
    
    return () => cancelIdleCallback(taskId);
  }, [content, items, isEditing, dataLoaded]);

  // --- 5. UPLOADS COM PROGRESSO ---
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileUpload = async (e, callback, multiple = false) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!user) { alert("Login necessário."); return; }

    const MAX_MB = 15;
    const bigFile = files.find(f => f.size > MAX_MB * 1024 * 1024);
    if (bigFile && !confirm(`Arquivo grande (${(bigFile.size/1024/1024).toFixed(1)}MB). O site pode ficar lento. Continuar?`)) return;

    setLoading(true);
    setLoadingText('Iniciando...');

    try {
      const urls = [];
      
      for (let i = 0; i < files.length; i++) {
          const f = files[i];
          let url = null;
          
          if (user.email && firebaseInitialized && !isDemoMode) {
            try {
               const storageRef = ref(storage, `uploads/${appId}/${Date.now()}_${f.name}`);
               await uploadBytes(storageRef, f);
               url = await getDownloadURL(storageRef);
            } catch (err) { console.warn("Erro Storage, fallback local", err); }
          }
          
          if (!url) {
             setLoadingText(`Salvando ${f.name} (Local)...`);
             url = await convertToBase64(f);
          }
          urls.push(url);
      }
      
      callback(multiple ? urls : urls[0]);
      ignoreRemote.current = true;
      setTimeout(saveAll, 500);
    } catch (err) {
      alert("Erro: " + String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const triggerFileUpload = (callback, multiple = false) => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.multiple = multiple;
      fileInputRef.current.onchange = e => handleFileUpload(e, callback, multiple);
      fileInputRef.current.click();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
      else await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      setShowLogin(false);
      setIsEditing(true);
      setIsDemoMode(false);
    } catch (err) {
      if (err.code === 'auth/operation-not-allowed') {
        alert("Login Email não ativado no Firebase. Ativando modo local.");
        setIsDemoMode(true);
        setShowLogin(false);
        setIsEditing(true);
        setUser({ uid: 'local', email: 'admin@local' });
      } else {
        setAuthError(String(err.message || 'Erro desconhecido'));
      }
    } finally { setLoading(false); }
  };

  // --- ACTIONS ---
  const handleContentChange = (k, v) => { setContent(p => ({ ...p, [k]: v })); ignoreRemote.current = true; };
  const scrollToSection = (id) => { 
    const el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior: 'smooth' }); 
    setMenuOpen(false); 
  };
  
  // --- LAYOUT E REORDENAÇÃO ---
  const handleAddItem = (e) => {
    e.preventDefault();
    const galleryItems = newItem.gallery && newItem.gallery.length > 0 ? newItem.gallery : (newItem.image ? [newItem.image] : []);
    const finalGallery = normalizeGallery(galleryItems);
    const updated = [...items, { ...newItem, id: Date.now().toString(), gallery: finalGallery }];
    setItems(updated);
    ignoreRemote.current = true;
    setShowAddItemModal(false);
    setNewItem({ title: '', location: '', image: '', category: '', gallery: [] });
  };
  
  const handleUpdateSize = (itemId, idx) => {
    const updated = items.map(it => {
      if (it.id !== itemId) return it;
      let g = normalizeGallery(it.gallery);
      const current = g[idx].size || 'landscape';
      const type = g[idx].type;
      
      let nextSize = 'landscape';
      if (type === 'video') nextSize = current === 'landscape' ? 'portrait' : 'landscape';
      else {
          if (current === 'landscape') nextSize = 'square';
          else if (current === 'square') nextSize = 'portrait';
          else nextSize = 'landscape';
      }
      g[idx].size = nextSize;
      if (viewingItem?.id === itemId) setViewingItem({ ...viewingItem, gallery: g });
      return { ...it, gallery: g };
    });
    setItems(updated);
    ignoreRemote.current = true;
  };

  const handleMoveMedia = (itemId, idx, dir) => {
    const updated = items.map(it => {
      if (it.id !== itemId) return it;
      let g = normalizeGallery(it.gallery);
      const [moved] = g.splice(idx, 1);
      g.splice(idx + dir, 0, moved);
      if (viewingItem?.id === itemId) setViewingItem({ ...viewingItem, gallery: g });
      return { ...it, gallery: g };
    });
    setItems(updated);
    ignoreRemote.current = true;
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex || !viewingItem) return;

    const g = [...normalizeGallery(viewingItem.gallery)];
    const draggedItem = g[draggedItemIndex];
    g.splice(draggedItemIndex, 1);
    g.splice(targetIndex, 0, draggedItem);

    const n = items.map(x => x.id === viewingItem.id ? {...x, gallery: g} : x);
    setItems(n);
    setViewingItem({...viewingItem, gallery: g});
    ignoreRemote.current = true;
  };

  const getLabelForSize = (s, type) => {
      if (type === 'video') return 'Video (2x1)';
      switch(s) {
          case 'landscape': return 'Paisagem (2x1)';
          case 'square': return 'Quadrado (1x1)';
          case 'portrait': return 'Retrato (1x2)';
          default: return 'Normal';
      }
  };

  // LIGHTBOX LOGIC
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (lightboxIndex === null || !viewingItem) return;
        const gallery = normalizeGallery(viewingItem.gallery);
        
        if (e.key === 'Escape') setLightboxIndex(null);
        if (e.key === 'ArrowRight') setLightboxIndex((lightboxIndex + 1) % gallery.length);
        if (e.key === 'ArrowLeft') setLightboxIndex((lightboxIndex - 1 + gallery.length) % gallery.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, viewingItem]);


  // --- RENDER & ANIMATION OBSERVER (OTIMIZADO) ---
  useEffect(() => {
    let ticking = false;
    const h = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                setIsScrolled(window.scrollY > 50);
                ticking = false;
            });
            ticking = true;
        }
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    
    const setupObserver = (root = null) => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target); // Para de observar após ativar
                }
            });
        }, { threshold: 0.05, root: root }); 
        
        const elements = root ? root.querySelectorAll('.reveal') : document.querySelectorAll('.reveal');
        elements.forEach(el => observer.observe(el));
        return observer;
    };

    const mainObserver = setupObserver(null);
    let modalObserver = null;

    if (viewingItem && modalScrollRef.current) {
        // Delay crucial para o DOM do modal renderizar e o scroll existir
        setTimeout(() => {
             modalObserver = setupObserver(modalScrollRef.current);
             // Fallback de segurança para garantir visibilidade
             setTimeout(() => {
                 const modalElements = document.querySelectorAll('.modal-content .reveal');
                 modalElements.forEach(el => el.classList.add('active'));
             }, 800);
        }, 100);
    } else {
        // Fallback main
        setTimeout(() => {
             document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
        }, 500);
    }
    
    return () => {
        mainObserver.disconnect();
        if (modalObserver) modalObserver.disconnect();
    };
  }, [items, content, viewingItem, menuOpen, dataLoaded]);

  if ((appState === 'loading' || loading) && !dataLoaded) {
    return (
        <div className="h-screen bg-[#1a1a1a] flex items-center justify-center text-[#EADDCE] flex-col gap-4">
            <Loader className="animate-spin" size={40}/>
            <span className="text-xs tracking-widest uppercase">{loadingText || "Carregando..."}</span>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#593428] font-sans selection:bg-[#593428] selection:text-[#EADDCE] overflow-x-hidden">
      <style>{`
        /* APPLE-LIKE ANIMATIONS */
        :root { --ease-apple: cubic-bezier(0.25, 0.1, 0.25, 1); }
        .reveal { opacity: 0; transform: translateY(20px) scale(0.98); transition: opacity 0.8s var(--ease-apple), transform 0.8s var(--ease-apple); will-change: transform, opacity; }
        .reveal.active { opacity: 1; transform: translateY(0) scale(1); }
        .modal-content .reveal { transition-duration: 0.6s; } 
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeInApple { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
        .animate-fade-in { animation: fadeInApple 0.4s var(--ease-apple) forwards; }
        button:active { transform: scale(0.96); transition: transform 0.1s var(--ease-apple); }
      `}</style>

      <input type="file" ref={fileInputRef} className="hidden" />

      {/* ADMIN BAR */}
      {(user?.email || isEditing) && (
        <div className="fixed top-0 w-full bg-[#593428] text-[#EADDCE] z-[100] py-2 px-6 flex justify-between items-center text-[10px] font-bold tracking-[0.2em] shadow-xl">
          <div className="flex items-center gap-4">
             <span className="bg-white/10 px-2 py-0.5 rounded">VN ADMIN</span>
             {isEditing && <span className="text-yellow-400 animate-pulse">● EDITANDO</span>}
             <div className="flex items-center gap-2 border-l border-white/20 pl-4 ml-2">
                {saveStatus === 'saving' && <span className="text-white animate-pulse flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Salvando...</span>}
                {saveStatus === 'saved' && <span className="text-green-400 flex items-center gap-1"><Cloud size={10}/> Nuvem</span>}
                {saveStatus === 'saved-local' && <span className="text-orange-400 flex items-center gap-1"><HardDrive size={10}/> Local</span>}
                {saveStatus === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={10}/> Erro</span>}
                <span className="opacity-50 text-[9px] hidden md:inline">| {String(statusMsg)}</span>
             </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => saveAll()} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 transition-colors flex items-center gap-2">
               <Save size={12}/> SALVAR AGORA
            </button>
            <button onClick={() => setShowHeroManager(true)} className="border border-white/20 px-3 py-1 rounded hover:bg-white hover:text-black transition-colors">CAPA</button>
            <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-1 rounded transition-colors ${isEditing ? 'bg-yellow-500 text-black' : 'border border-white/20 hover:bg-white hover:text-black'}`}>
              {isEditing ? 'CONCLUIR' : 'EDITAR'}
            </button>
            <button onClick={() => { if(auth) signOut(auth); setUser(null); setIsEditing(false); }} className="bg-red-900/40 p-1.5 rounded-full hover:bg-red-600 transition-colors"><LogOut size={14}/></button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${isScrolled || user?.email ? 'bg-[#593428] shadow-md py-4' : 'bg-transparent py-8'} ${user?.email ? 'top-8' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="transition-colors cursor-pointer text-[#EADDCE]" onClick={() => scrollToSection('home')}>
             <div className="font-serif leading-none">
                <span className="text-2xl md:text-3xl font-bold tracking-tighter uppercase block">VN PEDRONI</span>
                <span className="text-[8px] md:text-[10px] tracking-[0.4em] uppercase opacity-70">Fotografia</span>
             </div>
          </div>
          <button onClick={() => setMenuOpen(true)} className="p-2 rounded-full transition-colors text-[#EADDCE] hover:bg-white/10">
            <Menu size={32}/>
          </button>
        </div>
      </nav>

      {/* MENU */}
      {menuOpen && (
        <div className="fixed inset-0 bg-[#593428] z-[200] flex flex-col items-center justify-center animate-fade-in text-[#EADDCE]">
          <button onClick={() => setMenuOpen(false)} className="absolute top-10 right-10 hover:text-white transition-colors"><X size={40} /></button>
          <div className="flex flex-col items-center gap-8">
            {['Início', 'Portfólio', 'Equipa', 'Contato'].map((label, idx) => (
              <button key={idx} onClick={() => scrollToSection(label === 'Início' ? 'home' : (label === 'Equipa' ? 'team' : (label === 'Contato' ? 'contact' : 'portfolio')))} className="text-4xl md:text-6xl font-serif italic hover:text-white transition-all transform hover:scale-105">
                {label}
              </button>
            ))}
            {!user?.email && (
              <button onClick={() => { setShowLogin(true); setMenuOpen(false); }} className="mt-8 text-[10px] font-bold uppercase tracking-[0.4em] text-[#EADDCE]/50 border border-[#EADDCE]/20 px-8 py-3 rounded-full hover:border-white hover:text-white transition-all flex items-center gap-2">
                <Lock size={12}/> Área Restrita
              </button>
            )}
          </div>
        </div>
      )}

      {/* HERO */}
      <header id="home" className="relative h-screen flex items-center justify-center bg-[#1a1a1a] overflow-hidden">
        <div className="absolute inset-0 z-0">
          {content.heroBackgroundType === 'video' && content.heroBackgrounds?.[0] ? (
            <video ref={videoRef} key={content.heroBackgrounds[0]} src={content.heroBackgrounds[0]} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-50" />
          ) : (
            content.heroBackgrounds?.map((bg, i) => (
              <img key={i} src={bg} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === currentHeroSlide ? 'opacity-50' : 'opacity-0'}`} alt="" />
            ))
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#593428]/10 to-[#593428]/80 pointer-events-none" />
        </div>
        <div className="relative z-10 text-center text-[#EADDCE] px-6 max-w-5xl">
          <div className="reveal active">
            <EditableText id="heroTagline" tag="p" className="text-xl md:text-2xl font-serif italic mb-6 opacity-90" value={content.heroTagline} isEditing={isEditing} onChange={handleContentChange} />
            <EditableText id="heroTitle" tag="h1" className="text-6xl md:text-9xl font-serif mb-8 leading-none tracking-tighter" value={content.heroTitle} isEditing={isEditing} onChange={handleContentChange} />
            <EditableText id="heroSubtitle" tag="p" className="text-[10px] uppercase tracking-[0.3em] font-sans opacity-70 mb-12" value={content.heroSubtitle} isEditing={isEditing} onChange={handleContentChange} />
            <button onClick={() => scrollToSection('portfolio')} className="border border-[#EADDCE] px-12 py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-[#EADDCE] hover:text-[#593428] transition-all">
              {content.heroButton}
            </button>
          </div>
        </div>
      </header>

      {/* INTRO */}
      <section className="py-32 px-6 max-w-4xl mx-auto text-center reveal">
        <EditableText id="introTitle" tag="h2" className="text-4xl md:text-6xl font-serif mb-4" value={content.introTitle} isEditing={isEditing} onChange={handleContentChange} />
        <EditableText id="introSubtitle" tag="h3" className="text-3xl md:text-5xl font-serif italic mb-8 opacity-60" value={content.introSubtitle} isEditing={isEditing} onChange={handleContentChange} />
        <div className="w-20 h-[1px] bg-[#593428]/20 mx-auto mb-10"></div>
        <EditableText id="introText" tag="p" className="text-lg text-gray-500 font-light leading-relaxed" value={content.introText} isEditing={isEditing} onChange={handleContentChange} />
      </section>

      {/* MARQUEE */}
      <section className="py-20 bg-[#593428] overflow-hidden reveal">
        <div className="text-center mb-12">
           <EditableText id="marqueeTitle" tag="h3" className="text-2xl font-serif italic text-[#EADDCE]" value={content.marqueeTitle} isEditing={isEditing} onChange={handleContentChange} />
           {isEditing && <button onClick={() => triggerFileUpload(urls => handleContentChange('marqueeImages', [...(content.marqueeImages || []), ...urls]), true)} className="mt-4 bg-[#EADDCE] text-[#593428] px-3 py-1 text-[8px] font-bold uppercase rounded-full hover:scale-105 transition-transform">Adicionar Fotos</button>}
        </div>
        <div className="flex w-max animate-marquee gap-6">
          {content.marqueeImages && [...content.marqueeImages, ...content.marqueeImages].map((img, i) => (
            <div key={i} className="relative h-80 w-64 group overflow-hidden shadow-xl rounded-sm">
               <ImageWithLoader src={img} alt="" className="h-full w-full" />
               {isEditing && i < (content.marqueeImages.length) && <button onClick={() => {let l = [...content.marqueeImages]; l.splice(i,1); handleContentChange('marqueeImages', l);}} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"><Trash2 size={12}/></button>}
            </div>
          ))}
        </div>
      </section>

      {/* CINEMA */}
      <section className="py-32 bg-white reveal">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 order-2 md:order-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 border-b border-[#593428] pb-1">{content.videoTagline}</span>
            <EditableText id="videoTitle" tag="h2" className="text-5xl md:text-7xl font-serif leading-tight" value={content.videoTitle} isEditing={isEditing} onChange={handleContentChange} />
            <EditableText id="videoDescription" tag="p" className="text-gray-500 leading-relaxed font-light text-lg" value={content.videoDescription} isEditing={isEditing} onChange={handleContentChange} />
          </div>
          <div className="order-1 md:order-2 relative aspect-video group shadow-2xl rounded-sm bg-black overflow-hidden">
             {content.videoSectionUrl ? (
                <video key={content.videoSectionUrl} src={content.videoSectionUrl} controls className="w-full h-full object-cover" playsInline />
             ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                   <Film size={40} className="opacity-50"/>
                   <span className="text-xs uppercase tracking-widest">Nenhum filme selecionado</span>
                </div>
             )}
             {isEditing && (
                <button onClick={() => triggerFileUpload(url => handleContentChange('videoSectionUrl', url))} className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 text-[10px] uppercase font-bold shadow-lg hover:bg-[#EADDCE] transition-colors z-20 flex items-center gap-2">
                  <Upload size={14}/> {content.videoSectionUrl ? 'Trocar Filme' : 'Adicionar Filme'}
                </button>
             )}
          </div>
        </div>
      </section>

      {/* PORTFÓLIO */}
      <section id="portfolio" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-20 reveal border-b border-[#593428]/10 pb-12">
          <div>
            <EditableText id="portfolioSubtitle" tag="span" className="text-[10px] font-bold uppercase tracking-widest opacity-50 block mb-2" value={content.portfolioSubtitle} isEditing={isEditing} onChange={handleContentChange} />
            <EditableText id="portfolioTitle" tag="h2" className="text-4xl md:text-6xl font-serif" value={content.portfolioTitle} isEditing={isEditing} onChange={handleContentChange} />
          </div>
          {isEditing && <button onClick={() => setShowAddItemModal(true)} className="bg-[#593428] text-[#EADDCE] px-8 py-4 text-[10px] font-bold uppercase tracking-widest hover:brightness-110 shadow-lg flex items-center gap-2"><Plus size={16}/> Novo Trabalho</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {items.map((item, i) => (
            <div key={item.id} className="group cursor-pointer reveal bg-white shadow-sm hover:shadow-2xl transition-all duration-500 pb-10" style={{ transitionDelay: `${(i % 3)*150}ms` }} onClick={() => setViewingItem(item)}>
              <div className="relative aspect-[3/4] overflow-hidden mb-8 bg-gray-100">
                <ImageWithLoader src={item.image} alt={item.title} className="h-full w-full" />
                {isEditing && <button onClick={(e) => { e.stopPropagation(); if(confirm("Apagar Álbum?")) { const n = items.filter(x => x.id !== item.id); setItems(n); ignoreRemote.current = true; } }} className="absolute top-4 right-4 bg-red-600 text-white p-3 rounded-full shadow-lg z-20"><Trash2 size={16}/></button>}
                <div className="absolute inset-0 bg-[#593428]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="bg-[#FAF9F6] text-[#593428] px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl">Explorar Galeria</span>
                </div>
              </div>
              <div className="px-8 text-center">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#9C7C60] block mb-3">{item.category}</span>
                <h3 className="text-3xl font-serif italic mb-3">{item.title}</h3>
                <p className="text-[10px] uppercase tracking-widest opacity-50">{item.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EQUIPA */}
      <section id="team" className="py-32 bg-[#FAF9F6] reveal">
        <div className="max-w-5xl mx-auto px-6 text-center mb-24">
          <EditableText id="teamTitle" tag="h2" className="text-5xl md:text-7xl font-serif" value={content.teamTitle} isEditing={isEditing} onChange={handleContentChange} />
          <div className="w-20 h-[1px] bg-[#593428] mx-auto mt-8"></div>
        </div>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-24">
          {content.teamMembers?.map((m, i) => (
            <div key={i} className="text-center group">
              <div className="h-[650px] overflow-hidden mb-10 relative shadow-2xl rounded-sm">
                <ImageWithLoader src={m.image} alt={m.name} className="h-full w-full" />
                {isEditing && (
                   <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4">
                      <button onClick={() => triggerFileUpload(url => { let l = [...content.teamMembers]; l[i].image = url; handleContentChange('teamMembers', l); })} className="bg-white text-black px-6 py-2 text-[10px] font-bold uppercase rounded-full shadow-xl hover:bg-[#EADDCE]">Trocar Foto</button>
                      <input value={m.name} onChange={e => { let l = [...content.teamMembers]; l[i].name = e.target.value; handleContentChange('teamMembers', l); }} className="bg-white/20 border border-white/30 text-white text-center p-2 rounded w-64 focus:bg-white/30 outline-none" placeholder="Nome do membro" />
                   </div>
                )}
              </div>
              {!isEditing && (
                <>
                  <h3 className="text-4xl font-serif italic mb-3">{m.name}</h3>
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-60">{m.role}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-[#593428] text-[#EADDCE] py-32 px-6 text-center">
        <div className="reveal">
          <EditableText id="contactTitle" tag="h2" className="text-4xl md:text-8xl font-serif mb-16 text-white leading-tight max-w-4xl mx-auto tracking-tighter" value={content.contactTitle} isEditing={isEditing} onChange={handleContentChange} />
          
          {/* BOTÃO FALE CONOSCO EDITÁVEL */}
          <div className="flex justify-center mb-24">
             {isEditing ? (
                 <button onClick={() => {
                     const newLink = prompt("Link do Fale Conosco:", content.contactLink);
                     if(newLink) handleContentChange('contactLink', newLink);
                 }} className="border border-yellow-500 text-yellow-500 px-16 py-6 text-[10px] font-bold uppercase tracking-[0.5em] hover:bg-yellow-500/10 flex items-center gap-3">
                     <Edit2 size={12}/> Editar Link do Botão
                 </button>
             ) : (
                 <button onClick={() => window.open(content.contactLink, '_blank')} className="border border-[#EADDCE] px-16 py-6 text-[10px] font-bold uppercase tracking-[0.5em] hover:bg-[#EADDCE] hover:text-[#593428] transition-all rounded-sm shadow-2xl">
                    {content.contactButton}
                 </button>
             )}
          </div>
          
          <div className="flex justify-center gap-12 opacity-50 mb-20">
            <SmartSocialButton icon={Instagram} label="Instagram" link={content.socialInstagram} isEditing={isEditing} onUpdate={(l) => handleContentChange('socialInstagram', l)} />
            <SmartSocialButton icon={PinterestIcon} label="Pinterest" link={content.socialPinterest} isEditing={isEditing} onUpdate={(l) => handleContentChange('socialPinterest', l)} />
          </div>
          
          <p className="text-[10px] uppercase tracking-[0.4em] opacity-20 font-sans mb-12">{content.footerCopyright}</p>
        </div>
      </footer>

      {/* MODAL ÁLBUM */}
      {viewingItem && !lightboxIndex && lightboxIndex !== 0 && (
        <div className="fixed inset-0 z-[150] bg-[#FAF9F6] overflow-y-auto animate-fade-in p-6 md:p-20 modal-content" ref={modalScrollRef}>
          <button onClick={() => setViewingItem(null)} className="fixed top-8 right-8 bg-[#593428] text-[#EADDCE] p-4 rounded-full z-[160] hover:scale-110 shadow-2xl transition-transform"><X size={28}/></button>
          <div className="max-w-7xl mx-auto">
             <div className="text-center mb-20 reveal active">
                <h2 className="text-5xl md:text-9xl font-serif leading-none mb-6 tracking-tighter">{viewingItem.title}</h2>
                <div className="flex justify-center gap-8 text-[11px] uppercase tracking-[0.4em] opacity-50 font-bold">
                   <span>{viewingItem.location}</span>
                   <span>•</span>
                   <span>{viewingItem.category}</span>
                </div>
             </div>
             
             {/* GRID DENSE MATEMÁTICO - 2 COLUNAS MOBILE, 4 DESKTOP */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[minmax(0,_1fr)] grid-flow-dense">
                {normalizeGallery(viewingItem.gallery).map((m, i) => (
                  <div 
                      key={i} 
                      className={`relative group reveal active overflow-hidden shadow-xl rounded-lg ${
                          m.size === 'landscape' ? 'col-span-2 row-span-1 aspect-[2/1]' : 
                          m.size === 'square' ? 'col-span-1 row-span-1 aspect-square' : 
                          'col-span-1 row-span-2 aspect-[1/2]'
                      } bg-gray-100`}
                      draggable={isEditing}
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i)}
                  >
                      {m.type === 'video' ? (
                        <video 
                           src={m.url} 
                           autoPlay 
                           muted 
                           loop 
                           playsInline 
                           className="w-full h-full object-cover transition-opacity duration-1000 opacity-0 animate-fade-in absolute inset-0" 
                           onLoadedData={(e) => e.target.classList.remove('opacity-0')} 
                        />
                      ) : (
                        <ImageWithLoader 
                            src={m.url} 
                            alt="" 
                            className="w-full h-full absolute inset-0 cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={() => !isEditing && setLightboxIndex(i)} 
                        />
                      )}
                      
                      {isEditing && (
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3 z-20 transition-all duration-500 cursor-move">
                          <GripVertical className="text-white mb-2 opacity-50" />
                          <div className="flex gap-4">
                             {/* Botão de Layout (Só aparece se NÃO for vídeo) */}
                             {m.type !== 'video' && (
                                 <button onClick={() => {
                                     let g = [...viewingItem.gallery];
                                     const sizes = ['landscape', 'square', 'portrait'];
                                     g[i].size = sizes[(sizes.indexOf(g[i].size || 'landscape') + 1) % sizes.length];
                                     const n = items.map(x => x.id === viewingItem.id ? {...x, gallery: g} : x);
                                     setItems(n);
                                     setViewingItem({...viewingItem, gallery: g});
                                     ignoreRemote.current = true;
                                 }} className="bg-[#EADDCE] text-[#593428] px-4 py-2 rounded-full text-[10px] font-bold uppercase w-32 flex justify-center"><LayoutGrid size={14} className="mr-2"/> {
                                    m.size === 'square' ? '1x1' : m.size === 'portrait' ? '1x2' : '2x1'
                                 }</button>
                             )}
                             
                             <button onClick={() => { 
                                if(!confirm("Remover?")) return;
                                let g = [...viewingItem.gallery]; g.splice(i,1); 
                                const n = items.map(x => x.id === viewingItem.id ? {...x, gallery: g} : x); 
                                setItems(n);
                                setViewingItem({...viewingItem, gallery: g});
                                ignoreRemote.current = true;
                             }} className="bg-red-600 text-white p-2 rounded-full"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
                {isEditing && (
                  <div onClick={() => triggerFileUpload(async urls => {
                      const ns = (Array.isArray(urls) ? urls : [urls]).map(u => ({ url: u, size: 'landscape', type: isVideo(u) ? 'video' : 'image' }));
                      const g = [...(viewingItem.gallery || []), ...ns];
                      const n = items.map(x => x.id === viewingItem.id ? {...x, gallery: g} : x);
                      setItems(n);
                      setViewingItem({...viewingItem, gallery: g});
                      ignoreRemote.current = true;
                  }, true)} className="border-2 border-dashed border-[#593428]/20 flex flex-col items-center justify-center text-[#593428]/40 cursor-pointer hover:bg-white hover:text-[#593428] transition-all bg-white/50 reveal active shadow-inner min-h-[450px] aspect-[2/1] col-span-2">
                    <Plus size={60}/><span className="text-[12px] font-bold uppercase mt-6">Adicionar Mídia</span>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX (APPLE STYLE) */}
      {(lightboxIndex !== null && viewingItem) && (
          <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in">
              <button onClick={() => setLightboxIndex(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 p-2 rounded-full backdrop-blur-sm z-50">
                  <X size={24} />
              </button>
              
              <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img 
                      src={normalizeGallery(viewingItem.gallery)[lightboxIndex].url} 
                      className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl rounded-sm transition-transform duration-300"
                      alt=""
                  />
                  
                  <button 
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + viewingItem.gallery.length) % viewingItem.gallery.length); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white bg-white/10 p-4 rounded-full backdrop-blur-sm hover:scale-110 transition-all"
                  >
                      <ChevronLeft size={32}/>
                  </button>

                  <button 
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % viewingItem.gallery.length); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white bg-white/10 p-4 rounded-full backdrop-blur-sm hover:scale-110 transition-all"
                  >
                      <ChevronRight size={32}/>
                  </button>
              </div>
          </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 z-[200] bg-[#593428]/98 flex items-center justify-center p-6 backdrop-blur-md animate-fade-in">
          <div className="bg-white p-12 max-w-md w-full rounded shadow-2xl relative text-center border border-[#593428]/10 text-black">
            <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 opacity-40 hover:opacity-100"><X size={24}/></button>
            <h3 className="text-4xl font-serif mb-4 text-[#593428]">VN Admin</h3>
            <form onSubmit={handleLogin} className="space-y-6">
              <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full border-b border-[#593428]/20 p-4 outline-none text-sm" required />
              <input type="password" placeholder="Senha" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full border-b border-[#593428]/20 p-4 outline-none text-sm" required />
              {authError && <p className="text-red-500 text-xs">{authError}</p>}
              <button className="w-full bg-[#593428] text-[#EADDCE] py-5 uppercase font-bold tracking-[0.3em] hover:opacity-90 shadow-xl">Entrar</button>
            </form>
          </div>
        </div>
      )}

      {showAddItemModal && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#FAF9F6] p-12 max-w-xl w-full rounded-sm text-[#593428] max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setShowAddItemModal(false)} className="absolute top-6 right-6 opacity-50"><X size={24}/></button>
            <h3 className="text-4xl font-serif mb-10 text-center">Novo Álbum</h3>
            <form onSubmit={handleAddItem} className="space-y-6">
              <input value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="Título" className="w-full border-b border-[#593428]/20 p-4 bg-transparent outline-none text-black" required />
              <div className="grid grid-cols-2 gap-6">
                 <input value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} placeholder="Local" className="w-full border-b border-[#593428]/20 p-4 bg-transparent outline-none text-black" required />
                 <input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="Categoria" className="w-full border-b border-[#593428]/20 p-4 bg-transparent outline-none text-black" required />
              </div>
              <div onClick={() => triggerFileUpload(url => setNewItem({...newItem, image: url}))} className="border-2 border-dashed border-[#593428]/10 p-12 text-center cursor-pointer hover:bg-white/50">
                 {newItem.image ? (
                   <div className="relative w-full h-48">
                     <img src={newItem.image} className="w-full h-full object-contain shadow-2xl" alt="" />
                   </div>
                 ) : (
                   <div className="text-gray-400 flex flex-col items-center justify-center h-48"><ImageIcon size={40} className="mb-4"/><span>Capa Principal</span></div>
                 )}
              </div>
              <button className="w-full bg-[#593428] text-[#EADDCE] py-5 uppercase font-bold tracking-[0.3em] hover:opacity-95 shadow-xl">Publicar</button>
            </form>
          </div>
        </div>
      )}

      {showHeroManager && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4">
          <div className="bg-white p-12 max-w-4xl w-full rounded-sm relative max-h-[90vh] overflow-y-auto text-black">
            <button onClick={() => setShowHeroManager(false)} className="absolute top-6 right-6 hover:text-red-500"><X size={24}/></button>
            <h3 className="text-4xl font-serif mb-10 text-[#593428]">Capa</h3>
            <div className="flex gap-4 mb-10">
               <button onClick={() => handleContentChange('heroBackgroundType', 'image')} className={`px-8 py-3 text-[10px] font-bold uppercase tracking-widest border ${content.heroBackgroundType === 'image' ? 'bg-[#593428] text-[#EADDCE]' : 'text-gray-400'}`}>Imagens</button>
               <button onClick={() => handleContentChange('heroBackgroundType', 'video')} className={`px-8 py-3 text-[10px] font-bold uppercase tracking-widest border ${content.heroBackgroundType === 'video' ? 'bg-[#593428] text-[#EADDCE]' : 'text-gray-400'}`}>Vídeo</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {(content.heroBackgrounds || []).map((bg, idx) => (
                <div key={idx} className="relative group aspect-video shadow-md overflow-hidden bg-gray-50 rounded">
                   {content.heroBackgroundType === 'video' ? <div className="bg-black w-full h-full flex items-center justify-center text-white"><Play size={20}/></div> : <ImageWithLoader src={bg} alt="" className="h-full w-full" />}
                   <button onClick={() => { const b = [...content.heroBackgrounds]; b.splice(idx,1); handleContentChange('heroBackgrounds', b); }} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"><Trash2 size={12}/></button>
                </div>
              ))}
              <button onClick={() => triggerFileUpload(url => handleContentChange('heroBackgrounds', [...(content.heroBackgrounds || []), ...(Array.isArray(url) ? url : [url])]), true)} className="border-2 border-dashed border-gray-200 flex flex-col items-center justify-center aspect-video text-gray-400 hover:text-[#593428] hover:border-[#593428] transition-all bg-gray-50 rounded">
                <Plus size={30}/><span className="text-[9px] uppercase font-bold mt-3">Upload</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLink && (
        <div className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-10 max-w-md w-full rounded shadow-2xl relative text-center text-black animate-fade-in">
            <h3 className="text-2xl font-serif mb-6 text-[#593428]">Configurar {editingLink.label}</h3>
            <div className="text-left mb-6">
               <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-2 font-bold">URL Completa</label>
               <input value={editingLink.url} onChange={e => setEditingLink({...editingLink, url: e.target.value})} className="w-full border-b border-gray-300 p-3 outline-none focus:border-[#593428] font-sans text-sm" placeholder="https://instagram.com/vn_pedroni" />
            </div>
            <div className="flex gap-4">
              <button onClick={() => { handleContentChange(editingLink.id, editingLink.url); setEditingLink(null); }} className="flex-1 bg-[#593428] text-white py-4 uppercase font-bold text-[10px] tracking-widest hover:opacity-90 shadow-lg transition-opacity">Salvar Alteração</button>
              <button onClick={() => setEditingLink(null)} className="flex-1 border border-gray-300 py-4 text-[10px] uppercase font-bold tracking-widest hover:bg-gray-50 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading && !dataLoaded && (
        <div className="fixed inset-0 z-[500] bg-[#593428]/98 flex items-center justify-center text-[#EADDCE] flex-col animate-fade-in backdrop-blur-sm">
          <Loader className="animate-spin mb-6" size={60}/><span className="uppercase tracking-[0.5em] font-bold text-xs animate-pulse">{loadingText}</span>
        </div>
      )}
    </div>
  );
}
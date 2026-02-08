
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Scene, Language, Theme, Role, ScriptLine } from './types';
import { TRANSLATIONS, SUPPORT_LINK, AUTHOR_LINK } from './constants';
import { parseScript } from './services/geminiService';
import { saveAudio, getAudio, deleteAudio } from './services/storage';

// Declare global libraries added via script tags
declare const mammoth: any;
declare const pdfjsLib: any;

// Set PDF.js worker
if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// --- Icons ---

const IconHelp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

const IconMic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);

const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);

// --- Proper Components ---

const LineCard: React.FC<{
  line: ScriptLine;
  updateLine: (id: string, updates: Partial<ScriptLine>) => void;
  t: any;
}> = ({ line, updateLine, t }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [hasAudio, setHasAudio] = useState(!!line.audioKey);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHasAudio(!!line.audioKey);
  }, [line.audioKey]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [line.text]);

  const toggleRole = () => {
    updateLine(line.id, { role: line.role === 'ME' ? 'PARTNER' : 'ME' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const key = `audio_${line.id}`;
        await saveAudio(key, blob);
        updateLine(line.id, { audioKey: key });
        setHasAudio(true);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const playRecording = async () => {
    if (!line.audioKey) return;
    const blob = await getAudio(line.audioKey);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    }
  };

  return (
    <div className={`group p-6 rounded-[2rem] border-2 transition-all duration-300 ${line.role === 'ME' ? 'border-indigo-100 bg-indigo-50/20 dark:border-indigo-900/30 dark:bg-indigo-900/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/40'} hover:border-indigo-400 dark:hover:border-indigo-600`}>
      <div className="flex justify-between items-center mb-4">
        <input 
          value={line.character || ''}
          onChange={(e) => updateLine(line.id, { character: e.target.value.toUpperCase() })}
          className="bg-transparent font-black text-slate-400 dark:text-slate-500 outline-none w-1/2 text-[10px] tracking-[0.2em] uppercase focus:text-indigo-500 transition-colors"
          placeholder="CHARACTER"
        />
        <button 
          onClick={toggleRole}
          className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all transform active:scale-95 shadow-sm ${line.role === 'ME' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}
        >
          {line.role === 'ME' ? t.me : t.partner}
        </button>
      </div>
      
      {line.direction && (
        <input 
          value={line.direction || ''}
          onChange={(e) => updateLine(line.id, { direction: e.target.value })}
          className="block w-full bg-transparent italic text-slate-400 mb-3 outline-none text-sm font-script"
          placeholder="(direction)"
        />
      )}

      <textarea 
        ref={textareaRef}
        value={line.text || ''}
        onChange={(e) => updateLine(line.id, { text: e.target.value })}
        className="w-full bg-transparent dark:text-slate-100 outline-none resize-none mb-6 font-script text-xl leading-relaxed transition-all placeholder:text-slate-300"
        style={{ overflow: 'hidden' }}
        placeholder="Line text..."
      />

      {line.role === 'PARTNER' && (
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {!isRecording ? (
            <button 
              onClick={startRecording} 
              className="flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
            >
              <IconMic /> {t.record}
            </button>
          ) : (
            <button 
              onClick={stopRecording} 
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest animate-pulse shadow-lg"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-sm" /> {t.stop}
            </button>
          )}
          {hasAudio && (
            <button 
              onClick={playRecording} 
              className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
            >
              <IconPlay /> {t.play}
            </button>
          )}
          {hasAudio && !isRecording && (
             <div className="ml-auto flex gap-0.5">
               {[1, 2, 3, 4].map(i => <div key={i} className="w-1 h-3 bg-green-400/30 rounded-full" />)}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

const PartnerAudioPlayer: React.FC<{ line: ScriptLine, onPlayNext: () => void }> = ({ line, onPlayNext }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (line.role === 'PARTNER' && line.audioKey) {
        const play = async () => {
            const blob = await getAudio(line.audioKey!);
            if (blob && !isCancelled) {
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;
                setIsPlaying(true);
                audio.onended = () => {
                    if (!isCancelled) {
                        setIsPlaying(false);
                        setTimeout(onPlayNext, 800);
                    }
                };
                audio.play().catch(() => !isCancelled && setIsPlaying(false));
            }
        };
        play();
    }
    return () => {
      isCancelled = true;
      if (audioRef.current) audioRef.current.pause();
    };
  }, [line.id, line.audioKey, line.role, onPlayNext]);

  if (line.role === 'ME') return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
       {isPlaying && (
         <div className="flex gap-1.5 h-16 items-end">
           {[1, 2, 3, 4, 5, 6, 7].map(i => (
             <div key={i} className="w-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s`, height: `${20 + (i * 4) + (Math.random() * 20)}px` }} />
           ))}
         </div>
       )}
    </div>
  );
};

const NewSceneForm: React.FC<{ onBack: () => void, onCreate: (title: string, text: string) => void, t: any, isParsing: boolean }> = ({ onBack, onCreate, t, isParsing }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let extractedText = "";

      if (extension === 'pdf') {
        extractedText = await extractTextFromPDF(file);
      } else if (extension === 'docx') {
        extractedText = await extractTextFromDOCX(file);
      } else {
        // Assume TXT or other compatible text format
        const reader = new FileReader();
        extractedText = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      }

      setText(extractedText);
      // Auto-populate title if empty
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } catch (err) {
      console.error(err);
      alert("Error processing file. Please try another format or copy-paste.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="text-indigo-600 mb-8 font-black flex items-center gap-2 hover:translate-x-[-4px] transition-transform text-xs uppercase tracking-widest">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {t.back}
      </button>
      <h2 className="text-4xl font-black mb-10 dark:text-white tracking-tight">{t.newScene}</h2>
      <div className="space-y-6">
        <div className="group">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 group-focus-within:text-indigo-500 transition-colors">{t.title}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-6 py-4 rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 dark:text-white focus:border-indigo-500 outline-none transition-all shadow-sm" placeholder="Ex: Hamlet - Act 1" />
        </div>
        <div className="group">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 group-focus-within:text-indigo-500 transition-colors">{t.script}</label>
          <div className="relative">
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-96 px-6 py-4 rounded-[2.5rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 dark:text-white focus:border-indigo-500 outline-none resize-none transition-all font-script text-lg leading-relaxed shadow-sm" placeholder={t.pasteScript} />
            {isProcessingFile && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 rounded-[2.5rem] flex items-center justify-center backdrop-blur-sm transition-all animate-in fade-in">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Processing file...</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 pt-4">
           <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-8 py-4 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
             Upload .txt .pdf .docx
             <input type="file" accept=".txt,.pdf,.docx" className="hidden" onChange={handleFileChange} />
           </label>
           <button disabled={!text.trim() || isParsing || isProcessingFile} onClick={() => onCreate(title, text)} className="flex-1 bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-3xl font-black text-[12px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95 hover:bg-indigo-700">
            {isParsing ? t.parsing : t.parse}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

export default function App() {
  const [scenes, setScenes] = useState<Scene[]>(() => {
    const saved = localStorage.getItem('gmtl_scenes');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('gmtl_lang') as Language) || 'ru');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('gmtl_theme') as Theme) || 'system');
  const [view, setView] = useState<'list' | 'new' | 'edit' | 'rehearse' | 'settings' | 'help'>('list');
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rehearsalIndex, setRehearsalIndex] = useState(0);

  const t = TRANSLATIONS[lang];

  useEffect(() => { localStorage.setItem('gmtl_scenes', JSON.stringify(scenes)); }, [scenes]);
  useEffect(() => { localStorage.setItem('gmtl_lang', lang); localStorage.setItem('gmtl_theme', theme); }, [lang, theme]);
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const activeScene = useMemo(() => scenes.find(s => s.id === activeSceneId), [scenes, activeSceneId]);

  const handleCreateScene = useCallback(async (title: string, rawText: string) => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const parsedLines = await parseScript(rawText);
      const newScene: Scene = {
        id: crypto.randomUUID(),
        title: title || `Scene ${scenes.length + 1}`,
        rawText,
        createdAt: Date.now(),
        lines: parsedLines.map((line: any) => ({ 
          ...line, 
          id: crypto.randomUUID(), 
          role: 'PARTNER' 
        }))
      };
      setScenes(prev => [newScene, ...prev]);
      setActiveSceneId(newScene.id);
      setView('edit');
    } catch (err: any) {
      console.error("Scene creation failed:", err);
      alert(`${t.parsing} error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  }, [scenes.length, t.parsing]);

  const updateLine = useCallback((lineId: string, updates: Partial<ScriptLine>) => {
    if (!activeSceneId) return;
    setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, lines: s.lines.map(l => l.id === lineId ? { ...l, ...updates } : l) } : s));
  }, [activeSceneId]);

  const deleteScene = useCallback((id: string) => {
    if (confirm("Delete this scene?")) {
      setScenes(prev => prev.filter(s => s.id !== id));
      if (activeSceneId === id) setActiveSceneId(null);
    }
  }, [activeSceneId]);

  const handlePlayNext = useCallback(() => {
    if (activeScene && rehearsalIndex < activeScene.lines.length - 1) setRehearsalIndex(i => i + 1);
  }, [rehearsalIndex, activeScene]);

  // Main navigation components
  const Header = () => (
    <header className="sticky top-0 z-40 w-full border-b bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 flex justify-between items-center px-6 md:px-12">
      <h1 
        className="text-xl font-black bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity" 
        onClick={() => setView('list')}
      >
        {t.appName.toUpperCase()}
      </h1>
      <div className="flex gap-1 md:gap-3">
        <button onClick={() => setView('help')} className="p-3 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"><IconHelp /></button>
        <button onClick={() => setView('settings')} className="p-3 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"><IconSettings /></button>
      </div>
    </header>
  );

  if (view === 'rehearse' && activeScene) {
    const currentLine = activeScene.lines[rehearsalIndex];
    if (!currentLine) return null;
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 z-50 flex flex-col p-8 overflow-hidden animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-10 max-w-6xl mx-auto w-full">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-400 font-black tracking-[0.2em] text-[10px] uppercase">{rehearsalIndex + 1} / {activeScene.lines.length}</div>
          <button 
            onClick={() => setView('edit')} 
            className="bg-rose-500 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 hover:bg-rose-600 transition-all"
          >
            {t.finish}
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full overflow-y-auto scrollbar-hide py-12">
          <div className="text-center">
            <span className={`inline-block px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] mb-8 shadow-sm transition-all uppercase ${currentLine.role === 'ME' ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'}`}>
              {String(currentLine.character || '')}
            </span>
            {currentLine.direction && (
              <p className="text-slate-400 italic mb-10 text-2xl font-script opacity-80 leading-relaxed px-4">
                {String(currentLine.direction)}
              </p>
            )}
            <h3 className={`text-4xl md:text-7xl font-script leading-tight dark:text-white transition-all px-4 ${currentLine.role === 'PARTNER' ? 'opacity-20 blur-[2px]' : 'opacity-100'}`}>
              {String(currentLine.text || '')}
            </h3>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full">
          <div className="h-2 bg-slate-50 dark:bg-slate-900 rounded-full mb-12 overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700 ease-out shadow-lg" style={{ width: `${((rehearsalIndex + 1) / activeScene.lines.length) * 100}%` }} />
          </div>

          <div className="flex justify-between gap-6 pb-12">
            <button 
              disabled={rehearsalIndex === 0} 
              onClick={() => setRehearsalIndex(i => i - 1)} 
              className="flex-1 py-5 bg-slate-50 dark:bg-slate-900 dark:text-slate-100 rounded-[2rem] font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.back}
            </button>
            <PartnerAudioPlayer line={currentLine} onPlayNext={handlePlayNext} />
            <button 
              disabled={rehearsalIndex === activeScene.lines.length - 1} 
              onClick={() => setRehearsalIndex(i => i + 1)} 
              className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all hover:bg-indigo-700 shadow-2xl shadow-indigo-600/30"
            >
              {t.next}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-indigo-100 dark:selection:bg-indigo-900">
      <Header />
      <main className="pb-32 pt-10">
        {view === 'list' && (
          <div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-12 px-2">
              <h2 className="text-4xl font-black dark:text-white tracking-tight">{t.myScenes}</h2>
              <button 
                onClick={() => setView('new')} 
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-3xl font-black shadow-xl shadow-indigo-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                <IconPlus /> {t.newScene}
              </button>
            </div>
            {scenes.length === 0 ? (
              <div className="text-center py-32 border-4 border-dashed rounded-[3rem] dark:border-slate-800/50 dark:text-slate-600">
                <div className="mb-6 opacity-20"><IconPlus /></div>
                <p className="text-xl font-bold">{t.noScenes}</p>
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {scenes.map(s => (
                  <div 
                    key={s.id} 
                    className="bg-slate-50 dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-transparent flex flex-col justify-between hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-2xl hover:translate-y-[-6px] transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => deleteScene(s.id)} className="text-rose-400 hover:text-rose-600 p-2">✕</button>
                    </div>
                    <div>
                      <h3 className="font-black text-2xl mb-3 dark:text-white line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">{s.title}</h3>
                      <p className="text-[10px] font-black text-slate-400 mb-8 uppercase tracking-[0.2em]">{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => { setActiveSceneId(s.id); setView('edit'); }} 
                      className="w-full text-[11px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 py-4 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group-hover:shadow-md"
                    >
                      {t.edit}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'new' && <NewSceneForm onBack={() => setView('list')} onCreate={handleCreateScene} t={t} isParsing={isParsing} />}
        
        {view === 'edit' && activeScene && (
          <div className="p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-12">
              <button 
                onClick={() => setView('list')} 
                className="text-indigo-600 font-black flex items-center gap-2 hover:translate-x-[-4px] transition-transform text-xs uppercase tracking-widest"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                {t.back}
              </button>
              <button 
                onClick={() => { setRehearsalIndex(0); setView('rehearse'); }} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 rounded-3xl font-black shadow-2xl shadow-emerald-500/20 transition-all active:scale-95 text-xs uppercase tracking-[0.2em]"
              >
                {t.rehearse}
              </button>
            </div>
            <h2 className="text-4xl font-black mb-12 dark:text-white leading-tight tracking-tight">{activeScene.title}</h2>
            <div className="space-y-10">
              {activeScene.lines.map(l => <LineCard key={l.id} line={l} updateLine={updateLine} t={t} />)}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="p-6 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('list')} className="text-indigo-600 mb-8 font-black flex items-center gap-2 text-xs uppercase tracking-widest">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              {t.back}
            </button>
            <h2 className="text-4xl font-black mb-12 dark:text-white tracking-tight">{t.settings}</h2>
            <div className="space-y-16">
              <section>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{t.language}</label>
                <div className="flex gap-4">
                  {(['en', 'ru', 'es'] as Language[]).map(l => (
                    <button 
                      key={l} 
                      onClick={() => setLang(l)} 
                      className={`flex-1 py-5 rounded-[2rem] border-2 font-black transition-all transform active:scale-95 ${lang === l ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30' : 'border-slate-100 dark:border-slate-800 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50'}`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{t.theme}</label>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as Theme[]).map(th => (
                    <button 
                      key={th} 
                      onClick={() => setTheme(th)} 
                      className={`py-5 rounded-[2rem] border-2 font-black transition-all text-[10px] uppercase tracking-widest transform active:scale-95 ${theme === th ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30' : 'border-slate-100 dark:border-slate-800 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50'}`}
                    >
                      {t[th]}
                    </button>
                  ))}
                </div>
              </section>
              <section className="pt-12 border-t border-slate-100 dark:border-slate-800">
                <a href={SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gradient-to-br from-orange-400 via-rose-500 to-indigo-600 text-white py-6 rounded-[2.5rem] font-black shadow-2xl shadow-rose-500/30 active:scale-[0.98] transition-all hover:brightness-110 uppercase tracking-[0.2em] text-xs">❤️ {t.support}</a>
                <p className="text-center mt-8 text-slate-400 text-[10px] font-black uppercase tracking-widest"><a href={AUTHOR_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">{t.author}</a></p>
              </section>
            </div>
          </div>
        )}

        {view === 'help' && (
          <div className="p-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('list')} className="text-indigo-600 mb-8 font-black flex items-center gap-2 text-xs uppercase tracking-widest">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              {t.back}
            </button>
            <h2 className="text-5xl font-black mb-10 dark:text-white tracking-tight">{t.guideTitle}</h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-500 dark:text-slate-400 text-2xl mb-16 font-medium leading-relaxed font-script italic">{t.guideIntro}</p>
              <ul className="space-y-10 list-none p-0">
                {t.guideSteps.map((step, idx) => (
                  <li key={idx} className="flex gap-8 items-start bg-slate-50/50 dark:bg-slate-900/30 p-10 rounded-[3rem] border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/40 transition-all">
                    <span className="flex-shrink-0 w-12 h-12 rounded-[1.25rem] bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-600/30">{idx + 1}</span>
                    <p className="pt-2 text-slate-700 dark:text-slate-200 font-bold leading-relaxed text-lg">{String(step)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Floating Support Button for desktop */}
      <div className="fixed bottom-8 right-8 hidden lg:block z-40">
        <a href={SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white dark:bg-slate-800 px-6 py-4 rounded-full shadow-2xl border dark:border-slate-700 hover:translate-y-[-4px] transition-all group">
          <span className="text-rose-500 text-xl group-hover:scale-125 transition-transform inline-block">❤️</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.support}</span>
        </a>
      </div>
    </div>
  );
}

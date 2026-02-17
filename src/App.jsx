import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Folder,
  Settings,
  Music,
  AlertCircle,
  HardDrive,
  Volume2,
  VolumeX,
  List,
  Mic2,
  Headphones,
  Sliders,
  Activity
} from 'lucide-react';

/* Encore! Player
   Features:
   - Local-Only Playback
   - Strict Folder Structure (Folder = Song)
   - Real Root Folder Naming
   - Click-to-seek on Waveforms
   - "Encore!" Brand Colors (Orange/Red/Rose)
   - "Zinc" Theme (Locked) with Icon Controls
*/

// --- Theme Definition (Zinc Locked) ---

const THEME = {
  id: 'zinc',
  name: 'Zinc',
  bg: 'bg-zinc-950',
  header: 'bg-zinc-900 border-zinc-800',
  sidebar: 'bg-zinc-900 border-zinc-800',
  panel: 'bg-zinc-800 border-zinc-700',
  panelActive: 'bg-zinc-800 border-l-orange-500',
  deck: 'bg-zinc-800 border-zinc-700',
  lane: 'bg-zinc-900',
  textMain: 'text-zinc-100',
  textSec: 'text-zinc-400',
  textMuted: 'text-zinc-600',
  accentText: 'text-orange-400',
  buttonSec: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700',
  buttonGhost: 'bg-transparent hover:bg-white/10 text-zinc-300 hover:text-white',
  waveMuted: '#52525b', // zinc-600
  waveSolo: '#fbbf24',
  waveActive: '#f97316'
};

// --- Helper Functions ---

const organizeFilesIntoCues = (flatFiles) => {
  const cuesMap = new Map();
  const rootStems = [];
  let rootFolderName = "Imported Folder"; // Default fallback

  // Attempt to grab the actual root folder name from the first file
  if (flatFiles.length > 0 && flatFiles[0].webkitRelativePath) {
      const parts = flatFiles[0].webkitRelativePath.split('/');
      if (parts.length > 0) rootFolderName = parts[0];
  }

  flatFiles.forEach(file => {
    const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];

    if (pathParts.length > 2) {
      // It's in a subfolder. Use subfolder name as Cue Name.
      const cueName = pathParts[pathParts.length - 2];
      const existing = cuesMap.get(cueName) || [];
      existing.push({ ...file, stemName: file.name });
      cuesMap.set(cueName, existing);
    } else {
      // It's in the root folder.
      rootStems.push({ ...file, stemName: file.name });
    }
  });

  const cues = [];

  // Use the detected Root Folder Name instead of "Main Folder"
  if (rootStems.length > 0) {
    cues.push({
      id: 'root-cue',
      name: rootFolderName,
      stems: rootStems
    });
  }

  cuesMap.forEach((stems, name) => {
    cues.push({
      id: `cue-${name}`,
      name: name,
      stems: stems.sort((a,b) => a.name.localeCompare(b.name))
    });
  });

  return cues.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, title = '' }) => {
  const baseStyle = "flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  let variantClass = "";
  switch (variant) {
      case 'primary':
          variantClass = "bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white shadow-lg shadow-rose-900/20";
          break;
      case 'secondary':
          variantClass = THEME.buttonSec;
          break;
      case 'danger':
          variantClass = "bg-red-600 hover:bg-red-500 text-white";
          break;
      case 'ghost':
          variantClass = THEME.buttonGhost;
          break;
      default:
          variantClass = THEME.buttonGhost;
  }

  return (
    <button
      onClick={onClick}
      className={`${baseStyle} ${variantClass} ${className}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

// --- Waveform Component ---
const Waveform = ({ audioUrl, height = 64, color }) => {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!audioUrl) return;

    const draw = async () => {
      setStatus('loading');
      try {
        // Fetch buffer
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error('Network err');
        const arrayBuffer = await response.arrayBuffer();

        // Decode
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Process Peaks
        const channelData = audioBuffer.getChannelData(0);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const width = canvas.offsetWidth;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;

        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;

        for (let i = 0; i < width; i++) {
          let min = 1.0;
          let max = -1.0;

          for (let j = 0; j < step; j++) {
            const datum = channelData[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }

          ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        setStatus('ready');
        audioCtx.close();
      } catch (e) {
        console.warn("Waveform gen failed", e);
        setStatus('error');
      }
    };

    draw();
  }, [audioUrl, height, color]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden pointer-events-none opacity-80">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
          <Activity size={16} className="text-white/50 animate-pulse" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-50">
           <div className="h-0.5 w-full bg-white/10"></div>
        </div>
      )}
    </div>
  );
};

const StemLane = ({
  stem,
  volume,
  muted,
  soloed,
  isAnySolo,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onSeek,
  playheadPosition
}) => {

  const waveUrl = useMemo(() => {
    if (stem.file) return URL.createObjectURL(stem.file);
    return null;
  }, [stem]);

  const handleLaneClick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      onSeek(percentage);
  };

  // Resolve waveform color
  const waveColor = soloed ? THEME.waveSolo : (muted ? THEME.waveMuted : THEME.waveActive);

  return (
    <div className={`flex flex-col ${THEME.deck} rounded-lg overflow-hidden shrink-0 transition-opacity ${muted || (isAnySolo && !soloed) ? 'opacity-60' : 'opacity-100'}`}>

      {/* Top row: stem name + controls (compact on mobile) */}
      <div className={`w-full ${THEME.deck} px-2 py-1.5 md:p-0 flex flex-row items-center gap-2 shrink-0 z-10 md:hidden`}>
        <div className="w-6 h-6 rounded bg-black/20 flex items-center justify-center text-white/50 shrink-0 font-bold text-[10px] border border-white/5">
          {stem.stemName.substring(0,2).toUpperCase()}
        </div>
        <div className={`font-medium text-[11px] ${THEME.textSec} truncate flex-1 min-w-0`} title={stem.stemName}>
            {stem.stemName.replace(/\.[^/.]+$/, "")}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-12 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full"
                disabled={muted || (isAnySolo && !soloed)}
            />
            <button
                onClick={onMuteToggle}
                className={`w-5 h-5 rounded flex items-center justify-center border ${muted ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-black/20 text-zinc-500 border-transparent hover:text-white'}`}
                title="Mute"
            >
                <VolumeX size={10} />
            </button>
            <button
                onClick={onSoloToggle}
                className={`w-5 h-5 rounded flex items-center justify-center border ${soloed ? 'bg-orange-500 text-white border-orange-600' : 'bg-black/20 text-zinc-500 border-transparent hover:text-white'}`}
                title="Solo"
            >
                <Headphones size={10} />
            </button>
        </div>
      </div>

      <div className="flex flex-row h-12 md:h-20">
        {/* Left: Mixer Deck (desktop only) */}
        <div className={`hidden md:flex w-64 ${THEME.deck} p-3 border-r items-center gap-3 shrink-0 z-10`}>
          <div className="w-8 h-8 rounded bg-black/20 flex items-center justify-center text-white/50 shrink-0 font-bold text-xs border border-white/5">
            {stem.stemName.substring(0,2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className={`font-medium text-xs ${THEME.textSec} truncate mb-1`} title={stem.stemName}>
                  {stem.stemName.replace(/\.[^/.]+$/, "")}
              </div>

              <div className="flex items-center gap-2">
                  <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={muted ? 0 : volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full"
                      disabled={muted || (isAnySolo && !soloed)}
                  />

                  <button
                      onClick={onMuteToggle}
                      className={`w-5 h-5 rounded flex items-center justify-center border ${muted ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-black/20 text-zinc-500 border-transparent hover:text-white'}`}
                      title="Mute"
                  >
                      <VolumeX size={10} />
                  </button>
                  <button
                      onClick={onSoloToggle}
                      className={`w-5 h-5 rounded flex items-center justify-center border ${soloed ? 'bg-orange-500 text-white border-orange-600' : 'bg-black/20 text-zinc-500 border-transparent hover:text-white'}`}
                      title="Solo"
                  >
                      <Headphones size={10} />
                  </button>
              </div>
          </div>
        </div>

        {/* Right: Waveform Timeline (Clickable) */}
        <div
          className={`flex-1 relative ${THEME.lane} min-w-0 cursor-crosshair group active:cursor-grabbing`}
          onClick={handleLaneClick}
        >
           <div className="absolute inset-0 p-1">
              <Waveform
                  audioUrl={waveUrl}
                  color={waveColor}
                  height={64}
              />
           </div>

           {/* Hover Indicator */}
           <div className="absolute inset-y-0 w-0.5 bg-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"/>

           {/* Playhead Overlay for this track */}
           <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none"
              style={{ left: `${playheadPosition}%` }}
           />
        </div>
      </div>
    </div>
  );
};

const SetupScreen = ({ onLocalConnect }) => {
  return (
    <div className={`min-h-screen ${THEME.bg} ${THEME.textMain} flex items-center justify-center p-4 font-sans relative overflow-hidden transition-colors duration-500`}>
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className={`w-full max-w-md ${THEME.panel} backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border ${THEME.deck.split(' ')[1]} z-10 transition-colors duration-500`}>
        <div className={`p-8 text-center border-b ${THEME.deck.split(' ')[1]}`}>
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-rose-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-rose-900/30">
            <Music size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-500 to-rose-600 mb-2">
            encore!
          </h1>
          <p className={`${THEME.textSec} font-medium tracking-wide text-sm`}>MUSICALS BERLIN</p>
        </div>

        <div className="p-8 space-y-6">
          <div className={`border-2 border-dashed ${THEME.textSec.split(' ')[0]}/20 hover:border-orange-500/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-colors bg-black/10`}>
            <Folder size={48} className={THEME.textMuted} />
            <div className="text-center">
                <p className={`${THEME.textSec} font-medium`}>Select Show Folder</p>
                <p className={`text-xs ${THEME.textMuted} mt-2 max-w-[200px] mx-auto leading-relaxed`}>
                    Folder structure determines songs.
                    <br/>
                    Subfolders = Songs. Files = Stems.
                </p>
            </div>
            <label className="cursor-pointer group">
              <span className="bg-gradient-to-r from-orange-500 to-rose-600 group-hover:from-orange-400 group-hover:to-rose-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-rose-900/20 transition-all inline-block transform group-hover:scale-105">
                Browse Folder
              </span>
              <input
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={onLocalConnect}
                accept="audio/*"
              />
            </label>
          </div>
        </div>

        <div className={`p-4 bg-black/20 text-center`}>
             <p className={`text-[10px] ${THEME.textMuted} uppercase tracking-widest font-bold`}>Local Playback Engine</p>
        </div>
      </div>
    </div>
  );
};

const PlayerScreen = ({ cues, onBack }) => {
  const audioInstances = useRef(new Map());
  const [currentCueIndex, setCurrentCueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoNext, setAutoNext] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  const [isMasterMuted, setIsMasterMuted] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mixerState, setMixerState] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeUrlsRef = useRef([]);

  const currentCue = cues[currentCueIndex];
  const stems = currentCue?.stems || [];

  const initializeMixer = (trackStems) => {
    const initial = {};
    trackStems.forEach(stem => {
      initial[stem.id] = { volume: 1, muted: false, soloed: false };
    });
    setMixerState(initial);
  };

  const applyVolumes = (currentMixerState) => {
    const instances = audioInstances.current;
    if (instances.size === 0) return;
    const anySolo = Object.values(currentMixerState).some(s => s.soloed);

    instances.forEach((audio, stemId) => {
      const state = currentMixerState[stemId] || { volume: 1, muted: false, soloed: false };
      let effectiveVolume = 0;
      if (isMasterMuted) effectiveVolume = 0;
      else if (state.muted) effectiveVolume = 0;
      else if (anySolo) effectiveVolume = state.soloed ? state.volume * masterVolume : 0;
      else effectiveVolume = state.volume * masterVolume;

      if (Math.abs(audio.volume - effectiveVolume) > 0.01) {
          audio.volume = effectiveVolume;
      }
    });
  };

  useEffect(() => {
    applyVolumes(mixerState);
  }, [mixerState, masterVolume, isMasterMuted]);

  useEffect(() => {
    const loadCue = async () => {
      if (!currentCue) return;
      audioInstances.current.forEach(audio => { audio.pause(); audio.src = ''; });
      audioInstances.current.clear();
      activeUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      activeUrlsRef.current = [];

      setIsPlaying(false);
      setIsLoading(true);
      setError(null);
      setCurrentTime(0);
      setDuration(0);

      const initialMixerState = {};
      currentCue.stems.forEach(stem => {
        initialMixerState[stem.id] = { volume: 1, muted: false, soloed: false };
      });
      setMixerState(initialMixerState);

      try {
        let loadedCount = 0;
        const totalStems = currentCue.stems.length;

        await Promise.all(currentCue.stems.map(async (stem) => {
          let src = '';
          if (stem.file) {
            src = URL.createObjectURL(stem.file);
            activeUrlsRef.current.push(src);
          }

          const audio = new Audio();
          audio.src = src;
          audio.preload = 'auto';

          if (audioInstances.current.size === 0) {
             audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
             audio.addEventListener('durationchange', () => setDuration(audio.duration));
             audio.addEventListener('ended', () => { setIsPlaying(false); if (autoNext) handleNext(); });
             audio.addEventListener('error', (e) => { console.error(e); setError("Playback Error"); });
          }

          audio.addEventListener('canplay', () => {
            loadedCount++;
            if (loadedCount >= totalStems) setIsLoading(false);
          });
          audioInstances.current.set(stem.id, audio);
        }));
        applyVolumes(initialMixerState);
      } catch (err) {
        console.error(err);
        setError("Failed to load audio stems.");
        setIsLoading(false);
      }
    };
    loadCue();
    return () => {
      audioInstances.current.forEach(audio => audio.pause());
      activeUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [currentCueIndex]);

  const togglePlay = () => {
    if (audioInstances.current.size === 0) return;
    if (isPlaying) {
      audioInstances.current.forEach(audio => audio.pause());
      setIsPlaying(false);
    } else {
      const promises = [];
      audioInstances.current.forEach(audio => promises.push(audio.play()));
      Promise.all(promises).then(() => setIsPlaying(true)).catch(e => {
        console.error(e); setError("Playback prevented."); setIsPlaying(false);
      });
    }
  };

  const stop = () => {
    audioInstances.current.forEach(audio => { audio.pause(); audio.currentTime = 0; });
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleWaveformSeek = (percentage) => {
    const newTime = percentage * (duration || 0);
    setCurrentTime(newTime);
    audioInstances.current.forEach(audio => { audio.currentTime = newTime; });
  };

  const handleNext = () => {
    if (currentCueIndex < cues.length - 1) setCurrentCueIndex(prev => prev + 1);
    else setIsPlaying(false);
  };

  const handlePrev = () => {
    if (currentTime > 2) stop();
    else if (currentCueIndex > 0) setCurrentCueIndex(prev => prev - 1);
  };

  const updateStemState = (stemId, updates) => {
    setMixerState(prev => ({ ...prev, [stemId]: { ...prev[stemId], ...updates } }));
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`h-screen flex flex-col ${THEME.bg} ${THEME.textMain} font-sans overflow-hidden transition-colors duration-500`}>

      {/* Header */}
      <div className={`${THEME.header} px-3 md:px-4 py-2 md:py-4 flex items-center justify-between shrink-0 h-12 md:h-16 z-30 border-b`}>
        <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-zinc-300">
                <List size={20} />
            </button>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40">
                <Music size={16} className="text-white md:hidden" />
                <Music size={18} className="text-white hidden md:block" />
            </div>
            <div>
                <h1 className="font-bold text-lg leading-none hidden md:block">encore!</h1>
                <span className={`text-[10px] ${THEME.accentText} font-bold tracking-widest hidden md:block`}>PLAYER</span>
            </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
            <div className={`flex items-center gap-1.5 md:gap-2 ${THEME.deck} rounded-lg p-1 px-2 md:px-3 border`}>
                <span className={`text-[10px] md:text-xs font-bold uppercase ${autoNext ? THEME.accentText : THEME.textMuted} hidden sm:inline`}>Auto-Next</span>
                <span className={`text-[10px] font-bold uppercase ${autoNext ? THEME.accentText : THEME.textMuted} sm:hidden`}>AN</span>
                <button onClick={() => setAutoNext(!autoNext)} className={`w-8 h-4 rounded-full relative transition-colors ${autoNext ? 'bg-orange-500' : 'bg-black/30'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoNext ? 'left-4.5' : 'left-0.5'}`} style={{left: autoNext ? 'calc(100% - 14px)' : '2px'}}/>
                </button>
            </div>
            <Button variant="ghost" onClick={onBack} title="Close Show" className="p-1.5 md:p-2">
                <HardDrive size={18} />
            </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar: Cues */}
        <div className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-20
          w-64 ${THEME.sidebar} border-r border-r-${THEME.header.split('border-')[1]} flex flex-col shrink-0
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}>
            <div className={`p-3 md:p-4 border-b ${THEME.header.split('border-')[1] || 'border-transparent'} text-xs font-bold ${THEME.textMuted} uppercase tracking-wider flex items-center justify-between`}>
                <span className="flex items-center gap-2"><List size={14} /> Cues ({cues.length})</span>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 rounded hover:bg-white/10 text-zinc-400">
                    <Square size={12} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cues.map((cue, idx) => (
                    <div key={cue.id} onClick={() => { setCurrentCueIndex(idx); setSidebarOpen(false); }} className={`px-3 md:px-4 py-3 border-b border-black/10 cursor-pointer transition-colors flex items-center gap-3 ${currentCueIndex === idx ? THEME.panelActive : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}>
                        <div className={`text-sm font-mono w-6 text-right ${currentCueIndex === idx ? THEME.accentText : THEME.textMuted}`}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${currentCueIndex === idx ? THEME.accentText : THEME.textSec}`}>{cue.name}</div>
                            {currentCueIndex === idx && isPlaying && <span className={`text-[10px] ${THEME.accentText} flex items-center gap-1 mt-1`}><div className={`w-1 h-1 ${THEME.accentText.replace('text-', 'bg-')} rounded-full`}/> Playing</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Main Panel: DAW View */}
        <div className={`flex-1 flex flex-col ${THEME.bg} relative min-w-0 transition-colors duration-500`}>

            {/* Song Info Bar */}
            <div className={`px-3 md:px-4 py-2 md:py-4 border-b ${THEME.header.split('border-')[1]} bg-black/10 flex items-center justify-between z-20 gap-2`}>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base md:text-xl font-bold leading-tight truncate">{currentCue?.name || "No Song Selected"}</h2>
                    {isLoading && <span className={`${THEME.accentText} text-[10px] md:text-xs animate-pulse`}>Syncing & Generating Waveforms...</span>}
                    {error && <span className="text-red-400 text-[10px] md:text-xs">{error}</span>}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-lg md:text-2xl font-mono font-light">{formatTime(currentTime)} <span className={`${THEME.textMuted} text-sm md:text-lg`}>/ {formatTime(duration)}</span></div>
                </div>
            </div>

            {/* DAW Lane Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4 space-y-1.5 md:space-y-2 relative">
                {stems.length > 0 ? stems.map((stem) => (
                    <StemLane
                        key={stem.id}
                        stem={stem}
                        volume={mixerState[stem.id]?.volume || 1}
                        muted={mixerState[stem.id]?.muted || false}
                        soloed={mixerState[stem.id]?.soloed || false}
                        isAnySolo={Object.values(mixerState).some(s => s.soloed)}
                        onVolumeChange={(v) => updateStemState(stem.id, { volume: v })}
                        onMuteToggle={() => updateStemState(stem.id, { muted: !mixerState[stem.id]?.muted })}
                        onSoloToggle={() => updateStemState(stem.id, { soloed: !mixerState[stem.id]?.soloed })}
                        onSeek={handleWaveformSeek}
                        playheadPosition={(currentTime / (duration || 1)) * 100}
                    />
                )) : (
                    <div className={`text-center ${THEME.textMuted} py-20`}><Sliders size={48} className="mx-auto mb-4 opacity-20" /><p>No audio stems loaded</p></div>
                )}
            </div>

            {/* Transport Bar */}
            <div className={`${THEME.header} px-3 py-2 md:p-4 z-30 shadow-2xl border-t`}>
                <div className="max-w-4xl mx-auto flex items-center gap-3 md:gap-6">
                    {/* Master Vol */}
                    <div className="hidden md:flex items-center gap-3 w-32 group">
                        <button onClick={() => setIsMasterMuted(!isMasterMuted)} className={`${THEME.textSec} hover:text-white`}>
                            {isMasterMuted || masterVolume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input type="range" min="0" max="1" step="0.05" value={masterVolume} onChange={(e) => setMasterVolume(parseFloat(e.target.value))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full"/>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 flex items-center justify-center gap-3 md:gap-6">
                        <Button variant="secondary" onClick={handlePrev} className="w-9 h-9 md:w-10 md:h-10 rounded-full"><SkipBack size={16}/></Button>
                        <button onClick={togglePlay} disabled={isLoading} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${isPlaying ? 'bg-orange-500 text-white hover:bg-orange-400' : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white hover:from-orange-400 hover:to-rose-500'}`}>
                            {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={28} fill="currentColor" className="ml-0.5"/>}
                        </button>
                        <Button variant="danger" onClick={stop} className="w-9 h-9 md:w-10 md:h-10 rounded-full"><Square size={12} fill="currentColor"/></Button>
                        <Button variant="secondary" onClick={handleNext} className="w-9 h-9 md:w-10 md:h-10 rounded-full"><SkipForward size={16}/></Button>
                    </div>

                    <div className="hidden md:block w-32"></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [cues, setCues] = useState([]);
  const [view, setView] = useState('setup');
  const [loading, setLoading] = useState(false);

  const handleLocalConnect = (e) => {
    setLoading(true);
    const files = Array.from(e.target.files);
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    if (audioFiles.length === 0) { alert("No audio files found."); setLoading(false); return; }
    const rawFiles = audioFiles.map((file, index) => ({
      id: `local-${index}-${file.name}`, name: file.name, file: file, webkitRelativePath: file.webkitRelativePath
    }));
    const groupedCues = organizeFilesIntoCues(rawFiles);
    setCues(groupedCues);
    setView('player');
    setLoading(false);
  };

  return (
    <div className={`${THEME.bg} ${THEME.textMain} min-h-screen transition-colors duration-500`}>
      {loading && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center flex-col gap-4">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-orange-400 font-medium animate-pulse">Organizing Stems...</p>
        </div>
      )}
      {view === 'setup' && <SetupScreen onLocalConnect={handleLocalConnect} />}
      {view === 'player' && <PlayerScreen cues={cues} onBack={() => setView('setup')} />}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowDownRight, RotateCcw, Info, Activity, Clock, Server, Play, Send, Zap } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('lamport');

  // --- STATE ΓΙΑ LAMPORT & VECTOR ---
  const [events, setEvents] = useState([]);
  const [globalStep, setGlobalStep] = useState(0);
  const [selectedSender, setSelectedSender] = useState(null);
  const [connections, setConnections] = useState([]);
  const containerRef = useRef(null);
  const eventRefs = useRef({});
  const processes = ['P1', 'P2', 'P3'];

  // --- STATE ΓΙΑ BERKELEY ---
  const [berkeleyState, setBerkeleyState] = useState({ daemon: 300, c1: 290, c2: 325 });
  const [berkeleyResult, setBerkeleyResult] = useState(null);
  const [berkeleySimStep, setBerkeleySimStep] = useState(0);

  // --- STATE ΓΙΑ NTP ---
  const [ntpState, setNtpState] = useState({ t1: 1100, t2: 800, t3: 850, t4: 1200 });
  const [ntpResult, setNtpResult] = useState(null);
  const [ntpSimStep, setNtpSimStep] = useState(0);

  // --- STATE ΓΙΑ PTP (IEEE 1588) ---
  const [ptpState, setPtpState] = useState({ t1: 1000, t2: 1050, t3: 1060, t4: 1115 });
  const [ptpResult, setPtpResult] = useState(null);
  const [ptpSimStep, setPtpSimStep] = useState(0);

  const updateConnections = () => {
    if (!containerRef.current || (activeTab !== 'lamport' && activeTab !== 'vector')) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnections = [];
    events.forEach((ev) => {
      if (ev.senderId) {
        const senderEl = eventRefs.current[ev.senderId];
        const receiverEl = eventRefs.current[ev.id];
        if (senderEl && receiverEl) {
          const sRect = senderEl.getBoundingClientRect();
          const rRect = receiverEl.getBoundingClientRect();
          newConnections.push({
            id: ev.id,
            x1: sRect.left - containerRect.left + sRect.width / 2,
            y1: sRect.top - containerRect.top + sRect.height / 2,
            x2: rRect.left - containerRect.left + rRect.width / 2,
            y2: rRect.top - containerRect.top + rRect.height / 2,
          });
        }
      }
    });
    setConnections(newConnections);
  };

  useEffect(() => {
    updateConnections();
    window.addEventListener('resize', updateConnections);
    return () => window.removeEventListener('resize', updateConnections);
  }, [events, activeTab]);

  const handleReset = () => {
    setEvents([]); setGlobalStep(0); setSelectedSender(null); setConnections([]);
    setBerkeleyResult(null); setBerkeleySimStep(0);
    setNtpResult(null); setNtpSimStep(0);
    setPtpResult(null); setPtpSimStep(0);
  };

  // --- ΛΟΓΙΚΗ LAMPORT & VECTOR ---
  const getLamportMax = (processId) => {
    const pEvents = events.filter((e) => e.processId === processId);
    return pEvents.length === 0 ? 0 : Math.max(...pEvents.map((e) => e.clock));
  };
  const getVectorLatest = (processId) => {
    const pEvents = events.filter((e) => e.processId === processId);
    return pEvents.length === 0 ? [0, 0, 0] : pEvents[pEvents.length - 1].vector;
  };
  
  const handleAddLocalEvent = (processId) => {
    const newEvent = { id: `e_${Date.now()}`, processId, type: 'local', step: globalStep + 1, senderId: null };
    if (activeTab === 'lamport') {
      newEvent.clock = getLamportMax(processId) + 1;
    } else {
      const cVector = [...getVectorLatest(processId)];
      cVector[processes.indexOf(processId)] += 1;
      newEvent.vector = cVector;
    }
    setEvents([...events, newEvent]); setGlobalStep(globalStep + 1);
  };

  const handleReceiveEvent = (processId) => {
    if (!selectedSender) return;
    const newEvent = { id: `e_${Date.now()}`, processId, type: 'receive', step: globalStep + 1, senderId: selectedSender.id };
    if (activeTab === 'lamport') {
      newEvent.clock = Math.max(getLamportMax(processId), selectedSender.clock) + 1;
    } else {
      const lVector = [...getVectorLatest(processId)];
      lVector[processes.indexOf(processId)] += 1;
      const senderVec = selectedSender.vector || [0,0,0];
      newEvent.vector = lVector.map((val, idx) => Math.max(val, senderVec[idx]));
    }
    setEvents([...events, newEvent]); setGlobalStep(globalStep + 1); setSelectedSender(null);
  };

  // --- ΛΟΓΙΚΗ BERKELEY ---
  const simulateBerkeley = () => {
    setBerkeleyResult(null); setBerkeleySimStep(1);
    const d = Number(berkeleyState.daemon); const n1 = Number(berkeleyState.c1); const n2 = Number(berkeleyState.c2);
    const diff1 = n1 - d; const diff2 = n2 - d; const avgDiff = (0 + diff1 + diff2) / 3;
    setTimeout(() => setBerkeleySimStep(2), 1200); 
    setTimeout(() => setBerkeleySimStep(3), 2400); 
    setTimeout(() => {
      setBerkeleySimStep(4); 
      setBerkeleyResult({ avgDiff, adjDaemon: avgDiff, adj1: avgDiff - diff1, adj2: avgDiff - diff2, finalTime: d + avgDiff });
    }, 3600);
  };

  // --- ΛΟΓΙΚΗ NTP ---
  const simulateNTP = () => {
    setNtpResult(null); setNtpSimStep(1);
    const t1 = Number(ntpState.t1); const t2 = Number(ntpState.t2); const t3 = Number(ntpState.t3); const t4 = Number(ntpState.t4);
    const delay = (t4 - t1) - (t3 - t2); const offset = ((t2 - t1) + (t3 - t4)) / 2;
    setTimeout(() => setNtpSimStep(2), 1000);
    setTimeout(() => setNtpSimStep(3), 2000); 
    setTimeout(() => {
      setNtpSimStep(4);
      setNtpResult({ delay, offset, newTime: t4 + offset });
    }, 3000); 
  };

  // --- ΛΟΓΙΚΗ PTP ---
  const simulatePTP = () => {
    setPtpResult(null); setPtpSimStep(1);
    const t1 = Number(ptpState.t1); const t2 = Number(ptpState.t2); const t3 = Number(ptpState.t3); const t4 = Number(ptpState.t4);
    // Τύποι PTP: Delay = ((t2 - t1) + (t4 - t3)) / 2, Offset = ((t2 - t1) - (t4 - t3)) / 2
    const delay = ((t2 - t1) + (t4 - t3)) / 2; 
    const offset = ((t2 - t1) - (t4 - t3)) / 2;
    setTimeout(() => setPtpSimStep(2), 1000); // Sync (Master -> Slave)
    setTimeout(() => setPtpSimStep(3), 2000); // Delay_Req (Slave -> Master)
    setTimeout(() => {
      setPtpSimStep(4);
      setPtpResult({ delay, offset, newTime: t3 - offset }); // Η νέα ώρα βασίζεται στη διόρθωση της απόκλισης
    }, 3000); 
  };

  return (
    <div className="min-h-screen bg-[#1E2328] text-gray-200 p-8 font-sans overflow-x-hidden">
      
      <style>{`
        @keyframes flow { to { stroke-dashoffset: -20; } }
        .animate-flow { stroke-dasharray: 8; animation: flow 0.6s linear infinite; }
        @keyframes popIn { 
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; } 
          70% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 
        }
        .event-node { position: absolute; transform: translate(-50%, -50%); animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        @keyframes packetFlyRight { 0% { left: 0%; opacity: 0; } 50% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
        @keyframes packetFlyLeft { 0% { left: 100%; opacity: 0; } 50% { opacity: 1; } 100% { left: 0%; opacity: 0; } }
        .fly-right { animation: packetFlyRight 1s ease-in-out forwards; }
        .fly-left { animation: packetFlyLeft 1s ease-in-out forwards; }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Tabs */}
        <div className="bg-[#2A3138] p-6 rounded-2xl shadow-xl border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Κατανεμημένα Συστήματα (Visualizer)
            </h1>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors font-medium text-sm">
              <RotateCcw size={16} /> Καθαρισμός
            </button>
          </div>
          
          <div className="flex gap-6 border-b border-gray-700 pb-2 overflow-x-auto">
            {[ 
              { id: 'lamport', label: 'Lamport' }, 
              { id: 'vector', label: 'Vector Clocks' }, 
              { id: 'berkeley', label: 'Berkeley' }, 
              { id: 'ntp', label: 'NTP' },
              { id: 'ptp', label: 'PTP (IEEE 1588)' }
            ].map((tab) => (
              <button key={tab.id} 
                onClick={() => {
                  handleReset(); 
                  setActiveTab(tab.id); 
                }}
                className={`pb-2 px-4 font-bold transition-all duration-300 ${activeTab === tab.id ? 'text-[#F28500] border-b-4 border-[#F28500]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-t-lg'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* --- VIEW: ΛΟΓΙΚΑ & ΑΝΥΣΜΑΤΙΚΑ ΡΟΛΟΓΙΑ --- */}
        {(activeTab === 'lamport' || activeTab === 'vector') && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-[#4169E1]/20 border border-[#4169E1]/50 p-4 rounded-xl flex items-center gap-3">
              <Info className="text-[#4169E1] shrink-0" size={24} />
              <p className="text-sm text-gray-200">
                {activeTab === 'lamport' ? 'Lamport: C = max(C_local, C_msg) + 1.' : 'Vector Clocks: Αύξηση του τοπικού index. Στη λήψη, παίρνουμε το Max ανά index.'} Κάντε κλικ στο "Γεγονός", και έπειτα συνδέστε το με "Λήψη" σε άλλη διεργασία.
              </p>
            </div>

            <div className="bg-[#2A3138] border border-gray-700 rounded-2xl shadow-xl overflow-hidden relative">
              <div ref={containerRef} className="relative w-full overflow-x-auto min-h-[480px] p-8">
                
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ minWidth: `${globalStep * 110 + 300}px` }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#F28500" />
                    </marker>
                  </defs>
                  {connections.map((conn) => (
                    <line key={conn.id} x1={conn.x1} y1={conn.y1} x2={conn.x2} y2={conn.y2} stroke="#F28500" strokeWidth="3" markerEnd="url(#arrowhead)" className="animate-flow opacity-80" />
                  ))}
                </svg>

                <div className="space-y-24" style={{ minWidth: `${globalStep * 110 + 300}px` }}>
                  {processes.map((processId) => (
                    <div key={processId} className="relative flex items-center h-16">
                      <div className="absolute left-32 right-0 h-1 bg-gray-700 rounded-full top-1/2 -translate-y-1/2 z-0 shadow-inner" />
                      
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-3 z-30 bg-[#2A3138] p-2 rounded-r-xl pr-6">
                        <div className="w-12 h-12 bg-[#4169E1] text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">{processId}</div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleAddLocalEvent(processId)} disabled={!!selectedSender} className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-700 text-gray-200 hover:bg-gray-600 rounded-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"><Plus size={14} /> Γεγονός</button>
                          {selectedSender && selectedSender.processId !== processId && (
                            <button onClick={() => handleReceiveEvent(processId)} className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#F28500] text-white hover:brightness-110 rounded-lg animate-pulse shadow-md"><ArrowDownRight size={14} /> Λήψη</button>
                          )}
                        </div>
                      </div>

                      {events.filter((e) => e.processId === processId).map((ev) => (
                        <div key={ev.id} ref={(el) => (eventRefs.current[ev.id] = el)} onClick={() => !selectedSender && setSelectedSender(ev)}
                          className={`event-node z-20 flex items-center justify-center cursor-pointer transition-all duration-300 
                            ${selectedSender?.id === ev.id ? 'scale-125 shadow-[0_0_15px_rgba(242,133,0,0.5)] ring-2 ring-[#F28500] bg-[#F28500] text-white border-transparent' : 'hover:scale-110 shadow-lg border-[#4169E1] bg-[#1E2328] text-gray-200'} 
                            ${activeTab === 'lamport' ? 'w-12 h-12 rounded-full border-2' : 'w-24 h-10 rounded-lg px-2 border-2'} 
                            ${ev.type === 'receive' ? 'border-[#F28500]' : ''}`}
                          style={{ left: `${180 + ev.step * 105}px`, top: '50%' }}>
                          
                          <span className="font-bold text-sm tracking-wider">
                            {activeTab === 'lamport' ? ev.clock : `[${(ev.vector || [0,0,0]).join(',')}]`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: BERKELEY --- */}
        {activeTab === 'berkeley' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-[#2A3138] border border-gray-700 p-6 rounded-2xl shadow-xl grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-xl border-b border-gray-600 pb-2 flex items-center gap-2"><Server className="text-[#4169E1]"/> Δεδομένα (Time)</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between text-sm font-bold bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm">
                      Server <input type="number" value={berkeleyState.daemon} onChange={e => setBerkeleyState({...berkeleyState, daemon: e.target.value})} className="w-24 p-1 rounded text-center bg-gray-900 text-white border border-gray-600"/>
                    </label>
                    <label className="flex items-center justify-between text-sm font-bold bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm">
                      Client 1 <input type="number" value={berkeleyState.c1} onChange={e => setBerkeleyState({...berkeleyState, c1: e.target.value})} className="w-24 p-1 rounded text-center bg-gray-900 text-white border border-gray-600"/>
                    </label>
                    <label className="flex items-center justify-between text-sm font-bold bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm">
                      Client 2 <input type="number" value={berkeleyState.c2} onChange={e => setBerkeleyState({...berkeleyState, c2: e.target.value})} className="w-24 p-1 rounded text-center bg-gray-900 text-white border border-gray-600"/>
                    </label>
                    <button onClick={simulateBerkeley} disabled={berkeleySimStep > 0 && berkeleySimStep < 4} className="w-full flex justify-center items-center gap-2 mt-4 bg-[#4169E1] hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-md">
                      {berkeleySimStep > 0 && berkeleySimStep < 4 ? <Activity className="animate-spin"/> : <Play size={18}/>}
                      Έναρξη Προσομοίωσης
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative overflow-hidden flex flex-col items-center justify-center space-y-8 min-h-[300px]">
                  <div className={`transition-all duration-500 w-32 h-16 bg-[#4169E1] text-white rounded-xl flex flex-col items-center justify-center font-bold shadow-lg z-10 ${berkeleySimStep === 2 ? 'ring-4 ring-[#F28500] scale-110' : ''}`}>
                    Server <span className="font-mono">{berkeleyResult ? berkeleyResult.finalTime.toFixed(0) : berkeleyState.daemon}</span>
                  </div>
                  
                  {(berkeleySimStep === 1 || berkeleySimStep === 3) && (
                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                      <div className={`absolute w-4 h-4 bg-[#F28500] rounded-full ${berkeleySimStep === 1 ? 'animate-ping' : ''}`} style={{top: '30%'}} />
                    </div>
                  )}

                  <div className="flex gap-16 w-full justify-center z-10">
                    <div className={`transition-all duration-500 w-28 h-16 bg-gray-700 border border-gray-600 text-white rounded-xl flex flex-col items-center justify-center font-bold shadow-md ${berkeleySimStep === 4 ? 'border-[#F28500] bg-gray-600' : ''}`}>
                      C1 <span className="font-mono text-sm">{berkeleyResult ? berkeleyResult.finalTime.toFixed(0) : berkeleyState.c1}</span>
                      {berkeleyResult && berkeleySimStep === 4 && <span className="absolute -bottom-6 text-xs font-bold text-[#F28500]">{berkeleyResult.adj1 > 0 ? '+':''}{berkeleyResult.adj1.toFixed(0)}</span>}
                    </div>
                    <div className={`transition-all duration-500 w-28 h-16 bg-gray-700 border border-gray-600 text-white rounded-xl flex flex-col items-center justify-center font-bold shadow-md ${berkeleySimStep === 4 ? 'border-[#F28500] bg-gray-600' : ''}`}>
                      C2 <span className="font-mono text-sm">{berkeleyResult ? berkeleyResult.finalTime.toFixed(0) : berkeleyState.c2}</span>
                      {berkeleyResult && berkeleySimStep === 4 && <span className="absolute -bottom-6 text-xs font-bold text-[#F28500]">{berkeleyResult.adj2 > 0 ? '+':''}{berkeleyResult.adj2.toFixed(0)}</span>}
                    </div>
                  </div>

                  <div className="absolute bottom-4 text-sm font-bold text-white bg-gray-900/80 px-4 py-1 rounded-full">
                    {berkeleySimStep === 0 && 'Αναμονή'}
                    {berkeleySimStep === 1 && '1. Ο Server ζητά την ώρα...'}
                    {berkeleySimStep === 2 && '2. Υπολογισμός μέσης απόκλισης...'}
                    {berkeleySimStep === 3 && '3. Αποστολή διορθώσεων στους Clients...'}
                    {berkeleySimStep === 4 && <span className="text-[#F28500]">Συγχρονισμός Ολοκληρώθηκε!</span>}
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* --- VIEW: NTP --- */}
        {activeTab === 'ntp' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-[#2A3138] border border-gray-700 p-6 rounded-2xl shadow-xl grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-xl border-b border-gray-600 pb-2 flex items-center gap-2"><Clock className="text-[#4169E1]"/> Χρονοσφραγίδες (T1 - T4)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col text-sm font-bold">T1 (Client Send) <input type="number" value={ntpState.t1} onChange={e => setNtpState({...ntpState, t1: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">T2 (Server Recv) <input type="number" value={ntpState.t2} onChange={e => setNtpState({...ntpState, t2: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">T3 (Server Send) <input type="number" value={ntpState.t3} onChange={e => setNtpState({...ntpState, t3: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">T4 (Client Recv) <input type="number" value={ntpState.t4} onChange={e => setNtpState({...ntpState, t4: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                  </div>
                  <button onClick={simulateNTP} disabled={ntpSimStep > 0 && ntpSimStep < 4} className="w-full flex justify-center items-center gap-2 mt-2 bg-[#4169E1] hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70">
                    {ntpSimStep > 0 && ntpSimStep < 4 ? <Activity className="animate-spin"/> : <Send size={18}/>}
                    Αποστολή NTP Request
                  </button>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 relative min-h-[300px] flex flex-col justify-between p-6">
                  <div className="flex justify-between items-center z-10 relative px-4">
                     <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-lg transition-colors ${ntpSimStep >= 1 ? 'bg-[#4169E1]' : 'bg-gray-700'}`}>
                        Client <span className="font-mono text-sm mt-1">{ntpSimStep === 4 ? ntpResult.newTime : ntpState.t1}</span>
                     </div>
                     <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-lg transition-colors ${ntpSimStep >= 2 ? 'bg-[#F28500]' : 'bg-gray-700'}`}>
                        Server <span className="font-mono text-sm mt-1">{ntpState.t2}</span>
                     </div>
                  </div>

                  <div className="absolute top-[80px] left-[10%] right-[10%] h-1 bg-gray-600 rounded">
                    {ntpSimStep === 1 && <div className="absolute top-[-6px] w-4 h-4 bg-[#F28500] rounded-full fly-right shadow-md"/>}
                    {ntpSimStep === 3 && <div className="absolute top-[-6px] w-4 h-4 bg-[#4169E1] rounded-full fly-left shadow-md"/>}
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-6 text-center min-h-[100px] flex flex-col justify-center">
                    {ntpSimStep === 0 && <span className="text-gray-400 font-medium">Πατήστε Αποστολή για έναρξη.</span>}
                    {ntpSimStep === 1 && <span className="text-[#4169E1] font-bold">T1: Αποστολή αιτήματος στο Server...</span>}
                    {ntpSimStep === 2 && <span className="text-gray-200 font-bold">T2-T3: Ο Server επεξεργάζεται την ώρα...</span>}
                    {ntpSimStep === 3 && <span className="text-[#F28500] font-bold">T3-T4: Επιστροφή απάντησης στον Client...</span>}
                    {ntpSimStep === 4 && ntpResult && (
                      <div className="animate-fade-in text-sm space-y-1 mt-2">
                        <div className="font-bold text-[#F28500]">Επιτυχής Συγχρονισμός!</div>
                        <div className="text-gray-300">Delay: <span className="font-mono">{ntpResult.delay}</span> | Offset: <span className="font-mono text-white">{ntpResult.offset}</span></div>
                        <div className="text-[#4169E1] font-bold text-lg">Νέα Ώρα Client: {ntpResult.newTime}</div>
                      </div>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* --- VIEW: PTP (IEEE 1588) --- */}
        {activeTab === 'ptp' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-[#4169E1]/20 border border-[#4169E1]/50 p-4 rounded-xl flex items-center gap-3">
              <Zap className="text-[#4169E1] shrink-0" size={24} />
              <p className="text-sm text-gray-200">
                Το <strong>PTP (Precision Time Protocol)</strong> προσφέρει συγχρονισμό ακριβείας μέσω hardware χρονοσφραγίδων. Ανταλλάσσει μηνύματα <code>Sync</code> και <code>Delay_Req</code> μεταξύ Master και Slave.
              </p>
            </div>

             <div className="bg-[#2A3138] border border-gray-700 p-6 rounded-2xl shadow-xl grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-xl border-b border-gray-600 pb-2 flex items-center gap-2"><Clock className="text-[#4169E1]"/> Hardware Timestamps</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col text-sm font-bold">t1 (Master Sync Tx) <input type="number" value={ptpState.t1} onChange={e => setPtpState({...ptpState, t1: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">t2 (Slave Sync Rx) <input type="number" value={ptpState.t2} onChange={e => setPtpState({...ptpState, t2: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">t3 (Slave Delay_Req Tx) <input type="number" value={ptpState.t3} onChange={e => setPtpState({...ptpState, t3: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                    <label className="flex flex-col text-sm font-bold">t4 (Master Delay_Req Rx) <input type="number" value={ptpState.t4} onChange={e => setPtpState({...ptpState, t4: e.target.value})} className="mt-1 p-2 rounded bg-gray-800 border border-gray-600 text-white"/></label>
                  </div>
                  <button onClick={simulatePTP} disabled={ptpSimStep > 0 && ptpSimStep < 4} className="w-full flex justify-center items-center gap-2 mt-2 bg-[#4169E1] hover:brightness-110 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70">
                    {ptpSimStep > 0 && ptpSimStep < 4 ? <Activity className="animate-spin"/> : <Zap size={18}/>}
                    Εκτέλεση Κύκλου PTP
                  </button>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 relative min-h-[300px] flex flex-col justify-between p-6">
                  <div className="flex justify-between items-center z-10 relative px-4">
                     <div className={`w-28 h-24 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-lg transition-colors ${ptpSimStep >= 1 ? 'bg-[#F28500]' : 'bg-gray-700'}`}>
                        Master Clock <span className="font-mono text-sm mt-1">{ptpState.t1}</span>
                     </div>
                     <div className={`w-28 h-24 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-lg transition-colors ${ptpSimStep >= 2 ? 'bg-[#4169E1]' : 'bg-gray-700'}`}>
                        Slave Clock <span className="font-mono text-sm mt-1">{ptpSimStep === 4 ? ptpResult.newTime : ptpState.t2}</span>
                     </div>
                  </div>

                  <div className="absolute top-[80px] left-[15%] right-[15%] h-1 bg-gray-600 rounded">
                    {ptpSimStep === 1 && <div className="absolute top-[-6px] w-4 h-4 bg-[#F28500] rounded-full fly-right shadow-md"/>}
                    {ptpSimStep === 2 && <div className="absolute top-[-6px] w-4 h-4 bg-[#4169E1] rounded-full fly-left shadow-md"/>}
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mt-6 text-center min-h-[100px] flex flex-col justify-center">
                    {ptpSimStep === 0 && <span className="text-gray-400 font-medium">Πατήστε Εκτέλεση για έναρξη PTP.</span>}
                    {ptpSimStep === 1 && <span className="text-[#F28500] font-bold">t1-t2: Ο Master στέλνει Sync...</span>}
                    {ptpSimStep === 2 && <span className="text-[#4169E1] font-bold">t3-t4: Ο Slave στέλνει Delay_Req...</span>}
                    {ptpSimStep === 3 && <span className="text-gray-200 font-bold">Υπολογισμός Mean Path Delay & Offset...</span>}
                    {ptpSimStep === 4 && ptpResult && (
                      <div className="animate-fade-in text-sm space-y-1 mt-2">
                        <div className="font-bold text-[#F28500]">Υπολογισμός Ολοκληρώθηκε!</div>
                        <div className="text-gray-300">Mean Path Delay: <span className="font-mono">{ptpResult.delay}</span> | Offset: <span className="font-mono text-white">{ptpResult.offset}</span></div>
                        <div className="text-[#4169E1] font-bold text-lg">Νέα Ώρα Slave: {ptpResult.newTime}</div>
                      </div>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { calculateClassStatistics, processStudentData, calculateFacilitatorStats, generatePDFBlob } from './utils';
import { GlobalSettings, StudentData, Department, Module, SchoolClass, ProcessedStudent } from './types';
import { RAW_STUDENTS, FACILITATORS, getSubjectsForDepartment, DEFAULT_GRADING_REMARKS, DAYCARE_INDICATORS } from './constants';
import MasterSheet from './components/MasterSheet';
import DaycareMasterSheet from './components/DaycareMasterSheet';
import ReportCard from './components/ReportCard';
import DaycareReportCard from './components/DaycareReportCard';
import ScoreEntry from './components/ScoreEntry';
import FacilitatorDashboard from './components/FacilitatorDashboard';
import GenericModule from './components/GenericModule';
import { supabase } from './supabaseClient';

const DEFAULT_SETTINGS: GlobalSettings = {
  schoolName: "UNITED BAYLOR ACADEMY",
  examTitle: "2ND MOCK 2025 BROAD SHEET EXAMINATION",
  mockSeries: "2",
  mockAnnouncement: "Please ensure all scores are entered accurately. Section A is out of 40, Section B is out of 60.",
  mockDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  submittedSubjects: [],
  termInfo: "TERM 2",
  academicYear: "2024/2025",
  nextTermBegin: "TBA",
  attendanceTotal: "60",
  startDate: "10-02-2025",
  endDate: "15-02-2025",
  headTeacherName: "HEADMASTER NAME",
  reportDate: new Date().toLocaleDateString(),
  schoolContact: "+233 24 000 0000",
  schoolEmail: "info@unitedbaylor.edu.gh",
  facilitatorMapping: FACILITATORS,
  gradingSystemRemarks: DEFAULT_GRADING_REMARKS,
  activeIndicators: DAYCARE_INDICATORS,
  customIndicators: [],
  customSubjects: [],
  disabledSubjects: [],
  staffList: []
};

const DEPARTMENTS: Department[] = [
  "Daycare", "Nursery", "Kindergarten", "Lower Basic School", "Upper Basic School", "Junior High School"
];

const DEPARTMENT_CLASSES: Record<Department, SchoolClass[]> = {
  "Daycare": ["D1", "Creche"],
  "Nursery": ["N1", "N2"],
  "Kindergarten": ["K1", "K2"],
  "Lower Basic School": ["Basic 1", "Basic 2", "Basic 3"],
  "Upper Basic School": ["Basic 4", "Basic 5", "Basic 6"],
  "Junior High School": ["Basic 7", "Basic 8", "Basic 9"]
};

const MODULES: Module[] = [
  "Time Table", "Academic Calendar", "Facilitator List", "Pupil Enrolment", "Assessment", "Lesson Plans", 
  "Exercise Assessment", "Staff Movement", "Materials & Logistics", "Learner Materials & Booklist", "Disciplinary", "Special Event Day"
];

const App: React.FC = () => {
  const [activeDept, setActiveDept] = useState<Department>("Junior High School");
  const [activeClass, setActiveClass] = useState<SchoolClass>("Basic 9");
  const [activeModule, setActiveModule] = useState<Module>("Assessment");
  const [isLoading, setIsLoading] = useState(true);
  const [reportViewMode, setReportViewMode] = useState<'master' | 'reports' | 'dashboard' | 'facilitators'>('master');
  const [examSubTab, setExamSubTab] = useState<'timetable' | 'invigilators' | 'results' | 'indicators' | 'subjects'>('results');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Bulk Sharing State
  const [isBulkSharing, setIsBulkSharing] = useState(false);
  const [bulkShareIndex, setBulkShareIndex] = useState(-1);
  const [bulkShareLog, setBulkShareLog] = useState<{name: string, status: 'pending' | 'success' | 'error'}[]>([]);

  useEffect(() => {
     const availableClasses = DEPARTMENT_CLASSES[activeDept];
     if (availableClasses && availableClasses.length > 0) setActiveClass(availableClasses[0]);
  }, [activeDept]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: settingsData } = await supabase.from('settings').select('payload').eq('id', 1).single();
        if (settingsData?.payload) setSettings({ ...DEFAULT_SETTINGS, ...settingsData.payload });
        const { data: studentsData } = await supabase.from('students').select('payload');
        if (studentsData?.length > 0) setStudents(studentsData.map((row: any) => row.payload));
        else setStudents(RAW_STUDENTS.map(s => ({ ...s, scoreDetails: {} })));
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const handleSettingChange = (key: keyof GlobalSettings, value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsLoading(true);
    try {
        await supabase.from('settings').upsert({ id: 1, payload: settings });
        await supabase.from('students').upsert(students.map(s => ({ id: s.id, payload: s })));
        alert("Data saved successfully!");
    } catch (err) { alert("Error saving data"); } finally { setIsLoading(false); }
  };

  const handleStudentUpdate = (id: number, field: keyof StudentData, value: any) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const isEarlyChildhood = activeDept === "Daycare" || activeDept === "Nursery" || activeDept === "Kindergarten";

  const currentSubjectList = useMemo(() => {
      const subjects = getSubjectsForDepartment(activeDept);
      const list = [...subjects.filter(s => !settings.disabledSubjects?.includes(s)), ...(settings.customSubjects || [])];
      return isEarlyChildhood ? [...list, ...(settings.activeIndicators || [])] : list;
  }, [activeDept, settings, isEarlyChildhood]);

  const { stats, processedStudents, classAvgAggregate, facilitatorStats } = useMemo(() => {
    const s = calculateClassStatistics(students, currentSubjectList);
    const processed = processStudentData(s, students, settings.facilitatorMapping || {}, currentSubjectList, settings.gradingSystemRemarks, settings.staffList);
    return { stats: s, processedStudents: processed, classAvgAggregate: processed.reduce((sum, st) => sum + st.bestSixAggregate, 0) / processed.length || 0, facilitatorStats: calculateFacilitatorStats(processed) };
  }, [students, currentSubjectList, settings]);

  // Bulk WhatsApp logic
  const startBulkShare = () => {
    setBulkShareLog(processedStudents.map(s => ({ name: s.name, status: 'pending' })));
    setBulkShareIndex(0);
    setIsBulkSharing(true);
  };

  const shareCurrentStudent = async () => {
    if (bulkShareIndex < 0 || bulkShareIndex >= processedStudents.length) return;
    const student = processedStudents[bulkShareIndex];
    const elementId = isEarlyChildhood 
        ? `daycare-report-${student.id}` 
        : `report-${student.id}`;
    
    const res = await generatePDFBlob(elementId, `${student.name.replace(/\s+/g, '_')}_Report.pdf`);
    
    if (res && navigator.share) {
        try {
            await navigator.share({
                files: [res.file],
                title: `${student.name} Report Card`,
                text: `Report card for ${student.name} from United Baylor Academy.`
            });
            const nextLog = [...bulkShareLog];
            nextLog[bulkShareIndex].status = 'success';
            setBulkShareLog(nextLog);
            setBulkShareIndex(prev => prev + 1);
        } catch (e) {
            console.error(e);
            alert("Sharing cancelled or failed for this student. You can skip or retry.");
        }
    } else {
        alert("Sharing not supported on this browser or element not found.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      {/* Bulk Sharing Modal */}
      {isBulkSharing && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
                      <h3 className="font-bold">WhatsApp Sharing Queue</h3>
                      <button onClick={() => setIsBulkSharing(false)} className="text-blue-300 hover:text-white">✕</button>
                  </div>
                  <div className="p-4 border-b bg-blue-50">
                      <p className="text-sm text-blue-900 mb-4">
                          Browsers require a user gesture for each file share. Click <strong>"Share to WhatsApp"</strong> to send the current report. The next student will load automatically.
                      </p>
                      <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-green-500 h-full transition-all duration-300" 
                            style={{width: `${(bulkShareIndex / processedStudents.length) * 100}%`}}
                          />
                      </div>
                      <p className="text-xs mt-1 text-blue-700 font-bold">Progress: {bulkShareIndex} / {processedStudents.length} Students</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {bulkShareLog.map((item, i) => (
                          <div key={i} className={`flex justify-between items-center p-2 rounded border ${i === bulkShareIndex ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-400' : 'bg-white'}`}>
                              <span className={`text-sm ${i === bulkShareIndex ? 'font-bold' : ''}`}>{i+1}. {item.name}</span>
                              {item.status === 'success' ? (
                                  <span className="text-green-600 font-bold text-xs">✓ Shared</span>
                              ) : i === bulkShareIndex ? (
                                  <span className="text-blue-600 animate-pulse text-xs font-bold">Current</span>
                              ) : (
                                  <span className="text-gray-400 text-xs">Pending</span>
                              )}
                          </div>
                      ))}
                  </div>
                  <div className="p-4 bg-gray-50 border-t flex gap-2">
                      <button 
                        onClick={() => setIsBulkSharing(false)}
                        className="flex-1 py-3 border border-gray-300 rounded font-bold text-gray-700 hover:bg-white"
                      >
                          Cancel
                      </button>
                      {bulkShareIndex < processedStudents.length ? (
                          <button 
                            onClick={shareCurrentStudent}
                            className="flex-[2] py-3 bg-green-600 text-white rounded font-bold shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"
                          >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.539 2.016 2.126-.54c.947.518 1.842.802 2.871.802h.001c3.181 0 5.766-2.586 5.767-5.766 0-3.18-2.585-5.765-5.677-5.765zm3.084 8.213c-.17.475-.85.87-1.168.924-.316.056-.708.083-1.135-.054-.26-.083-.589-.196-.98-.363-1.666-.71-2.733-2.4-2.816-2.51-.084-.111-.678-.897-.678-1.711 0-.814.426-1.214.577-1.378.15-.164.329-.205.438-.205.109 0 .219.001.314.005.101.005.237-.038.37.28.137.329.466 1.137.507 1.219.041.083.068.178.013.287-.054.11-.082.178-.164.273-.082.095-.173.15-.246.233-.083.082-.17.172-.073.342.097.17.433.714.927 1.154.636.565 1.171.74 1.336.823.164.083.26.069.356-.041.095-.11.411-.479.52-.644.11-.164.219-.137.37-.083.15.054.958.451 1.123.533.164.083.274.123.314.192.041.068.041.397-.13.872z"/></svg>
                              Share to WhatsApp
                          </button>
                      ) : (
                          <button 
                            onClick={() => setIsBulkSharing(false)}
                            className="flex-[2] py-3 bg-blue-600 text-white rounded font-bold"
                          >
                              All Finished!
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Main UI */}
      <div className="no-print bg-blue-900 text-white shadow-md z-50">
          <div className="flex justify-between items-center px-4 py-3">
            <div className="flex items-center gap-2">
                 <div className="bg-white text-blue-900 rounded-full w-8 h-8 flex items-center justify-center font-black">UBA</div>
                 <h1 className="font-bold text-lg hidden lg:block">United Baylor Academy System</h1>
            </div>
            <div className="flex gap-1 overflow-x-auto">
                {DEPARTMENTS.map(dept => (
                    <button key={dept} onClick={() => setActiveDept(dept)} className={`px-3 py-1 rounded text-sm font-semibold transition-colors whitespace-nowrap ${activeDept === dept ? 'bg-yellow-500 text-blue-900 shadow' : 'text-blue-200 hover:text-white hover:bg-blue-800'}`}>{dept}</button>
                ))}
            </div>
             <div className="flex gap-2">
                 <button onClick={handleSave} className="text-yellow-400 hover:text-yellow-300" title="Save All Data"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2v-4"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
            </div>
          </div>
      </div>
      <div className="no-print bg-blue-800 text-white border-b border-blue-900 shadow-inner">
          <div className="px-4 py-1.5 flex gap-2 overflow-x-auto items-center">
              <span className="text-xs font-bold uppercase text-blue-300">Classes:</span>
              {DEPARTMENT_CLASSES[activeDept].map(cls => (
                  <button key={cls} onClick={() => setActiveClass(cls)} className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeClass === cls ? 'bg-white text-blue-900 border-white' : 'text-blue-200 border-transparent hover:bg-blue-700'}`}>{cls}</button>
              ))}
          </div>
      </div>
      <div className="no-print bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
          <div className="px-4 py-2 flex gap-4 overflow-x-auto items-center">
              <span className="text-xs font-bold uppercase text-gray-400">Modules:</span>
              {MODULES.map(mod => (
                  <button key={mod} onClick={() => setActiveModule(mod)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeModule === mod ? 'bg-blue-100 text-blue-900 border-blue-300' : 'text-gray-600 border-transparent hover:bg-gray-100'}`}>{mod}</button>
              ))}
          </div>
      </div>

      {activeModule === 'Assessment' && examSubTab === 'results' ? (
        <>
            <div className="no-print bg-blue-50 border-b border-blue-200 p-2 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold uppercase text-blue-900 px-2 bg-blue-200 rounded">{activeClass} Portal</span>
                    <div className="flex bg-white rounded border border-blue-200 p-0.5 text-xs">
                        {['master', 'reports', 'dashboard'].map(mode => (
                            <button key={mode} onClick={() => setReportViewMode(mode as any)} className={`px-3 py-1 rounded transition capitalize ${reportViewMode === mode ? 'bg-blue-600 text-white font-bold' : 'text-blue-900 hover:bg-blue-50'}`}>{mode}</button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {reportViewMode === 'reports' && (
                        <button 
                            onClick={startBulkShare}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold shadow text-xs flex items-center gap-2"
                        >
                            Bulk Share (WhatsApp)
                        </button>
                    )}
                    <button onClick={window.print} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-bold shadow transition text-xs">Print View</button>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100">
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }} className="p-4 md:p-8">
                    {reportViewMode === 'master' && !isEarlyChildhood && <MasterSheet students={processedStudents} stats={stats} settings={settings} onSettingChange={handleSettingChange} subjectList={currentSubjectList} />}
                    {reportViewMode === 'master' && isEarlyChildhood && <DaycareMasterSheet students={processedStudents} settings={settings} onSettingChange={handleSettingChange} subjectList={currentSubjectList} />}
                    {reportViewMode === 'reports' && (
                        <div className="flex flex-col gap-8 items-center">
                            {processedStudents.map(student => isEarlyChildhood ? (
                                <DaycareReportCard key={student.id} student={student} settings={settings} onSettingChange={handleSettingChange} onStudentUpdate={handleStudentUpdate} schoolClass={activeClass} totalStudents={processedStudents.length} />
                            ) : (
                                <ReportCard key={student.id} student={student} stats={stats} settings={settings} onSettingChange={handleSettingChange} classAverageAggregate={classAvgAggregate} onStudentUpdate={handleStudentUpdate} department={activeDept} schoolClass={activeClass} />
                            ))}
                        </div>
                    )}
                    {reportViewMode === 'dashboard' && <ScoreEntry students={students} setStudents={setStudents} settings={settings} onSettingChange={handleSettingChange} onSave={handleSave} department={activeDept} schoolClass={activeClass} subjectList={currentSubjectList} />}
                </div>
            </div>
        </>
      ) : (
          <div className="flex-1 overflow-auto bg-gray-100 p-8">
              <GenericModule department={activeDept} schoolClass={activeClass} module={activeModule} settings={settings} onSettingChange={handleSettingChange} students={students} setStudents={setStudents} onSave={handleSave} />
          </div>
      )}
    </div>
  );
};

export default App;

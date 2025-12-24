import React, { useState } from 'react';
import { ProcessedStudent, GlobalSettings, ClassStatistics, StudentData, Department, SchoolClass } from '../types';
import EditableField from './EditableField';
import { generatePDFBlob, generateWordBlob } from '../utils';

interface ReportCardProps {
  student: ProcessedStudent;
  stats: ClassStatistics;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: string) => void;
  classAverageAggregate: number;
  onStudentUpdate: (id: number, field: keyof StudentData, value: any) => void;
  department: Department;
  schoolClass: SchoolClass;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, stats, settings, onSettingChange, classAverageAggregate, onStudentUpdate, department, schoolClass }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const sortedSubjects = [...student.subjects].sort((a, b) => b.score - a.score);
  const gradingRemarks = settings.gradingSystemRemarks || {};

  const handleSharePDF = async () => {
    setIsGenerating(true);
    const filename = `${student.name.replace(/\s+/g, '_')}_Report.pdf`;
    const res = await generatePDFBlob(`report-${student.id}`, filename);
    
    if (res) {
        if (navigator.canShare && navigator.canShare({ files: [res.file] })) {
            try {
                await navigator.share({
                    files: [res.file],
                    title: `${student.name} Report Card`,
                    text: `Report card for ${student.name} from ${settings.schoolName}.`,
                });
            } catch (err) {
                console.log("Share failed or cancelled", err);
            }
        } else {
            const url = URL.createObjectURL(res.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    } else {
        alert("An error occurred during PDF generation.");
    }
    setIsGenerating(false);
  };

  const handleShareWord = async () => {
    setIsGenerating(true);
    const filename = `${student.name.replace(/\s+/g, '_')}_Report.doc`;
    const res = await generateWordBlob(`report-${student.id}`, filename);
    
    if (res) {
        if (navigator.canShare && navigator.canShare({ files: [res.file] })) {
            try {
                await navigator.share({
                    files: [res.file],
                    title: `${student.name} Report Card (Word)`,
                    text: `Microsoft Word Report for ${student.name}.`,
                });
            } catch (err) {
                console.log("Word share failed", err);
            }
        } else {
            const url = URL.createObjectURL(res.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    setIsGenerating(false);
  };

  return (
    <div 
        id={`report-${student.id}`}
        className="bg-white p-4 max-w-[210mm] mx-auto min-h-[296mm] border border-gray-200 shadow-sm print:shadow-none print:border-none page-break relative group flex flex-col box-border overflow-hidden"
    >
       <div data-html2canvas-ignore="true" className="absolute top-2 right-2 flex gap-2 no-print opacity-50 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={handleSharePDF} disabled={isGenerating} className={`${isGenerating ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'} text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs transition-colors`}>
            {isGenerating ? 'Preparing...' : 'Share PDF'}
          </button>
          <button onClick={handleShareWord} disabled={isGenerating} className={`${isGenerating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs transition-colors`}>
            {isGenerating ? '...' : 'Share Word'}
          </button>
       </div>

       {/* School Header Section */}
       <div className="school-header text-center border-b-4 border-double border-blue-900 pb-2 mb-2 pt-2 flex flex-col items-center">
          <div className="mb-2 w-full">
             <EditableField value={settings.schoolName} onChange={(v) => onSettingChange('schoolName', v)} className="text-center font-black w-full bg-transparent text-4xl text-blue-900 tracking-widest uppercase leading-tight drop-shadow-md" multiline rows={1} />
          </div>
          <div className="flex justify-center gap-4 text-[10px] font-semibold text-gray-800 mb-1 w-full text-center">
            <div className="flex gap-1"><span>Tel:</span><EditableField value={settings.schoolContact} onChange={(v) => onSettingChange('schoolContact', v)} /></div>
            <span>|</span>
            <div className="flex gap-1"><span>Email:</span><EditableField value={settings.schoolEmail} onChange={(v) => onSettingChange('schoolEmail', v)} /></div>
          </div>
          <h2 className="text-lg font-bold text-red-700 uppercase mt-0 leading-tight w-full text-center">
            <EditableField value={settings.examTitle} onChange={(v) => onSettingChange('examTitle', v)} className="text-center w-full" multiline rows={1} />
          </h2>
          <div className="flex justify-center gap-4 text-xs mt-0.5 font-semibold text-gray-700 items-center w-full text-center">
             <EditableField value={settings.termInfo} onChange={(v) => onSettingChange('termInfo', v)} className="text-center w-24 bg-transparent" />
             <span>|</span>
             <div className="flex gap-1">
                 <span>Year:</span>
                 <EditableField value={settings.academicYear} onChange={(v) => onSettingChange('academicYear', v)} className="w-24" />
             </div>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-4 mb-2 border border-gray-800 p-2 rounded bg-blue-50 text-xs">
          <div className="space-y-1">
            <div className="flex items-center"><span className="font-bold w-20">Name:</span><span className="flex-1 border-b border-dotted border-gray-600 uppercase font-semibold">{student.name}</span></div>
            <div className="flex items-center"><span className="font-bold w-20">ID No:</span><span className="flex-1 font-mono">{student.id.toString().padStart(4, '0')}</span></div>
            <div className="flex items-center"><span className="font-bold w-20">Attendance:</span><div className="flex-1 flex gap-1"><EditableField value={student.attendance || "0"} onChange={(v) => onStudentUpdate(student.id, 'attendance', v)} className="w-8 text-center" /><span>/</span><EditableField value={settings.attendanceTotal} onChange={(v) => onSettingChange('attendanceTotal', v)} className="w-8 text-center" /></div></div>
          </div>
          <div className="space-y-1">
             <div className="flex items-center"><span className="font-bold w-24">Start Date:</span><EditableField value={settings.startDate} onChange={(v) => onSettingChange('startDate', v)} className="w-full" /></div>
             <div className="flex items-center"><span className="font-bold w-24">End Date:</span><EditableField value={settings.endDate} onChange={(v) => onSettingChange('endDate', v)} className="w-full" /></div>
             <div className="flex items-center"><span className="font-bold w-24">Agg. (Best 6):</span><span className="flex-1 font-bold text-base text-red-800">{student.bestSixAggregate}</span></div>
          </div>
       </div>

       <table className="w-full text-xs border-collapse border border-gray-800 mb-2">
          <thead className="bg-gray-200 text-gray-800 uppercase text-[10px]">
            <tr>
               <th className="border border-gray-600 p-1 text-left">Subject</th>
               <th className="border border-gray-600 p-1 w-12 text-center">Score</th>
               <th className="border border-gray-600 p-1 w-12 text-center bg-gray-100">Avg</th>
               <th className="border border-gray-600 p-1 w-14 text-center">Grd</th>
               <th className="border border-gray-600 p-1 text-left">Remark</th>
            </tr>
          </thead>
          <tbody>
             {sortedSubjects.map(sub => (
               <tr key={sub.subject} className="even:bg-gray-50 text-[11px]">
                 <td className="border border-gray-600 p-1 font-medium">{sub.subject}</td>
                 <td className="border border-gray-600 p-1 text-center font-bold">{sub.score}</td>
                 <td className="border border-gray-600 p-1 text-center text-gray-500 bg-gray-50">{stats.subjectMeans[sub.subject]?.toFixed(0) || '-'}</td>
                 <td className={`border border-gray-600 p-1 text-center font-bold`}>{sub.grade}</td>
                 <td className="border border-gray-600 p-1 italic text-[10px]">{sub.remark}</td>
               </tr>
             ))}
          </tbody>
       </table>

       <div className="mb-2 p-1 border border-gray-300 rounded text-[9px] bg-gray-50 flex gap-2 flex-wrap justify-center">
            {Object.entries(gradingRemarks).map(([g, r]) => (
                <span key={g}><span className="font-bold">{g}</span>={r}</span>
            ))}
       </div>

       <div className="mb-2 space-y-2 flex-1 overflow-hidden">
         <div className="bg-gray-50 p-2 border border-gray-300 rounded">
            <h3 className="font-bold text-xs uppercase mb-1 text-blue-900">General Remarks & Weakness Analysis:</h3>
            <EditableField value={student.overallRemark} onChange={(v) => onStudentUpdate(student.id, 'finalRemark', v)} multiline className="w-full text-xs text-gray-800 leading-tight" />
         </div>
         <div className="bg-gray-50 p-2 border border-gray-300 rounded">
            <h3 className="font-bold text-xs uppercase mb-1 text-blue-900">Recommendation:</h3>
            <EditableField value={student.recommendation} onChange={(v) => onStudentUpdate(student.id, 'recommendation', v)} multiline className="w-full text-xs text-gray-800 leading-tight" />
         </div>
       </div>

       {/* Footer Section - Ensure it stays inside same card */}
       <div className="mt-auto pt-4 flex justify-between items-end pb-2">
         <div className="w-1/3 text-center flex flex-col items-center">
            <div className="border-b border-black mb-1 h-10 w-full"></div>
            <p className="font-bold text-[10px] uppercase">Class Teacher</p>
         </div>
         <div className="w-1/3 text-center flex flex-col items-center">
            <div className="border-b border-black mb-1 h-10 flex items-end justify-center pb-0 w-full">
               <EditableField value={settings.headTeacherName} onChange={(v) => onSettingChange('headTeacherName', v)} className="text-center font-bold uppercase w-full text-xs" />
            </div>
            <p className="font-bold text-[10px] uppercase">Headteacher's Signature & Stamp</p>
         </div>
       </div>
    </div>
  );
};

export default ReportCard;

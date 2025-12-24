import React, { useState } from 'react';
import { ProcessedStudent, GlobalSettings, SchoolClass, StudentData } from '../types';
import EditableField from './EditableField';
import { DAYCARE_SKILLS, DAYCARE_SUBJECTS } from '../constants';
import { getDaycareGrade, generatePDFBlob, generateWordBlob } from '../utils';

interface DaycareReportCardProps {
  student: ProcessedStudent;
  settings: GlobalSettings;
  onSettingChange: (key: keyof GlobalSettings, value: string) => void;
  onStudentUpdate: (id: number, field: keyof StudentData, value: any) => void;
  schoolClass: SchoolClass;
  totalStudents: number;
}

const DaycareReportCard: React.FC<DaycareReportCardProps> = ({ student, settings, onSettingChange, onStudentUpdate, schoolClass, totalStudents }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const activeIndicatorsList = settings.activeIndicators || DAYCARE_SKILLS;

  const handleSharePDF = async () => {
    setIsGenerating(true);
    const filename = `${student.name.replace(/\s+/g, '_')}_Daycare_Report.pdf`;
    const res = await generatePDFBlob(`daycare-report-${student.id}`, filename);
    
    if (res) {
        if (navigator.canShare && navigator.canShare({ files: [res.file] })) {
            try {
                await navigator.share({
                    files: [res.file],
                    title: `${student.name} Report`,
                    text: `Daycare Report Card for ${student.name} from ${settings.schoolName}.`,
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
    const filename = `${student.name.replace(/\s+/g, '_')}_Daycare_Report.doc`;
    const res = await generateWordBlob(`daycare-report-${student.id}`, filename);
    
    if (res) {
        if (navigator.canShare && navigator.canShare({ files: [res.file] })) {
            try {
                await navigator.share({
                    files: [res.file],
                    title: `${student.name} Daycare Report (Word)`,
                    text: `MS Word export for ${student.name}.`,
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
        id={`daycare-report-${student.id}`}
        className="bg-white p-6 max-w-[210mm] mx-auto min-h-[296mm] border border-gray-200 shadow-sm print:shadow-none print:border-none page-break relative group flex flex-col box-border font-sans overflow-hidden"
    >
       {/* Share Buttons */}
       <div 
         data-html2canvas-ignore="true" 
         className="absolute top-2 right-2 flex gap-2 no-print opacity-50 group-hover:opacity-100 transition-opacity z-10"
        >
          <button 
            onClick={handleSharePDF}
            disabled={isGenerating}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs transition-colors"
          >
            {isGenerating ? '...' : 'Share PDF'}
          </button>
          <button 
            onClick={handleShareWord}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 font-bold text-xs transition-colors"
          >
            {isGenerating ? '...' : 'Share Word'}
          </button>
       </div>

       {/* Header Section */}
       <div className="school-header text-center mb-4 flex flex-col items-center">
          <EditableField 
             value={settings.schoolName} 
             onChange={(v) => onSettingChange('schoolName', v)} 
             className="text-center font-black w-full bg-transparent text-3xl text-blue-900 tracking-widest uppercase leading-tight mb-1" 
             multiline
             rows={1}
          />
           <div className="flex justify-center gap-4 text-[10px] font-semibold text-gray-800 mb-2 w-full text-center">
            <div className="flex gap-1">
               <span>Tel:</span>
               <EditableField value={settings.schoolContact} onChange={(v) => onSettingChange('schoolContact', v)} placeholder="000-000-0000" />
            </div>
            <span>|</span>
            <div className="flex gap-1">
               <span>Email:</span>
               <EditableField value={settings.schoolEmail} onChange={(v) => onSettingChange('schoolEmail', v)} placeholder="school@email.com" />
            </div>
          </div>
          <h2 className="text-base font-bold text-red-700 uppercase leading-tight w-full text-center">STANDARD BASED CURRICULUM, LEARNER’S PERFORMANCE REPORT</h2>
       </div>

       {/* Particulars */}
       <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 text-sm font-semibold border-b-2 border-gray-800 pb-4 bg-gray-50 p-2 rounded">
          <div className="flex items-end gap-2">
             <span>Name:</span>
             <span className="flex-1 border-b border-dotted border-gray-600 uppercase text-blue-900 font-black">{student.name}</span>
          </div>
          <div className="flex items-end gap-2">
             <span>Age:</span>
             <EditableField 
                value={student.age || ""} 
                onChange={(v) => onStudentUpdate(student.id, 'age', v)} 
                className="w-16 text-center border-b border-dotted border-gray-600 font-bold" 
             />
          </div>
          <div className="flex items-end gap-2">
             <span>No. on Roll:</span>
             <span className="flex-1 border-b border-dotted border-gray-600">{totalStudents}</span>
          </div>
           <div className="flex items-end gap-2">
             <span>Term:</span>
             <EditableField value={settings.termInfo} onChange={(v) => onSettingChange('termInfo', v)} className="w-24 text-center border-b border-dotted border-gray-600" />
          </div>
          <div className="flex items-end gap-2">
             <span>Vacation Date:</span>
             <EditableField value={settings.endDate} onChange={(v) => onSettingChange('endDate', v)} className="flex-1 border-b border-dotted border-gray-600" />
          </div>
          <div className="flex items-end gap-2">
             <span>Next Term Begins:</span>
             <EditableField value={settings.nextTermBegin} onChange={(v) => onSettingChange('nextTermBegin', v)} className="flex-1 border-b border-dotted border-gray-600" />
          </div>
       </div>

       <h3 className="text-center font-bold uppercase mb-2 bg-blue-100 p-1 border border-blue-200 text-blue-900 text-xs w-full">Skill Achievement(s) Remarks</h3>

       {/* Main Table */}
       <div className="flex-1 border border-gray-800 mb-4 flex flex-col overflow-hidden rounded">
           {/* Header Row */}
           <div className="flex bg-gray-200 font-black text-[10px] uppercase border-b border-gray-800">
               <div className="flex-1 p-2 border-r border-gray-600">Learning Areas / Skills</div>
               <div className="w-10 p-2 text-center border-r border-gray-600 bg-white" title="Developing">D</div>
               <div className="w-10 p-2 text-center border-r border-gray-600 bg-gray-50" title="Achieved">A</div>
               <div className="w-10 p-2 text-center bg-gray-300" title="Advanced">A+</div>
           </div>

           {/* Subjects */}
           {student.subjects.filter(sub => DAYCARE_SUBJECTS.includes(sub.subject)).map(sub => {
               const { grade, remark } = getDaycareGrade(sub.score);
               return (
                   <div key={sub.subject} className="flex border-b border-gray-400 text-xs">
                       <div className="flex-1 p-2 border-r border-gray-600 font-bold uppercase text-blue-900">
                           {sub.subject}
                           <span className="block font-normal italic text-[9px] text-gray-500">{remark}</span>
                       </div>
                        <div className="w-10 p-2 text-center border-r border-gray-600 flex justify-center items-center font-black">
                            {grade === 'B' ? '✔' : ''}
                        </div>
                        <div className="w-10 p-2 text-center border-r border-gray-600 flex justify-center items-center font-black">
                            {grade === 'S' ? '✔' : ''}
                        </div>
                        <div className="w-10 p-2 text-center flex justify-center items-center font-black">
                            {grade === 'G' ? '✔' : ''}
                        </div>
                   </div>
               );
           })}

           <div className="bg-blue-50 p-1 font-bold text-[10px] border-b border-gray-400 text-center uppercase text-blue-800 w-full">
               Assessment on Social, Physical and Cultural Development
           </div>

           {/* Skills Checklist */}
           <div className="flex-1 overflow-y-auto">
               {activeIndicatorsList.map(skill => {
                   const rating = student.skills?.[skill];
                   return (
                        <div key={skill} className="flex border-b border-gray-400 text-[10px] last:border-0 hover:bg-gray-50">
                           <div className="flex-1 p-1 pl-2 border-r border-gray-600 uppercase">{skill}</div>
                           <div className="w-10 p-1 text-center border-r border-gray-600 flex justify-center items-center font-black text-green-700">
                               {rating === 'D' ? '✔' : ''}
                           </div>
                           <div className="w-10 p-1 text-center border-r border-gray-600 flex justify-center items-center font-black text-blue-700">
                               {rating === 'A' ? '✔' : ''}
                           </div>
                           <div className="w-10 p-1 text-center flex justify-center items-center font-black text-purple-700">
                               {rating === 'A+' ? '✔' : ''}
                           </div>
                       </div>
                   );
               })}
           </div>
       </div>

       {/* Footer Section */}
       <div className="text-xs font-semibold space-y-3 mt-2">
           <div className="flex items-center gap-2">
               <span>ATTENDANCE:</span>
               <div className="flex items-center border-b border-dotted border-gray-600 px-2">
                    <EditableField 
                        value={student.attendance || "0"} 
                        onChange={(v) => onStudentUpdate(student.id, 'attendance', v)}
                        className="w-8 text-center font-bold" 
                    />
                    <span className="mx-1">/</span>
                    <EditableField value={settings.attendanceTotal} onChange={(v) => onSettingChange('attendanceTotal', v)} className="w-8 text-center font-bold" />
               </div>
               <span className="ml-4">PROMOTED TO:</span>
               <EditableField 
                    value={student.promotedTo || ""} 
                    onChange={(v) => onStudentUpdate(student.id, 'promotedTo', v)}
                    className="flex-1 border-b border-dotted border-gray-600 uppercase font-black text-blue-900" 
               />
           </div>

           <div className="flex items-center gap-2">
               <span>TALENT AND INTEREST:</span>
               <EditableField 
                    value={student.interest || ""} 
                    onChange={(v) => onStudentUpdate(student.id, 'interest', v)}
                    className="flex-1 border-b border-dotted border-gray-600 italic" 
               />
           </div>

           <div className="flex items-center gap-2">
               <span>CONDUCT:</span>
               <EditableField 
                    value={student.conduct || ""} 
                    onChange={(v) => onStudentUpdate(student.id, 'conduct', v)}
                    className="flex-1 border-b border-dotted border-gray-600" 
               />
           </div>

           <div className="flex items-start gap-2 bg-gray-50 p-2 rounded border">
               <span className="whitespace-nowrap font-bold text-blue-900 uppercase">Overall Remark:</span>
               <EditableField 
                    value={student.overallRemark || ""} 
                    onChange={(v) => onStudentUpdate(student.id, 'finalRemark', v)}
                    multiline
                    className="flex-1 border-b border-dotted border-gray-600 leading-tight text-[11px]" 
               />
           </div>

           <div className="flex justify-between items-end mt-4 pt-4">
               <div className="w-5/12 text-center flex flex-col items-center">
                   <div className="border-b border-black h-8 mb-1 w-full"></div>
                   <p className="text-[10px] font-bold">CLASS FACILITATOR</p>
               </div>
               <div className="w-5/12 text-center flex flex-col items-center">
                   <div className="border-b border-black h-8 mb-1 flex items-end justify-center w-full">
                        <EditableField value={settings.headTeacherName} onChange={(v) => onSettingChange('headTeacherName', v)} className="text-center font-bold uppercase w-full text-[11px]" />
                   </div>
                   <p className="text-[10px] font-bold">HEAD TEACHER SIGN/STAMP</p>
               </div>
           </div>
       </div>

       {/* Grading Key Footer */}
       <div className="mt-4 border-t-2 border-gray-800 pt-2 flex justify-between text-[9px] uppercase font-black text-gray-500 w-full">
           <div>Procedure</div>
           <div>70-100% G GOLD (High)</div>
           <div>40-69% S SILVER (Suff.)</div>
           <div>01-39% B BRONZE (Appr.)</div>
           <div>Absent O Absent</div>
       </div>
    </div>
  );
};

export default DaycareReportCard;

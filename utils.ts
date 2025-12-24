import { CORE_SUBJECTS, DEFAULT_GRADING_REMARKS } from './constants';
import { ClassStatistics, ProcessedStudent, ComputedSubject, StudentData, FacilitatorStats, StaffMember } from './types';

export const calculateMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

export const calculateStdDev = (values: number[], mean: number): number => {
  if (values.length === 0) return 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
};

// Daycare Grading Helper
export const getDaycareGrade = (score: number): { grade: string, remark: string } => {
    if (score >= 70) return { grade: 'G', remark: 'High Level of Proficiency' }; // GOLD
    if (score >= 40) return { grade: 'S', remark: 'Sufficient Level of Proficiency' }; // SILVER
    return { grade: 'B', remark: 'Approaching Proficiency' }; // BRONZE
};

// Calculate Indicator Rating from 1-9 Scale Points
export const getObservationRating = (scores: number[] | undefined): 'D' | 'A' | 'A+' | '' => {
    if (!scores || scores.length === 0) return '';
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    if (avg >= 7) return 'A+';
    if (avg >= 4) return 'A';
    return 'D'; 
};

export const generateSubjectRemark = (score: number): string => {
  if (score >= 90) return "Outstanding mastery of subject concepts.";
  if (score >= 80) return "Excellent performance, shows great potential.";
  if (score >= 70) return "Very Good. Consistent effort displayed.";
  if (score >= 60) return "Good. Capable of achieving higher grades.";
  if (score >= 55) return "Credit. Satisfactory understanding shown.";
  if (score >= 50) return "Pass. Needs more dedication to studies.";
  if (score >= 40) return "Weak Pass. Remedial support recommended.";
  return "Critical Failure. Immediate intervention required.";
};

export const getGradeFromZScore = (score: number, mean: number, stdDev: number, remarksMap: Record<string, string>): { grade: string, value: number, category: string } => {
  if (stdDev === 0) return { grade: 'C4', value: 4, category: remarksMap['C4'] || 'Credit' };
  const diff = score - mean;
  if (diff >= 1.645 * stdDev) return { grade: 'A1', value: 1, category: remarksMap['A1'] || 'Excellent' };
  if (diff >= 1.036 * stdDev) return { grade: 'B2', value: 2, category: remarksMap['B2'] || 'Very Good' };
  if (diff >= 0.524 * stdDev) return { grade: 'B3', value: 3, category: remarksMap['B3'] || 'Good' };
  if (diff >= 0) return { grade: 'C4', value: 4, category: remarksMap['C4'] || 'Credit' };
  if (diff >= -0.524 * stdDev) return { grade: 'C5', value: 5, category: remarksMap['C5'] || 'Credit' };
  if (diff >= -1.036 * stdDev) return { grade: 'C6', value: 6, category: remarksMap['C6'] || 'Credit' };
  if (diff >= -1.645 * stdDev) return { grade: 'D7', value: 7, category: remarksMap['D7'] || 'Pass' };
  if (diff >= -2.326 * stdDev) return { grade: 'E8', value: 8, category: remarksMap['E8'] || 'Pass' };
  return { grade: 'F9', value: 9, category: remarksMap['F9'] || 'Fail' };
};

export const calculateClassStatistics = (students: StudentData[], subjectList: string[]): ClassStatistics => {
  const subjectMeans: Record<string, number> = {};
  const subjectStdDevs: Record<string, number> = {};
  subjectList.forEach(subject => {
    const scores = students.map(s => s.scores[subject] || 0);
    const mean = calculateMean(scores);
    const stdDev = calculateStdDev(scores, mean);
    subjectMeans[subject] = mean;
    subjectStdDevs[subject] = stdDev;
  });
  return { subjectMeans, subjectStdDevs };
};

export const processStudentData = (
    stats: ClassStatistics, 
    students: StudentData[], 
    facilitatorMap: Record<string, string>,
    subjectList: string[],
    gradingRemarks: Record<string, string> = DEFAULT_GRADING_REMARKS,
    staffList: StaffMember[] = []
): ProcessedStudent[] => {
  const processed = students.map(student => {
    let totalScore = 0;
    const computedSubjects: ComputedSubject[] = [];
    subjectList.forEach(subject => {
      const score = student.scores[subject] || 0;
      totalScore += score;
      const mean = stats.subjectMeans[subject];
      const stdDev = stats.subjectStdDevs[subject];
      const { grade, value } = getGradeFromZScore(score, mean, stdDev, gradingRemarks);
      const remark = generateSubjectRemark(score); 
      const staff = staffList.find(s => s.subjects && s.subjects.includes(subject));
      const facilitatorName = staff ? staff.name : (facilitatorMap[subject] || 'TBA');
      computedSubjects.push({
        subject, score, grade, gradeValue: value, remark, facilitator: facilitatorName,
        zScore: stdDev === 0 ? 0 : (score - mean) / stdDev
      });
    });
    const cores = computedSubjects.filter(s => CORE_SUBJECTS.includes(s.subject));
    const electives = computedSubjects.filter(s => !CORE_SUBJECTS.includes(s.subject));
    const sortFn = (a: ComputedSubject, b: ComputedSubject) => {
      if (a.gradeValue !== b.gradeValue) return a.gradeValue - b.gradeValue;
      return b.score - a.score;
    };
    cores.sort(sortFn);
    electives.sort(sortFn);
    const best4Cores = cores.slice(0, 4);
    const best2Electives = electives.slice(0, 2);
    const bestSixAggregate = best4Cores.reduce((sum, s) => sum + s.gradeValue, 0) + best2Electives.reduce((sum, s) => sum + s.gradeValue, 0);
    let category = "Average";
    if (bestSixAggregate <= 10) category = "Distinction";
    else if (bestSixAggregate <= 20) category = "Merit";
    else if (bestSixAggregate <= 36) category = "Pass";
    else category = "Fail";
    let combinedOverallRemark = "";
    let weaknessAnalysis = "";
    if (student.finalRemark && student.finalRemark.trim() !== "") {
        combinedOverallRemark = student.finalRemark;
    } else {
        const weakSubjects = computedSubjects.filter(s => s.gradeValue >= 7);
        if (weakSubjects.length > 0) weaknessAnalysis = `Needs urgent improvement in: ${weakSubjects.map(s => s.subject).join(", ")}.`;
        const classTeacherRemark = student.overallRemark || `Overall performance is ${category}.`;
        combinedOverallRemark = `${weaknessAnalysis}\n\n${classTeacherRemark}`;
    }
    const recommendation = student.recommendation || "Recommended to attend extra classes for weak areas.";
    const mergedSkills = { ...student.skills };
    if (student.observationScores) {
        Object.entries(student.observationScores).forEach(([indicator, scores]) => {
            if (!mergedSkills[indicator] && scores.length > 0) {
                const rating = getObservationRating(scores);
                if (rating) mergedSkills[indicator] = rating;
            }
        });
    }
    return {
      id: student.id, name: student.name, subjects: computedSubjects, totalScore, bestSixAggregate,
      bestCoreSubjects: best4Cores, bestElectiveSubjects: best2Electives, overallRemark: combinedOverallRemark,
      recommendation, weaknessAnalysis, category, rank: 0, attendance: student.attendance || "0",
      age: student.age, promotedTo: student.promotedTo, conduct: student.conduct, interest: student.interest, skills: mergedSkills
    };
  });
  processed.sort((a, b) => {
    if (a.bestSixAggregate !== b.bestSixAggregate) return a.bestSixAggregate - b.bestSixAggregate;
    return b.totalScore - a.totalScore;
  });
  processed.forEach((p, index) => { p.rank = index + 1; });
  return processed;
};

export const calculateFacilitatorStats = (processedStudents: ProcessedStudent[]): FacilitatorStats[] => {
  const statsMap: Record<string, FacilitatorStats> = {};
  processedStudents.forEach(student => {
    student.subjects.forEach(sub => {
      const key = `${sub.facilitator}||${sub.subject}`;
      if (!statsMap[key]) {
        statsMap[key] = {
          facilitatorName: sub.facilitator, subject: sub.subject, studentCount: 0,
          gradeCounts: { 'A1': 0, 'B2': 0, 'B3': 0, 'C4': 0, 'C5': 0, 'C6': 0, 'D7': 0, 'E8': 0, 'F9': 0 },
          totalGradeValue: 0, performancePercentage: 0, averageGradeValue: 0, performanceGrade: ''
        };
      }
      const entry = statsMap[key];
      entry.studentCount++;
      entry.gradeCounts[sub.grade] = (entry.gradeCounts[sub.grade] || 0) + 1;
      entry.totalGradeValue += sub.gradeValue;
    });
  });
  
  return Object.values(statsMap).map(stat => {
    const avg = stat.totalGradeValue / stat.studentCount;
    const perf = Math.round((1 - (stat.totalGradeValue / (stat.studentCount * 9))) * 100);
    
    let grade = 'F9';
    if (perf >= 80) grade = 'A1';
    else if (perf >= 70) grade = 'B2';
    else if (perf >= 60) grade = 'B3';
    else if (perf >= 50) grade = 'C4';
    else if (perf >= 45) grade = 'C5';
    else if (perf >= 40) grade = 'C6';
    else if (perf >= 35) grade = 'D7';
    else if (perf >= 30) grade = 'E8';

    return {
      ...stat,
      performancePercentage: perf,
      averageGradeValue: avg,
      performanceGrade: grade
    };
  });
};

export const generatePDFBlob = async (elementId: string, filename: string): Promise<{ blob: Blob, file: File } | null> => {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) return null;

  // @ts-ignore
  const html2pdf = (window as any).html2pdf;
  if (!html2pdf) {
    console.error("html2pdf library not found.");
    return null;
  }

  const clone = originalElement.cloneNode(true) as HTMLElement;
  
  const replaceInputs = (tagName: string) => {
    const originals = originalElement.querySelectorAll(tagName);
    const clones = clone.querySelectorAll(tagName);
    originals.forEach((orig, idx) => {
      const originalInput = orig as HTMLInputElement | HTMLTextAreaElement;
      const cloneInput = clones[idx] as HTMLElement;
      if (!cloneInput) return;
      
      const div = document.createElement('div');
      div.textContent = originalInput.value;
      div.style.whiteSpace = tagName === 'textarea' ? 'pre-wrap' : 'nowrap';
      div.className = cloneInput.className;
      div.classList.remove('hover:bg-yellow-50', 'focus:bg-yellow-100', 'focus:border-blue-500');
      
      const computed = window.getComputedStyle(originalInput);
      div.style.textAlign = computed.textAlign || 'inherit';
      div.style.fontWeight = computed.fontWeight;
      div.style.fontSize = computed.fontSize;
      div.style.color = computed.color;
      div.style.fontFamily = computed.fontFamily;
      div.style.width = '100%';
      div.style.display = 'block';
      
      cloneInput.parentNode?.replaceChild(div, cloneInput);
    });
  };
  replaceInputs('input');
  replaceInputs('textarea');

  clone.querySelectorAll('button, [data-html2canvas-ignore]').forEach(el => el.remove());

  const headings = clone.querySelectorAll('h1, h2, .text-center, .school-header');
  headings.forEach(h => {
    (h as HTMLElement).style.textAlign = 'center';
    (h as HTMLElement).style.width = '100%';
    (h as HTMLElement).style.display = 'block';
  });

  clone.style.width = '210mm';
  clone.style.height = 'auto'; 
  clone.style.minHeight = '296mm';
  clone.style.padding = '10mm'; 
  clone.style.boxSizing = 'border-box';
  clone.style.background = 'white';
  clone.style.margin = '0';
  clone.style.transform = 'none';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.appendChild(clone);
  document.body.appendChild(container);

  const opt = {
    margin: 0, 
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      windowWidth: 794 
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const blob = await html2pdf().set(opt).from(clone).output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    document.body.removeChild(container);
    return { blob, file };
  } catch (e) {
    console.error("generatePDFBlob error:", e);
    if (container.parentNode) document.body.removeChild(container);
    return null;
  }
};

/**
 * Generates a Word (.docx) compatible blob from an HTML element
 * Uses the MHTML approach which Word can interpret natively
 */
export const generateWordBlob = async (elementId: string, filename: string): Promise<{ blob: Blob, file: File } | null> => {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) return null;

  const clone = originalElement.cloneNode(true) as HTMLElement;
  
  // Replace inputs and interactive fields
  const replaceInputs = (tagName: string) => {
    const originals = originalElement.querySelectorAll(tagName);
    const clones = clone.querySelectorAll(tagName);
    originals.forEach((orig, idx) => {
      const originalInput = orig as HTMLInputElement | HTMLTextAreaElement;
      if (clones[idx]) {
        const div = document.createElement('div');
        div.textContent = originalInput.value;
        clones[idx].parentNode?.replaceChild(div, clones[idx]);
      }
    });
  };
  replaceInputs('input');
  replaceInputs('textarea');

  clone.querySelectorAll('button, [data-html2canvas-ignore]').forEach(el => el.remove());

  // Center alignment for word headings
  clone.querySelectorAll('h1, h2, .text-center, .school-header').forEach(h => {
    (h as HTMLElement).style.textAlign = 'center';
  });

  // Table styling for word
  clone.querySelectorAll('table').forEach(tbl => {
    (tbl as HTMLElement).style.borderCollapse = 'collapse';
    (tbl as HTMLElement).style.width = '100%';
    tbl.querySelectorAll('td, th').forEach(cell => {
      (cell as HTMLElement).style.border = '1pt solid black';
      (cell as HTMLElement).style.padding = '5pt';
    });
  });

  const content = clone.innerHTML;
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; }
      .text-center { text-align: center; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 10pt; }
      th, td { border: 1pt solid #000; padding: 5pt; }
      .font-bold { font-weight: bold; }
      h1 { font-size: 24pt; color: #1e3a8a; }
      h2 { font-size: 18pt; color: #b91c1c; }
    </style>
    </head><body>
  `;
  const footer = "</body></html>";
  const sourceHTML = header + content + footer;

  const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
  const file = new File([blob], filename, { type: 'application/msword' });
  
  return { blob, file };
};

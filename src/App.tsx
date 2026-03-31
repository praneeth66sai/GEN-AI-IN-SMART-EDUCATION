/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  LayoutDashboard, 
  Plus, 
  Sparkles, 
  Zap,
  Download, 
  History, 
  Trash2, 
  FileText, 
  X, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  ArrowLeft, 
  Share2,
  Settings,
  MoreVertical,
  Search,
  Clock,
  User,
  Copy,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Types ---

type ArtifactType = 'lesson-plan' | 'academic-year' | 'roadmap' | 'daily-schedule';

interface Artifact {
  id: string;
  type: ArtifactType;
  topic: string;
  courseCode: string;
  program: string;
  sessionsPerWeek: string;
  sessionDays: string[];
  startDate?: string;
  endDate?: string;
  content: string;
  syllabusContext?: string;
  timestamp: number;
}

// --- Constants ---

const SYSTEM_PROMPT = `Role: You are an expert Instructional Designer and Curriculum Architect specialized in "Smart Education" for higher education (University level), inspired by advanced LMS platforms like GITAM G-Learn. Your goal is to generate highly structured, contextual, and ready-to-use teaching artifacts.

Core Directives:

Autonomous Pedagogy: You must independently select the most effective teaching method for a topic. If a topic is theoretical, use Chalk & Talk. If it is practical/coding, use Interactive Lab. If it involves critical thinking, use Socratic Seminar.

Long-Term Planning: When asked for an academic year, provide a 32-week roadmap split into two semesters.

Roadmap Architecture (G-Learn Style): When asked for a "Long Term Roadmap", structure it as a series of "Learning Modules". Each module must have:
1. Module Title & Duration
2. Core Competencies (What the student will master)
3. Milestones (Key assessments or projects)
4. Industry Alignment (How this maps to 2026 job roles)

Formatting: Always output in Markdown. DO NOT use tables. Use clean, hierarchical bullet points for all structured data.

Structure of Every Lesson Plan (G-Learn Standard):
1. Weekly Time Table: A bulleted list showing sessions (strictly 40 minutes each, e.g., 09:00-09:40, 09:40-10:20) across Monday to Saturday.
2. Detailed Lesson Plan: A bulleted list with details: Topic, Periods, Date, CO type, Delivery method, Reference.
3. Teaching Flow: A breakdown of how the 40 minutes are spent.
4. Divergent Paths: Provide one "Scaffolded" path for struggling students and one "Extension" path for advanced students.

Structure of Academic Year Plan:
Semester Overview: A bulleted list with [Week | Module | Core Topic | AI-Selected Method | Justification].

Structure of Long Term Roadmap:
Phase-wise breakdown (Foundation -> Intermediate -> Advanced -> Specialization).
Each phase contains multiple modules with clear progression paths.

Tone: Professional, academic, and encouraging.`;

// --- Components ---

export default function App() {
  const [topic, setTopic] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('3');
  const [sessionDays, setSessionDays] = useState<string[]>(['Monday', 'Wednesday', 'Friday']);
  const [artifactType, setArtifactType] = useState<ArtifactType>('lesson-plan');
  const [semester, setSemester] = useState('Semester 1');
  const [grade, setGrade] = useState('Freshman (Year 1)');
  const [program, setProgram] = useState('B.Tech CSE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [syllabusContent, setSyllabusContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [showHero, setShowHero] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('smartedu_artifacts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setArtifacts(parsed);
        if (parsed.length > 0) {
          setActiveArtifactId(parsed[0].id);
          setShowHero(false);
        }
      } catch (e) {
        console.error("Failed to parse saved artifacts", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('smartedu_artifacts', JSON.stringify(artifacts));
  }, [artifacts]);

  const exportToPDF = (artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.topic.replace(/\s+/g, '_')}_${artifact.type}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const regenerateArtifact = async (artifact: Artifact) => {
    setIsGenerating(true);
    try {
      let prompt = '';
      const dateContext = artifact.startDate && artifact.endDate ? `from ${artifact.startDate} to ${artifact.endDate}` : '';
      
      if (artifact.type === 'lesson-plan') {
        prompt = `Generate a clean, professional, and comprehensive Day-by-Day Lesson Plan ${dateContext} for the course: "${artifact.topic}" (${artifact.courseCode}). 
                 Program: ${artifact.program}.
                 Schedule: ${artifact.sessionsPerWeek} sessions per week on ${artifact.sessionDays.join(', ')}.
                 
                 CRITICAL REQUIREMENTS:
                 1. Organize the content into logical MODULES.
                 2. Provide a detailed DAY-BY-DAY breakdown for the entire duration ${dateContext}.
                 3. If dates are provided, assign specific dates to each session based on the session days (${artifact.sessionDays.join(', ')}).
                 4. Each session must be exactly 40 minutes.
                 5. DO NOT use tables. Use a clean, bulleted list for each session.
                 6. Use clean Markdown formatting with clear headings and professional structure.`;
      } else if (artifact.type === 'daily-schedule') {
        prompt = `Generate a clean, professional Weekly Schedule ${dateContext} for the course: "${artifact.topic}" (${artifact.courseCode}). 
                 Program: ${artifact.program}.
                 Schedule: ${artifact.sessionsPerWeek} sessions per week on ${artifact.sessionDays.join(', ')}.
                 
                 CRITICAL REQUIREMENTS:
                 1. Organize the output by WEEK (e.g., Week 1, Week 2, etc.).
                 2. For each week, include a brief "Weekly Goal" or "What to accomplish this week" summary.
                 3. List each session for that week with a BULLET POINT.
                 4. Format each session line as: - [Topic] [Day of the Week] [Date].
                 5. DO NOT use tables. Use clean, hierarchical bullet points.
                 6. Ensure the output is extremely clean and easy to read.`;
      } else if (artifact.type === 'academic-year') {
        prompt = `Generate a clean, professional 32-week Academic Year Plan ${dateContext} organized by MODULES and DAY-BY-DAY for the course: "${artifact.topic}" (${artifact.courseCode}). 
                 Program: ${artifact.program}.
                 Schedule: ${artifact.sessionsPerWeek} sessions per week.
                 
                 CRITICAL REQUIREMENTS:
                 1. Break down the 32 weeks into distinct MODULES.
                 2. Provide a DAY-BY-DAY schedule for each week.
                 3. If dates are provided (${dateContext}), map the weeks and days to actual calendar dates.
                 4. Include key milestones, assessments, and holiday buffers.
                 5. DO NOT use tables. Use a clean, hierarchical bulleted list format.`;
      } else {
        prompt = `Generate a clean, professional Long-Term Career & Skill Roadmap ${dateContext} for: "${artifact.topic}" (${artifact.courseCode}). 
                 Program: ${artifact.program}.
                 Structure it like a GITAM G-Learn course journey.
                 
                 CRITICAL REQUIREMENTS:
                 1. Divide the roadmap into 4 clear PHASES: Foundation, Core, Advanced, and Industry Specialization.
                 2. Within each phase, define specific MODULES with day-by-day or week-by-week milestones.
                 3. If dates are provided (${dateContext}), align the phases with the timeline.
                 4. Include industry alignment and skill outcomes for each module.
                 5. DO NOT use tables. Use clean, hierarchical bulleted lists.`;
      }

      const context = artifact.syllabusContext || syllabusContent;
      if (context) {
        const truncatedSyllabus = context.length > 15000 
          ? context.substring(0, 15000) + "... [Syllabus truncated due to length]"
          : context;
        prompt += `\n\nReference the following syllabus content for context, structure, and specific requirements:\n${truncatedSyllabus}`;
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: SYSTEM_PROMPT }),
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const data = await response.json();
      const content = data.content || "Failed to generate content.";
      
      const updatedArtifact = { ...artifact, content, timestamp: Date.now() };
      setArtifacts(artifacts.map(a => a.id === artifact.id ? updatedArtifact : a));
    } catch (error: any) {
      console.error("Regeneration error:", error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateArtifact = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    try {
      let prompt = '';
      const dateContext = startDate && endDate ? `from ${startDate} to ${endDate}` : '';
      
      if (artifactType === 'lesson-plan') {
        prompt = `Generate a clean, professional, and comprehensive Day-by-Day Lesson Plan ${dateContext} for the course: "${topic}" (${courseCode}). 
                 Program: ${program}.
                 Target Level: ${grade}. 
                 Context: ${semester}.
                 Schedule: ${sessionsPerWeek} sessions per week on ${sessionDays.join(', ')}.
                 
                 CRITICAL REQUIREMENTS:
                 1. Organize the content into logical MODULES.
                 2. Provide a detailed DAY-BY-DAY breakdown for the entire duration ${dateContext}.
                 3. If dates are provided, assign specific dates to each session based on the session days (${sessionDays.join(', ')}).
                 4. Each session must be exactly 40 minutes.
                 5. DO NOT use tables. Use a clean, bulleted list for each session.
                 6. Use clean Markdown formatting with clear headings and professional structure.`;
      } else if (artifactType === 'daily-schedule') {
        prompt = `Generate a clean, professional Weekly Schedule ${dateContext} for the course: "${topic}" (${courseCode}). 
                 Program: ${program}.
                 Schedule: ${sessionsPerWeek} sessions per week on ${sessionDays.join(', ')}.
                 
                 CRITICAL REQUIREMENTS:
                 1. Organize the output by WEEK (e.g., Week 1, Week 2, etc.).
                 2. For each week, include a brief "Weekly Goal" or "What to accomplish this week" summary.
                 3. List each session for that week with a BULLET POINT.
                 4. Format each session line as: - [Topic] [Day of the Week] [Date].
                 5. DO NOT use tables. Use clean, hierarchical bullet points.
                 6. Example Format:
                    Week 1: Introduction to OOSE
                    Goal: Understand core principles of object-oriented engineering.
                    - OOSe basics Monday (March 30)
                    - Requirement Analysis Tuesday (March 31)
                 7. Ensure the output is extremely clean and easy to read.`;
      } else if (artifactType === 'academic-year') {
        prompt = `Generate a clean, professional 32-week Academic Year Plan ${dateContext} organized by MODULES and DAY-BY-DAY for the course: "${topic}" (${courseCode}). 
                 Program: ${program}.
                 Target Level: ${grade}. 
                 Focus: ${semester}.
                 Schedule: ${sessionsPerWeek} sessions per week.
                 
                 CRITICAL REQUIREMENTS:
                 1. Break down the 32 weeks into distinct MODULES.
                 2. Provide a DAY-BY-DAY schedule for each week.
                 3. If dates are provided (${dateContext}), map the weeks and days to actual calendar dates.
                 4. Include key milestones, assessments, and holiday buffers.
                 5. DO NOT use tables. Use a clean, hierarchical bulleted list format.`;
      } else {
        prompt = `Generate a clean, professional Long-Term Career & Skill Roadmap ${dateContext} for: "${topic}" (${courseCode}). 
                 Program: ${program}.
                 Structure it like a GITAM G-Learn course journey.
                 
                 CRITICAL REQUIREMENTS:
                 1. Divide the roadmap into 4 clear PHASES: Foundation, Core, Advanced, and Industry Specialization.
                 2. Within each phase, define specific MODULES with day-by-day or week-by-week milestones.
                 3. If dates are provided (${dateContext}), align the phases with the timeline.
                 4. Include industry alignment and skill outcomes for each module.
                 5. DO NOT use tables. Use clean, hierarchical bulleted lists.`;
      }

      if (syllabusContent) {
        // Truncate syllabus content to avoid API limits (approx 15k chars)
        const truncatedSyllabus = syllabusContent.length > 15000 
          ? syllabusContent.substring(0, 15000) + "... [Syllabus truncated due to length]"
          : syllabusContent;
          
        prompt += `\n\nReference the following syllabus content for context, structure, and specific requirements:\n${truncatedSyllabus}`;
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          systemInstruction: SYSTEM_PROMPT
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate content';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const content = data.content || "Failed to generate content.";
      
      const newArtifact: Artifact = {
        id: crypto.randomUUID(),
        type: artifactType,
        topic: topic,
        courseCode: courseCode,
        program: program,
        sessionsPerWeek: sessionsPerWeek,
        sessionDays: sessionDays,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        content: content,
        syllabusContext: syllabusContent || undefined,
        timestamp: Date.now(),
      };

      setArtifacts([newArtifact, ...artifacts]);
      setActiveArtifactId(newArtifact.id);
      setShowHero(false);
      setTopic('');
      setCourseCode('');
    } catch (error: any) {
      console.error("Generation error:", error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteArtifact = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = artifacts.filter(a => a.id !== id);
    setArtifacts(updated);
    if (activeArtifactId === id) {
      if (updated.length > 0) {
        setActiveArtifactId(updated[0].id);
      } else {
        setActiveArtifactId(null);
        setShowHero(true);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10MB limit for PDF/Word
    if (file.size > 10 * 1024 * 1024) {
      alert("The syllabus file is too large. Please upload a file smaller than 10MB.");
      return;
    }

    const fileType = file.name.split('.').pop()?.toLowerCase();

    try {
      if (fileType === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        setSyllabusContent(fullText);
        alert(`PDF Syllabus "${file.name}" processed successfully!`);
      } 
      else if (fileType === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setSyllabusContent(result.value);
        alert(`Word Syllabus "${file.name}" processed successfully!`);
      } 
      else {
        // Handle text-based files
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setSyllabusContent(content);
          alert(`Syllabus "${file.name}" uploaded successfully!`);
        };
        reader.onerror = () => {
          alert("Failed to read the file.");
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error("File processing error:", error);
      alert("Error processing file. Please ensure it is a valid PDF, Word, or Text document.");
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-gray-900 font-sans selection:bg-brand-accent/20">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900 leading-none">PlanFlow</h1>
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest mt-1">AI Architect</p>
            </div>
          </div>

          <button 
            onClick={() => { 
              setShowHero(true); 
              setCurrentStep(1); 
              setActiveArtifactId(null);
              setStartDate('');
              setEndDate('');
              setTopic('');
              setCourseCode('');
              setSyllabusContent(null);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-accent text-white rounded-xl font-bold hover:bg-brand-accent/90 transition-all shadow-lg shadow-brand-accent/20 mb-8"
          >
            <Plus className="w-4 h-4" /> New Flow
          </button>

          {/* Vertical Step Indicator - Only in Wizard Mode */}
          {showHero && (
            <div className="mb-8 space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Current Progress</p>
              {[
                { step: 1, label: 'Course Context', icon: BookOpen },
                { step: 2, label: 'Design Parameters', icon: LayoutDashboard },
                { step: 3, label: 'Flow Generation', icon: Sparkles }
              ].map((s) => (
                <div 
                  key={s.step}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all border",
                    currentStep === s.step 
                      ? "bg-brand-accent/5 border-brand-accent/10 text-brand-accent" 
                      : "border-transparent text-gray-400"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                    currentStep === s.step ? "bg-brand-accent text-white" : 
                    currentStep > s.step ? "bg-green-500 text-white" : "bg-gray-100"
                  )}>
                    {currentStep > s.step ? "✓" : s.step}
                  </div>
                  <span className={cn("text-xs font-bold", currentStep === s.step ? "text-gray-900" : "text-gray-400")}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Flows</p>
            <div className="flex items-center gap-2">
              {artifacts.length > 0 && (
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1 hover:text-red-500 text-gray-400 transition-colors"
                  title="Clear All"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <History className="w-3 h-3 text-gray-400" />
            </div>
          </div>
          <AnimatePresence>
            {artifacts.length === 0 ? (
              <div className="p-8 text-center space-y-2 opacity-40">
                <Clock className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-[10px] font-bold uppercase tracking-wider">No history yet</p>
              </div>
            ) : (
              artifacts.map((artifact) => (
                <motion.div
                  key={artifact.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setActiveArtifactId(artifact.id);
                    setShowHero(false);
                  }}
                  className={cn(
                    "group p-3 rounded-xl cursor-pointer transition-all border mb-1",
                    activeArtifactId === artifact.id 
                      ? "bg-white border-gray-200 shadow-sm" 
                      : "border-transparent hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded-lg",
                      activeArtifactId === artifact.id ? "bg-brand-accent text-white" : "bg-gray-100 text-gray-400"
                    )}>
                      {artifact.type === 'lesson-plan' && <BookOpen className="w-3 h-3" />}
                      {artifact.type === 'academic-year' && <Calendar className="w-3 h-3" />}
                      {artifact.type === 'roadmap' && <LayoutDashboard className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-bold truncate leading-tight",
                        activeArtifactId === artifact.id ? "text-gray-900" : "text-gray-600"
                      )}>{artifact.topic}</p>
                      <p className="text-[9px] text-gray-400 mt-1 font-medium">
                        {new Date(artifact.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => deleteArtifact(artifact.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-1">
          <button className="w-full flex items-center gap-3 p-3 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button className="w-full flex items-center gap-3 p-3 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all">
            <User className="w-4 h-4" /> Profile
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F9FAFB]">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-4">
            {!showHero && (
              <button 
                onClick={() => setShowHero(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <h2 className="text-sm font-black text-gray-900 tracking-tight">
                {showHero ? "Architect New Flow" : activeArtifact?.topic}
              </h2>
              {!showHero && (
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {activeArtifact?.type.replace('-', ' ')} • {activeArtifact?.courseCode}
                </p>
              )}
            </div>
          </div>

          {!showHero && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => activeArtifact && copyToClipboard(activeArtifact.content)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  isCopying 
                    ? "bg-green-50 border-green-200 text-green-600" 
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {isCopying ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {isCopying ? "Copied!" : "Copy"}
              </button>
              <button 
                onClick={() => activeArtifact && regenerateArtifact(activeArtifact)}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
                Regenerate
              </button>
              <button 
                onClick={() => activeArtifact && exportToPDF(activeArtifact)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl text-xs font-bold hover:bg-brand-accent/90 transition-all shadow-lg shadow-brand-accent/20"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          <AnimatePresence mode="wait">
            {showHero ? (
              <motion.div 
                key="hero"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="min-h-full flex items-center justify-center p-8"
              >
                <div className="w-full max-w-3xl">
                  <div className="mb-12 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                      <Sparkles className="w-3 h-3" /> Powered by PlanFlow AI
                    </div>
                    <h1 className="text-5xl font-black tracking-tight text-gray-900 leading-[1.1]">
                      Design your perfect <br />
                      <span className="text-brand-accent">learning journey.</span>
                    </h1>
                    <p className="text-gray-500 text-lg font-medium max-w-xl mx-auto">
                      Transform your curriculum into a structured, day-by-day architectural flow in seconds.
                    </p>
                  </div>

                  <div className="bg-white p-10 rounded-[40px] shadow-xl shadow-brand-accent/5 border border-gray-100 relative overflow-hidden">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                    
                    <AnimatePresence mode="wait">
                      {currentStep === 1 && (
                        <motion.div 
                          key="step1"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-8 relative z-10"
                        >
                          <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-brand-accent/10 rounded-2xl flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-brand-accent" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Course Context</h3>
                              <p className="text-sm font-medium text-gray-400">Establish the foundation of your curriculum.</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Program / Branch</label>
                              <select 
                                value={program}
                                onChange={(e) => setProgram(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all appearance-none cursor-pointer"
                              >
                                <option value="B.Tech CSE">B.Tech CSE</option>
                                <option value="BCA">BCA</option>
                                <option value="MCA">MCA</option>
                                <option value="M.Tech">M.Tech</option>
                                <option value="B.Tech ECE">B.Tech ECE</option>
                              </select>
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Course Code</label>
                              <input 
                                type="text"
                                value={courseCode}
                                onChange={(e) => setCourseCode(e.target.value)}
                                placeholder="e.g. CS101"
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all placeholder:text-gray-300"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Sessions / Week</label>
                              <input 
                                type="number"
                                value={sessionsPerWeek}
                                onChange={(e) => setSessionsPerWeek(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Session Days</label>
                              <div className="flex flex-wrap gap-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                  <button
                                    key={day}
                                    onClick={() => {
                                      const fullDay = day === 'Mon' ? 'Monday' : day === 'Tue' ? 'Tuesday' : day === 'Wed' ? 'Wednesday' : day === 'Thu' ? 'Thursday' : day === 'Fri' ? 'Friday' : 'Saturday';
                                      if (sessionDays.includes(fullDay)) {
                                        setSessionDays(sessionDays.filter(d => d !== fullDay));
                                      } else {
                                        setSessionDays([...sessionDays, fullDay]);
                                      }
                                    }}
                                    className={cn(
                                      "px-3 py-2 text-[10px] font-black rounded-xl transition-all border",
                                      sessionDays.some(d => d.startsWith(day))
                                        ? "bg-brand-accent border-brand-accent text-white shadow-lg shadow-brand-accent/20" 
                                        : "bg-white border-gray-200 text-gray-400 hover:border-brand-accent hover:text-brand-accent"
                                    )}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Start Date</label>
                              <input 
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">End Date</label>
                              <input 
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Syllabus Context (Optional)</label>
                            <div className="relative group">
                              <label className={cn(
                                "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-[32px] cursor-pointer transition-all",
                                syllabusContent ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200 group-hover:bg-gray-100 group-hover:border-brand-accent/30"
                              )}>
                                <div className="flex flex-col items-center justify-center p-6 text-center">
                                  {syllabusContent ? (
                                    <>
                                      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-3">
                                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                                      </div>
                                      <p className="text-sm font-black text-green-700 tracking-tight">Syllabus Analyzed</p>
                                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-1">Context is locked & loaded</p>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                                        <Plus className="w-7 h-7 text-brand-accent" />
                                      </div>
                                      <p className="text-sm font-black text-gray-900 tracking-tight">Upload Syllabus</p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] mt-1">PDF, DOCX, TXT (MAX 10MB)</p>
                                    </>
                                  )}
                                </div>
                                <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
                              </label>
                              {syllabusContent && (
                                <button 
                                  onClick={() => setSyllabusContent(null)}
                                  className="absolute top-6 right-6 p-2 bg-white rounded-xl shadow-md border border-gray-100 text-red-500 hover:bg-red-50 transition-all hover:scale-110"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={() => setCurrentStep(2)}
                            disabled={!courseCode || !sessionsPerWeek || sessionDays.length === 0 || !startDate || !endDate}
                            className="w-full py-5 bg-brand-accent text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-brand-accent/90 transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                          >
                            Continue Flow <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </motion.div>
                      )}

                      {currentStep === 2 && (
                        <motion.div 
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-8 relative z-10"
                        >
                          <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-brand-accent/10 rounded-2xl flex items-center justify-center">
                              <Zap className="w-6 h-6 text-brand-accent" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Design Parameters</h3>
                              <p className="text-sm font-medium text-gray-400">Define the scope and focus of your flow.</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Artifact Type</label>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { id: 'lesson-plan', icon: BookOpen, label: 'Lesson Plan' },
                                { id: 'daily-schedule', icon: Calendar, label: 'Weekly Schedule' },
                                { id: 'academic-year', icon: FileText, label: 'Year Plan' },
                                { id: 'roadmap', icon: Sparkles, label: 'Roadmap' }
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => setArtifactType(type.id as any)}
                                  className={cn(
                                    "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group",
                                    artifactType === type.id 
                                      ? "bg-brand-accent/5 border-brand-accent text-brand-accent" 
                                      : "bg-white border-gray-100 text-gray-400 hover:border-brand-accent/30 hover:text-gray-600"
                                  )}
                                >
                                  <type.icon className={cn(
                                    "w-6 h-6 transition-transform",
                                    artifactType === type.id ? "scale-110" : "group-hover:scale-110"
                                  )} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">{type.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Main Topic / Subject</label>
                            <div className="relative">
                              <input 
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. Advanced Quantum Mechanics"
                                className="w-full p-5 bg-gray-50 border border-gray-200 rounded-[24px] text-sm font-bold focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all placeholder:text-gray-300 pr-12"
                              />
                              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300">
                                <Search className="w-5 h-5" />
                              </div>
                            </div>
                          </div>

                          {syllabusContent && (
                            <div className="p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex items-start gap-4">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-indigo-100 shrink-0">
                                <FileText className="w-5 h-5 text-brand-accent" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-black text-indigo-900 tracking-tight">Syllabus Context Active</p>
                                <p className="text-[10px] text-indigo-600 font-bold leading-relaxed">
                                  PlanFlow will prioritize the structure and depth defined in your uploaded document.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-4">
                            <button 
                              onClick={() => setCurrentStep(1)}
                              className="px-8 py-5 bg-white border border-gray-200 text-gray-600 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                              <ArrowLeft className="w-5 h-5" /> Back
                            </button>
                            <button 
                              onClick={() => {
                                if (topic.trim()) {
                                  setCurrentStep(3);
                                  generateArtifact();
                                }
                              }}
                              disabled={!topic.trim() || isGenerating}
                              className="flex-1 py-5 bg-brand-accent text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-brand-accent/90 transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                              {isGenerating ? (
                                <>Architecting Flow <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /></>
                              ) : (
                                <>Architect Flow <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" /></>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {currentStep === 3 && (
                        <motion.div 
                          key="step3"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-10 text-center py-12 relative z-10"
                        >
                          {isGenerating ? (
                            <div className="space-y-8">
                              <div className="relative w-32 h-32 mx-auto">
                                <div className="absolute inset-0 border-4 border-brand-accent/10 rounded-[40px] rotate-45" />
                                <div className="absolute inset-0 border-4 border-brand-accent border-t-transparent rounded-[40px] rotate-45 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Sparkles className="w-10 h-10 text-brand-accent animate-pulse" />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Architecting Your Flow...</h3>
                                <p className="text-sm font-medium text-gray-500 max-w-xs mx-auto">
                                  Our AI is synthesizing your context into a professional, day-by-day learning journey.
                                </p>
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              <div className="w-24 h-24 bg-green-100 rounded-[40px] flex items-center justify-center mx-auto rotate-12 shadow-lg shadow-green-100">
                                <CheckCircle2 className="w-12 h-12 text-green-600 -rotate-12" />
                              </div>
                              <div className="space-y-3">
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Architecture Complete!</h3>
                                <p className="text-sm font-medium text-gray-500">Your comprehensive learning flow is ready for review.</p>
                              </div>
                              <div className="space-y-4">
                                <button 
                                  onClick={() => setShowHero(false)}
                                  className="w-full py-5 bg-brand-accent text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:bg-brand-accent/90 transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 group"
                                >
                                  Enter Workspace <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button 
                                  onClick={() => setCurrentStep(2)}
                                  className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                                >
                                  Edit Parameters & Regenerate
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ) : activeArtifact ? (
              <div className="max-w-5xl mx-auto p-8">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[48px] shadow-2xl shadow-brand-accent/5 border border-gray-100 overflow-hidden"
                >
                  <div className="p-12 border-b border-gray-100 bg-gray-50/30 relative overflow-hidden">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/5 rounded-full -mr-48 -mt-48 blur-3xl" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                        <button 
                          onClick={() => { setShowHero(true); setCurrentStep(1); }}
                          className="flex items-center gap-2 text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
                        >
                          <ArrowLeft className="w-4 h-4" /> Create New Flow
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="px-4 py-2 bg-brand-accent/10 text-brand-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                            {activeArtifact.type.replace('-', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h2 className="text-5xl font-black tracking-tight text-gray-900 leading-[1.1]">{activeArtifact.topic}</h2>
                        <div className="flex flex-wrap items-center gap-6 pt-2">
                          {activeArtifact.startDate && activeArtifact.endDate && (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100">
                                <Calendar className="w-4 h-4 text-brand-accent" />
                              </div>
                              <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                                {activeArtifact.startDate} — {activeArtifact.endDate}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100">
                              <GraduationCap className="w-4 h-4 text-brand-accent" />
                            </div>
                            <p className="text-xs font-black text-gray-900 uppercase tracking-wider">{activeArtifact.courseCode}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100">
                              <BookOpen className="w-4 h-4 text-brand-accent" />
                            </div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{activeArtifact.program}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100">
                              <Clock className="w-4 h-4 text-brand-accent" />
                            </div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
                              {activeArtifact.sessionsPerWeek} SESSIONS / WEEK
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-12">
                    <div className="markdown-body">
                      <Markdown>{activeArtifact.content}</Markdown>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>

      {/* Clear History Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-gray-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Clear All History?</h3>
              <p className="text-sm font-medium text-gray-500 mb-8">
                This will permanently delete all your generated learning flows. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setArtifacts([]);
                    setActiveArtifactId(null);
                    setShowHero(true);
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

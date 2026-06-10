import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import ReactECharts from 'echarts-for-react';

type StateSetter<T> = Dispatch<SetStateAction<T>>;
import { ArrowDownUp, Download, Eye, GitBranch, Image, LayoutDashboard, Network, Palette, Plus, Puzzle, Trash2, Undo2, UploadCloud, User } from 'lucide-react';
import { artifacts as initialArtifacts, elements as initialElements, kitStages, kits } from './data/mockData';

type Screen = 'home' | 'details' | 'overview' | 'artifacts' | 'brand';
type Tone = 'critical' | 'medium' | 'success' | 'info' | 'neutral';
function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) { return <span className={`badge ${tone}`}>{children}</span>; }
function Button({ children, className = '', variant = 'default', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' }) { return <button className={`button ${variant} ${className}`.trim()} {...props}>{children}</button>; }
function Panel({ children, className = '', ...props }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) { return <section className={`panel ${className}`.trim()} {...props}>{children}</section>; }
function Progress({ value }: { value: number }) { return <div className="progress"><span style={{ width: `${value}%` }} /></div>; }
function StackSegment({ className, value, label }: { className: string; value: number; label: string }) { if (value <= 0) return null; return <i className={className} style={{ flex: value }} title={`${label}: ${value}`} aria-label={`${label}: ${value}`}><span>{value}</span></i>; }
function LegendItem({ className, label, value }: { className: string; label: string; value: number }) { return <span className={`legend-item ${className}`}><i aria-hidden="true"/>{label} {value}</span>; }
function FlowMetric({ className, label, value }: { className: string; label: string; value: number }) { return <span className={`flow-metric ${className}`}><small>{label}</small><b>{value}</b></span>; }
const statusTone = (s: string): Tone => s === 'green' ? 'success' : s === 'yellow' ? 'medium' : 'neutral';
const stepTone = (s: string): Tone => s === 'done' ? 'success' : s === 'blocked' ? 'critical' : s === 'in-progress' ? 'info' : 'neutral';
const stepLabel = (s: string) => s === 'done' ? 'сделано' : s === 'in-progress' ? 'в работе' : s === 'blocked' ? 'блокер' : 'ожидает';
const deltaText = (n: number) => n === 0 ? '0' : `${n > 0 ? '+' : ''}${n}`;
const PersonTags = ({ people }: { people: string[] }) => <span className="person-tags">{people.map(p => <span key={p} className="person-tag">{p}</span>)}</span>;
const KitTag = ({ kitId, muted = false, kitsList = kits }: { kitId: string; muted?: boolean; kitsList?: any[] }) => { if (!kitsList.some(item => item?.id === kitId)) return null; const k = getKitById(kitId, kitsList); return <span className="marker" style={{ color: k.color.text, background: k.color.bg, borderColor: k.color.border, opacity: muted ? 0.34 : 1 }}>{k.name}</span>; };
const ToolTag = ({ children }: { children: React.ReactNode }) => <span className="tool-tag">{children}</span>;
const RoleTag = ({ tone, children }: { tone: 'designer' | 'co' | 'other'; children: React.ReactNode }) => { const raw = String(children || 'Не назначен'); const empty = !raw || raw === 'нет' || raw.toLowerCase() === 'не назначен' || raw.toLowerCase() === 'исполнитель не назначен'; if (empty) return <span className="assignee-missing">Исполнитель не назначен</span>; const icon = tone === 'other' ? <User size={13}/> : <Palette size={13}/>; return <span className={`role-tag ${tone}`}>{icon}<span>{raw}</span></span>; };
const defaultKitColor = { text: '#dbeafe', bg: '#0f172a', border: '#60a5fa' };
const normalizeKit = (kit: any) => ({ ...kit, kind: kit?.kind ?? 'Кит', location: kit?.location ?? 'Нет кита', owner: kit?.owner ?? '', team: Array.isArray(kit?.team) ? kit.team : [], color: { ...defaultKitColor, ...(kit?.color ?? {}) } });
const visibleKits = (baseKits: any[], extraKits: any[], kitEdits: Record<string, any>) => [...baseKits, ...extraKits].filter(k => k && typeof k === 'object' && k.id).map(normalizeKit).map(k => normalizeKit({ ...k, ...(kitEdits[k.id] ?? {}) })).map(k => ({ ...k, owner: seededPeople.includes(k.owner) ? '' : k.owner, team: (k.team ?? []).filter((p: string) => !seededPeople.includes(p)) })).filter(k => !k.deleted);
const getKitById = (kitId: string, kitsList: any[] = kits) => { const found = kitsList.find(item => item.id === kitId); return normalizeKit({ ...(found ?? {}), id: kitId, name: found?.name ?? kitId }); };
const defaultRoleFor = (name: string, kitsList: any[] = kits): 'designer' | 'co' | 'other' => kitsList.some(k => k.owner === name) ? 'designer' : kitsList.some(k => (k.team ?? []).includes(name)) ? 'co' : 'other';
const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => localIso(new Date());
const overdue = (due?: string, status?: string) => Boolean(due && status !== 'done' && due < todayIso());
const deadlineTone = (due?: string, status?: string) => { if (status === 'done') return 'ok'; if (!due) return 'ok'; const today = new Date(`${todayIso()}T00:00:00`); const target = new Date(`${due}T00:00:00`); const days = Math.round((target.getTime() - today.getTime()) / 86400000); return days <= 0 ? 'danger' : days <= 3 ? 'warn' : 'ok'; };
const nodeTitle = (stages: any[], ref: any) => ref?.type === 'stage' ? stages.find(s => s.id === ref.id)?.title : stages.flatMap(s => s.steps).find((s: any) => s.id === ref?.id)?.title;
const blockersForKit = (stages: any[], kitId: string) => stages.filter(s => s.kitId === kitId).flatMap(stage => [...(stage.blockedBy ?? []).map((ref: any) => ({ type: 'stage', id: stage.id, target: stage.title, blocker: nodeTitle(stages, ref) ?? ref.id, reason: ref.reason })), ...stage.steps.flatMap((step: any) => (step.blockedBy ?? []).map((ref: any) => ({ type: 'step', id: step.id, stageId: stage.id, target: step.title, blocker: nodeTitle(stages, ref) ?? ref.id, reason: ref.reason })))]);
const latestDeadline = (values: any[]) => { const sorted = values.filter(Boolean).sort(); return sorted[sorted.length - 1]; };
const latestStepDeadline = (steps: any[]) => latestDeadline((steps ?? []).map(s => s.dueDate));
const stageDeadline = (stage: any) => stage.dueDateOverride ?? latestStepDeadline(stage.steps) ?? stage.dueDate;
const kitStageDeadline = (stages: any[], kitId: string) => latestDeadline(stages.filter(s => s.kitId === kitId).map(stageDeadline));
const kitDeadline = (stages: any[], kitId: string, fallback?: string) => fallback ?? kitStageDeadline(stages, kitId);
const stageStatusId = (stage: any) => stage.steps?.length && stage.steps.every((s: any) => s.status === 'done') ? 'done' : stage.steps?.some((s: any) => s.status === 'blocked') ? 'blocked' : stage.steps?.some((s: any) => s.status === 'in-progress') ? 'in-progress' : 'todo';
const overdueForKit = (stages: any[], kitId: string) => stages.filter(s => s.kitId === kitId).flatMap(stage => [overdue(stageDeadline(stage), stageStatusId(stage)) ? { type: 'stage', id: stage.id, title: stage.title } : null, ...stage.steps.map((step: any) => overdue(step.dueDate, step.status) ? { type: 'step', id: step.id, stageId: stage.id, title: step.title } : null)]).filter(Boolean);
const blocksAny = (stages: any[], type: 'stage' | 'step', id: string) => stages.some(stage => (stage.blockedBy ?? []).some((r: any) => r.type === type && r.id === id) || stage.steps.some((step: any) => (step.blockedBy ?? []).some((r: any) => r.type === type && r.id === id)));
const refsBlockedByNode = (stages: any[], type: 'stage' | 'step', id: string) => stages.flatMap(stage => [(stage.blockedBy ?? []).some((r: any) => r.type === type && r.id === id) ? { type: 'stage', id: stage.id, title: stage.title } : null, ...stage.steps.map((step: any) => (step.blockedBy ?? []).some((r: any) => r.type === type && r.id === id) ? { type: 'step', id: step.id, stageId: stage.id, title: step.title } : null)]).filter(Boolean);
type DetailSortMode = 'created' | 'deadline';
const sortModeLabel = (mode: DetailSortMode) => mode === 'deadline' ? 'Дедлайн' : 'Создано';
const toggleSortMode = (mode: DetailSortMode): DetailSortMode => mode === 'deadline' ? 'created' : 'deadline';
const idTimestamp = (id: any) => { const match = String(id ?? '').match(/(\d+)$/); return match ? Number(match[1]) : 0; };
const dateSortValue = (value?: string) => { if (!value) return 0; const parsed = Date.parse(value.includes('T') ? value : `${value}T00:00:00`); return Number.isNaN(parsed) ? 0 : parsed; };
const compareCreatedDesc = (a: any, b: any) => { const createdDelta = dateSortValue(b.createdAt) - dateSortValue(a.createdAt); if (createdDelta) return createdDelta; const idDelta = idTimestamp(b.id) - idTimestamp(a.id); if (idDelta) return idDelta; return Number(a.order ?? 0) - Number(b.order ?? 0); };
const compareDeadlineAsc = (getDeadline: (item: any) => string | undefined) => (a: any, b: any) => { const da = dateSortValue(getDeadline(a)); const db = dateSortValue(getDeadline(b)); if (!da && !db) return compareCreatedDesc(a, b); if (!da) return 1; if (!db) return -1; return da - db || compareCreatedDesc(a, b); };
const sortDetailItems = (items: any[], mode: DetailSortMode, getDeadline: (item: any) => string | undefined) => [...items].sort(mode === 'deadline' ? compareDeadlineAsc(getDeadline) : compareCreatedDesc);
const problemCardsForKit = (stages: any[], kitId: string) => stages.filter(s => s.kitId === kitId).flatMap(stage => [overdue(stageDeadline(stage), stageStatusId(stage)) || (stage.blockedBy ?? []).length || blocksAny(stages, 'stage', stage.id) ? { ...stage, type: 'stage', dueDate: stageDeadline(stage), status: stageStatusId(stage) } : null, ...stage.steps.map((step: any) => overdue(step.dueDate, step.status) || (step.blockedBy ?? []).length || blocksAny(stages, 'step', step.id) ? { ...step, type: 'step', stageId: stage.id } : null)]).filter(Boolean);
const kitStatusId = (stages: any[], kitId: string) => { const steps = stages.filter(s => s.kitId === kitId).flatMap(s => s.steps); return steps.length && steps.every((s: any) => s.status === 'done') ? 'done' : steps.some((s: any) => s.status === 'blocked') ? 'blocked' : steps.some((s: any) => s.status === 'in-progress') ? 'in-progress' : 'todo'; };
const uniquePeople = (people: string[]) => Array.from(new Set(people.map(p => p.trim()).filter(Boolean)));
const stageParticipants = (stage: any) => uniquePeople([...(stage.participants ?? []), ...stage.steps.flatMap((step: any) => [step.owner, ...(step.participants ?? [])])]);
const kitPeopleFromStages = (stages: any[], kitId: string) => uniquePeople(stages.filter(s => s.kitId === kitId).flatMap(stage => stageParticipants(stage)));
const homeKitRoles = (stages: any[], kit: any) => {
  const co = new Set<string>((kit.team ?? []).filter(Boolean));
  const other = new Set<string>();
  stages.filter(s => s.kitId === kit.id).forEach(stage => {
    (stage.participants ?? []).forEach((p: string) => (stage.participantRoles?.[p] === 'other' ? other : co).add(p));
    stage.steps.forEach((step: any) => {
      if (step.owner) co.add(step.owner);
      (step.participants ?? []).forEach((p: string) => (step.participantRoles?.[p] === 'other' ? other : co).add(p));
    });
  });
  if (kit.owner) { co.delete(kit.owner); other.delete(kit.owner); }
  co.forEach(p => other.delete(p));
  return { designer: kit.owner || '', co: Array.from(co), other: Array.from(other) };
};
const stepDate = (step: any) => step.createdAt ?? step.dueDate ?? todayIso();
const inPeriod = (date: string, period?: { from: string; to: string }) => !period || (date >= period.from && date <= period.to);
const kitStepStats = (stages: any[], kitId: string, period?: { from: string; to: string }) => { const steps = stages.filter(s => s.kitId === kitId).flatMap(s => s.steps ?? []); const done = steps.filter((s: any) => s.status === 'done').length; const addedPeriod = steps.filter((s: any) => inPeriod(stepDate(s), period)).length; const donePeriod = steps.filter((s: any) => s.status === 'done' && inPeriod(s.completedAt ?? todayIso(), period)).length; return { total: steps.length, done, readiness: steps.length ? Math.round(done / steps.length * 100) : 0, addedPeriod, donePeriod }; };
const normalizeElements = (items: any[]) => items.map(e => ({ status: 'active', replaces: [], ...e }));
const removeElementsById = (items: any[], ids: string[]) => { const removedIds = new Set(ids.map(String)); const kept = normalizeElements(items).filter((element: any) => !removedIds.has(String(element.id))); const keptIds = new Set(kept.map((element: any) => String(element.id))); return kept.map((element: any) => { const replacementDeleted = element.replacedBy && removedIds.has(String(element.replacedBy)); return { ...element, status: replacementDeleted && element.status === 'merged' ? 'active' : element.status, replaces: (element.replaces ?? []).filter((id: string) => keptIds.has(String(id))), replacedBy: keptIds.has(String(element.replacedBy)) ? element.replacedBy : undefined }; }); };
const mergeStats = (elements: any[]) => { const normalized = normalizeElements(elements); const active = normalized.filter((e: any) => e.status !== 'merged' && e.status !== 'deprecated'); const unique = active.filter((e: any) => e.status === 'unique').length; const locked = active.filter((e: any) => e.status === 'locked').length; const eligible = active.filter((e: any) => e.status !== 'unique' && e.status !== 'locked'); const common = eligible.filter((e: any) => (e.kits ?? []).length > 1).length; const single = eligible.filter((e: any) => (e.kits ?? []).length <= 1).length; const merged = normalized.filter((e: any) => e.status === 'merged').length; return { total: active.length, eligibleTotal: eligible.length, historicalTotal: active.length + merged, common, merged, single, unique, locked, percent: eligible.length ? Math.round(common / eligible.length * 100) : 0 }; };
const detailElementId = (type: 'stage' | 'step', id: string) => `detail-${type}-${id}`;
const detailElementRef = (element: any) => { const legacy = String(element?.id ?? '').match(/^detail-(stage|step)-(.+)$/); if (legacy) return { type: legacy[1] as 'stage' | 'step', id: legacy[2] }; if (element?.sourceStepId) return { type: 'step' as const, id: String(element.sourceStepId) }; if (element?.sourceStageId) return { type: 'stage' as const, id: String(element.sourceStageId) }; return null; };
const sanitizeElements = (items: any[], stages: any[], artifacts: any[], kitsList: any[]) => {
  const stageIds = new Set<string>(stages.map((stage: any) => String(stage.id)));
  const stepIds = new Set<string>(stages.flatMap((stage: any) => (stage.steps ?? []).map((step: any) => String(step.id))));
  const attachedArtifactIds = new Set<string>(stages.flatMap((stage: any) => (stage.steps ?? []).flatMap((step: any) => step.artifactIds ?? [])).map(String));
  const artifactIds = new Set<string>(artifacts.map((artifact: any) => String(artifact.id)));
  const kitIds = new Set<string>(kitsList.map((kit: any) => String(kit.id)));
  const valid = (element: any) => {
    const sourceArtifactId = element?.sourceArtifactId ?? element?.artifactId;
    if (sourceArtifactId) return artifactIds.has(String(sourceArtifactId)) && attachedArtifactIds.has(String(sourceArtifactId)) && (!element.sourceStepId || stepIds.has(String(element.sourceStepId))) && (!element.sourceStageId || stageIds.has(String(element.sourceStageId)));
    const ref = detailElementRef(element);
    if (!ref) return false;
    return ref.type === 'stage' ? stageIds.has(String(ref.id)) : stepIds.has(String(ref.id));
  };
  const filtered = normalizeElements(items).filter(valid).map((element: any) => ({ ...element, kits: (element.kits ?? []).filter((id: string) => kitIds.has(String(id))) }));
  const keptIds = new Set(filtered.map((element: any) => element.id));
  return filtered.map((element: any) => ({ ...element, replaces: (element.replaces ?? []).filter((id: string) => keptIds.has(id)), replacedBy: keptIds.has(element.replacedBy) ? element.replacedBy : undefined }));
};
const ELEMENT_PURGE_KEY = 'berega.elements.purged.v1';
const loadElementsAfterPurge = () => { try { if (localStorage.getItem(ELEMENT_PURGE_KEY) !== 'true') { localStorage.setItem('berega.elements', '[]'); localStorage.setItem(ELEMENT_PURGE_KEY, 'true'); return []; } } catch (e) { console.warn('elements purge failed', e); } return loadStoredArray('berega.elements', initialElements); };
const kitColor = (id: string, kitsList: any[] = kits) => kitsList.find(k => k.id === id)?.color?.border ?? '#64748b';
const pieSymbol = (colors: string[]) => {
  if (colors.length <= 1) return 'circle';
  const n = colors.length; let acc = 0;
  const slices = colors.map((c, i) => { const a0 = acc / n * Math.PI * 2; acc += 1; const a1 = acc / n * Math.PI * 2; const x0 = 50 + 48 * Math.cos(a0), y0 = 50 + 48 * Math.sin(a0), x1 = 50 + 48 * Math.cos(a1), y1 = 50 + 48 * Math.sin(a1); return `<path d="M50 50 L${x0} ${y0} A48 48 0 ${1 / n > .5 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${c}"/>`; }).join('');
  return `image://data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#0f172a"/>${slices}<circle cx="50" cy="50" r="49" fill="none" stroke="#e5e7eb" stroke-width="3"/></svg>`)}`;
};
const shortDate = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'дедлайн';
type KeyboardLike = { key: string; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; isComposing?: boolean; nativeEvent?: { isComposing?: boolean }; preventDefault: () => void; stopPropagation: () => void; target?: EventTarget | null };
const isEscapeKey = (e: { key: string }) => e.key === 'Escape';
const isApplyKey = (e: { key: string; shiftKey?: boolean; altKey?: boolean; isComposing?: boolean; nativeEvent?: { isComposing?: boolean } }) => (e.key === 'Enter' || e.key === 'Return') && !e.shiftKey && !e.altKey && !e.isComposing && !e.nativeEvent?.isComposing;
const stopKeyboardEvent = (e: KeyboardLike) => { e.preventDefault(); e.stopPropagation(); };
const shouldIgnoreGlobalApply = (e: KeyboardEvent) => { const target = e.target as HTMLElement | null; if (!target) return false; if (target.isContentEditable || target.closest('[contenteditable="true"]')) return true; if (target.closest('button,a,[role="button"]')) return true; if (target instanceof HTMLTextAreaElement) return !(e.metaKey || e.ctrlKey); if (target instanceof HTMLSelectElement) return true; if (target instanceof HTMLInputElement) return ['file','checkbox','radio','range','color','date','datetime-local','month','time','week'].includes(target.type); return false; };
const shouldIgnoreGlobalDelete = (e: KeyboardEvent) => { const target = e.target as HTMLElement | null; if (!target) return false; if (target.isContentEditable || target.closest('[contenteditable="true"]')) return true; if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true; if (target.closest('button,a,[role="button"]')) return true; return false; };
const loadStored = (key: string, fallback: any) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const loadStoredArray = (key: string, fallback: any[]) => { const value = loadStored(key, fallback); return Array.isArray(value) ? value : fallback; };
const loadStoredObject = (key: string, fallback: Record<string, any>) => { const value = loadStored(key, fallback); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; };
const saveStored = (key: string, value: any) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('localStorage save failed', key, e); } };
const isDataUrl = (value: any) => typeof value === 'string' && value.startsWith('data:');
const isImageDataUrl = (value: any) => typeof value === 'string' && value.startsWith('data:image');
const ARTIFACT_FILE_API = '/api/artifacts/files';
const artifactFileKey = (id: string) => `artifact-file-${id}`;
const artifactFileUrl = (fileName: string) => `${ARTIFACT_FILE_API}/${encodeURIComponent(fileName)}`;
const fileNameFromArtifactUrl = (value: any) => { const text = String(value ?? ''); if (!text.startsWith(`${ARTIFACT_FILE_API}/`)) return ''; try { return decodeURIComponent(text.slice(ARTIFACT_FILE_API.length + 1)); } catch { return ''; } };
const artifactStoredFileName = (artifact: any) => String(artifact?.storedFileName || artifact?.fileStoredName || fileNameFromArtifactUrl(artifact?.fileUrl) || fileNameFromArtifactUrl(artifact?.fileData) || '').trim();
const artifactFileSrc = (artifact: any) => { const storedName = artifactStoredFileName(artifact); return String(artifact?.fileUrl || artifact?.fileData || (storedName ? artifactFileUrl(storedName) : '') || ''); };
const isImageFileName = (value: any) => /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(String(value ?? '').split('?')[0]);
const isPreviewableFrameFileName = (value: any) => /\.(csv|json|log|md|pdf|txt)$/i.test(String(value ?? '').split('?')[0]);
const artifactMimeType = (artifact: any) => String(artifact?.fileMimeType || artifact?.mimeType || '').toLowerCase();
const isImageArtifact = (artifact: any) => { const mime = artifactMimeType(artifact); if (mime.startsWith('image/')) return true; return isImageFileName(artifact?.fileName) || isImageFileName(artifactStoredFileName(artifact)); };
const isPreviewableFrameArtifact = (artifact: any) => { const mime = artifactMimeType(artifact); if (mime === 'application/pdf' || mime === 'application/json' || mime.startsWith('text/')) return true; return isPreviewableFrameFileName(artifact?.fileName) || isPreviewableFrameFileName(artifactStoredFileName(artifact)); };
const artifactImageSrc = (artifact: any) => { const data = String(artifact?.fileData ?? ''); if (isImageDataUrl(data)) return data; const preview = String(artifact?.preview ?? ''); if (isImageDataUrl(preview)) return preview; const fileSrc = artifactFileSrc(artifact); return fileSrc && isImageArtifact(artifact) ? fileSrc : ''; };
const artifactFrameSrc = (artifact: any) => { const fileSrc = artifactFileSrc(artifact); if (!fileSrc || isDataUrl(fileSrc) || isImageArtifact(artifact) || !isPreviewableFrameArtifact(artifact)) return ''; return fileSrc; };
const downloadArtifact = (artifact: any) => { const src = artifactFileSrc(artifact) || artifactImageSrc(artifact); const fallbackName = `${String(artifact?.title || 'artifact').trim() || 'artifact'}.txt`; const fileName = artifact?.fileName || artifactStoredFileName(artifact) || fallbackName; const link = document.createElement('a'); if (src) { link.href = src; link.download = fileName; link.target = '_blank'; document.body.appendChild(link); link.click(); link.remove(); return; } const blob = new Blob([String(artifact?.description || artifact?.preview || artifact?.title || '')], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); link.href = url; link.download = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0); };
const ArtifactLargePreview = ({ artifact }: { artifact: any }) => { const frameSrc = artifactFrameSrc(artifact); if (frameSrc) return <iframe className="artifact-doc-frame" src={frameSrc} sandbox="" title={artifact?.title || 'Артефакт'}/>; return <ArtifactPreview artifact={artifact}/>; };
const stripArtifactFilePayloads = (items: any[]) => items.map(item => { if (!item || typeof item !== 'object') return item; const next = { ...item }; const hasLegacyPayload = isDataUrl(next.fileData) || isDataUrl(next.preview); if (next.id && (next.fileKey || hasLegacyPayload)) next.fileKey = next.fileKey || artifactFileKey(next.id); if (isDataUrl(next.fileData)) next.fileData = next.fileUrl || (artifactStoredFileName(next) ? artifactFileUrl(artifactStoredFileName(next)) : ''); if (isDataUrl(next.preview)) next.preview = next.fileUrl || (artifactStoredFileName(next) ? artifactFileUrl(artifactStoredFileName(next)) : '') || next.description || next.fileName || next.title || ''; return next; });
const stripElementFilePayloads = (items: any[]) => items.map(item => { if (!item || typeof item !== 'object') return item; const next = { ...item }; if (isDataUrl(next.preview)) next.preview = next.description || next.name || ''; return next; });
const ARTIFACT_FILE_DB = 'berega-artifact-files';
const ARTIFACT_FILE_STORE = 'files';
const openArtifactFileDb = () => new Promise<IDBDatabase>((resolve, reject) => { if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; } const request = indexedDB.open(ARTIFACT_FILE_DB, 1); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(ARTIFACT_FILE_STORE)) db.createObjectStore(ARTIFACT_FILE_STORE); }; request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result); });
const runArtifactFileRequest = async <T,>(mode: IDBTransactionMode, createRequest: (store: IDBObjectStore) => IDBRequest<T>) => { const db = await openArtifactFileDb(); return new Promise<T>((resolve, reject) => { const tx = db.transaction(ARTIFACT_FILE_STORE, mode); const request = createRequest(tx.objectStore(ARTIFACT_FILE_STORE)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); tx.oncomplete = () => db.close(); tx.onerror = () => { db.close(); reject(tx.error); }; tx.onabort = () => { db.close(); reject(tx.error); }; }); };
const saveLegacyArtifactFileData = async (key: string, data: string) => { if (!key || !isDataUrl(data)) return; try { await runArtifactFileRequest('readwrite', store => store.put(data, key)); } catch (e) { console.warn('legacy artifact file save failed', key, e); } };
const loadLegacyArtifactFileData = async (key: string) => { if (!key) return ''; try { const value = await runArtifactFileRequest<any>('readonly', store => store.get(key)); return typeof value === 'string' ? value : ''; } catch (e) { console.warn('legacy artifact file load failed', key, e); return ''; } };
const deleteLegacyArtifactFileData = async (key: string) => { if (!key) return; try { await runArtifactFileRequest('readwrite', store => store.delete(key)); } catch (e) { console.warn('legacy artifact file delete failed', key, e); } };
const saveArtifactFileData = async (artifactId: string, fileName: string, data: string) => { if (!artifactId || !isDataUrl(data)) return null; const response = await fetch(ARTIFACT_FILE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artifactId, fileName, dataUrl: data }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error || 'Не удалось сохранить файл артефакта'); return payload as { fileName: string; url: string; originalName?: string; mimeType?: string; size?: number }; };
const deleteArtifactFileData = async (artifactOrKey: any) => { const storedName = typeof artifactOrKey === 'object' ? artifactStoredFileName(artifactOrKey) : ''; if (storedName) { try { const response = await fetch(artifactFileUrl(storedName), { method: 'DELETE' }); if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`); } catch (e) { console.warn('artifact disk file delete failed', storedName, e); } } const legacyKey = typeof artifactOrKey === 'string' ? artifactOrKey : artifactOrKey?.fileKey; if (legacyKey) await deleteLegacyArtifactFileData(legacyKey); };
const restoreArtifactFileData = async (artifact: any) => { const storedName = artifactStoredFileName(artifact); if (!storedName) return; try { const response = await fetch(artifactFileUrl(storedName), { method: 'POST' }); if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`); } catch (e) { console.warn('artifact disk file restore failed', storedName, e); } };
const persistArtifactFilesForStorage = async (items: any[]) => { await Promise.all(items.map(async item => { if (!item || typeof item !== 'object' || !item.id || artifactStoredFileName(item) || item.fileUrl) return; const payload = isDataUrl(item.fileData) ? item.fileData : (isDataUrl(item.preview) ? item.preview : ''); if (payload) await saveLegacyArtifactFileData(item.fileKey || artifactFileKey(item.id), payload); })); return stripArtifactFilePayloads(items); };
const hydrateArtifactFilePayloads = async (items: any[]) => Promise.all(items.map(async item => { if (!item || typeof item !== 'object') return item; const storedName = artifactStoredFileName(item); if (!item.fileData && (storedName || item.fileUrl)) { const fileUrl = item.fileUrl || artifactFileUrl(storedName); const withFileUrl = { ...item, fileUrl, fileData: fileUrl }; return { ...withFileUrl, preview: isImageArtifact(withFileUrl) ? fileUrl : (item.preview || item.fileName || item.title || '') }; } if (item.fileData || !item.fileKey) return item; const data = await loadLegacyArtifactFileData(item.fileKey); if (!data) return item; try { const saved = await saveArtifactFileData(item.id, item.fileName || item.title || 'file', data); await deleteLegacyArtifactFileData(item.fileKey); const migrated = { ...item, storedFileName: saved?.fileName || '', fileUrl: saved?.url || '', fileData: saved?.url || '', fileMimeType: saved?.mimeType || '', fileSize: saved?.size || 0 }; return { ...migrated, preview: isImageArtifact(migrated) ? migrated.fileUrl : (item.preview || item.fileName || item.title || '') }; } catch (e) { console.warn('artifact disk migration failed', item.fileKey, e); return { ...item, fileData: data, preview: isImageDataUrl(data) ? data : (item.preview || item.fileName || item.title || '') }; } }));
const deltaClass = (n: number) => n === 0 ? 'zero-delta' : n > 0 ? 'bad-delta' : 'good-delta';
const metricDeltaClass = (n: number) => n === 0 ? 'zero-delta' : n > 0 ? 'good-delta' : 'bad-delta';

type KitStats = { total: number; done: number; readiness: number; addedPeriod: number; donePeriod: number };
function KitMiniProgressViz({ stats }: { stats: KitStats }) {
  const total = Math.max(0, stats.total ?? 0);
  const done = Math.max(0, Math.min(stats.done ?? 0, total));
  const todo = Math.max(0, total - done);
  const readiness = Math.max(0, Math.min(100, stats.readiness ?? 0));
  const doneWidth = total ? (done / total) * 100 : 0;
  const markerLeft = Math.max(0, Math.min(100, doneWidth));
  const addedPeriod = Math.max(0, stats.addedPeriod ?? 0);
  const donePeriod = Math.max(0, stats.donePeriod ?? 0);
  const periodNet = donePeriod - addedPeriod;
  const balanceText = periodNet > 0 ? `Остаток −${periodNet}` : periodNet < 0 ? `Остаток +${Math.abs(periodNet)}` : 'Остаток 0';
  const balanceAria = periodNet > 0 ? `остаток задач уменьшился на ${periodNet}` : periodNet < 0 ? `остаток задач увеличился на ${Math.abs(periodNet)}` : 'остаток задач не изменился';

  return <div className="mini-progress-viz kpv" role="group" aria-label={`Готовность ${readiness}%. Сделано ${done} из ${total}. Осталось ${todo}. За период закрыто ${donePeriod}, добавлено ${addedPeriod}; ${balanceAria}.`}>
    <div className="kpv-summary">
      <div className="kpv-main-count"><span>Готово</span><b>{done} из {total}</b></div>
      <strong className="kpv-percent">{readiness}%</strong>
    </div>
    <div className="kpv-ruler" role="img" aria-label={`Линейка прогресса: сделано ${done} из ${total}, осталось ${todo}`}>
      <div className="kpv-ruler-scale" aria-hidden="true"><span>0</span><span>{total}</span></div>
      <div className="kpv-track" aria-hidden="true">
        <span className="kpv-fill" style={{ width: `${doneWidth}%` }} />
        <i className="kpv-marker" style={{ left: `${markerLeft}%` }} />
      </div>
      <div className="kpv-ruler-caption"><span>{done} сделано</span><span>{todo} осталось</span></div>
    </div>
    <div className="kpv-period" aria-label={`За период закрыто ${donePeriod}, добавлено ${addedPeriod}. ${balanceAria}.`}>
      <span className="kpv-period-title">За период</span>
      <span>Закрыто <b>{deltaText(donePeriod)}</b></span>
      <span>Добавлено <b>{deltaText(addedPeriod)}</b></span>
      <span className={`kpv-balance ${metricDeltaClass(periodNet)}`}>{balanceText}</span>
    </div>
  </div>;
}

const seededPeople = ['Анна Орлова','Анна','Илья','Даша','Марк Серов','Марк','Кира Нова','Кира','Павел','Олег Ручьёв','Олег'];
const seededArtifactIds = ['a1','a2','a3','a4','a5','a6'];
const stripSeededPeople = (data: any[]) => (Array.isArray(data) ? data : kitStages).map(stage => ({ ...stage, blockedBy: [], participants: (stage.participants ?? []).filter((p: string) => !seededPeople.includes(p)), steps: (Array.isArray(stage.steps) ? stage.steps : []).map((step: any) => ({ ...step, owner: seededPeople.includes(step.owner) ? '' : step.owner, participants: (step.participants ?? []).filter((p: string) => !seededPeople.includes(p)), blockedBy: [], artifactIds: (step.artifactIds ?? []).filter((id: string) => !seededArtifactIds.includes(id)) })) }));

function DeadlineButton({ value, status, onChange }: { value?: string; status?: string; onChange: (value: string) => void }) {
  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [cursor, setCursor] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [draftValue, setDraftValue] = useState(value || localIso(initialDate));
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const pad = (start.getDay() + 6) % 7;
  const iso = (d: Date) => localIso(d);
  const days = Array.from({ length: 42 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - pad + 1));
  const closeDraft = () => setOpen(false);
  const commitDraft = () => { if (!draftValue) return; onChange(draftValue); setOpen(false); };
  useEffect(() => { if (!open) return; const close = (e: MouseEvent) => { if (!hostRef.current?.contains(e.target as Node)) closeDraft(); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, [open]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.defaultPrevented) return; if (isEscapeKey(e)) { stopKeyboardEvent(e); closeDraft(); return; } if (isApplyKey(e) && !shouldIgnoreGlobalApply(e)) { stopKeyboardEvent(e); commitDraft(); } }; window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true); }, [open, draftValue]);
  const openCalendar = () => { const baseDate = value ? new Date(`${value}T00:00:00`) : new Date(); setDraftValue(value || localIso(baseDate)); setCursor(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)); const r = hostRef.current?.getBoundingClientRect(); if (r) setPos({ top: Math.min(r.bottom + 8, window.innerHeight - 330), left: Math.min(r.left, window.innerWidth - 300) }); setOpen(true); };
  return <div ref={hostRef} className="deadline-host" onClick={e => e.stopPropagation()}><button className={`deadline-button ${value ? deadlineTone(value, status) : 'empty'}`} onClick={openCalendar}>{shortDate(value)}</button>{open && <div className="deadline-popover real-calendar" style={{ top: pos.top, left: pos.left }}><div className="calendar-nav"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button><b>{cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</b><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button></div><div className="calendar-week">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map(d => { const v = iso(d); return <button key={v} className={`${d.getMonth() === cursor.getMonth() ? '' : 'muted'} ${v === todayIso() ? 'today' : ''} ${v === draftValue ? 'picked' : ''}`} onClick={() => setDraftValue(v)}>{d.getDate()}</button>; })}</div><div className="row-actions"><Button variant="primary" onClick={commitDraft}>Применить</Button><Button onClick={closeDraft}>Отмена</Button></div></div>}</div>;
}

function TopNav({ screen, setScreen, artifactFilter, toggleArtifactKit, displayKits }: { screen: Screen; setScreen: (s: Screen) => void; artifactFilter: string[]; toggleArtifactKit: (id: string) => void; displayKits: any[] }) {
  const item = (id: Screen, icon: React.ReactNode, title: string) => <button className={`nav-card ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}><span className="nav-icon">{icon}</span><b>{title}</b></button>;
  return <nav className="top-nav">
    {item('home', <LayoutDashboard size={18}/>, 'Главная')}
    {item('details', <GitBranch size={18}/>, 'Детали')}
    {item('overview', <Network size={18}/>, 'Обзор')}
    {item('artifacts', <Image size={18}/>, 'Артефакты')}
    {screen === 'artifacts' && displayKits.map(k => <button key={k.id} className={`nav-card kit-filter ${artifactFilter.includes(k.id) ? 'active' : ''}`} onClick={() => toggleArtifactKit(k.id)}><b>{k.name}</b></button>)}
  </nav>;
}
function DateRangePicker({ onChange }: { onChange?: (range: { from: string; to: string }) => void }) {
  const today = new Date();
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const iso = (d: Date) => localIso(d);
  const initialRange = { from: iso(weekAgo), to: iso(today) };
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(initialRange);
  const [draftRange, setDraftRange] = useState(initialRange);
  useEffect(() => { onChange?.(range); }, [range]);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const pad = (start.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - pad + 1));
  const closeDraft = () => { setDraftRange(range); setOpen(false); };
  const commitDraft = () => { const from = draftRange.from; const to = draftRange.to || draftRange.from; const next = from <= to ? { from, to } : { from: to, to: from }; setRange(next); setDraftRange(next); setOpen(false); };
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.defaultPrevented) return; if (isEscapeKey(e)) { stopKeyboardEvent(e); closeDraft(); return; } if (isApplyKey(e) && !shouldIgnoreGlobalApply(e)) { stopKeyboardEvent(e); commitDraft(); } }; window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true); }, [open, draftRange, range]);
  const pick = (d: Date) => { const value = iso(d); setDraftRange(current => value < current.from || current.to ? { from: value, to: '' } : { ...current, to: value }); };
  const openPicker = () => { setDraftRange(range); setCursor(new Date(`${range.from}T00:00:00`)); setOpen(true); };
  return <div className="calendar-host">
    <button className="date-button" onClick={openPicker}><span>{fmt(new Date(`${range.from}T00:00:00`))} - {range.to ? fmt(new Date(`${range.to}T00:00:00`)) : '...'}</span></button>
    {open && <><div className="calendar-shade" onClick={closeDraft} /><div className="calendar-popover real-calendar"><div className="calendar-nav"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button><b>{cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</b><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button></div><div className="calendar-week">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map(d => { const v = iso(d); const inRange = draftRange.to && v >= draftRange.from && v <= draftRange.to; return <button key={v} className={`${d.getMonth() === cursor.getMonth() ? '' : 'muted'} ${v === iso(new Date()) ? 'today' : ''} ${v === draftRange.from || v === draftRange.to ? 'picked' : ''} ${inRange ? 'in-range' : ''}`} onClick={() => pick(d)}>{d.getDate()}</button>; })}</div><div className="row-actions"><Button variant="primary" onClick={commitDraft}>Применить</Button><Button onClick={closeDraft}>Отмена</Button></div></div></>}
  </div>;
}
function TopBar({ screen, setScreen, artifactFilter, toggleArtifactKit, displayKits, setPeriod, canUndo, undo }: { screen: Screen; setScreen: (s: Screen) => void; artifactFilter: string[]; toggleArtifactKit: (id: string) => void; displayKits: any[]; setPeriod: (range: { from: string; to: string }) => void; canUndo: boolean; undo: () => void }) { return <header className="topbar"><button type="button" className="topbar-brand" onClick={() => setScreen('brand')} aria-label="Открыть скрытый экран Берега"><span className="brand-blue">Не путай </span><b>Берега</b><span className="brand-blue">!</span></button><TopNav screen={screen} setScreen={setScreen} artifactFilter={artifactFilter} toggleArtifactKit={toggleArtifactKit} displayKits={displayKits}/><div className="top-actions">{screen !== 'home' && screen !== 'brand' && <button className="undo-button" disabled={!canUndo} onClick={undo} aria-label="Откатить"><Undo2 size={17}/></button>}{(screen === 'home' || screen === 'brand') && <DateRangePicker onChange={setPeriod}/>}</div></header>; }

function Home({ openKit, displayKits = kits, stages = stripSeededPeople(loadStoredArray('berega.stages', kitStages)), period, elements = [] }: { openKit: (id: string, target?: any) => void; displayKits?: any[]; stages?: any[]; period?: { from: string; to: string }; elements?: any[] }) {
  const allSteps = stages.flatMap(s => s.steps);
  const totalStats = { total: allSteps.length, todo: allSteps.filter((s: any) => s.status === 'todo').length, work: allSteps.filter((s: any) => s.status === 'in-progress').length, done: allSteps.filter((s: any) => s.status === 'done').length, added: allSteps.filter((s: any) => inPeriod(stepDate(s), period)).length, donePeriod: allSteps.filter((s: any) => s.status === 'done' && inPeriod(s.completedAt ?? todayIso(), period)).length };
  const totalReadiness = totalStats.total ? Math.round(totalStats.done / totalStats.total * 100) : 0;
  const merge = mergeStats(elements);
  const kitDue = loadStoredObject('berega.kitDue', {});
  return <main className={`screen home-screen ${displayKits.length <= 4 ? 'few-kits' : ''}`}>
    <section className="home-summary-grid">
      <Panel className="summary-card">
        <div className="summary-head"><b>Общий прогресс</b><span className="summary-stat"><strong>{totalReadiness}% готово</strong><small>{totalStats.done} / {totalStats.total} шагов</small></span></div>
        <div className="stackbar" role="img" aria-label={`Общий прогресс: ожидает ${totalStats.todo}, в работе ${totalStats.work}, сделано ${totalStats.done}`}><StackSegment className="task-todo" value={totalStats.todo} label="Ожидает"/><StackSegment className="task-work" value={totalStats.work} label="В работе"/><StackSegment className="task-done" value={totalStats.done} label="Сделано"/></div>
        <div className="summary-period" aria-label={`За период: закрыто ${totalStats.donePeriod}, добавлено ${totalStats.added}`}><span className="summary-period-title">За период</span><em className={totalStats.donePeriod === 0 ? 'zero-delta' : 'good-delta'}>Закрыто {deltaText(totalStats.donePeriod)}</em><em className={totalStats.added === 0 ? 'zero-delta' : 'info-text'}>Добавлено {deltaText(totalStats.added)}</em></div>
        <div className="bar-legend"><LegendItem className="task-todo" label="Ожидает" value={totalStats.todo}/><LegendItem className="task-work" label="В работе" value={totalStats.work}/><LegendItem className="task-done" label="Сделано" value={totalStats.done}/></div>
      </Panel>
      <Panel className="summary-card">
        <div className="summary-head"><b>Статус объединения</b><span className="summary-stat"><strong>{merge.percent}% общих</strong><small>{merge.common} / {merge.eligibleTotal} объединяемых</small></span></div>
        <div className="stackbar" role="img" aria-label={`Статус объединения: отдельные ${merge.single}, общие ${merge.common}, уникальные ${merge.unique}, больше не объединить ${merge.locked}, заменённые ${merge.merged}`}><StackSegment className="merge-single" value={merge.single} label="Отдельные"/><StackSegment className="merge-common" value={merge.common} label="Общие"/><StackSegment className="merge-unique" value={merge.unique} label="Уникальные"/><StackSegment className="merge-locked" value={merge.locked} label="Больше не объединить"/><StackSegment className="merge-merged" value={merge.merged} label="Заменённые"/></div>
        <div className="bar-legend"><LegendItem className="merge-single" label="Отдельные" value={merge.single}/><LegendItem className="merge-common" label="Общие" value={merge.common}/><LegendItem className="merge-unique" label="Уникальные" value={merge.unique}/><LegendItem className="merge-locked" label="Больше не объединить" value={merge.locked}/><LegendItem className="merge-merged" label="Заменённые" value={merge.merged}/><span className="legend-total">Активных {merge.total}</span></div>
      </Panel>
    </section>
    <section className="kit-home-grid">
      {displayKits.map(k => { const blocked = blockersForKit(stages, k.id); const late = overdueForKit(stages, k.id); const problems = problemCardsForKit(stages, k.id); const stats = kitStepStats(stages, k.id, period); const kitState = kitStatusId(stages, k.id); const kitDeadlineValue = kitDeadline(stages, k.id, kitDue[k.id]); const overdueDelta = late.length - (k.previousOverdue ?? 0); const blockedDelta = blocked.length - (k.previousBlockers ?? 0); return <Panel key={k.id} className="kit-status-card clickable-card" onClick={() => openKit(k.id)}>
        <button className="card-open" onClick={() => openKit(k.id)} aria-label={`Открыть ${k.name}`}></button>
        <div className="card-top"><div className="card-title"><h2>{k.name}</h2><p>{k.kind}</p></div><div className="home-card-meta"><span className={`deadline-button ${kitDeadlineValue ? deadlineTone(kitDeadlineValue, kitState) : 'empty'}`}>{shortDate(kitDeadlineValue)}</span><span className={`status-word ${stepTone(kitState)}`}>{stepLabel(kitState)}</span><button className={`kit-location-word ${k.location === 'Pixso' || k.location === 'Pixco' ? 'ok' : ''}`}>{k.location === 'Pixso' || k.location === 'Pixco' ? '✓ Pixso' : k.location}</button></div></div>
        <div className="mini-metrics mini-metrics-v2"><KitMiniProgressViz stats={stats}/></div>
        <div className="home-risk-metrics text-risk-metrics"><span>Просрочено: <strong className={late.length ? 'metric-count danger' : 'metric-count'}>{late.length}</strong> <em className={deltaClass(overdueDelta)}>{deltaText(overdueDelta)}</em></span><span>Заблокировано: <strong className={blocked.length ? 'metric-count danger' : 'metric-count'}>{blocked.length}</strong> <em className={deltaClass(blockedDelta)}>{deltaText(blockedDelta)}</em></span></div>{problems.length > 0 && <div className="home-blockers">{problems.map((item: any) => <button key={`${item.type}-${item.id}`} className="flow-card home-problem-card readonly-card" onClick={(e) => { e.stopPropagation(); openKit(k.id, item); }}>
  <b>{item.title}</b>
  <span>{item.description}</span>
  <span className={`status-chip-button ${stepTone(item.status)} top-status`}>{stepLabel(item.status)}</span>
  <div className="step-toolbar">
    <span className={`deadline-button ${item.dueDate ? deadlineTone(item.dueDate, item.status) : 'empty'}`}>{shortDate(item.dueDate)}</span>
  </div>
  {(item.blockedBy ?? []).length > 0 && <div className="blocker-box">
    {(item.blockedBy ?? []).map((ref: any) => <span key={`${ref.type}-${ref.id}`} className="blocker-chip blocked-by">Заблокировано: {nodeTitle(stages, ref) ?? ref.id}</span>)}
  </div>}
  <div className="detail-card-participants home-assignee">
    {item.owner || (item.participants && item.participants.length)
      ? (item.owner ? <RoleTag tone="designer">{item.owner}</RoleTag> : item.participants.map((p: any) => <RoleTag key={p} tone="co">{p}</RoleTag>))
      : <span className="assignee-missing">Исполнитель не назначен</span>}
  </div>
</button>)}</div>}
        <div className="roles-bottom">{(() => { const roles = homeKitRoles(stages, k); return <>{roles.designer ? <RoleTag tone="designer">{roles.designer}</RoleTag> : <RoleTag tone="other">Не назначен</RoleTag>}{roles.co.map(p => <RoleTag key={p} tone="co">{p}</RoleTag>)}{roles.other.map(p => <RoleTag key={p} tone="other">{p}</RoleTag>)}</>; })()}</div>
      </Panel>})}
    </section>
  </main>;
}

function ElementCard({ element, kitsList = kits, onDeleteElement }: { element: any; kitsList?: any[]; onDeleteElement?: (id: string) => void }) {
  return <Panel className="element-card">
    <div className="card-top"><div><h2>{element.name}</h2><p>{element.description}</p></div></div>
    <div className="preview-box"><span>{element.preview}</span></div>
    <div className="kit-markers">{kitsList.map(k => <KitTag key={k.id} kitId={k.id} kitsList={kitsList} muted={!(element.kits ?? []).includes(k.id)} />)}</div>
    <div className="row-actions"><Button aria-label="Выгрузить"><UploadCloud size={15}/></Button><Button aria-label="Удалить" onClick={() => onDeleteElement?.(element.id)}><Trash2 size={15}/></Button></div>
  </Panel>;
}

function GraphInfoPanel({ element, hoverElement, elements, setElements, actionMode, setActionMode, onDeleteElement, kitsList = kits }: { element: any; hoverElement: any; elements: any[]; setElements: StateSetter<any[]>; actionMode: 'kits' | 'replaces' | 'replaceBy' | null; setActionMode: (mode: 'kits' | 'replaces' | 'replaceBy' | null) => void; onDeleteElement?: () => void; kitsList?: any[] }) {
  const preview = (item: any, title = 'Превью') => item ? <Panel className="graph-preview-card"><span>{title}</span><div className="large-preview">{item.preview}</div><b>{item.name}</b><p>{item.description}</p></Panel> : null;
  const toggleElementKit = (kitId: string) => setElements((prev: any[]) => prev.map(e => { if (e.id !== element.id) return e; if (e.status === 'locked') { alert('Для этого элемента дальнейшее объединение невозможно.'); return e; } const has = (e.kits ?? []).includes(kitId); const nextKits = has ? (e.kits ?? []).filter((id: string) => id !== kitId) : [...(e.kits ?? []), kitId]; if (e.status === 'unique' && nextKits.length > 1) { alert('Уникальный элемент не может быть общим. Сначала снимите статус «уникальный».'); return e; } return { ...e, kits: nextKits }; }));
  const markReplaces = (oldId: string) => setElements((prev: any[]) => { const current = prev.find(e => e.id === element.id); const old = prev.find(e => e.id === oldId); if (!current || !old) return prev; const kitsUnion = uniquePeople([...(current.kits ?? []), ...(old.kits ?? [])]); return prev.map(e => e.id === element.id ? { ...e, status: e.status === 'unique' ? 'unique' : 'active', kits: kitsUnion, replaces: uniquePeople([...(e.replaces ?? []), oldId]) } : e.id === oldId ? { ...e, status: 'merged', replacedBy: element.id, kits: [] } : e); });
  const replaceBy = (targetId: string) => setElements((prev: any[]) => { const current = prev.find(e => e.id === element.id); const target = prev.find(e => e.id === targetId); if (!current || !target) return prev; const kitsUnion = uniquePeople([...(target.kits ?? []), ...(current.kits ?? [])]); return prev.map(e => e.id === element.id ? { ...e, status: 'merged', replacedBy: targetId, kits: [] } : e.id === targetId ? { ...e, status: e.status === 'unique' ? 'unique' : 'active', kits: kitsUnion, replaces: uniquePeople([...(e.replaces ?? []), element.id]) } : e); });
  const restoreElement = () => setElements((prev: any[]) => prev.map(e => e.id === element.id ? { ...e, status: 'active', replacedBy: undefined } : { ...e, replaces: (e.replaces ?? []).filter((id: string) => id !== element.id) }));
  return <Panel className="graph-info-panel">
    {element ? <><div className="card-top"><div><h2>{element.name}</h2><p>{element.description}</p></div>{onDeleteElement && <div className="row-actions"><Button aria-label="Удалить" title="Удалить элемент" onClick={onDeleteElement}><Trash2 size={15}/></Button></div>}</div><div className="info-block merge-actions"><span>Объединение</span><Button className={actionMode === 'kits' ? 'selected-person' : ''} onClick={() => setActionMode(actionMode === 'kits' ? null : 'kits')}>Подключить к китам</Button><Button onClick={() => setElements((prev: any[]) => prev.map(e => e.id === element.id ? { ...e, kits: [] } : e))}>Отключить от китов</Button><label className="merge-check unique"><input type="checkbox" checked={element.status === 'unique'} onChange={e => setElements((prev: any[]) => prev.map(x => x.id === element.id ? { ...x, status: e.target.checked ? 'unique' : 'active' } : x))}/>Уникальный</label><label className="merge-check locked"><input type="checkbox" checked={element.status === 'locked'} onChange={e => setElements((prev: any[]) => prev.map(x => x.id === element.id ? { ...x, status: e.target.checked ? 'locked' : 'active' } : x))}/>Дальнейшее объединение невозможно</label>{element.status === 'merged' && <Button onClick={restoreElement}>Восстановить</Button>}<span>Замещение</span><Button className={actionMode === 'replaces' ? 'selected-person' : ''} onClick={() => setActionMode(actionMode === 'replaces' ? null : 'replaces')}>Этот элемент заменяет…</Button><Button className={actionMode === 'replaceBy' ? 'selected-person' : ''} onClick={() => setActionMode(actionMode === 'replaceBy' ? null : 'replaceBy')}>Заменить этот элемент другим…</Button>{actionMode && <small className="merge-pick-hint">{actionMode === 'kits' ? 'Выберите кит в списке или шарик кита' : 'Выберите элемент слева или шарик на диаграмме'}</small>}{(element.replaces ?? []).length > 0 && <small>Заменяет: {(element.replaces ?? []).map((id: string) => elements.find(e => e.id === id)?.name ?? id).join(', ')}</small>}{element.replacedBy && <small>Заменён: {elements.find(e => e.id === element.replacedBy)?.name ?? element.replacedBy}</small>}</div></> : <div className="card-top"><div><h2>Артефакты</h2><p>Все артефакты. Выберите шарик, чтобы отфильтровать по связанным китам.</p></div></div>}
    <div className="overview-artifacts">{preview(element, 'Активный элемент')}{element && hoverElement && hoverElement.id !== element.id && preview(hoverElement, 'Ховер')}</div>
  </Panel>;
}

function Graph({ selected, setSelected, elements, artifacts, setElements, displayKits = kits }: { selected: string | null; setSelected: (id: string | null) => void; elements: any[]; artifacts: any[]; setElements: StateSetter<any[]>; displayKits?: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'kits' | 'replaces' | 'replaceBy' | null>(null);
  const focusId = hovered ?? selected;
  const focusedElement = elements.find(e => e.id === focusId) ?? null;
  const selectedElement = elements.find(e => e.id === selected) ?? null;
  const hoverElement = hovered ? elements.find(e => e.id === hovered) ?? null : null;
  const deleteSelectedElement = () => { if (!selectedElement) return; if (!confirm(`Удалить элемент «${selectedElement.name}» из системы?`)) return; setElements((prev: any[]) => removeElementsById(prev, [selectedElement.id])); setSelected(null); setHovered(null); setActionMode(null); };
  const applyMergePick = (targetId: string) => { if (!selected || !actionMode || targetId === selected) { setSelected(targetId); return; } if (actionMode === 'kits') return; setElements((prev: any[]) => { const current = prev.find(e => e.id === selected); const target = prev.find(e => e.id === targetId); if (!current || !target) return prev; if (actionMode === 'replaces') { const kitsUnion = uniquePeople([...(current.kits ?? []), ...(target.kits ?? [])]); return prev.map(e => e.id === selected ? { ...e, status: e.status === 'unique' ? 'unique' : 'active', kits: kitsUnion, replaces: uniquePeople([...(e.replaces ?? []), targetId]) } : e.id === targetId ? { ...e, status: 'merged', replacedBy: selected, kits: [] } : e); } const kitsUnion = uniquePeople([...(target.kits ?? []), ...(current.kits ?? [])]); return prev.map(e => e.id === selected ? { ...e, status: 'merged', replacedBy: targetId, kits: [] } : e.id === targetId ? { ...e, status: e.status === 'unique' ? 'unique' : 'active', kits: kitsUnion, replaces: uniquePeople([...(e.replaces ?? []), selected]) } : e); }); setActionMode(null); };
  const toggleSelectedKit = (kitId: string) => { if (actionMode !== 'kits' || !selectedElement) { setSelected(selected === kitId ? null : kitId); return; } setElements((prev: any[]) => prev.map(e => { if (e.id !== selected) return e; const has = (e.kits ?? []).includes(kitId); const nextKits = has ? (e.kits ?? []).filter((id: string) => id !== kitId) : [...(e.kits ?? []), kitId]; if (e.status === 'unique' && nextKits.length > 1) { alert('Уникальный элемент не может быть общим.'); return e; } return { ...e, kits: nextKits }; })); };
  const option = useMemo(() => {
    const visibleKitIds = new Set<string>(displayKits.map(k => k.id));
    const focusedKitId = focusId && visibleKitIds.has(focusId) ? focusId : null;
    const activeKitIds = new Set<string>();
    const activeElementIds = new Set<string>();
    if (focusedElement) {
      activeElementIds.add(focusedElement.id);
      (focusedElement.kits ?? []).forEach((id: string) => { if (visibleKitIds.has(id)) activeKitIds.add(id); });
    } else if (focusedKitId) {
      activeKitIds.add(focusedKitId);
      elements.forEach(e => { if ((e.kits ?? []).includes(focusedKitId)) activeElementIds.add(e.id); });
    } else {
      displayKits.forEach(k => activeKitIds.add(k.id));
      elements.forEach(e => activeElementIds.add(e.id));
    }
    const hasFocus = Boolean(focusedElement || focusedKitId);
    const kitNodes = displayKits.map(k => {
      const kitActive = activeKitIds.has(k.id);
      return {
        id: k.id,
        name: k.name,
        category: 0,
        symbol: 'circle',
        symbolSize: 66,
        label: { show: true, fontWeight: 800, fontSize: 11, color: '#f9fafb' },
        itemStyle: { color: kitActive ? k.color.border : '#475569', opacity: kitActive ? 1 : 0.35 }
      };
    });
    const elementNodes = elements.map(e => {
      const active = e.id === selected && !hovered;
      const focused = e.id === focusId;
      const connected = activeElementIds.has(e.id);
      const colors = (e.kits ?? []).map((id: string) => kitColor(id, displayKits));
      return {
        id: e.id,
        name: e.name,
        category: e.status === 'unique' ? 3 : e.status === 'locked' ? 4 : 2,
        symbol: e.status === 'unique' || !(e.kits ?? []).length ? 'circle' : pieSymbol(colors),
        symbolSize: focused || active ? 40 : 24,
        label: { show: true, fontSize: 11, color: connected ? '#f9fafb' : '#cbd5e1' },
        itemStyle: { color: focused || active ? '#2563eb' : e.status === 'unique' ? '#ef4444' : e.status === 'locked' ? '#f97316' : !(e.kits ?? []).length ? '#64748b' : colors[0], opacity: !hasFocus || connected ? 1 : 0.18 }
      };
    });
    const links = elements.flatMap(e => (e.kits ?? []).map((kitId: string) => {
      const linkActive = activeKitIds.has(kitId) && activeElementIds.has(e.id);
      const focusedLink = focusId === e.id || focusId === kitId;
      return { source: kitId, target: e.id, lineStyle: { color: kitColor(kitId, displayKits), opacity: !hasFocus || linkActive ? 1 : 0.14, width: hasFocus && linkActive && focusedLink ? 3 : 1.2 } };
    }));
    return {
      backgroundColor: 'transparent',
      tooltip: { show: false, triggerOn: 'none' },
      legend: [{ top: 6, left: 'center', orient: 'horizontal', icon: 'circle', itemGap: 16, textStyle: { color: '#94a3b8' }, data: ['Киты', 'Элементы', 'Уникальные', 'Дальше нельзя объединить'] }],
      animationDurationUpdate: 900,
      animationEasingUpdate: 'quinticInOut',
      series: [{ type: 'graph', layout: 'circular', left: 92, right: 92, top: 76, bottom: 44, zoom: 0.82, circular: { rotateLabel: false }, data: [...kitNodes, ...elementNodes], links, categories: [{ name: 'Киты' }, { name: 'Элементы' }, { name: 'Элементы' }, { name: 'Уникальные' }, { name: 'Дальше нельзя объединить' }], roam: true, label: { show: true, position: 'right', formatter: '{b}' }, labelLayout: { hideOverlap: false }, lineStyle: { curveness: 0.3 }, emphasis: { focus: 'none' } }]
    };
  }, [focusId, focusedElement, selected, hovered, elements, displayKits]);
  return <><button className="top-delete-button details-header-delete" disabled={!selectedElement} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); deleteSelectedElement(); }} aria-label="Удалить" title={selectedElement ? `Удалить элемент ${selectedElement.name}` : 'Выберите элемент для удаления'}><Trash2 size={18}/></button><div className="graph-wrap"><Panel className="element-list-panel"><h3>Киты и элементы</h3>{actionMode && <p className="merge-pick-hint">{actionMode === 'kits' ? 'Выберите кит или элемент' : 'Выберите элемент для замещения'}</p>}{displayKits.map(k => <div key={k.id} className="left-kit-group"><button className="left-kit-title" style={{color: k.color.border}} onMouseEnter={() => setHovered(null)} onClick={() => toggleSelectedKit(k.id)}>{k.name}</button>{elements.filter(e => (e.kits ?? []).includes(k.id)).map(e => <button key={`${k.id}-${e.id}`} className={`element-list-item ${selected === e.id ? 'active' : ''} ${hovered === e.id ? 'hovered' : ''}`} onMouseEnter={() => setHovered(e.id)} onMouseLeave={() => setHovered(null)} onClick={() => applyMergePick(e.id)}>{e.name}</button>)}</div>)}<div className="left-kit-group"><b className="left-kit-title muted">Без кита</b>{elements.filter(e => !(e.kits ?? []).length).map(e => <button key={e.id} className={`element-list-item ${selected === e.id ? 'active' : ''} ${hovered === e.id ? 'hovered' : ''}`} onMouseEnter={() => setHovered(e.id)} onMouseLeave={() => setHovered(null)} onClick={() => applyMergePick(e.id)}>{e.name}</button>)}</div></Panel><div className="graph-canvas-panel" onMouseLeave={() => setHovered(null)}><ReactECharts className="echarts-graph" style={{ width: '100%', height: '100%' }} option={option} notMerge={true} onChartReady={(chart: any) => chart.getZr().on('click', (event: any) => { if (!event.target && !actionMode) setSelected(null); })} onEvents={{ mouseover: (params: any) => { if (params.dataType !== 'node') return; const id = params.data?.id; if (elements.some(e => e.id === id) || displayKits.some(k => k.id === id)) setHovered(id); }, mouseout: (params: any) => { if (params.dataType === 'node') setHovered(null); }, globalout: () => setHovered(null), click: (params: any) => { if (params.dataType === 'node' && elements.some(e => e.id === params.data?.id)) applyMergePick(params.data.id); if (params.dataType === 'node' && displayKits.some(k => k.id === params.data?.id)) toggleSelectedKit(params.data.id); } }} /></div><GraphInfoPanel element={selectedElement} hoverElement={hoverElement} elements={elements} setElements={setElements} actionMode={actionMode} setActionMode={setActionMode} onDeleteElement={deleteSelectedElement} kitsList={displayKits}/></div></>;
}

function DetailsScreen({ initialKit, target, artifactList, setArtifactList, elements, setElements, kitEdits, setKitEdits, stages, setStages, extraKits, setExtraKits }: { initialKit: string; target?: any; artifactList: any[]; setArtifactList: StateSetter<any[]>; elements: any[]; setElements: StateSetter<any[]>; kitEdits: Record<string, any>; setKitEdits: StateSetter<Record<string, any>>; stages: any[]; setStages: StateSetter<any[]>; extraKits: any[]; setExtraKits: StateSetter<any[]> }) {
  const [selectedKit, setSelectedKit] = useState(initialKit);
  const [kitDue, setKitDue] = useState<Record<string, string>>(() => loadStored('berega.kitDue', {}));
  const detailKits = visibleKits(kits, extraKits, kitEdits);
  const kit = detailKits.find(k => k.id === selectedKit) ?? detailKits[0];
  const kitStageList = stages.filter(s => s.kitId === selectedKit).sort((a, b) => a.order - b.order);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [pendingBlocker, setPendingBlocker] = useState<{ type: 'stage' | 'step'; id: string } | null>(null);
  const [highlightedRef, setHighlightedRef] = useState<{ keys: string[]; tone: 'yellow' | 'red' } | null>(null);
  const [statusTarget, setStatusTarget] = useState<any>(null);
  const [participantTarget, setParticipantTarget] = useState<{ type: 'kit' | 'stage' | 'step'; id: string } | null>(null);
  const [newParticipant, setNewParticipant] = useState('');
  const [selectedPersonForDelete, setSelectedPersonForDelete] = useState('');
  const [participantRole, setParticipantRole] = useState<'designer' | 'co' | 'other'>('other');
  const [deletedPeople, setDeletedPeople] = useState<string[]>(() => uniquePeople([...loadStored('berega.deletedPeople', []), ...seededPeople]));
  const [artifactRequest, setArtifactRequest] = useState<any>(null);
  const [activeArtifact, setActiveArtifact] = useState<any>(null);
  const [artifactDraft, setArtifactDraft] = useState({ title: '', description: '', fileName: '', fileData: '', makeElement: true });
  const [createTarget, setCreateTarget] = useState<'kit' | 'stage' | 'step' | null>(null);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const selectedStage = kitStageList.find(s => s.id === selectedStageId);
  const [selectedStepId, setSelectedStepId] = useState('');
  const [selectedCard, setSelectedCard] = useState<{ type: 'kit' | 'stage' | 'step'; id: string } | null>(null);
  const [stageSortMode, setStageSortMode] = useState<DetailSortMode>('created');
  const [stepSortMode, setStepSortMode] = useState<DetailSortMode>('created');
  const sortedStages = sortDetailItems(kitStageList, stageSortMode, stageDeadline);
  const filteredStepStage = (selectedCard?.type === 'stage' || selectedCard?.type === 'step') ? selectedStage : null;
  const visibleStepsRaw = filteredStepStage ? filteredStepStage.steps.map((step: any) => ({ ...step, stageId: filteredStepStage.id })) : kitStageList.flatMap(st => st.steps.map((step: any) => ({ ...step, stageId: st.id })));
  const visibleSteps = sortDetailItems(visibleStepsRaw, stepSortMode, (step: any) => step.dueDate);
  const selectedStep = kitStageList.flatMap(s => s.steps).find((s: any) => s.id === selectedStepId);
  const selectedCardStage = selectedCard?.type === 'stage' ? kitStageList.find(s => s.id === selectedCard.id) : selectedStage;
  const selectedArtifactIds = selectedCard?.type === 'step' ? (kitStageList.flatMap(s => s.steps).find((s: any) => s.id === selectedCard.id)?.artifactIds ?? []) : selectedCard?.type === 'stage' ? (selectedCardStage?.steps.flatMap((s: any) => s.artifactIds ?? []) ?? []) : kitStageList.flatMap(st => st.steps.flatMap((s: any) => s.artifactIds ?? []));
  const stepArtifacts = artifactList.filter(a => selectedArtifactIds.includes(a.id));
  const allRefs = stages.flatMap(s => [{ type: 'stage', id: s.id, label: `Этап: ${s.title}` }, ...s.steps.map((step: any) => ({ type: 'step', id: step.id, label: `Шаг: ${step.title}` }))]);
  const allPeople = uniquePeople([...detailKits.flatMap(k => [k.owner, ...(k.team ?? [])]), ...stages.flatMap(s => [...(s.participants ?? []), ...s.steps.map((step: any) => step.owner), ...s.steps.flatMap((step: any) => step.participants ?? [])])]).filter(p => !deletedPeople.includes(p));
  const roleForParticipant = (container: any, name: string) => container?.owner === name ? 'designer' : container?.participantRoles?.[name] ?? (container?.steps?.some((st:any)=>st.owner===name) ? 'co' : defaultRoleFor(name, detailKits));
  const targetParticipants = (target: { type: 'kit' | 'stage' | 'step'; id: string }) => {
    if (target.type === 'kit') {
      const k = detailKits.find(x => x.id === target.id);
      return uniquePeople([k?.owner, ...(k?.team ?? [])]).filter(Boolean);
    }
    if (target.type === 'stage') {
      const s = stages.find(x => x.id === target.id);
      return uniquePeople([...(s?.participants ?? [])]);
    }
    const step = stages.flatMap(s => s.steps).find((x: any) => x.id === target.id);
    return uniquePeople([step?.owner, ...(step?.participants ?? [])]).filter(Boolean);
  };
  const withoutParticipantRole = (roles: Record<string, any> | undefined, name: string) => { const next = { ...(roles ?? {}) }; delete next[name]; return next; };
  const participantContainer = (target: { type: 'kit' | 'stage' | 'step'; id: string }) => target.type === 'kit' ? detailKits.find(x => x.id === target.id) : target.type === 'stage' ? stages.find(x => x.id === target.id) : stages.flatMap(s => s.steps).find((x: any) => x.id === target.id);
  const unassignParticipant = (target: { type: 'kit' | 'stage' | 'step'; id: string }, name: string) => {
    if (target.type === 'kit') {
      const k = detailKits.find(x => x.id === target.id);
      updateKit(target.id, { ...(k?.owner === name ? { owner: '' } : {}), team: (k?.team ?? []).filter((p: string) => p !== name) });
    } else {
      setStages(prev => prev.map(stage => target.type === 'stage' && stage.id === target.id ? { ...stage, participants: (stage.participants ?? []).filter((p: string) => p !== name), participantRoles: withoutParticipantRole(stage.participantRoles, name) } : { ...stage, steps: stage.steps.map((step: any) => target.type === 'step' && step.id === target.id ? { ...step, owner: step.owner === name ? '' : step.owner, participants: (step.participants ?? []).filter((p: string) => p !== name), participantRoles: withoutParticipantRole(step.participantRoles, name) } : step) }));
    }
    setSelectedPersonForDelete(current => current === name ? '' : current);
    setNewParticipant(current => current === name ? '' : current);
  };
  const renamePersonEverywhere = (from: string, to: string) => { if (!from || !to || from === to) return; setKitEdits(prev => { const next = { ...prev }; detailKits.forEach(k => { if (k.owner === from || (k.team ?? []).includes(from)) next[k.id] = { ...(next[k.id] ?? {}), owner: k.owner === from ? to : k.owner, team: uniquePeople((k.team ?? []).map((p: string) => p === from ? to : p)) }; }); return next; }); setStages(prev => prev.map(stage => ({ ...stage, participants: uniquePeople((stage.participants ?? []).map((p: string) => p === from ? to : p)), participantRoles: Object.fromEntries(Object.entries(stage.participantRoles ?? {}).map(([p, r]) => [p === from ? to : p, r])), steps: stage.steps.map((step: any) => ({ ...step, owner: step.owner === from ? to : step.owner, participants: uniquePeople((step.participants ?? []).map((p: string) => p === from ? to : p)), participantRoles: Object.fromEntries(Object.entries(step.participantRoles ?? {}).map(([p, r]) => [p === from ? to : p, r])) })) }))); setSelectedPersonForDelete(to); };
  const addParticipant = (target: { type: 'kit' | 'stage' | 'step'; id: string }, name: string) => { const clean = name.trim(); if (!clean) return; if (selectedPersonForDelete && selectedPersonForDelete !== clean) renamePersonEverywhere(selectedPersonForDelete, clean); setDeletedPeople(prev => prev.filter(p => p !== clean)); if (target.type === 'kit') { const k = detailKits.find(x => x.id === target.id); const team = participantRole === 'designer' ? (k?.team ?? []).filter((p: string) => p !== clean) : uniquePeople([...(k?.team ?? []).filter((p: string) => p !== clean), clean]); updateKit(target.id, participantRole === 'designer' ? { owner: clean, team } : { team }); closeParticipantModal(); return; } setStages(prev => prev.map(s => target.type === 'stage' && s.id === target.id ? { ...s, participants: uniquePeople([...(s.participants ?? []).filter((p: string) => p !== clean), clean]), participantRoles: { ...(s.participantRoles ?? {}), [clean]: participantRole } } : { ...s, steps: s.steps.map((step: any) => target.type === 'step' && step.id === target.id ? { ...step, owner: participantRole === 'designer' ? clean : step.owner === clean ? '' : step.owner, participants: participantRole === 'designer' ? (step.participants ?? []).filter((p: string) => p !== clean) : uniquePeople([...(step.participants ?? []).filter((p: string) => p !== clean), clean]), participantRoles: { ...(step.participantRoles ?? {}), [clean]: participantRole } } : step) })); closeParticipantModal(); };
  const toggleParticipant = (target: { type: 'kit' | 'stage' | 'step'; id: string }, name: string) => { if (targetParticipants(target).includes(name)) { unassignParticipant(target, name); return; } setSelectedPersonForDelete(name); setNewParticipant(name); setParticipantRole(roleForParticipant(participantContainer(target), name)); };
  const deletePersonEverywhere = (name: string) => { if (!confirm(`Удалить человека «${name}»?`)) return; setDeletedPeople(prev => uniquePeople([...prev, name])); detailKits.forEach(k => { if (k.owner === name || (k.team ?? []).includes(name)) updateKit(k.id, { owner: k.owner === name ? '' : k.owner, team: (k.team ?? []).filter((p: string) => p !== name) }); }); setStages(prev => prev.map(stage => ({ ...stage, participants: (stage.participants ?? []).filter((p: string) => p !== name), participantRoles: withoutParticipantRole(stage.participantRoles, name), steps: stage.steps.map((step: any) => ({ ...step, owner: step.owner === name ? '' : step.owner, participants: (step.participants ?? []).filter((p: string) => p !== name), participantRoles: withoutParticipantRole(step.participantRoles, name) })) }))); setSelectedPersonForDelete(''); setNewParticipant(''); };
  const syncKit = (id: string) => { setSelectedKit(id); setSelectedStageId(''); setSelectedStepId(''); setSelectedCard({ type: 'kit', id }); setEditingField(null); };
  useEffect(() => { if (detailKits.some(k => k.id === selectedKit)) return; if (detailKits[0]) { syncKit(detailKits[0].id); return; } setSelectedKit(''); setSelectedStageId(''); setSelectedStepId(''); setSelectedCard(null); }, [detailKits, selectedKit]);
  const resetCreateDraft = () => { setCreateName(''); setCreateDescription(''); };
  const closeCreateModal = () => { setCreateTarget(null); resetCreateDraft(); };
  const closeParticipantModal = () => { setParticipantTarget(null); setNewParticipant(''); setSelectedPersonForDelete(''); setParticipantRole('other'); };
  const resetArtifactDraft = () => setArtifactDraft({ title: '', description: '', fileName: '', fileData: '', makeElement: true });
  const closeArtifactRequestModal = () => { setArtifactRequest(null); resetArtifactDraft(); };
  const addKit = () => { resetCreateDraft(); setCreateTarget('kit'); };
  const updateKit = (id: string, patch: any) => setKitEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  const hasDetailElement = (type: 'stage' | 'step', id: string) => elements.some(e => e.id === detailElementId(type, id));
  const toggleDetailElement = (type: 'stage' | 'step', item: any, kitId: string) => {
    const id = detailElementId(type, item.id);
    setElements((prev: any[]) => prev.some(e => e.id === id) ? prev.filter(e => e.id !== id) : [...prev, { id, name: item.title, description: item.description || item.title, preview: item.description || item.title, status: 'active', kits: [kitId] }]);
  };
  const detailElementButton = (type: 'stage' | 'step', item: any, status: string, kitId: string) => {
    const active = hasDetailElement(type, item.id);
    const enabled = status === 'done';
    return <button type="button" className={`icon-chip detail-element-toggle ${active ? 'active' : ''}`} disabled={!enabled} aria-label="Элемент" aria-pressed={active} title={enabled ? 'Элемент' : 'Элемент доступен только для сделанных карточек'} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (enabled) toggleDetailElement(type, item, kitId); }}><Puzzle size={15}/></button>;
  };
  const removeDetailElements = (ids: string[]) => setElements((prev: any[]) => prev.filter(e => !ids.includes(e.id)));
  const updateStage = (id: string, patch: Record<string, any>) => setStages(prev => prev.map(stage => stage.id === id ? { ...stage, ...patch } : stage));
  const updateStageDeadline = (id: string, value: string) => updateStage(id, { dueDateOverride: value });
  const kitDerivedStatusId = (id: string) => kitStatusId(stages, id);
  const addStage = () => { if (!selectedKit || !kit) return; resetCreateDraft(); setCreateTarget('stage'); };
  const canCreateStep = !!selectedStage;
  const addStep = () => { if (!canCreateStep) return; resetCreateDraft(); setCreateTarget('step'); };
  const skipCardSelect = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest('button') || !!target.closest('[contenteditable="true"]'));
  const startEditing = (key: string, el: HTMLElement) => { el.dataset.original = el.textContent ?? ''; setEditingField(key); setTimeout(() => { const active = document.querySelector(`[data-edit-key="${key}"]`) as HTMLElement | null; if (!active) return; active.focus(); const range = document.createRange(); range.selectNodeContents(active); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }, 0); };
  const editableProps = (key: string, fallback: string, onSave: (value: string) => void, options?: { editOnClick?: boolean; allowEmpty?: boolean }) => { const begin = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => { e.stopPropagation(); if (editingField === key) return; startEditing(key, e.currentTarget); }; return { contentEditable: editingField === key, suppressContentEditableWarning: true, 'data-edit-key': key, role: options?.editOnClick ? 'textbox' : undefined, tabIndex: options?.editOnClick ? 0 : undefined, onClick: options?.editOnClick ? begin : undefined, onFocus: options?.editOnClick ? begin : undefined, onDoubleClick: begin, onBlur: (e: React.FocusEvent<HTMLElement>) => { const value = e.currentTarget.textContent ?? ''; onSave(options?.allowEmpty ? value : value || fallback); setEditingField(current => current === key ? null : current); }, onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => { if ((e.key === 'Enter' || e.key === 'Return')) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.textContent = e.currentTarget.dataset.original ?? e.currentTarget.textContent; e.currentTarget.blur(); } } }; };
  const createCard = () => { const title = createName.trim(); const description = createDescription.trim(); if (!title) return; if (createTarget === 'kit') { const id = `kit-${Date.now()}`; const newKit = { id, name: title, kind: 'Кит', location: 'Нет кита', owner: '', team: [], color: { border: '#60a5fa' } }; setExtraKits(prev => [...prev, newKit]); setSelectedKit(id); setSelectedStageId(''); setSelectedStepId(''); setSelectedCard({ type: 'kit', id }); closeCreateModal(); return; } if (createTarget === 'stage') { if (!selectedKit) return; const id = `stage-${Date.now()}`; setStages(prev => [{ id, kitId: selectedKit, title, description, createdAt: todayIso(), order: 0, dueDate: '', blockedBy: [], steps: [] }, ...prev]); setSelectedStageId(id); setSelectedCard({ type: 'stage', id }); closeCreateModal(); return; } if (createTarget === 'step') { if (!canCreateStep || !selectedStage) return; const id = `step-${Date.now()}`; setStages(prev => prev.map(st => st.id === selectedStage.id ? { ...st, steps: [{ id, stageId: selectedStage.id, title, description, createdAt: todayIso(), status: 'todo', owner: '', participants: [], dueDate: '', blockedBy: [], artifactIds: [] }, ...st.steps] } : st)); setSelectedStageId(selectedStage.id); setSelectedStepId(id); setSelectedCard({ type: 'step', id }); closeCreateModal(); } };
  const editStage = (id: string) => setStages(prev => prev.map(s => s.id === id ? { ...s, title: prompt('Название этапа', s.title) || s.title, description: prompt('Описание этапа', s.description) || s.description } : s));
  const cleanupRefs = (refs: any[], removed: Set<string>) => (refs ?? []).filter((r: any) => !removed.has(r.id));
  const deleteArtifactsEverywhere = (ids: string[]) => { const removed = new Set(ids); artifactList.filter((a: any) => removed.has(a.id)).forEach((a: any) => { void deleteArtifactFileData(a); }); setArtifactList((prev: any[]) => prev.filter(a => !removed.has(a.id))); };
  const deleteStage = (id: string) => { const stage = stages.find(s => s.id === id); if (!stage || !confirm('Удалить этап со всеми шагами, связями и артефактами?')) return; const removedIds = new Set([id, ...stage.steps.map((s: any) => s.id)]); deleteArtifactsEverywhere(stage.steps.flatMap((s: any) => s.artifactIds ?? [])); removeDetailElements([detailElementId('stage', id), ...stage.steps.map((s: any) => detailElementId('step', s.id))]); setStages(prev => prev.filter(s => s.id !== id).map(s => ({ ...s, blockedBy: cleanupRefs(s.blockedBy, removedIds), steps: s.steps.map((step: any) => ({ ...step, blockedBy: cleanupRefs(step.blockedBy, removedIds) })) }))); setSelectedCard(null); setSelectedStageId(''); setSelectedStepId(''); };
  const deleteStep = (id: string) => { const hostStage = stages.find(st => st.steps.some((s: any) => s.id === id)); const step = hostStage?.steps.find((s: any) => s.id === id); if (!step || !confirm('Удалить шаг со всеми связями и артефактами?')) return; const removedIds = new Set([id]); deleteArtifactsEverywhere(step.artifactIds ?? []); removeDetailElements([detailElementId('step', id), ...(hostStage ? [detailElementId('stage', hostStage.id)] : [])]); setStages(prev => prev.map(st => ({ ...st, blockedBy: cleanupRefs(st.blockedBy, removedIds), steps: st.steps.filter((step: any) => step.id !== id).map((step: any) => ({ ...step, blockedBy: cleanupRefs(step.blockedBy, removedIds) })) }))); setSelectedCard(null); setSelectedStageId(''); setSelectedStepId(''); };
  const deleteKit = (id: string) => { const kitStagesToRemove = stages.filter(s => s.kitId === id); const removedIds = new Set(kitStagesToRemove.flatMap(st => [st.id, ...st.steps.map((x: any) => x.id)])); deleteArtifactsEverywhere(kitStagesToRemove.flatMap(st => st.steps.flatMap((x: any) => x.artifactIds ?? []))); removeDetailElements(kitStagesToRemove.flatMap(st => [detailElementId('stage', st.id), ...st.steps.map((x: any) => detailElementId('step', x.id))])); setStages(prev => prev.filter(s => s.kitId !== id).map(s => ({ ...s, blockedBy: cleanupRefs(s.blockedBy, removedIds), steps: s.steps.map((step: any) => ({ ...step, blockedBy: cleanupRefs(step.blockedBy, removedIds) })) }))); updateKit(id, { deleted: true }); if (selectedKit === id) { setSelectedCard(null); setSelectedStageId(''); setSelectedStepId(''); } };
  const deleteSelectedCard = () => { if (selectedCard?.type === 'stage') return deleteStage(selectedCard.id); if (selectedCard?.type === 'step') return deleteStep(selectedCard.id); if (selectedKit && confirm('Удалить кит со всеми этапами, шагами, связями и артефактами?')) deleteKit(selectedKit); };
  const updateStep = (id: string, patch: Record<string, any>) => setStages(prev => prev.map(st => st.steps.some((step: any) => step.id === id) ? { ...st, steps: st.steps.map((step: any) => step.id === id ? { ...step, ...patch } : step) } : st));
  const changeStepStatus = (step: any, status: string) => { const hostStageId = step.stageId ?? selectedStage?.id; updateStep(step.id, { status, completedAt: status === 'done' ? todayIso() : '' }); if (status !== 'done') removeDetailElements([detailElementId('step', step.id), ...(hostStageId ? [detailElementId('stage', hostStageId)] : [])]); if (status === 'done') setStages(prev => prev.map(stage => ({ ...stage, blockedBy: (stage.blockedBy ?? []).filter((r: any) => r.id !== step.id), steps: stage.steps.map((s: any) => ({ ...s, blockedBy: (s.blockedBy ?? []).filter((r: any) => r.id !== step.id) })) }))); if (status === 'done' && step.status !== 'done') { setArtifactDraft({ title: step.title, description: '', fileName: '', fileData: '', makeElement: true }); setArtifactRequest(step); } };
  const saveRequestedArtifact = async () => { if (!artifactRequest) return; const id = `a-${Date.now()}`; const hostStageId = artifactRequest.stageId ?? selectedStage?.id; const type = artifactDraft.fileName ? 'Файл' : artifactDraft.description ? 'Описание' : 'Артефакт'; const title = artifactDraft.title || artifactRequest.title; let fileMeta: any = null; if (artifactDraft.fileData) { try { fileMeta = await saveArtifactFileData(id, artifactDraft.fileName || title || 'file', artifactDraft.fileData); } catch (e) { console.warn('artifact file save failed', e); alert('Не удалось сохранить файл в папку «Артефакты». Артефакт не создан.'); return; } } const fileUrl = fileMeta?.url || ''; const artifact = { id, title, type, kits: [selectedKit], preview: fileUrl && isImageFileName(fileMeta?.fileName || artifactDraft.fileName) ? fileUrl : artifactDraft.description || artifactDraft.fileName || title, description: artifactDraft.description, fileName: artifactDraft.fileName, fileData: fileUrl, fileUrl, storedFileName: fileMeta?.fileName || '', fileMimeType: fileMeta?.mimeType || '', fileSize: fileMeta?.size || 0, fileKey: '', executors: artifactRequest.owner ? [artifactRequest.owner] : [] }; setArtifactList((prev: any[]) => [...prev, artifact]); if (artifactDraft.makeElement) setElements((prev: any[]) => [...prev, { id: `el-${Date.now()}`, name: title, description: artifactDraft.description || title, kits: [selectedKit], status: 'green', preview: artifactDraft.description || title }]); setStages(prev => prev.map(st => st.id !== hostStageId ? st : { ...st, steps: st.steps.map((step: any) => step.id === artifactRequest.id ? { ...step, artifactIds: [...(step.artifactIds ?? []), id] } : step) })); closeArtifactRequestModal(); };
  const addBlocker = (targetType: 'stage' | 'step', targetId: string, value: string) => { if (!value) return; const [type, id] = value.split(':'); if (type === targetType && id === targetId) return; const ref = { type, id, reason: '' }; setStages(prev => prev.map(stage => targetType === 'stage' && stage.id === targetId ? { ...stage, blockedBy: [...(stage.blockedBy ?? []).filter((b: any) => !(b.type === type && b.id === id)), ref] } : { ...stage, steps: stage.steps.map((step: any) => targetType === 'step' && step.id === targetId ? { ...step, blockedBy: [...(step.blockedBy ?? []).filter((b: any) => !(b.type === type && b.id === id)), ref] } : step) })); };
  const removeBlocker = (targetType: 'stage' | 'step', targetId: string, ref: any) => setStages(prev => prev.map(stage => ({ ...stage, blockedBy: targetType === 'stage' && stage.id === targetId ? (stage.blockedBy ?? []).filter((b: any) => !(b.type === ref.type && b.id === ref.id)) : (stage.blockedBy ?? []), steps: stage.steps.map((step: any) => targetType === 'step' && step.id === targetId ? { ...step, blockedBy: (step.blockedBy ?? []).filter((b: any) => !(b.type === ref.type && b.id === ref.id)) } : step) })));
  const isPendingBlockerTarget = (type: 'stage' | 'step', id: string) => pendingBlocker?.type === type && pendingBlocker.id === id;
  const chooseBlocker = (type: 'stage' | 'step', id: string) => { if (!pendingBlocker) return false; if (isPendingBlockerTarget(type, id)) { setHighlightedRef({ keys: [`${type}-${id}`], tone: 'yellow' }); return true; } addBlocker(pendingBlocker.type, pendingBlocker.id, `${type}:${id}`); setHighlightedRef({ keys: [`${pendingBlocker.type}-${pendingBlocker.id}`, `${type}-${id}`], tone: 'red' }); setPendingBlocker(null); return true; };
  const refsBlocking = (type: 'stage' | 'step', id: string) => stages.flatMap(stage => [(stage.blockedBy ?? []).some((r: any) => r.type === type && r.id === id) ? { type: 'stage', id: stage.id, title: stage.title } : null, ...stage.steps.map((step: any) => (step.blockedBy ?? []).some((r: any) => r.type === type && r.id === id) ? { type: 'step', id: step.id, title: step.title } : null)]).filter(Boolean);
  const scrollToRef = (ref: any, tone: 'yellow' | 'red', source?: any) => { const targetKey = `${ref.type}-${ref.id}`; const sourceKey = source ? `${source.type}-${source.id}` : targetKey; setHighlightedRef({ keys: Array.from(new Set([targetKey, sourceKey])), tone }); const el = document.getElementById(targetKey); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const setStepStatusFlow = (step: any, status: string) => { changeStepStatus(step, status); setStatusTarget(null); if (status === 'blocked') setPendingBlocker({ type: 'step', id: step.id }); };
  const dropStage = (targetId: string) => { setStages(prev => { if (!draggedStageId || draggedStageId === targetId) return prev; const local = prev.filter(s => s.kitId === selectedKit).sort((a,b)=>a.order-b.order); const from = local.findIndex(s => s.id === draggedStageId); const to = local.findIndex(s => s.id === targetId); if (from < 0 || to < 0) return prev; const [moved] = local.splice(from, 1); local.splice(to, 0, moved); return prev.map(s => { const i = local.findIndex(x => x.id === s.id); return i >= 0 ? { ...s, order: i + 1 } : s; }); }); setDraggedStageId(null); };
  const dropStep = (targetId: string) => { setStages(prev => prev.map(st => { if (st.id !== selectedStage?.id || !draggedStepId || draggedStepId === targetId) return st; const steps = [...st.steps]; const from = steps.findIndex(s => s.id === draggedStepId); const to = steps.findIndex(s => s.id === targetId); if (from < 0 || to < 0) return st; const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); return { ...st, steps }; })); setDraggedStepId(null); };
  useEffect(() => { if (!target) return; if (target.type === 'stage') { setSelectedStageId(target.id); setSelectedCard({ type: 'stage', id: target.id }); } if (target.type === 'step') { setSelectedStageId(target.stageId); setSelectedStepId(target.id); setSelectedCard({ type: 'step', id: target.id }); } setTimeout(() => document.getElementById(`${target.type}-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); }, [target]);
  useEffect(() => { saveStored('berega.kitDue', kitDue); }, [kitDue]);
  useEffect(() => { saveStored('berega.deletedPeople', deletedPeople); }, [deletedPeople]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (!isEscapeKey(e) && !isApplyKey(e))) return;
      if (document.querySelector('.deadline-popover,.calendar-popover')) return;
      const active = document.activeElement as HTMLElement | null;
      const editable = (e.target as HTMLElement | null)?.closest?.('[contenteditable="true"]') as HTMLElement | null;
      const activeEditable = active?.isContentEditable ? active : editable;

      if (isEscapeKey(e)) {
        if (activeEditable) {
          stopKeyboardEvent(e);
          activeEditable.textContent = activeEditable.dataset.original ?? activeEditable.textContent;
          activeEditable.blur();
          return;
        }
        if (activeArtifact) { stopKeyboardEvent(e); setActiveArtifact(null); return; }
        if (artifactRequest) { stopKeyboardEvent(e); closeArtifactRequestModal(); return; }
        if (participantTarget) { stopKeyboardEvent(e); closeParticipantModal(); return; }
        if (createTarget) { stopKeyboardEvent(e); closeCreateModal(); return; }
        if (statusTarget) { stopKeyboardEvent(e); setStatusTarget(null); return; }
        if (pendingBlocker || highlightedRef || selectedCard || selectedStageId || selectedStepId) {
          stopKeyboardEvent(e);
          setPendingBlocker(null);
          setHighlightedRef(null);
          setSelectedCard(null);
          setSelectedStageId('');
          setSelectedStepId('');
        }
        return;
      }

      if (activeEditable) { stopKeyboardEvent(e); activeEditable.blur(); return; }
      if (shouldIgnoreGlobalApply(e)) return;
      if (createTarget) { stopKeyboardEvent(e); createCard(); return; }
      if (participantTarget) { stopKeyboardEvent(e); addParticipant(participantTarget, newParticipant); return; }
      if (artifactRequest) { stopKeyboardEvent(e); void saveRequestedArtifact(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [artifactRequest, artifactDraft, createTarget, createName, createDescription, selectedKit, selectedStage, selectedStageId, selectedStepId, selectedCard, canCreateStep, participantTarget, newParticipant, pendingBlocker, highlightedRef, activeArtifact, statusTarget]);
  useEffect(() => { const onEditKey = (e: KeyboardEvent) => { const el = e.target as HTMLElement; if (!el?.isContentEditable) return; if ((e.key === 'Enter' || e.key === 'Return')) { e.preventDefault(); el.blur(); } if (e.key === 'Escape') { e.preventDefault(); el.textContent = el.dataset.original ?? el.textContent; el.blur(); } }; const onDbl = (e: MouseEvent) => { const el = e.target as HTMLElement; if (el?.isContentEditable) el.dataset.original = el.textContent ?? ''; }; document.addEventListener('keydown', onEditKey); document.addEventListener('dblclick', onDbl); return () => { document.removeEventListener('keydown', onEditKey); document.removeEventListener('dblclick', onDbl); }; }, []);
  useEffect(() => { const onDown = (_e: MouseEvent) => {}; document.addEventListener('mousedown', onDown); return () => document.removeEventListener('mousedown', onDown); }, []);
  useEffect(() => { const onMouse = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.flow-card,.modal-shade,.deadline-popover,.details-header-delete,.column-head,.corner-add')) return; setSelectedCard(null); setSelectedStageId(''); setSelectedStepId(''); setHighlightedRef(null); }; document.addEventListener('mousedown', onMouse); return () => document.removeEventListener('mousedown', onMouse); }, []);
  return <main className={`screen fit-screen stages-screen ${pendingBlocker ? 'blocker-mode' : ''}`}>
    <button className="top-delete-button details-header-delete" disabled={!selectedCard && !draggedStageId && !draggedStepId} onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (draggedStageId) deleteStage(draggedStageId); if (draggedStepId) deleteStep(draggedStepId); setDraggedStageId(null); setDraggedStepId(null); }} onClick={e => { e.stopPropagation(); deleteSelectedCard(); }} aria-label="Удалить"><Trash2 size={18}/></button>
    <section className="stages-grid flow-grid">
      <Panel className="kit-column"><div className="column-head"><h3>Кит</h3><button className="corner-add" onClick={addKit}>+</button></div>{detailKits.map(k => <div key={k.id} className={`kit-select editable-kit ${selectedKit === k.id ? 'active' : ''}`} onClick={e => { if (skipCardSelect(e.target)) return; syncKit(k.id); }}><b {...editableProps(`kit-${k.id}-name`, k.name, value => updateKit(k.id, { name: value }))}>{k.name}</b><span className="kit-description" {...editableProps(`kit-${k.id}-kind`, k.kind, value => updateKit(k.id, { kind: value }))}>{k.kind}</span><span className={`status-chip-button ${stepTone(kitDerivedStatusId(k.id))}`}>{stepLabel(kitDerivedStatusId(k.id))}</span><DeadlineButton value={kitDeadline(stages, k.id, kitDue[k.id])} status={kitStatusId(stages, k.id)} onChange={value => setKitDue(prev => ({ ...prev, [k.id]: value }))}/><button className="delete-x" onClick={e => { e.stopPropagation(); if (confirm('Удалить кит со всеми этапами, шагами, связями и артефактами?')) deleteKit(k.id); }}><Trash2 size={15}/></button><div className="kit-markers kit-location-row"><button className={`kit-location-word ${(k.location === 'Pixso' || k.location === 'Pixco') ? 'ok' : ''}`} onClick={e => { e.stopPropagation(); const order = ['Pixso','Figma','Нет кита']; updateKit(k.id, { location: order[(order.indexOf(k.location) + 1) % order.length] }); }}>{(k.location === 'Pixso' || k.location === 'Pixco') ? <><span className="kit-location-check">✓</span> Pixso</> : k.location}</button></div><div className="stage-participants kit-participants" onClick={e => e.stopPropagation()}>{(() => { const r = homeKitRoles(stages, k); const des = r.designer || k.owner; const parts = [des ? <span key="des" onClick={() => { setParticipantTarget({ type: 'kit', id: k.id }); setSelectedPersonForDelete(des); setNewParticipant(des); setParticipantRole('designer'); }}><RoleTag tone="designer">{des}</RoleTag></span> : <RoleTag key="none" tone="other">Не назначен</RoleTag>]; r.co.forEach(p => parts.push(<span key={p} onClick={() => { setParticipantTarget({ type: 'kit', id: k.id }); setSelectedPersonForDelete(p); setNewParticipant(p); setParticipantRole('co'); }}><RoleTag tone="co">{p}</RoleTag></span>)); r.other.forEach(p => parts.push(<span key={'o'+p} onClick={() => { setParticipantTarget({ type: 'kit', id: k.id }); setSelectedPersonForDelete(p); setNewParticipant(p); setParticipantRole('other'); }}><RoleTag tone="other">{p}</RoleTag></span>)); parts.push(<button key="add" className="participant-add" onClick={e => { e.stopPropagation(); setParticipantTarget({ type: 'kit', id: k.id }); }}><User size={15}/></button>); return <>{parts}</>; })()}</div></div>)}</Panel>
      <Panel className="flow-column"><div className="column-head"><h3>Этап</h3><div className="column-actions"><button type="button" className={`detail-sort-button detail-sort-${stageSortMode}`} aria-label={`Сортировка этапов: ${sortModeLabel(stageSortMode)}`} title={`Сортировка: ${sortModeLabel(stageSortMode)}`} onClick={e => { e.stopPropagation(); setStageSortMode(mode => toggleSortMode(mode)); }}><ArrowDownUp size={16} aria-hidden="true"/></button><button className="corner-add" disabled={!selectedKit || !kit} onClick={addStage}>+</button></div></div><div className="flow-list scroll-block">{sortedStages.map((s) => <div id={`stage-${s.id}`} key={s.id} draggable onDragStart={() => { setDraggedStageId(s.id); setSelectedStageId(s.id); setSelectedStepId(''); setSelectedCard({ type: 'stage', id: s.id }); }} onDragOver={e => e.preventDefault()} onDrop={() => dropStage(s.id)} className={`flow-card ${selectedCard?.type === 'stage' && selectedCard.id === s.id || selectedCard?.type === 'step' && selectedStage?.id === s.id ? 'active' : ''} ${isPendingBlockerTarget('stage', s.id) ? 'blocking-pick' : ''} ${highlightedRef?.keys.includes(`stage-${s.id}`) ? `highlighted-card ${highlightedRef.tone}` : ''}`} onPointerDownCapture={e => { if (pendingBlocker || skipCardSelect(e.target)) return; setSelectedStageId(s.id); setSelectedStepId(''); setSelectedCard({ type: 'stage', id: s.id }); }} onClick={e => { if (skipCardSelect(e.target)) return; if (chooseBlocker('stage', s.id)) return; setSelectedStageId(s.id); setSelectedStepId(''); setSelectedCard({ type: 'stage', id: s.id }); }}><button className="delete-x" onClick={e => { e.stopPropagation(); deleteStage(s.id); }}><Trash2 size={15}/></button><b {...editableProps(`stage-${s.id}-title`, s.title, value => updateStage(s.id, { title: value }))}>{s.title}</b><span className={`card-description editable-description ${s.description ? '' : 'empty-description'}`} data-placeholder="Описание этапа" title="Двойной клик, чтобы добавить или изменить описание" aria-label="Описание этапа" {...editableProps(`stage-${s.id}-description`, s.description, value => updateStage(s.id, { description: value }), { allowEmpty: true })}>{s.description}</span><span className={`status-chip-button ${stepTone(stageStatusId(s))} top-status`}>{stepLabel(stageStatusId(s))}</span><div className="blocker-box">{!(s.blockedBy ?? []).length && !refsBlocking('stage', s.id).length && <button className={`blocker-none ${isPendingBlockerTarget('stage', s.id) ? 'active' : ''}`} aria-pressed={isPendingBlockerTarget('stage', s.id)} onClick={e => { e.stopPropagation(); setPendingBlocker({ type: 'stage', id: s.id }); }}>Блоков нет</button>}{(s.blockedBy ?? []).map((ref: any) => <span key={`${ref.type}-${ref.id}`} className="blocker-chip blocked-by" onClick={e => { e.stopPropagation(); scrollToRef(ref, 'yellow', { type: 'stage', id: s.id }); }}>Заблокировано: {nodeTitle(stages, ref) ?? ref.id}</span>)}{refsBlocking('stage', s.id).map((ref: any) => <span key={`blocks-${ref.type}-${ref.id}`} className="blocker-chip blocks" onClick={e => { e.stopPropagation(); scrollToRef(ref, 'red', { type: 'stage', id: s.id }); }}>Блокирует: {ref.title}<button className="blocker-remove" onClick={ev => { ev.stopPropagation(); removeBlocker(ref.type, ref.id, { type: 'stage', id: s.id }); }}>×</button></span>)}</div><div className="detail-card-footer"><div className="stage-participants detail-card-participants" onClick={e => e.stopPropagation()}><button type="button" className="participant-add card-participant-add" aria-label="Добавить участника этапа" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setParticipantTarget({ type: 'stage', id: s.id }); }}><User size={15}/></button>{stageParticipants(s).length ? stageParticipants(s).map(name => <span key={name} onClick={() => { setParticipantTarget({ type: 'stage', id: s.id }); setSelectedPersonForDelete(name); setNewParticipant(name); }}><RoleTag tone={roleForParticipant(s, name)}>{name}</RoleTag></span>) : <span className="assignee-missing">Исполнитель не назначен</span>}</div><div className="detail-card-actions">{detailElementButton('stage', s, stageStatusId(s), selectedKit)}<DeadlineButton value={stageDeadline(s)} status={stageStatusId(s)} onChange={value => updateStageDeadline(s.id, value)}/></div></div></div>)}</div></Panel>
      <Panel className="flow-column"><div className="column-head"><h3>Шаг</h3><div className="column-actions"><button type="button" className={`detail-sort-button detail-sort-${stepSortMode}`} aria-label={`Сортировка шагов: ${sortModeLabel(stepSortMode)}`} title={`Сортировка: ${sortModeLabel(stepSortMode)}`} onClick={e => { e.stopPropagation(); setStepSortMode(mode => toggleSortMode(mode)); }}><ArrowDownUp size={16} aria-hidden="true"/></button><button className="corner-add" disabled={!canCreateStep} onClick={addStep}>+</button></div></div><div className="flow-list scroll-block">{visibleSteps.map((s) => <div id={`step-${s.id}`} key={s.id} draggable onDragStart={() => { setDraggedStepId(s.id); if (s.stageId) setSelectedStageId(s.stageId); setSelectedStepId(s.id); setSelectedCard({ type: 'step', id: s.id }); }} onDragOver={e => e.preventDefault()} onDrop={() => dropStep(s.id)} className={`flow-card ${selectedCard?.type === 'step' && selectedCard.id === s.id ? 'active' : ''} ${isPendingBlockerTarget('step', s.id) ? 'blocking-pick' : ''} ${highlightedRef?.keys.includes(`step-${s.id}`) ? `highlighted-card ${highlightedRef.tone}` : ''}`} onPointerDownCapture={e => { if (pendingBlocker || skipCardSelect(e.target)) return; if (s.stageId) setSelectedStageId(s.stageId); setSelectedStepId(s.id); setSelectedCard({ type: 'step', id: s.id }); }} onClick={e => { if (skipCardSelect(e.target)) return; if (chooseBlocker('step', s.id)) return; if (s.stageId) setSelectedStageId(s.stageId); setSelectedStepId(s.id); setSelectedCard({ type: 'step', id: s.id }); }}><button className="delete-x" onClick={e => { e.stopPropagation(); deleteStep(s.id); }}><Trash2 size={15}/></button><b {...editableProps(`step-${s.id}-title`, s.title, value => updateStep(s.id, { title: value }))}>{s.title}</b><span className={`card-description editable-description ${s.description ? '' : 'empty-description'}`} data-placeholder="Описание шага" title="Двойной клик, чтобы добавить или изменить описание" aria-label="Описание шага" {...editableProps(`step-${s.id}-description`, s.description, value => updateStep(s.id, { description: value }), { allowEmpty: true })}>{s.description}</span><div className="step-toolbar"><button className={`status-chip-button ${stepTone(s.status)}`} onClick={e => { e.stopPropagation(); setStatusTarget(s); }}>{stepLabel(s.status)}</button></div><div className="blocker-box">{!(s.blockedBy ?? []).length && !refsBlocking('step', s.id).length && <button className={`blocker-none ${isPendingBlockerTarget('step', s.id) ? 'active' : ''}`} aria-pressed={isPendingBlockerTarget('step', s.id)} onClick={e => { e.stopPropagation(); setPendingBlocker({ type: 'step', id: s.id }); }}>Блоков нет</button>}{(s.blockedBy ?? []).map((ref: any) => <span key={`${ref.type}-${ref.id}`} className="blocker-chip blocked-by" onClick={e => { e.stopPropagation(); scrollToRef(ref, 'yellow', { type: 'step', id: s.id }); }}>Заблокировано: {nodeTitle(stages, ref) ?? ref.id}</span>)}{refsBlocking('step', s.id).map((ref: any) => <span key={`blocks-${ref.type}-${ref.id}`} className="blocker-chip blocks" onClick={e => { e.stopPropagation(); scrollToRef(ref, 'red', { type: 'step', id: s.id }); }}>Блокирует: {ref.title}<button className="blocker-remove" onClick={ev => { ev.stopPropagation(); removeBlocker(ref.type, ref.id, { type: 'step', id: s.id }); }}>×</button></span>)}</div><div className="detail-card-footer"><div className="stage-participants detail-card-participants" onClick={e => e.stopPropagation()}><button type="button" className="participant-add card-participant-add" aria-label="Добавить участника шага" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setParticipantTarget({ type: 'step', id: s.id }); }}><User size={15}/></button>{uniquePeople([s.owner, ...(s.participants ?? [])]).length ? uniquePeople([s.owner, ...(s.participants ?? [])]).map(name => <span key={name} onClick={() => { setParticipantTarget({ type: 'step', id: s.id }); setSelectedPersonForDelete(name); setNewParticipant(name); }}><RoleTag tone={roleForParticipant(s, name)}>{name}</RoleTag></span>) : <span className="assignee-missing">Исполнитель не назначен</span>}</div><div className="detail-card-actions">{(s.artifactIds ?? []).some((id: string) => artifactList.some(a => a.id === id)) && <button className="icon-chip artifact-eye" onClick={e => { e.stopPropagation(); setActiveArtifact(artifactList.find(a => (s.artifactIds ?? []).includes(a.id))); }}><Eye size={15}/></button>}{detailElementButton('step', s, s.status, selectedKit)}<DeadlineButton value={s.dueDate} status={s.status} onChange={value => updateStep(s.id, { dueDate: value })}/></div></div></div>)}</div></Panel>
      <Panel className="flow-column artifact-column"><div className="column-head"><h3>Артефакт</h3></div>{stepArtifacts.length ? stepArtifacts.map(a => <button key={a.id} type="button" className="artifact-mini" onClick={() => setActiveArtifact(a)}><b title={a.title}>{a.title}</b><div className="large-preview"><ArtifactPreview artifact={a}/></div><ToolTag>{a.type}</ToolTag><div className="kit-markers">{(a.kits ?? []).map((id: string) => <KitTag key={id} kitId={id} kitsList={detailKits}/>)}{(a.executors ?? []).map((name: string) => <span key={name} className="person-tag">{name}</span>)}</div></button>) : <div className="empty-note">У выбранной карточки пока нет артефактов</div>}</Panel>
    </section>
    {participantTarget && <div className="modal-shade" onClick={closeParticipantModal}><div className="participant-modal" onClick={e => e.stopPropagation()}><h3>Участник</h3><div className="chip-palette">{allPeople.map(name => { const assigned = targetParticipants(participantTarget).includes(name); return <button key={name} type="button" onClick={() => toggleParticipant(participantTarget, name)} className={`person-chip role-tag ${defaultRoleFor(name, detailKits)} ${selectedPersonForDelete === name ? 'selected-person' : ''} ${assigned ? 'assigned-person' : ''}`} title={assigned ? 'Убрать из текущей карточки' : 'Выбрать участника'}><span>{name}</span><span className="person-chip-delete" role="button" tabIndex={0} aria-label={`Удалить ${name} везде`} title="Удалить сотрудника везде" onClick={e => { e.stopPropagation(); deletePersonEverywhere(name); }} onKeyDown={e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); deletePersonEverywhere(name); }}>×</span></button>; })}</div><div className="role-palette"><button className={participantRole === 'designer' ? 'role-tag designer selected-person' : 'role-tag designer'} disabled={!newParticipant.trim()} onClick={() => setParticipantRole('designer')}><Palette size={13}/><span>Дизайнер</span></button><button className={participantRole === 'co' ? 'role-tag co selected-person' : 'role-tag co'} disabled={!newParticipant.trim()} onClick={() => setParticipantRole('co')}><Palette size={13}/><span>Соисполнитель</span></button><button className={participantRole === 'other' ? 'role-tag other selected-person' : 'role-tag other'} disabled={!newParticipant.trim()} onClick={() => setParticipantRole('other')}><User size={13}/><span>Участник</span></button></div><input value={newParticipant} autoFocus placeholder="Новый участник" onChange={e => setNewParticipant(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === 'Return')) addParticipant(participantTarget, newParticipant); }}/><div className="row-actions"><Button variant="primary" onClick={() => addParticipant(participantTarget, newParticipant)}>Применить</Button><Button onClick={closeParticipantModal}>Закрыть</Button></div></div></div>}
    {statusTarget && <div className="modal-shade" onClick={() => setStatusTarget(null)}><div className="participant-modal" onClick={e => e.stopPropagation()}><h3>Статус</h3><div className="chip-palette">{[{id:'in-progress', label:'в работе'}, {id:'todo', label:'ожидает'}, {id:'done', label:'сделано'}, {id:'blocked', label:'блокер'}].map(item => <button key={item.id} className={`status-chip-button ${stepTone(item.id)}`} onClick={() => setStepStatusFlow(statusTarget, item.id)}>{item.label}</button>)}</div></div></div>}
    {artifactRequest && <div className="modal-shade" onClick={closeArtifactRequestModal}><div className="participant-modal artifact-modal" onClick={e => e.stopPropagation()}><h3>Артефакт к выполненному шагу</h3><input value={artifactDraft.title} placeholder="Название" onChange={e => setArtifactDraft(v => ({ ...v, title: e.target.value }))}/><textarea value={artifactDraft.description} placeholder="Описание, ссылка или комментарий" onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }} onChange={e => setArtifactDraft(v => ({ ...v, description: e.target.value }))}/><label className="make-element"><input type="checkbox" checked={artifactDraft.makeElement} onChange={e => setArtifactDraft(v => ({ ...v, makeElement: e.target.checked }))}/> Сделать элементом</label><label className="file-upload">Файл / скриншот<input type="file" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setArtifactDraft(v => ({ ...v, fileName: file.name, fileData: String(reader.result || '') })); reader.readAsDataURL(file); }}/></label>{artifactDraft.fileData && <div className="large-preview upload-preview"><img src={artifactDraft.fileData}/></div>}<div className="row-actions"><Button variant="primary" onClick={saveRequestedArtifact}>Сохранить</Button><Button onClick={closeArtifactRequestModal}>Пропустить</Button></div></div></div>}
    {activeArtifact && <div className="modal-shade" onClick={() => setActiveArtifact(null)}><div className="artifact-zoom" onClick={e => e.stopPropagation()}><div className="large-preview"><ArtifactLargePreview artifact={activeArtifact}/></div><h2>{activeArtifact.title}</h2><p>{activeArtifact.description}</p></div></div>}
    {createTarget && <div className="modal-shade" onClick={closeCreateModal}><div className="participant-modal" onClick={e => e.stopPropagation()}><h3>{createTarget === 'kit' ? 'Новый кит' : createTarget === 'stage' ? 'Новый этап' : 'Новый шаг'}</h3><input value={createName} autoFocus placeholder="Название" onChange={e => setCreateName(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === 'Return')) createCard(); if (e.key === 'Escape') closeCreateModal(); }}/>{createTarget !== 'kit' && <textarea value={createDescription} placeholder={createTarget === 'stage' ? 'Описание этапа' : 'Описание шага'} rows={3} onChange={e => setCreateDescription(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === 'Return')) createCard(); if (e.key === 'Escape') closeCreateModal(); }}/>}<div className="row-actions"><Button variant="primary" onClick={createCard}>Создать</Button><Button onClick={closeCreateModal}>Отмена</Button></div></div></div>}
  </main>;
}

function OverviewScreen({ elements, artifacts, setElements, displayKits }: { elements: any[]; artifacts: any[]; setElements: StateSetter<any[]>; displayKits: any[] }) { const [selectedElement, setSelectedElement] = useState<string | null>(null); return <main className="screen fit-screen"><Graph selected={selectedElement} setSelected={setSelectedElement} elements={elements} artifacts={artifacts} setElements={setElements} displayKits={displayKits}/></main>; }
const ArtifactPreview = ({ artifact }: { artifact: any }) => { const text = artifact?.description || artifact?.preview || ''; const imageSrc = artifactImageSrc(artifact); if (imageSrc) return <img src={imageSrc} alt={artifact.title}/>; if (artifactFrameSrc(artifact) || artifact?.fileName || artifact?.type === 'Файл') return <span className="artifact-file-label">{artifact?.fileName || 'Файл'}</span>; if (/https?:\/\//.test(text)) return <span className="artifact-link-text">{text}</span>; return <span>{text || artifact?.title}</span>; };
function ArtifactsScreen({ artifactList, setArtifactList, artifactFilter, setStages, displayKits, onDeleteArtifact }: { artifactList: any[]; setArtifactList: StateSetter<any[]>; artifactFilter: string[]; setStages: StateSetter<any[]>; displayKits: any[]; onDeleteArtifact: (artifact: any) => void }) { const [active, setActive] = useState<any>(null); useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []); const filtered = artifactList.filter(a => artifactFilter.length === 0 || (a.kits ?? []).some((id: string) => artifactFilter.includes(id))); return <main className="screen fit-screen artifacts-screen"><section className="artifact-board only-tiles"><Panel className="artifact-tile-panel"><div className="artifact-tile-grid">{[...filtered, ...Array.from({ length: Math.max(0, 80 - filtered.length) }, (_, i) => ({ id: `placeholder-${i}`, placeholder: true }))].map((a: any) => a.placeholder ? <div key={a.id} className="artifact-tile artifact-placeholder"/> : <button key={a.id} className="artifact-tile" onClick={() => setActive(a)}><span className="artifact-title" title={a.title}>{a.title}</span><div className="artifact-thumb"><ArtifactPreview artifact={a}/></div><div className="kit-markers">{(a.kits ?? []).map((id: string) => <KitTag key={id} kitId={id} kitsList={displayKits}/>)}{(a.executors ?? []).map((name: string) => <span key={name} className="person-tag">{name}</span>)}</div></button>)}</div></Panel></section>{active && <div className="modal-shade" onClick={() => setActive(null)}><div className="artifact-zoom" onClick={e => e.stopPropagation()}><div className="large-preview"><ArtifactLargePreview artifact={active}/></div><h2>{active.title}</h2><p>{active.description}</p><div className="kit-markers">{(active.kits ?? []).map((id: string) => <KitTag key={id} kitId={id} kitsList={displayKits}/>)}{(active.executors ?? []).map((name: string) => <span key={name} className="person-tag">{name}</span>)}</div><div className="artifact-board-actions"><Button aria-label="Выгрузить" onClick={() => downloadArtifact(active)}><Download size={15}/></Button><Button aria-label="Удалить" onClick={() => { if (!confirm('Удалить артефакт?')) return; onDeleteArtifact(active); setStages((prev: any[]) => prev.map((st: any) => ({ ...st, steps: st.steps.map((step: any) => ({ ...step, artifactIds: (step.artifactIds ?? []).filter((id: string) => id !== active.id) })) }))); setActive(null); }}><Trash2 size={15}/></Button></div></div></div>}</main>; }

function BrandScreen({ displayKits, stages, elements, artifacts, period }: { displayKits: any[]; stages: any[]; elements: any[]; artifacts: any[]; period?: { from: string; to: string } }) {
  const stageList = Array.isArray(stages) ? stages : [];
  const allSteps = stageList.flatMap((stage: any) => (stage.steps ?? []).map((step: any) => ({ ...step, kitId: stage.kitId, stageTitle: stage.title })));
  const today = todayIso();
  const fallbackStart = new Date(`${today}T00:00:00`);
  fallbackStart.setDate(fallbackStart.getDate() - 6);
  const periodRange = period ?? { from: localIso(fallbackStart), to: today };
  const periodStart = new Date(`${periodRange.from}T00:00:00`);
  const periodEnd = new Date(`${periodRange.to}T00:00:00`);
  const periodDaysTotal = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
  const visibleTrendDays = Math.min(periodDaysTotal, 21);
  const trendStart = new Date(periodEnd);
  trendStart.setDate(periodEnd.getDate() - visibleTrendDays + 1);
  const periodLabel = `${shortDate(periodRange.from)} — ${shortDate(periodRange.to)}`;
  const done = allSteps.filter((s: any) => s.status === 'done').length;
  const inWork = allSteps.filter((s: any) => s.status === 'in-progress').length;
  const waiting = allSteps.filter((s: any) => s.status === 'todo').length;
  const blocked = allSteps.filter((s: any) => s.status === 'blocked').length;
  const explicitBlockers = stageList.reduce((sum: number, stage: any) => sum + (stage.blockedBy ?? []).length + (stage.steps ?? []).reduce((stepSum: number, step: any) => stepSum + (step.blockedBy ?? []).length, 0), 0);
  const readiness = allSteps.length ? Math.round(done / allSteps.length * 100) : 0;
  const stepDoneDate = (step: any) => typeof step.completedAt === 'string' && step.completedAt ? step.completedAt.slice(0, 10) : '';
  const addedPeriod = allSteps.filter((step: any) => inPeriod(stepDate(step), periodRange)).length;
  const donePeriod = allSteps.filter((step: any) => step.status === 'done' && inPeriod(stepDoneDate(step), periodRange)).length;
  const inWorkPeriod = allSteps.filter((step: any) => step.status === 'in-progress' && inPeriod(stepDate(step), periodRange)).length;
  const blockedPeriod = allSteps.filter((step: any) => step.status === 'blocked' && inPeriod(stepDate(step), periodRange)).length;
  const backlogDelta = addedPeriod - donePeriod;
  const riskIndex = blocked + explicitBlockers;
  const merge = mergeStats(Array.isArray(elements) ? elements : []);
  const mergeRows = [
    { label: 'Общие', value: merge.common, className: 'common' },
    { label: 'Отдельные', value: merge.single, className: 'single' },
    { label: 'Уник.', value: merge.unique, className: 'unique' },
    { label: 'Закрыты', value: merge.locked, className: 'locked' },
    { label: 'Замен.', value: merge.merged, className: 'merged' }
  ];
  const statusRows = [
    { label: 'Готово', value: done, className: 'done' },
    { label: 'В работе', value: inWork, className: 'work' },
    { label: 'Ожидает', value: waiting, className: 'wait' },
    { label: 'Блокер', value: blocked, className: 'block' }
  ];
  const volumeMax = Math.max(1, ...statusRows.map(row => row.value));
  const mergeMax = Math.max(1, ...mergeRows.map(row => row.value));
  const hasMergeData = mergeRows.some(row => row.value > 0);
  const periodTone = backlogDelta > 0 ? 'danger' : backlogDelta < 0 ? 'good' : 'flat';
  const periodSummary = backlogDelta > 0 ? `Остаток +${backlogDelta}` : backlogDelta < 0 ? `Остаток −${Math.abs(backlogDelta)}` : 'Остаток 0';
  const trendRows = Array.from({ length: visibleTrendDays }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const iso = localIso(date);
    const added = allSteps.filter((step: any) => stepDate(step) === iso).length;
    const finished = allSteps.filter((step: any) => step.status === 'done' && stepDoneDate(step) === iso).length;
    return { iso, day: date.getDate(), added, finished };
  });
  const trendMax = Math.max(1, ...trendRows.map(day => Math.max(day.added, day.finished)));
  const kitRows = displayKits.map((kit: any) => {
    const kitStages = stageList.filter((stage: any) => stage.kitId === kit.id);
    const steps = kitStages.flatMap((stage: any) => stage.steps ?? []);
    const doneForKit = steps.filter((step: any) => step.status === 'done').length;
    const addedForKit = steps.filter((step: any) => inPeriod(stepDate(step), periodRange)).length;
    const doneForKitPeriod = steps.filter((step: any) => step.status === 'done' && inPeriod(stepDoneDate(step), periodRange)).length;
    const readinessForKit = steps.length ? Math.round(doneForKit / steps.length * 100) : 0;
    const active = steps.filter((step: any) => step.status === 'in-progress').length;
    const waiting = steps.filter((step: any) => step.status === 'todo').length;
    const directBlocked = steps.filter((step: any) => step.status === 'blocked').length;
    const blockers = blockersForKit(stageList, kit.id).length + directBlocked;
    return { id: kit.id, name: kit.name, color: kit.color?.border ?? '#60a5fa', total: steps.length, done: doneForKit, readiness: readinessForKit, active, waiting, blockers, addedPeriod: addedForKit, donePeriod: doneForKitPeriod, backlogDelta: addedForKit - doneForKitPeriod };
  }).sort((a: any, b: any) => b.total - a.total || b.blockers - a.blockers || a.name.localeCompare(b.name));
  const visibleKitIds = new Set<string>(displayKits.map((kit: any) => kit.id));
  const graphElements = normalizeElements(Array.isArray(elements) ? elements : []).filter((element: any) => element.status !== 'merged' && element.status !== 'deprecated');
  const showElementLabels = graphElements.length <= 24;
  const graphZoom = graphElements.length > 36 ? 0.74 : graphElements.length > 20 ? 0.82 : 0.92;
  const graphLinks = graphElements.flatMap((element: any) => (element.kits ?? []).filter((kitId: string) => visibleKitIds.has(kitId)).map((kitId: string) => ({ source: kitId, target: element.id, lineStyle: { color: kitColor(kitId, displayKits), opacity: 0.42, width: 1.2 } })));
  const graphOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (params: any) => params.dataType === 'edge' ? 'связь кит — элемент' : params.data?.name },
    series: [{
      type: 'graph',
      layout: 'circular',
      left: 40,
      right: 40,
      top: 24,
      bottom: 24,
      zoom: graphZoom,
      circular: { rotateLabel: false },
      roam: false,
      data: [
        ...displayKits.map((kit: any) => ({ id: kit.id, name: kit.name, category: 0, symbol: 'circle', symbolSize: 56, label: { show: true, fontWeight: 800, fontSize: 11, color: '#f8fafc' }, itemStyle: { color: kit.color?.border ?? '#60a5fa' } })),
        ...graphElements.map((element: any) => {
          const colors = (element.kits ?? []).filter((kitId: string) => visibleKitIds.has(kitId)).map((kitId: string) => kitColor(kitId, displayKits));
          return { id: element.id, name: element.name, category: element.status === 'unique' ? 2 : element.status === 'locked' ? 3 : 1, symbol: colors.length > 1 ? pieSymbol(colors) : 'circle', symbolSize: element.status === 'unique' || element.status === 'locked' ? 28 : 22, label: { show: showElementLabels, fontSize: 10, color: '#cbd5e1' }, itemStyle: { color: element.status === 'unique' ? '#ef4444' : element.status === 'locked' ? '#f97316' : colors[0] ?? '#64748b' } };
        })
      ],
      links: graphLinks,
      categories: [{ name: 'Киты' }, { name: 'Элементы' }, { name: 'Уникальные' }, { name: 'Закрыты' }],
      label: { position: 'right', formatter: (params: any) => params.name?.length > 22 ? `${params.name.slice(0, 21)}…` : params.name },
      labelLayout: { hideOverlap: true },
      lineStyle: { curveness: 0.24 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 3 } }
    }]
  };

  return <main className="screen fit-screen brand-screen">
    <section className="brand-exec-top">
      <Panel className="brand-status-card brand-status-main">
        <div className="brand-section-head"><span>Ситуация</span><b>{riskIndex ? 'Есть блокировки' : 'Под контролем'}</b></div>
        <div className="brand-readiness"><strong>{readiness}%</strong><span>{done} / {allSteps.length} шагов</span></div>
        <div className="brand-gauge" aria-label={`Готовность ${readiness}%`}><span style={{ width: `${readiness}%` }}/></div>
        <div className="brand-status-split"><em>{waiting} ожидает</em><em>{inWork} в работе</em><em>{blocked} блокер</em></div>
      </Panel>
      <Panel className="brand-status-card brand-volume-card">
        <div className="brand-section-head"><span>Объем</span><b>{allSteps.length} шагов</b></div>
        <div className="brand-volume-score"><strong>{allSteps.length}</strong><span>шагов в системе</span></div>
        <div className="brand-volume-bars compact" aria-label={`Объем: готово ${done}, в работе ${inWork}, ожидает ${waiting}, блокер ${blocked}`}>
          {statusRows.map(row => <div key={row.className} className={`brand-volume-row ${row.className}`}><b>{row.label}</b><span><i style={{ width: `${row.value / volumeMax * 100}%` }}/></span><em>{row.value}</em></div>)}
        </div>
      </Panel>
      <Panel className="brand-status-card brand-flow-card">
        <div className="brand-section-head"><span>Период</span><b>{periodLabel}</b></div>
        <div className="brand-period-facts"><span><b>{addedPeriod}</b> добавлено</span><span><b>{donePeriod}</b> закрыто</span><span><b>{inWorkPeriod}</b> в работе</span><span><b>{blockedPeriod}</b> блокер</span></div>
        <div className={`brand-delta ${periodTone}`}>{periodSummary}</div>
      </Panel>
      <Panel className="brand-status-card brand-merge-card">
        <div className="brand-section-head"><span>Консолидация</span><b>{merge.percent}% общих</b></div>
        <div className="brand-merge-score"><strong>{merge.common}</strong><span>общих элементов из {merge.eligibleTotal}</span></div>
        <div className="brand-merge-bars" aria-label={`Консолидация: общих ${merge.common}, отдельных ${merge.single}, уникальных ${merge.unique}, закрытых ${merge.locked}, замененных ${merge.merged}`}>
          {mergeRows.map(row => <div key={row.className} className={`brand-merge-row ${row.className}`}><b>{row.label}</b><span><i style={{ width: hasMergeData ? `${row.value / mergeMax * 100}%` : '0%' }}/></span><em>{row.value}</em></div>)}
        </div>
        <div className="brand-muted-line">{artifacts.length} арт. · {merge.historicalTotal} всего</div>
      </Panel>
    </section>
    <section className="brand-exec-grid">
      <Panel className="brand-graph-panel">
        <div className="brand-panel-head"><h2>Визуализация Обзора</h2><span>{graphElements.length} элементов · {graphLinks.length} связей</span></div>
        <div className="brand-graph-shell">
          {displayKits.length || graphElements.length ? <ReactECharts className="brand-overview-graph" style={{ width: '100%', height: '100%' }} option={graphOption} notMerge={true}/> : <div className="brand-empty-state">Нет элементов для обзора</div>}
        </div>
        <div className="brand-graph-legend"><span><i className="kit"/> киты</span><span><i className="element"/> элементы</span><span><i className="unique"/> уникальные</span><span><i className="locked"/> нельзя объединить</span></div>
      </Panel>
      <div className="brand-side-stack">
        <Panel className="brand-dynamics-panel">
          <div className="brand-panel-head"><h2>Динамика периода</h2><span>{periodDaysTotal > visibleTrendDays ? `последние ${visibleTrendDays} дн.` : `${periodDaysTotal} дн.`}</span></div>
          <div className="brand-flow-strip" style={{ gridTemplateColumns: `repeat(${visibleTrendDays}, minmax(10px, 1fr))` }}>
            {trendRows.map(day => <div key={day.iso} className={`brand-flow-day ${day.iso === today ? 'today' : ''}`} title={`${day.iso}: +${day.added}, ✓${day.finished}`}>
              <span className="brand-flow-bars"><i className="add" style={{ height: day.added ? `${Math.max(6, day.added / trendMax * 100)}%` : 0 }}/><i className="done" style={{ height: day.finished ? `${Math.max(6, day.finished / trendMax * 100)}%` : 0 }}/></span>
              <b>{day.day}</b>
            </div>)}
          </div>
          <div className="brand-calendar-legend"><span><i className="add"/> добавлено</span><span><i className="done"/> закрыто</span></div>
        </Panel>
        <Panel className="brand-kit-panel">
          <div className="brand-panel-head"><h2>Киты: объем и прогресс</h2><span>{displayKits.length}</span></div>
          <div className="brand-kit-table">
            {kitRows.length ? kitRows.map((row: any) => <div key={row.id} className={`brand-kit-row ${row.blockers ? 'risk' : ''}`}>
              <div className="brand-kit-name"><b>{row.name}</b><span>{row.done} / {row.total} шагов · {row.active} в работе</span></div>
              <div className="brand-kit-progress"><span style={{ width: `${row.readiness}%`, background: row.color }}/></div>
              <div className="brand-kit-numbers"><strong>{row.readiness}%</strong><em>+{row.addedPeriod}</em><em>✓{row.donePeriod}</em><em className={row.blockers ? 'danger' : ''}>{row.blockers} блок.</em></div>
            </div>) : <div className="brand-empty-state">Нет данных</div>}
          </div>
        </Panel>
      </div>
    </section>
  </main>;
}

export default function App() { const [screen, setScreen] = useState<Screen>(() => { const saved = loadStored('berega.screen', 'home'); return ['home','details','overview','artifacts','brand'].includes(saved) ? saved : 'home'; }); const [detailsKit, setDetailsKit] = useState('bereg'); const [detailsTarget, setDetailsTarget] = useState<any>(null); const [artifactList, setArtifactList] = useState<any[]>(() => loadStoredArray('berega.artifacts', initialArtifacts).filter((a: any) => !seededArtifactIds.includes(a.id))); const hydratedArtifacts = useRef(false); useEffect(() => { if (hydratedArtifacts.current) return; hydratedArtifacts.current = true; let cancelled = false; hydrateArtifactFilePayloads(artifactList).then(items => { if (!cancelled) setArtifactList(items); }); return () => { cancelled = true; }; }, []); const [elements, setElements] = useState<any[]>(() => loadStoredArray('berega.elements', initialElements)); const [kitEdits, setKitEdits] = useState<Record<string, any>>(() => loadStoredObject('berega.kitEdits', {})); const [stages, setStages] = useState<any[]>(() => stripSeededPeople(loadStoredArray('berega.stages', kitStages))); const [extraKits, setExtraKits] = useState<any[]>(() => loadStoredArray('berega.extraKits', [])); const [period, setPeriod] = useState<{from:string;to:string} | undefined>(undefined); const [history, setHistory] = useState<any[]>([]); const lastSnapshot = useRef(''); const restoring = useRef(false); const makeSnapshot = () => ({ artifactList, elements, kitEdits, stages, extraKits }); useEffect(() => { saveStored('berega.screen', screen); }, [screen]); useEffect(() => { const snap = JSON.stringify(makeSnapshot()); if (!lastSnapshot.current) { lastSnapshot.current = snap; return; } if (restoring.current) { restoring.current = false; lastSnapshot.current = snap; return; } setHistory(prev => [JSON.parse(lastSnapshot.current), ...prev].slice(0, 10)); lastSnapshot.current = snap; }, [artifactList, elements, kitEdits, stages, extraKits]); const undo = () => { const [last, ...rest] = history; if (!last) return; const currentArtifactIds = new Set(artifactList.map((a: any) => a.id)); const artifactsToRestore = (last.artifactList ?? []).filter((a: any) => !currentArtifactIds.has(a.id)); const applyLast = () => { restoring.current = true; setArtifactList(last.artifactList); setElements(last.elements); setKitEdits(last.kitEdits); if (last.stages) setStages(last.stages); if (last.extraKits) setExtraKits(last.extraKits); }; setHistory(rest); if (artifactsToRestore.length) { restoring.current = true; void Promise.all(artifactsToRestore.map((a: any) => restoreArtifactFileData(a))).finally(applyLast); return; } applyLast(); }; useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.defaultPrevented || e.key !== 'Delete' || shouldIgnoreGlobalDelete(e)) return; stopKeyboardEvent(e); undo(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [history]); useEffect(() => { let cancelled = false; persistArtifactFilesForStorage(artifactList).then(items => { if (!cancelled) saveStored('berega.artifacts', items); }); return () => { cancelled = true; }; }, [artifactList]); useEffect(() => { saveStored('berega.elements', stripElementFilePayloads(elements)); }, [elements]); useEffect(() => { saveStored('berega.kitEdits', kitEdits); }, [kitEdits]); useEffect(() => { saveStored('berega.stages', stages); }, [stages]); useEffect(() => { saveStored('berega.extraKits', extraKits); }, [extraKits]); const displayKits = visibleKits(kits, extraKits, kitEdits); const [artifactFilter, setArtifactFilter] = useState<string[]>([]); const toggleArtifactKit = (id: string) => setArtifactFilter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); const openKit = (id: string, target?: any) => { setDetailsKit(id); setDetailsTarget(target ?? null); setScreen('details'); }; const deleteArtifactEverywhere = (artifact: any) => { const id = typeof artifact === 'string' ? artifact : artifact?.id; if (!id) return; const storedArtifact = artifactList.find((a: any) => a.id === id) || artifact; void deleteArtifactFileData(storedArtifact); setArtifactList((prev: any[]) => prev.filter(a => a.id !== id)); setStages(prev => prev.map(st => ({ ...st, steps: st.steps.map((step: any) => ({ ...step, artifactIds: (step.artifactIds ?? []).filter((artifactId: string) => artifactId !== id) })) }))); }; return <div className="app"><div className="main"><TopBar screen={screen} setScreen={setScreen} artifactFilter={artifactFilter} toggleArtifactKit={toggleArtifactKit} displayKits={displayKits} setPeriod={setPeriod} canUndo={history.length > 0} undo={undo}/>{screen === 'home' && <Home openKit={openKit} displayKits={displayKits} stages={stages} period={period} elements={elements}/>}{screen === 'details' && <DetailsScreen initialKit={detailsKit} target={detailsTarget} artifactList={artifactList} setArtifactList={setArtifactList} elements={elements} setElements={setElements} kitEdits={kitEdits} setKitEdits={setKitEdits} stages={stages} setStages={setStages} extraKits={extraKits} setExtraKits={setExtraKits}/>} {screen === 'overview' && <OverviewScreen elements={elements} artifacts={artifactList} setElements={setElements} displayKits={displayKits}/>} {screen === 'artifacts' && <ArtifactsScreen artifactList={artifactList} setArtifactList={setArtifactList} artifactFilter={artifactFilter} setStages={setStages} displayKits={displayKits} onDeleteArtifact={deleteArtifactEverywhere}/>} {screen === 'brand' && <BrandScreen displayKits={displayKits} stages={stages} elements={elements} artifacts={artifactList} period={period}/>}</div></div>; }

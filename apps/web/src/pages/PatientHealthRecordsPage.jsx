import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Download, Plus, Share2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePatientHealthRecords } from '@/hooks/usePatientHealthRecords.js';

function matchesSearch(payload, term) {
	if (!term.trim()) return true;
	const t = term.toLowerCase();
	return JSON.stringify(payload || {}).toLowerCase().includes(t);
}

/** @param {{ value: string, onChange: (v: string) => void, id: string }} props */
function Field({ id, label, value, onChange, type = 'text', placeholder = '', className = '' }) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={className}
			/>
		</div>
	);
}

export default function PatientHealthRecordsPage() {
	const { currentUser } = useAuth();
	const userId = currentUser?.id;
	const hr = usePatientHealthRecords(userId);
	const [searchTerm, setSearchTerm] = useState('');

	const [dialog, setDialog] = useState({
		open: false,
		kind: /** @type {'condition'|'lab'|'allergy'|'surgery'} */ ('condition'),
		row: /** @type {null | { id: string; payload: Record<string, unknown> }} */ (null),
	});

	const [form, setForm] = useState({});
	const [deleteTarget, setDeleteTarget] = useState(/** @type {null | { kind: string; id: string }} */ (null));
	const [saving, setSaving] = useState(false);

	const openCreate = (kind) => {
		setDialog({ open: true, kind, row: null });
		if (kind === 'condition') {
			setForm({ name: '', diagnosedDate: '', status: 'Active', severity: '', managingDoctor: '', notes: '' });
		} else if (kind === 'lab') {
			setForm({ testName: '', date: '', resultSummary: '', labName: '', notes: '' });
		} else if (kind === 'allergy') {
			setForm({ allergen: '', reaction: '', severity: '', date: '', notes: '' });
		} else {
			setForm({ procedureName: '', date: '', facility: '', notes: '' });
		}
	};

	const openEdit = (kind, row) => {
		setDialog({ open: true, kind, row });
		setForm({ ...(row.payload || {}) });
	};

	const closeDialog = () => {
		setDialog((d) => ({ ...d, open: false }));
	};

	const submitDialog = async () => {
		setSaving(true);
		try {
			const payload = { ...form };
			if (dialog.row) {
				const id = dialog.row.id;
				if (dialog.kind === 'condition') await hr.updateCondition(id, payload);
				else if (dialog.kind === 'lab') await hr.updateLab(id, payload);
				else if (dialog.kind === 'allergy') await hr.updateAllergy(id, payload);
				else await hr.updateSurgery(id, payload);
				toast.success('Record updated');
			} else {
				if (dialog.kind === 'condition') await hr.insertCondition(payload);
				else if (dialog.kind === 'lab') await hr.insertLab(payload);
				else if (dialog.kind === 'allergy') await hr.insertAllergy(payload);
				else await hr.insertSurgery(payload);
				toast.success('Record added');
			}
			closeDialog();
		} catch (e) {
			toast.error(e.message || 'Save failed');
		} finally {
			setSaving(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteTarget) return;
		setSaving(true);
		try {
			const { kind, id } = deleteTarget;
			if (kind === 'condition') await hr.deleteCondition(id);
			else if (kind === 'lab') await hr.deleteLab(id);
			else if (kind === 'allergy') await hr.deleteAllergy(id);
			else await hr.deleteSurgery(id);
			toast.success('Record removed');
			setDeleteTarget(null);
		} catch (e) {
			toast.error(e.message || 'Delete failed');
		} finally {
			setSaving(false);
		}
	};

	const downloadJson = () => {
		const json = hr.exportAllJson();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `paypill-health-records-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Download started');
	};

	const shareRecords = async () => {
		const json = hr.exportAllJson();
		try {
			if (navigator.share) {
				const blob = new Blob([json], { type: 'application/json' });
				const file = new File([blob], 'paypill-health-records.json', { type: 'application/json' });
				if (navigator.canShare?.({ files: [file] })) {
					await navigator.share({ files: [file], title: 'PayPill health records' });
					return;
				}
			}
			await navigator.clipboard.writeText(json);
			toast.success('Copied JSON to clipboard');
		} catch (e) {
			if (e?.name !== 'AbortError') toast.error(e.message || 'Share failed');
		}
	};

	const filteredConditions = useMemo(
		() => hr.conditions.filter((r) => matchesSearch(r.payload, searchTerm)),
		[hr.conditions, searchTerm]
	);
	const filteredLabs = useMemo(
		() => hr.labs.filter((r) => matchesSearch(r.payload, searchTerm)),
		[hr.labs, searchTerm]
	);
	const filteredAllergies = useMemo(
		() => hr.allergies.filter((r) => matchesSearch(r.payload, searchTerm)),
		[hr.allergies, searchTerm]
	);
	const filteredSurgeries = useMemo(
		() => hr.surgeries.filter((r) => matchesSearch(r.payload, searchTerm)),
		[hr.surgeries, searchTerm]
	);

	if (!userId) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-muted-foreground">
				Sign in to manage your health records.
			</div>
		);
	}

	if (hr.loading) {
		return (
			<div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
				<Loader2 className="h-6 w-6 animate-spin" />
				<span>Loading your records…</span>
			</div>
		);
	}

	if (hr.error) {
		return (
			<Card className="max-w-3xl mx-auto border-destructive/50 p-6 text-destructive">
				{hr.error}
			</Card>
		);
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<Helmet>
				<title>Health Records - PayPill</title>
			</Helmet>

			<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Health Records</h1>
					<p className="text-muted-foreground">
						Capture your medical history for safer recommendations alongside your profile. Data is stored in your account only.
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					<Button type="button" variant="outline" className="gap-2" onClick={shareRecords}>
						<Share2 className="h-4 w-4" /> Share
					</Button>
					<Button type="button" className="gap-2" onClick={downloadJson}>
						<Download className="h-4 w-4" /> Download
					</Button>
				</div>
			</div>

			<Card className="shadow-sm border-border/50 mb-8">
				<div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
					<div className="relative w-full sm:max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search records…"
							className="pl-9 bg-background"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
					<div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
						<Button type="button" size="sm" onClick={() => openCreate('condition')}>
							<Plus className="h-4 w-4 mr-1" /> Condition
						</Button>
						<Button type="button" size="sm" variant="secondary" onClick={() => openCreate('lab')}>
							<Plus className="h-4 w-4 mr-1" /> Lab
						</Button>
						<Button type="button" size="sm" variant="secondary" onClick={() => openCreate('allergy')}>
							<Plus className="h-4 w-4 mr-1" /> Allergy
						</Button>
						<Button type="button" size="sm" variant="secondary" onClick={() => openCreate('surgery')}>
							<Plus className="h-4 w-4 mr-1" /> Surgery
						</Button>
					</div>
				</div>

				<Tabs defaultValue="conditions" className="w-full">
					<div className="px-4 pt-4 border-b overflow-x-auto">
						<TabsList className="bg-transparent h-auto p-0 flex justify-start gap-6 min-w-max">
							<TabsTrigger
								value="conditions"
								className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2"
							>
								Conditions
							</TabsTrigger>
							<TabsTrigger
								value="labs"
								className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2"
							>
								Lab results
							</TabsTrigger>
							<TabsTrigger
								value="allergies"
								className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2"
							>
								Allergies
							</TabsTrigger>
							<TabsTrigger
								value="surgeries"
								className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2"
							>
								Surgeries
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="conditions" className="p-0 m-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm text-left">
								<thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b">
									<tr>
										<th className="px-6 py-4 font-medium">Condition</th>
										<th className="px-6 py-4 font-medium">Date diagnosed</th>
										<th className="px-6 py-4 font-medium">Status</th>
										<th className="px-6 py-4 font-medium">Managing clinician</th>
										<th className="px-6 py-4 font-medium text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredConditions.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
												No conditions yet. Add one to improve your dashboard risk context.
											</td>
										</tr>
									) : (
										filteredConditions.map((r) => {
											const p = r.payload || {};
											return (
												<tr key={r.id} className="hover:bg-muted/5 transition-colors">
													<td className="px-6 py-4 font-medium">{String(p.name || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.diagnosedDate || '—')}</td>
													<td className="px-6 py-4">
														<Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400">
															{String(p.status || '—')}
														</Badge>
													</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.managingDoctor || '—')}</td>
													<td className="px-6 py-4 text-right space-x-1">
														<Button variant="ghost" size="sm" type="button" onClick={() => openEdit('condition', r)}>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget({ kind: 'condition', id: r.id })}>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</TabsContent>

					<TabsContent value="labs" className="p-0 m-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm text-left">
								<thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b">
									<tr>
										<th className="px-6 py-4 font-medium">Test</th>
										<th className="px-6 py-4 font-medium">Date</th>
										<th className="px-6 py-4 font-medium">Result</th>
										<th className="px-6 py-4 font-medium">Laboratory</th>
										<th className="px-6 py-4 font-medium text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredLabs.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
												No lab results stored yet.
											</td>
										</tr>
									) : (
										filteredLabs.map((r) => {
											const p = r.payload || {};
											const ok = String(p.resultSummary || '').toLowerCase().includes('normal');
											return (
												<tr key={r.id} className="hover:bg-muted/5 transition-colors">
													<td className="px-6 py-4 font-medium">{String(p.testName || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.date || '—')}</td>
													<td className="px-6 py-4">
														<Badge
															variant="outline"
															className={
																ok
																	? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
																	: 'bg-orange-500/10 text-orange-700 border-orange-500/20'
															}
														>
															{String(p.resultSummary || '—')}
														</Badge>
													</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.labName || '—')}</td>
													<td className="px-6 py-4 text-right space-x-1">
														<Button variant="ghost" size="sm" type="button" onClick={() => openEdit('lab', r)}>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget({ kind: 'lab', id: r.id })}>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</TabsContent>

					<TabsContent value="allergies" className="p-0 m-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm text-left">
								<thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b">
									<tr>
										<th className="px-6 py-4 font-medium">Allergen</th>
										<th className="px-6 py-4 font-medium">Reaction</th>
										<th className="px-6 py-4 font-medium">Severity</th>
										<th className="px-6 py-4 font-medium">Date</th>
										<th className="px-6 py-4 font-medium text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredAllergies.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
												No allergies recorded.
											</td>
										</tr>
									) : (
										filteredAllergies.map((r) => {
											const p = r.payload || {};
											return (
												<tr key={r.id} className="hover:bg-muted/5 transition-colors">
													<td className="px-6 py-4 font-medium">{String(p.allergen || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.reaction || '—')}</td>
													<td className="px-6 py-4">{String(p.severity || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.date || '—')}</td>
													<td className="px-6 py-4 text-right space-x-1">
														<Button variant="ghost" size="sm" type="button" onClick={() => openEdit('allergy', r)}>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget({ kind: 'allergy', id: r.id })}>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</TabsContent>

					<TabsContent value="surgeries" className="p-0 m-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm text-left">
								<thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b">
									<tr>
										<th className="px-6 py-4 font-medium">Procedure</th>
										<th className="px-6 py-4 font-medium">Date</th>
										<th className="px-6 py-4 font-medium">Facility</th>
										<th className="px-6 py-4 font-medium text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredSurgeries.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
												No procedures recorded.
											</td>
										</tr>
									) : (
										filteredSurgeries.map((r) => {
											const p = r.payload || {};
											return (
												<tr key={r.id} className="hover:bg-muted/5 transition-colors">
													<td className="px-6 py-4 font-medium">{String(p.procedureName || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.date || '—')}</td>
													<td className="px-6 py-4 text-muted-foreground">{String(p.facility || '—')}</td>
													<td className="px-6 py-4 text-right space-x-1">
														<Button variant="ghost" size="sm" type="button" onClick={() => openEdit('surgery', r)}>
															<Pencil className="h-4 w-4" />
														</Button>
														<Button variant="ghost" size="sm" type="button" onClick={() => setDeleteTarget({ kind: 'surgery', id: r.id })}>
															<Trash2 className="h-4 w-4 text-destructive" />
														</Button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</TabsContent>
				</Tabs>
			</Card>

			<Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
				<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{dialog.row ? 'Edit' : 'Add'}{' '}
							{dialog.kind === 'condition'
								? 'condition'
								: dialog.kind === 'lab'
									? 'lab result'
									: dialog.kind === 'allergy'
										? 'allergy'
										: 'procedure'}
						</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						{dialog.kind === 'condition' ? (
							<>
								<Field id="c-name" label="Condition name" value={form.name || ''} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
								<Field
									id="c-date"
									label="Date diagnosed"
									type="date"
									value={form.diagnosedDate || ''}
									onChange={(v) => setForm((f) => ({ ...f, diagnosedDate: v }))}
								/>
								<div className="space-y-2">
									<Label htmlFor="c-status">Status</Label>
									<select
										id="c-status"
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										value={form.status || 'Active'}
										onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
									>
										<option value="Active">Active</option>
										<option value="Resolved">Resolved</option>
										<option value="In remission">In remission</option>
									</select>
								</div>
								<Field id="c-sev" label="Severity (optional)" value={form.severity || ''} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} />
								<Field
									id="c-doc"
									label="Managing clinician (optional)"
									value={form.managingDoctor || ''}
									onChange={(v) => setForm((f) => ({ ...f, managingDoctor: v }))}
								/>
								<Field id="c-notes" label="Notes (optional)" value={form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
							</>
						) : null}
						{dialog.kind === 'lab' ? (
							<>
								<Field id="l-test" label="Test name" value={form.testName || ''} onChange={(v) => setForm((f) => ({ ...f, testName: v }))} />
								<Field id="l-date" label="Date" type="date" value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
								<Field id="l-res" label="Result summary" value={form.resultSummary || ''} onChange={(v) => setForm((f) => ({ ...f, resultSummary: v }))} />
								<Field id="l-lab" label="Laboratory" value={form.labName || ''} onChange={(v) => setForm((f) => ({ ...f, labName: v }))} />
								<Field id="l-notes" label="Notes (optional)" value={form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
							</>
						) : null}
						{dialog.kind === 'allergy' ? (
							<>
								<Field id="a-alg" label="Allergen" value={form.allergen || ''} onChange={(v) => setForm((f) => ({ ...f, allergen: v }))} />
								<Field id="a-react" label="Reaction" value={form.reaction || ''} onChange={(v) => setForm((f) => ({ ...f, reaction: v }))} />
								<Field id="a-sev" label="Severity" value={form.severity || ''} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} />
								<Field id="a-date" label="Date (optional)" type="date" value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
								<Field id="a-notes" label="Notes (optional)" value={form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
							</>
						) : null}
						{dialog.kind === 'surgery' ? (
							<>
								<Field id="s-name" label="Procedure" value={form.procedureName || ''} onChange={(v) => setForm((f) => ({ ...f, procedureName: v }))} />
								<Field id="s-date" label="Date" type="date" value={form.date || ''} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
								<Field id="s-fac" label="Facility (optional)" value={form.facility || ''} onChange={(v) => setForm((f) => ({ ...f, facility: v }))} />
								<Field id="s-notes" label="Notes (optional)" value={form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
							</>
						) : null}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={closeDialog}>
							Cancel
						</Button>
						<Button type="button" onClick={submitDialog} disabled={saving}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this record?</AlertDialogTitle>
						<AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Tag } from 'lucide-react';
import api from '@/lib/api';
import { Modal, Button, Input, Badge, Spinner, ConfirmModal, useToast, EmptyState } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function CategoryModal({ open, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState({ categories: [], uncategorizedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {if (open) load(); /* eslint-disable-next-line */}, [open]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await api.post('/categories', { name });
      setNewName('');
      await load();
      onChanged?.();
      toast.success(`"${name}" ban gayi`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id) {
    const name = editName.trim();
    if (!name) return;
    try {
      await api.put(`/categories/${id}`, { name });
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await api.delete(`/categories/${confirmDelete._id}`);
      toast.success(res.message);
      setConfirmDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="md"
        title={t('Categories')}
        description={t('Items ko group karne ke liye')}
        footer={<Button variant="secondary" onClick={onClose}>{t('Band karein')}</Button>}>
        
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <Input
              label={t('Nayi category')}
              placeholder={t('Bearings')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {if (e.key === 'Enter') {e.preventDefault();add();}}} />
            
            <Button icon={Plus} onClick={add} loading={adding}>{t('Add')}</Button>
          </div>

          {loading ?
          <div className="flex justify-center py-8 text-slate-400"><Spinner /></div> :
          !data.categories.length ?
          <EmptyState
            icon={Tag}
            title={t('Koi category nahi')}
            message={t('Bearings, Chains, Plugs — jaise apne maal ke hisaab se bana lein.')} /> :


          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {data.categories.map((c) =>
            <li key={c._id} className="flex items-center gap-2 px-3 py-2.5">
                  {editingId === c._id ?
              <>
                      <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {if (e.key === 'Enter') saveEdit(c._id);}}
                  autoFocus
                  className="h-9 flex-1 rounded-lg border border-slate-300 px-2 text-sm focus-ring" />
                
                      <button onClick={() => saveEdit(c._id)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100">
                        <X size={16} />
                      </button>
                    </> :

              <>
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">{c.name}</span>
                      <Badge>{t("{a0} item", { a0: c.itemCount })}</Badge>
                      <button
                  onClick={() => {setEditingId(c._id);setEditName(c.name);}}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={t('Naam badlein')}>
                  
                        <Pencil size={15} />
                      </button>
                      <button
                  onClick={() => setConfirmDelete(c)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={t('Hatayein')}>
                  
                        <Trash2 size={15} />
                      </button>
                    </>
              }
                </li>
            )}
            </ul>
          }

          {data.uncategorizedCount > 0 &&
          <p className="text-xs text-slate-500">{t("{a0} item bina category ke hain.", { a0:
              data.uncategorizedCount })}
          </p>
          }
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        loading={busy}
        title={`"${confirmDelete?.name}" hatayein?`}
        message={
        confirmDelete?.itemCount ?
        `Iske ${confirmDelete.itemCount} item delete NAHI honge — wo "bina category" me chale jayenge.` :
        'Ye category hat jayegi.'
        }
        confirmLabel={t("Haan, hatayein")} />
      
    </>);

}

import { useEffect, useRef, useState } from 'react';
import { createImageMarkdown, uploadImage, validateImage } from '../services/images';

export default function ImageUploadDialog({ onInsert, onClose }) {
  const dialog = useRef(null);
  const controller = useRef(null);
  const active = useRef(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    active.current = true;
    const element = dialog.current;
    element.showModal();
    return () => {
      active.current = false;
      controller.current?.abort();
      element.close();
    };
  }, []);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function close() {
    active.current = false;
    controller.current?.abort();
    onClose();
  }

  function chooseFile(event) {
    const selected = event.target.files?.[0];
    setError('');
    setFile(null);
    if (!selected) return;
    try { validateImage(selected); setFile(selected); }
    catch (err) { setError(err.message); event.target.value = ''; }
  }

  async function submit(event) {
    event.preventDefault();
    if (controller.current || !file || !alt.trim()) return;
    const request = new AbortController();
    controller.current = request;
    setUploading(true);
    setError('');
    try {
      const image = await uploadImage(file, { signal: request.signal });
      if (active.current && !request.signal.aborted) {
        onInsert(createImageMarkdown(image.displayUrl, alt, caption));
      }
    } catch (err) {
      if (active.current && !request.signal.aborted) {
        setError(err.message || 'Upload failed. Please try again.');
      }
    } finally {
      controller.current = null;
      if (active.current) setUploading(false);
    }
  }

  const inputClass = 'mt-1 block w-full rounded-lg border border-border bg-transparent p-2 text-sm dark:border-gray-700';
  return (
    <dialog ref={dialog} aria-labelledby="image-dialog-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      className="m-auto max-h-[90vh] w-[min(94vw,32rem)] overflow-y-auto rounded-xl border border-border bg-white p-6 text-ink shadow-xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="image-dialog-title" className="text-xl font-semibold">Add image</h2>
        <p id="image-file-help" className="text-sm text-muted dark:text-gray-400">Choose a PNG, JPEG or WebP image up to 5 MB.</p>
        <label className="block text-sm font-medium">Image file
          <input autoFocus type="file" accept="image/png,image/jpeg,image/webp" required disabled={uploading}
            aria-describedby="image-file-help" onChange={chooseFile} className={inputClass} />
        </label>
        {preview && <img src={preview} alt="Selected image preview" className="mx-auto max-h-48 max-w-full rounded bg-white object-contain" />}
        <label className="block text-sm font-medium">Image description (alt text)
          <input required value={alt} maxLength={500} disabled={uploading} onChange={(event) => setAlt(event.target.value)}
            placeholder="Example: Stack with push and pop arrows at the top" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">Caption (optional)
          <input value={caption} maxLength={1000} disabled={uploading} onChange={(event) => setCaption(event.target.value)} className={inputClass} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
        <p role="status" aria-live="polite" className="text-sm text-muted dark:text-gray-400">
          {uploading ? 'Uploading image…' : 'After inserting, save the topic to keep your changes.'}
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-lg border border-border px-4 py-2 dark:border-gray-700">Cancel</button>
          <button type="submit" disabled={uploading || !file || !alt.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-50 dark:bg-emerald-600">
            {uploading ? 'Uploading…' : 'Upload and insert'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

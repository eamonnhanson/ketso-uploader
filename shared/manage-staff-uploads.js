(() => {
  const token = sessionStorage.getItem('ketso_staff_session');
  if (!token) { location.replace('/?programme=staff'); return; }
  const $ = id => document.getElementById(id);
  let uploads = [], collections = [], selected, loadController;
  async function api(path, options = {}) {
    const response = await fetch('/api/staff-managed-uploads' + path, { ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    if (response.status === 401) { sessionStorage.removeItem('ketso_staff_session'); location.replace('/?programme=staff'); throw Error('Please sign in again.'); }
    const data = await response.json();
    if (!response.ok || !data.ok) throw Error(data.error || 'Request failed. Please try again.');
    return data;
  }
  async function load() {
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    $('message').textContent = 'Loading uploads…';
    try {
      const query = new URLSearchParams({ collection: $('collection').value, status: $('status').value, search: $('search').value, date_from: $('from').value, date_to: $('to').value });
      const data = await api('?' + query, { signal: controller.signal });
      if (loadController !== controller) return;
      uploads = data.uploads; collections = data.collections;
      const current = $('collection').value;
      $('collection').querySelectorAll('[data-project]').forEach(option => option.remove());
      for (const collection of collections) { const option = new Option(collection.name, collection.id); option.dataset.project = '1'; $('collection').add(option); }
      $('collection').value = current;
      $('grid').replaceChildren();
      for (const upload of uploads) {
        const button = document.createElement('button');
        if (upload.file_type !== 'video') { const img = document.createElement('img'); img.src = upload.cropped_file_url || upload.original_file_url; img.alt = upload.caption || 'Staff upload'; img.loading = 'lazy'; button.append(img); }
        const caption = document.createElement('p'); caption.textContent = upload.caption || `Upload ${upload.id}`; button.append(caption);
        button.addEventListener('click', () => edit(upload)); $('grid').append(button);
      }
      $('message').textContent = uploads.length ? `${uploads.length} uploads` : 'No uploads in this view. Try Unassigned, All collections, or a different status.';
    } catch (error) {
      if (error.name !== 'AbortError' && loadController === controller) $('message').textContent = error.message;
    }
  }
  function edit(upload) {
    selected = upload;
    const media = document.createElement(upload.file_type === 'video' ? 'video' : 'img');
    media.src = upload.cropped_file_url || upload.original_file_url; media.alt = upload.caption || 'Upload';
    if (upload.file_type === 'video') media.controls = true;
    $('media').replaceChildren(media);
    $('uploaded').textContent = `Uploaded: ${new Date(upload.created_at_utc).toLocaleString()}`;
    $('caption').value = upload.caption || ''; $('location').value = upload.location || '';
    $('taken').value = upload.date_taken || ''; $('tags').value = (upload.tags || []).join('\n'); $('edit-status').value = upload.status;
    $('memberships').querySelectorAll('label').forEach(label => label.remove());
    for (const collection of collections) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.value = collection.id; input.checked = upload.collections.includes(collection.id);
      label.append(input, document.createTextNode(' ' + collection.name)); $('memberships').append(label);
    }
    $('edit-message').textContent = ''; $('editor').showModal();
  }
  $('filters').onsubmit = event => { event.preventDefault(); load(); };
  for (const id of ['collection', 'status', 'from', 'to']) $(id).onchange = load;
  $('cancel').onclick = () => $('editor').close();
  $('logout').onclick = () => { sessionStorage.removeItem('ketso_staff_session'); location.replace('/'); };
  $('edit-form').onsubmit = async event => {
    event.preventDefault(); $('save').disabled = true; $('cancel').disabled = true;
    try {
      await api('/' + selected.id, { method: 'PATCH', body: JSON.stringify({ caption: $('caption').value, location: $('location').value, date_taken: $('taken').value || null,
        tags: $('tags').value.split('\n').map(tag => tag.trim()).filter(Boolean), status: $('edit-status').value,
        collections: [...$('memberships').querySelectorAll('input:checked')].map(input => input.value) }) });
      $('editor').close(); await load(); $('message').textContent = 'Changes saved. ' + $('message').textContent;
    } catch (error) { $('edit-message').textContent = error.message; }
    finally { $('save').disabled = false; $('cancel').disabled = false; }
  };
  load();
})();

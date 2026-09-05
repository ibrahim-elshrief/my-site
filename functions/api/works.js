// ==============================================
// API خاص بجدول الأعمال (works) — بورتفوليو
// المسار: /api/works
// ==============================================

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method === 'GET') {
      return await listWorks(env);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      return await createWork(body, env);
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      return await updateWork(body, env);
    }

    if (request.method === 'DELETE') {
      const body = await request.json();
      return await deleteWork(body, env);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ==== عرض كل الأعمال ====
async function listWorks(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM works ORDER BY created_at DESC'
  ).all();

  return jsonResponse({ success: true, data: results });
}

// ==== إضافة عمل جديد (مع رفع الملف على Google Drive) ====
async function createWork(body, env) {
  var fileUrl = null;

  // لو فيه ملف مرفق، ابعته لـ Google Apps Script علشان يترفع على Drive
  if (body.fileData) {
    const uploadResult = await uploadToDrive(body.fileData, body.fileName, body.mimeType, env);
    if (!uploadResult.success) {
      return jsonResponse({ success: false, error: 'فشل رفع الملف: ' + uploadResult.error });
    }
    fileUrl = uploadResult.url;
  }

  const result = await env.DB.prepare(
    `INSERT INTO works (title, description, category, file_url, thumbnail_url)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    body.title,
    body.description || null,
    body.category || null,
    fileUrl,
    body.thumbnail_url || null
  ).run();

  return jsonResponse({ success: true, id: result.meta.last_row_id });
}

// ==== تعديل عمل موجود ====
async function updateWork(body, env) {
  var fileUrl = body.file_url || null;

  // لو المستخدم رفع ملف جديد بدل القديم
  if (body.fileData) {
    const uploadResult = await uploadToDrive(body.fileData, body.fileName, body.mimeType, env);
    if (!uploadResult.success) {
      return jsonResponse({ success: false, error: 'فشل رفع الملف: ' + uploadResult.error });
    }
    fileUrl = uploadResult.url;
  }

  await env.DB.prepare(
    `UPDATE works
     SET title = ?, description = ?, category = ?, file_url = ?, thumbnail_url = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    body.title,
    body.description || null,
    body.category || null,
    fileUrl,
    body.thumbnail_url || null,
    body.id
  ).run();

  return jsonResponse({ success: true });
}

// ==== حذف عمل ====
async function deleteWork(body, env) {
  await env.DB.prepare('DELETE FROM works WHERE id = ?').bind(body.id).run();
  return jsonResponse({ success: true });
}

// ==== رفع ملف على Google Drive عن طريق Apps Script ====
async function uploadToDrive(fileData, fileName, mimeType, env) {
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: env.APPS_SCRIPT_KEY,
      action: 'upload',
      fileData: fileData,
      fileName: fileName,
      mimeType: mimeType
    })
  });

  return await response.json();
}

// ==== دالة مساعدة لإرجاع رد JSON ====
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}

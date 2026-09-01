/* Meridian UI — the two places the app touches a file.

   Neither is a network request: a file the owner chose is read from disk
   through the File API, and the export is handed to the browser as a blob it
   already holds. Nothing here fetches anything, which is what makes the app
   work from file:// with the machine offline.

   Kept out of src/core deliberately — this is the only module in the data path
   that needs a document. */
(function () {
  'use strict';

  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  /* SheetJS wants an ArrayBuffer. `file.arrayBuffer()` exists in both target
     browsers; FileReader is the fallback for anything older, and costs four
     lines. */
  function readFile(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, prompt_reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { prompt_reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  function isWorkbook(file) {
    return !!file && /\.xlsx$/i.test(file.name || '');
  }

  /* An <input type="file"> created, clicked and thrown away, so no hidden input
     sits in the layout where the responsive auditor has to reason about it. */
  function pickFile(onFile) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (input.parentNode) input.parentNode.removeChild(input);
      if (file) onFile(file);
    });
    document.body.appendChild(input);
    input.click();
  }

  /* Blob + object URL + a real anchor, rather than XLSX.writeFile: the same
     bytes then feed the download and the export bookkeeping, and the filename
     is ours. Revoked on a later tick — revoking in the same tick cancels the
     download in Firefox. */
  function download(bytes, filename) {
    var blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  /* QUALITY-BAR §3: a long operation shows a busy state inside the same UI
     within 100 ms. Parsing a workbook is synchronous and blocks paint, so the
     work waits for the frame that paints "Working…" before it starts. */
  function afterPaint(work) {
    requestAnimationFrame(function () {
      setTimeout(work, 0);
    });
  }

  ui.io = {
    readFile: readFile,
    isWorkbook: isWorkbook,
    pickFile: pickFile,
    download: download,
    afterPaint: afterPaint
  };
})();
